'use server';

import { GoogleGenerativeAI } from '@google/generative-ai';
import prisma from '@/lib/prisma'; // Your prisma client
import { auth } from '@/auth'; // Your auth (NextAuth/Auth.js)
import { v4 as uuidv4 } from 'uuid';

// Pricing constants (Approx KRW per token for Flash models)
const COST_PER_INPUT_TOKEN = 0.00015;
const COST_PER_OUTPUT_TOKEN = 0.0006;
const DAILY_BUDGET_KRW = 1000000; // 개발용 임시 해제 (기존 5000)
const USER_DAILY_LIMIT = 9999;    // 개발용 임시 해제 (기존 10)

export type GeminiParsedRow = {
    memberName: string;
    scores: number[];
};

async function getKstDate() {
    return new Date(new Date().getTime() + 9 * 60 * 60 * 1000).toISOString().split('T')[0];
}

function extractJson(text: string): string {
    let cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    // Try to find the JSON object or array
    const startIdxObj = cleanText.indexOf('{');
    const startIdxArr = cleanText.indexOf('[');

    let startIdx = -1;
    let endIdx = -1;

    // Determine if it starts with { or [
    if (startIdxObj !== -1 && (startIdxArr === -1 || startIdxObj < startIdxArr)) {
        startIdx = startIdxObj;
        endIdx = cleanText.lastIndexOf('}');
    } else if (startIdxArr !== -1) {
        startIdx = startIdxArr;
        endIdx = cleanText.lastIndexOf(']');
    }

    if (startIdx !== -1 && endIdx !== -1) {
        return cleanText.slice(startIdx, endIdx + 1);
    }
    return cleanText;
}

// ... existing code ...

export async function analyzeLeagueRoundExcelWithGemini(
    excelData: any[],
    gameCount: number = 3
): Promise<{ success: boolean; data?: any[]; message?: string; errorType?: 'QUOTA' | 'GENERAL' }> {
    console.log(`Starting analyzeLeagueRoundExcelWithGemini (Pure extraction mode) for ${gameCount} games...`);

    try {
        const session = await auth();
        if (!session?.user?.id) return { success: false, message: "로그인이 필요합니다." };

        const apiKey = process.env.GOOGLE_API_KEY;
        if (!apiKey) return { success: false, message: "API Key 설정 오류" };

        const kstDate = await getKstDate();
        const hasQuota = await checkUserAiQuota(session.user.id, kstDate);
        if (!hasQuota) return { success: false, message: "오늘 무료 사용 횟수를 초과했습니다.", errorType: 'QUOTA' };

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" }); // Using newer model for better accuracy

        const prompt = `
            Task: Extract bowling scores from an Excel grid into a standardized JSON format.
            Tournament Type: ${gameCount}-Game Match (range 1-5).
            Focus: Extract Lane numbers, Row index (Slot), and exactly ${gameCount} individual Game scores.

            INPUT EXCEL DATA (2D Array - Grid View):
            ${JSON.stringify(excelData.slice(0, 500))}

            INSTRUCTIONS:
            1. **Identify Lane Sections**: 
               - Look for "Lane X", "레인 X", "No. X", or just a number "X" in the first column or header that identifies a lane group.
            2. **Identify Game Columns**: 
               - Look for headers like "1", "2", ... "${gameCount}" OR "1G", "2G", ... "${gameCount}G".
            3. **Extract Scores per Row (RESET BY LANE)**:
               - IMPORTANT: The "slot" represents the sequence (1, 2, 3...) within a specific Lane section.
               - **ALWAYS reset "slot" to 1** when a new Lane section begins.
               - For each player row:
                 - "lane": The lane number/name this player is assigned to.
                 - "slot": The local sequence number (1, 2, 3...) within that lane.
                 - "games": An array containing exactly ${gameCount} numbers [G1, G2, ... G${gameCount}].
            4. **Data Cleaning**:
               - Maximize Value: If a cell has "191/205", take 205.
               - Ignore Totals/Sums/Averages. Only take the individual game scores (1G to ${gameCount}G).
               - Scores must be 0-300.
               - DO NOT attempt to find player names or IDs. Just Lane, Slot, and Games.

            CRITICAL OUTPUT RULES:
            - **RETURN ONLY** THE JSON ARRAY BELOW. NO MARKDOWN. NO COMMENTS.
            - ENSURE THE OUTPUT IS A VALID JSON ARRAY.

            RETURN FORMAT EXAMPLE (Assume 3 games):
            [
               { "lane": 1, "slot": 1, "games": [150, 160, 170] },
               { "lane": 1, "slot": 2, "games": [140, 155, 130] }
            ]
            (For your response, use exactly ${gameCount} elements in the "games" array)
        `;

        console.log("Analyzing with Gemini model...");
        const result = await model.generateContent(prompt);
        console.log("Gemini API request completed.");

        const response = await result.response;
        const text = response.text();
        console.log("Gemini Raw Response (First 100 chars):", text.substring(0, 100));

        // 3. Track Global & User Usage
        const usageMetadata = result.response.usageMetadata;
        const inputTokens = usageMetadata?.promptTokenCount || 0;
        const outputTokens = usageMetadata?.candidatesTokenCount || 0;
        await incrementUserAiUsage(session.user.id, kstDate, inputTokens, outputTokens);

        const jsonString = extractJson(text);

        try {
            const parsed = JSON.parse(jsonString);
            // We want the raw array for the two-phase mapping
            const rawArray = Array.isArray(parsed) ? parsed : (parsed.raw || parsed.data || []);
            return { success: true, data: rawArray };
        } catch (parseError) {
            console.error("JSON Parse Error:", parseError);
            return { success: false, message: "AI응답 형식이 올바르지 않습니다. (JSON Parse Error)" };
        }

    } catch (error: any) {
        console.error("League Round AI Error:", error);
        return { success: false, message: error.message };
    }
}

async function checkUserAiQuota(userId: string, date: string): Promise<boolean> {
    const usage = await prisma.userApiUsage.upsert({
        where: { userId_date: { userId, date } },
        update: {},
        create: { userId, date, count: 0, id: uuidv4(), updatedAt: new Date() },
    });

    // Global check
    const globalUsage = await prisma.apiUsage.upsert({
        where: { date },
        update: {},
        create: { date, count: 0, inputTokens: 0, outputTokens: 0, cost: 0, updatedAt: new Date() },
    });

    if (usage.count >= USER_DAILY_LIMIT) return false;
    if (globalUsage.cost >= DAILY_BUDGET_KRW) return false;

    return true;
}

async function incrementUserAiUsage(userId: string, date: string, inputTokens = 0, outputTokens = 0) {
    const cost = (inputTokens * COST_PER_INPUT_TOKEN) + (outputTokens * COST_PER_OUTPUT_TOKEN);

    await prisma.$transaction([
        prisma.userApiUsage.upsert({
            where: { userId_date: { userId, date } },
            update: { count: { increment: 1 }, updatedAt: new Date() },
            create: { userId, date, count: 1, id: uuidv4(), updatedAt: new Date() },
        }),
        prisma.apiUsage.upsert({
            where: { date },
            update: {
                count: { increment: 1 },
                inputTokens: { increment: inputTokens },
                outputTokens: { increment: outputTokens },
                cost: { increment: cost },
                updatedAt: new Date()
            },
            create: {
                date,
                count: 1,
                inputTokens,
                outputTokens,
                cost,
                updatedAt: new Date()
            }
        })
    ]);
}

export async function analyzeScoreboardWithGemini(
    formData: FormData
): Promise<{ success: boolean; data?: GeminiParsedRow[]; message?: string; errorType?: 'QUOTA' | 'GENERAL' }> {
    console.log("Starting analyzeScoreboardWithGemini...");

    try {
        const session = await auth();
        if (!session?.user?.id) {
            return { success: false, message: "로그인이 필요합니다." };
        }

        const apiKey = process.env.GOOGLE_API_KEY;
        if (!apiKey) {
            return {
                success: false,
                message: "API Key 설정이 되지 않았습니다. 서버를 재기동(restart) 해주세요."
            };
        }

        const kstDate = await getKstDate();

        // 1. Check Global Daily Budget
        const globalUsage = await prisma.apiUsage.findUnique({
            where: { date: kstDate }
        });

        if (globalUsage && globalUsage.cost >= DAILY_BUDGET_KRW) {
            return {
                success: false,
                message: "금일 전체 AI 사용 예산을 초과했습니다. 내일 다시 시도해주세요.",
                errorType: 'QUOTA'
            };
        }

        // 2. Check Per-User Quota
        const hasQuota = await checkUserAiQuota(session.user.id, kstDate);
        if (!hasQuota) {
            return {
                success: false,
                message: `오늘 무료 분석 횟수(${USER_DAILY_LIMIT}회)를 모두 사용했습니다. 내일 다시 시도해주세요.`,
                errorType: 'QUOTA'
            };
        }

        const file = formData.get('image') as File;
        const knownMembersStr = formData.get('knownMembers') as string;

        if (!file) {
            return { success: false, message: "이미지 파일이 없습니다." };
        }

        const knownMembers = knownMembersStr ? JSON.parse(knownMembersStr) : [];
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const base64Data = buffer.toString('base64');
        const mimeType = file.type || 'image/jpeg';

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        const prompt = `
      Analyze this bowling scoreboard image.
      Task: Extract member names and their bowling scores (0-300).
      
      CONTEXT:
      - This is a bowling score sheet.
      - Rows contain names and a series of scores.
      - Handwriting might be messy.
      - Grid lines might vary.

      KNOWN MEMBERS (for fuzzy matching):
      ${JSON.stringify(knownMembers)}
      
      INSTRUCTIONS:
      1. Identify each row that represents a player.
      2. Extract the player's name. Focus EXCLUSIVELY on Korean characters. 
         - CRITICAL: Ignore any English alphabets (e.g., A, B, C used as score segment separators) or annotations. 
         - Match it against the 'KNOWN MEMBERS' list if it looks similar. Use the exact name from the list if matched.
      3. Extract all valid score numbers for that player. Ignore totals or averages.
         - CRITICAL: If a score cell contains two numbers separated by a slash (e.g., '191/205'), you MUST take only the HIGHER number (e.g., 205). This is very important.
      4. If a name cannot be read or is not Korean, use "Unknown".
      5. Return strictly a JSON array. No markdown formatting.

      OUTPUT FORMAT (JSON Array):
      [
        { "memberName": "Target Name", "scores": [150, 180, 200] },
        ...
      ]
    `;

        const result = await model.generateContent([
            prompt,
            {
                inlineData: {
                    data: base64Data,
                    mimeType: mimeType,
                },
            },
        ]);

        const response = await result.response;

        // 3. Track Global & User Usage
        const usageMetadata = result.response.usageMetadata;
        const inputTokens = usageMetadata?.promptTokenCount || 0;
        const outputTokens = usageMetadata?.candidatesTokenCount || 0;
        await incrementUserAiUsage(session.user.id, kstDate, inputTokens, outputTokens);

        const text = response.text();
        const jsonString = extractJson(text);
        const parsedData = JSON.parse(jsonString);

        return { success: true, data: parsedData };
    } catch (error: any) {
        console.error("Gemini Analysis Error:", error);
        if (error.message?.includes('429') || error.message?.includes('RESOURCE_EXHAUSTED')) {
            return {
                success: false,
                message: "서비스 할당량을 초과했습니다. 잠시 후 다시 시도해주세요.",
                errorType: 'QUOTA'
            };
        }
        return { success: false, message: error.message || "Failed to analyze image with AI." };
    }
}

export async function analyzeExcelWithGemini(
    excelData: any[]
): Promise<{ success: boolean; data?: (GeminiParsedRow & { gameDate?: string; memo?: string })[]; message?: string; errorType?: 'QUOTA' | 'GENERAL' }> {
    console.log("Starting analyzeExcelWithGemini with rows:", excelData?.length);

    try {
        const session = await auth();
        if (!session?.user?.id) {
            return { success: false, message: "로그인이 필요합니다." };
        }

        const apiKey = process.env.GOOGLE_API_KEY;
        if (!apiKey) {
            return {
                success: false,
                message: "API Key 설정이 되지 않았습니다. 서버를 재기동(restart) 해주세요."
            };
        }

        const kstDate = await getKstDate();

        // 1. Check Global Daily Budget
        const globalUsage = await prisma.apiUsage.findUnique({
            where: { date: kstDate }
        });

        if (globalUsage && globalUsage.cost >= DAILY_BUDGET_KRW) {
            return {
                success: false,
                message: "금일 전체 AI 사용 예산을 초과했습니다.",
                errorType: 'QUOTA'
            };
        }

        // 2. Check Per-User Quota
        const hasQuota = await checkUserAiQuota(session.user.id, kstDate);
        if (!hasQuota) {
            return {
                success: false,
                message: `오늘 무료 분석 횟수(${USER_DAILY_LIMIT}회)를 모두 사용했습니다. 내일 다시 시도해주세요.`,
                errorType: 'QUOTA'
            };
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        const prompt = `
            Analyze this raw JSON data extracted from an Excel file for professional bowling scores.
            Task: Standardize the data into a list of players, their scores, and potentially the date of the games.

            INPUT DATA:
            ${JSON.stringify(excelData.slice(0, 100))} (Only showing first 100 rows for brevity)

            INSTRUCTIONS:
            1. Identify columns for Name, Date (if any), Scores, and Memo.
            2. For each row representing a score entry:
               - memberName: The player's name.
               - scores: An array of numbers (0-300).
               - gameDate: The date in YYYY-MM-DD format. If multiple dates exist in the file, map them accordingly. If no date is found in a specific row, omit it (it will use the default).
               - memo: Any text that looks like a note for that entry.
            3. **Extract Scores per Row (RESET BY LANE)**:
               - IMPORTANT: The "slot" represents the sequence (1, 2, 3...) within a specific Lane section.
               - **ALWAYS reset "slot" to 1** when a new Lane section begins.
               - DO NOT use global rank numbers (e.g., 7, 8, 9) if they appear in the sheet.
               - For each row that contains a player's scores:
                 - "lane": The lane number/name this player is assigned to.
                 - "slot": The local sequence number (1, 2, 3...) within that lane.
                 - "games": An array of numbers (Game 1, 2, ...).
            4. Some Excel files might have dates in a header row or a separate column. Use your intelligence to associate the correct date with each score.
            5. If a score cell contains two numbers separated by a slash (e.g., '191/205'), you MUST take only the HIGHER number (e.g., 205).
            6. Return strictly a JSON array. No markdown formatting or preamble text.

            OUTPUT FORMAT (JSON Array):
            [
              { "memberName": "Name", "scores": [180, 210, 195], "gameDate": "2024-05-15", "memo": "Note here" },
              ...
            ]
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        // 3. Track Global & User Usage
        const usageMetadata = result.response.usageMetadata;
        const inputTokens = usageMetadata?.promptTokenCount || 0;
        const outputTokens = usageMetadata?.candidatesTokenCount || 0;
        await incrementUserAiUsage(session.user.id, kstDate, inputTokens, outputTokens);

        const jsonString = extractJson(text);
        const parsedData = JSON.parse(jsonString);

        return { success: true, data: parsedData };
    } catch (error: any) {
        console.error("Excel AI Analysis Error:", error);
        return { success: false, message: error.message || "Failed to analyze Excel data with AI." };
    }
}
