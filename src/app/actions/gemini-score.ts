'use server';

import { GoogleGenerativeAI } from '@google/generative-ai';
import prisma from '@/lib/prisma'; // Your prisma client
import { auth } from '@/auth'; // Your auth (NextAuth/Auth.js)
import { v4 as uuidv4 } from 'uuid';

import { 
    getKstDate, 
    extractJson, 
    checkUserAiQuota, 
    incrementUserAiUsage, 
    handleGeminiError 
} from '@/lib/gemini-utils';

export type GeminiParsedRow = {
    memberName: string;
    scores: number[];
};



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
        const quotaResult = await checkUserAiQuota(session.user.id, kstDate);
        if (!quotaResult.hasQuota) return { success: false, message: quotaResult.message, errorType: 'QUOTA' };

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ 
            model: "gemini-2.0-flash",
            generationConfig: { 
                responseMimeType: "application/json",
                maxOutputTokens: 8192
            }
        });

        const prompt = `
            Task: Extract bowling scores from an Excel grid into a standardized JSON format.
            Tournament Type: ${gameCount}-Game Match (range 1-5).
            Focus: Extract Lane numbers, Row index (Slot), and exactly ${gameCount} individual Game scores.

            INPUT EXCEL DATA (2D Array - Grid View):
            ${JSON.stringify(excelData.slice(0, 400))} (Showing up to 400 rows for broad lane coverage)

            INSTRUCTIONS:
            1. **Identify Lane Sections**: 
               - Look for "Lane X", "레인 X", "No. X", or just a number "X" in the first column or header that identifies a lane group.
            2. **Identify Game Columns**: 
               - Look for headers like "1", "2", ... "${gameCount}" OR "1G", "2G", ... "${gameCount}G".
            3. **Extract Scores per Row (RESET BY LANE)**:
               - IMPORTANT: The "slot" represents the sequence (1, 2, 3, 4...) within a specific Lane section.
               - **A lane can have 4 or more players (slots). DO NOT skip any player rows.**
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
            5. **Output limit**: Be as concise as possible. If there are too many entries, process up to the limit.

            CRITICAL OUTPUT RULES:
            - **RETURN ONLY** THE JSON ARRAY BELOW. NO MARKDOWN. NO COMMENTS.
            - ENSURE THE OUTPUT IS A VALID JSON ARRAY.

            RETURN FORMAT EXAMPLE (Assume 3 games, Lane 1 has 4 players):
            [
               { "lane": 1, "slot": 1, "games": [150, 160, 170] },
               { "lane": 1, "slot": 2, "games": [140, 155, 130] },
               { "lane": 1, "slot": 3, "games": [180, 190, 200] },
               { "lane": 1, "slot": 4, "games": [165, 175, 185] }
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
            console.error("League Round AI JSON Parse Error:", parseError, "JSON string:", jsonString);
            return { success: false, message: "AI응답 형식이 올바르지 않습니다. (Truncation error at pos " + (parseError instanceof Error ? (parseError as any).pos : "?") + ")" };
        }

    } catch (error: any) {
        console.error("League Round AI Error:", error);
        const handled = handleGeminiError(error);
        return { success: false, message: handled.message, errorType: handled.errorType };
    }
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

        // Check Quota
        const quotaResult = await checkUserAiQuota(session.user.id, kstDate);
        if (!quotaResult.hasQuota) {
            return {
                success: false,
                message: quotaResult.message,
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
        const model = genAI.getGenerativeModel({ 
            model: "gemini-2.0-flash",
            generationConfig: { 
                responseMimeType: "application/json",
                maxOutputTokens: 8192
            }
        });

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
        const handled = handleGeminiError(error);
        return { success: false, message: handled.message, errorType: handled.errorType };
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

        // Check Quota
        const quotaResult = await checkUserAiQuota(session.user.id, kstDate);
        if (!quotaResult.hasQuota) {
            return {
                success: false,
                message: quotaResult.message,
                errorType: 'QUOTA'
            };
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ 
            model: "gemini-2.0-flash",
            generationConfig: { 
                responseMimeType: "application/json",
                maxOutputTokens: 8192
            }
        });

        const prompt = `
            Analyze this raw JSON data extracted from an Excel file for professional bowling scores.
            Analyze this raw JSON data extracted from an Excel file for professional bowling scores.
            Task: Standardize the data into a list of players, their scores, and the correct date of each game session.

            HORIZONTAL MULTI-TABLE LAYOUT SUPPORT:
            - **IMPORTANT**: The input data may contain multiple tables arranged **SIDE-BY-SIDE** (horizontally).
            - Look for date headers (e.g., "20240831", "2024-09-14", "No. 1 24.10.15") at the top of each vertical column group.
            - A single row in the input array may contain data for DIFFERENT dates in different columns.
            - You MUST correctly associate each player (memberName) and their scores with the date header that appears at the top of their specific column group.
            - If a table lacks a header, use the user's provided default date.

            INPUT DATA:
            ${JSON.stringify(excelData.slice(0, 400))} (Showing up to 400 rows for broad lane coverage)

            INSTRUCTIONS:
            1. Identify columns for Name, Date (if any), Scores, and Memo.
            2. For each row representing a score entry:
               - memberName: The player's name.
               - scores: An array of numbers (0-300).
               - gameDate: The date in YYYY-MM-DD format. Ensure you map it to the correct column group's header date.
               - memo: Any text that looks like a note for that entry.
            3. Some Excel files might have dates in a header row or a separate column. Use your intelligence to associate the correct date with each score.
            4. If a score cell contains two numbers separated by a slash (e.g., '191/205'), you MUST take only the HIGHER number (e.g., 205).
            5. Final Output: Strictly a JSON array. No markdown formatting or preamble text.
            6. **Output limit**: Be as concise as possible. If there are too many entries, process up to the limit.

            OUTPUT FORMAT (JSON Array):
            [
              { "memberName": "홍길동", "scores": [180, 210, 195], "gameDate": "2024-08-31", "memo": "정기전" },
              { "memberName": "김철수", "scores": [150, 160], "gameDate": "2024-09-14" },
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
        
        try {
            const parsedData = JSON.parse(jsonString);
            return { success: true, data: parsedData };
        } catch (perr) {
            console.error("Gemini JSON parse failed even after extraction:", perr, "JSON String:", jsonString);
            return { success: false, message: "AI응답 형식이 올바르지 않습니다. (Truncation error at pos " + (perr instanceof Error ? (perr as any).pos : "?") + ")" };
        }
    } catch (error: any) {
        const handled = handleGeminiError(error);
        return { success: false, message: handled.message, errorType: handled.errorType };
    }
}
