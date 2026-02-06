'use server';

import { GoogleGenerativeAI } from '@google/generative-ai';
import prisma from '@/lib/prisma'; // Import prisma
import { auth } from '@/auth';

// Pricing constants (Approx KRW per token for Flash models)
const COST_PER_INPUT_TOKEN = 0.00015;
const COST_PER_OUTPUT_TOKEN = 0.0006;
const DAILY_BUDGET_KRW = 5000;
const USER_DAILY_LIMIT = 10;

export type GeminiParsedRow = {
    memberName: string;
    scores: number[];
};

async function getKstDate() {
    return new Date(new Date().getTime() + 9 * 60 * 60 * 1000).toISOString().split('T')[0];
}

async function checkUserAiQuota(userId: string, date: string) {
    const usage = await prisma.userApiUsage.findUnique({
        where: { userId_date: { userId, date } }
    });
    return (usage?.count || 0) < USER_DAILY_LIMIT;
}

async function incrementUserAiUsage(userId: string, date: string) {
    await prisma.userApiUsage.upsert({
        where: { userId_date: { userId, date } },
        update: { count: { increment: 1 } },
        create: { userId, date, count: 1 }
    });
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
        if (usageMetadata) {
            const inputTokens = usageMetadata.promptTokenCount || 0;
            const outputTokens = usageMetadata.candidatesTokenCount || 0;
            const reqCost = (inputTokens * COST_PER_INPUT_TOKEN) + (outputTokens * COST_PER_OUTPUT_TOKEN);

            await prisma.$transaction([
                prisma.apiUsage.upsert({
                    where: { date: kstDate },
                    update: {
                        count: { increment: 1 },
                        inputTokens: { increment: inputTokens },
                        outputTokens: { increment: outputTokens },
                        cost: { increment: reqCost }
                    },
                    create: {
                        date: kstDate,
                        count: 1,
                        inputTokens: inputTokens,
                        outputTokens: outputTokens,
                        cost: reqCost
                    }
                }),
                prisma.userApiUsage.upsert({
                    where: { userId_date: { userId: session.user.id, date: kstDate } },
                    update: { count: { increment: 1 } },
                    create: { userId: session.user.id, date: kstDate, count: 1 }
                })
            ]);
        }

        const text = response.text();
        const jsonString = text.replace(/```json/g, '').replace(/```/g, '').trim();
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
    console.log("Starting analyzeExcelWithGemini...");

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
            3. Some Excel files might have dates in a header row or a separate column. Use your intelligence to associate the correct date with each score.
            4. If a score cell contains two numbers separated by a slash (e.g., '191/205'), you MUST take only the HIGHER number (e.g., 205).
            5. Return strictly a JSON array. No markdown formatting or preamble text.

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
        if (usageMetadata) {
            const inputTokens = usageMetadata.promptTokenCount || 0;
            const outputTokens = usageMetadata.candidatesTokenCount || 0;
            const reqCost = (inputTokens * COST_PER_INPUT_TOKEN) + (outputTokens * COST_PER_OUTPUT_TOKEN);

            await prisma.$transaction([
                prisma.apiUsage.upsert({
                    where: { date: kstDate },
                    update: {
                        count: { increment: 1 },
                        inputTokens: { increment: inputTokens },
                        outputTokens: { increment: outputTokens },
                        cost: { increment: reqCost }
                    },
                    create: {
                        date: kstDate,
                        count: 1,
                        inputTokens: inputTokens,
                        outputTokens: outputTokens,
                        cost: reqCost
                    }
                }),
                prisma.userApiUsage.upsert({
                    where: { userId_date: { userId: session.user.id, date: kstDate } },
                    update: { count: { increment: 1 } },
                    create: { userId: session.user.id, date: kstDate, count: 1 }
                })
            ]);
        }

        let jsonString = text.replace(/```json/g, '').replace(/```/g, '').trim();

        // Final fallback: try to find the first '[' and last ']'
        const startIdx = jsonString.indexOf('[');
        const endIdx = jsonString.lastIndexOf(']');
        if (startIdx !== -1 && endIdx !== -1) {
            jsonString = jsonString.slice(startIdx, endIdx + 1);
        }

        const parsedData = JSON.parse(jsonString);

        return { success: true, data: parsedData };
    } catch (error: any) {
        console.error("Excel AI Analysis Error:", error);
        return { success: false, message: error.message || "Failed to analyze Excel data with AI." };
    }
}
