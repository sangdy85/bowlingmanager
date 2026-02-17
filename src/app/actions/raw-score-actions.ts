'use server';

import { auth } from '@/auth';
import prisma from '@/lib/prisma';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { v4 as uuidv4 } from 'uuid';

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

export async function uploadRawLaneScores(
    roundId: String,
    excelData: any[]
): Promise<{ success: boolean; message?: string; count?: number; data?: any[] }> {
    try {
        const session = await auth();
        if (!session?.user?.id) return { success: false, message: "로그인이 필요합니다." };

        const apiKey = process.env.GOOGLE_API_KEY;
        if (!apiKey) return { success: false, message: "API Key 오류" };

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        // Limit data size to avoid token overflow
        const inputData = excelData.length > 500 ? excelData.slice(0, 500) : excelData;

        const prompt = `
            Task: Extract raw bowling scores from this Excel grid.
            CONTEXT: The goal is to capture "Lane", "Slot" (Row index within that lane section), and "Scores" (Game 1, 2, 3) exactly as they appear.

            INPUT DATA:
            ${JSON.stringify(inputData)}

            INSTRUCTIONS:
            1. **Identify Lane Sections**: 
               - Look for "Lane X", "레인 X", "No. X", or just a number "X" in the first column if it seems to group rows.
            2. **Identify Game Columns**: 
               - Look for headers like "1", "2", "3" OR "1G", "2G", "3G" OR "Game 1", "Game 2", "Game 3".
            3. **Extract Scores**:
               - Focus on the columns directly under the game headers.
               - **CRITICAL**: Scores MUST be between 0 and 300.
               - **IGNORE** any column labeled "Total", "Series", "Sum", "H/C", "Avg", "Handicap".
               - **IGNORE** any value > 300 (e.g. 600, 800 are Series Totals, NOT Game Scores).
               - If a cell has "150/10", take the first number "150".
               - **Empty Cells**: If a score cell is empty or "-", use null.
            
            CRITICAL OUTPUT RULES:
            - **RETURN ONLY** THE JSON OBJECT BELOW. NO MARKDOWN. NO COMMENTS.
            - **DO NOT INCLUDE** ANY PART OF THE INPUT DATA AS KEYS OR VALUES IN THE OUTPUT.
            - ENSURE THE OUTPUT IS VALID JSON COMPATIBLE WITH JSON.parse().
            
            RETURN FORMAT EXAMPLE:
            {
                "data": [
                    { "lane": 1, "slot": 1, "games": [150, 160, 170] },
                    { "lane": 1, "slot": 2, "games": [180, 190, 200] }
                ]
            }
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        console.log("Gemini Raw Response (First 100 chars):", text.substring(0, 100));

        let jsonStr = extractJson(text);
        let parsed;

        try {
            parsed = JSON.parse(jsonStr);
        } catch (parseError) {
            console.error("JSON Parse Error:", parseError);
            console.error("Failed JSON String:", jsonStr);
            // Fallback: try to fix common JSON errors if possible, or fail gracefully
            return { success: false, message: "AI응답 형식이 올바르지 않습니다. (JSON Parse Error)" };
        }

        if (!parsed.data || !Array.isArray(parsed.data)) {
            return { success: false, message: "AI응답 데이터 구조가 예상과 다릅니다." };
        }

        // Transaction: Clear old raw scores for this round -> Insert new ones
        await prisma.$transaction(async (tx) => {
            await tx.rawLaneScore.deleteMany({ where: { roundId: roundId as string } });

            for (const item of parsed.data) {
                if (!item.games || !Array.isArray(item.games)) continue;
                await tx.rawLaneScore.create({
                    data: {
                        roundId: roundId as string,
                        lane: item.lane,
                        slot: item.slot,
                        game1: item.games[0] || null,
                        game2: item.games[1] || null,
                        game3: item.games[2] || null
                    }
                });
            }
        });

        // Return the newly created data so frontend can use it immediately
        const start = await prisma.rawLaneScore.findMany({ where: { roundId: roundId as string } });
        return { success: true, count: parsed.data.length, data: start };

    } catch (e: any) {
        console.error("Upload Raw Scores Error:", e);
        return { success: false, message: e.message || "알 수 없는 오류가 발생했습니다." };
    }
}

export async function getRawLaneScores(roundId: string) {
    try {
        const session = await auth();
        if (!session?.user?.id) return [];

        return await prisma.rawLaneScore.findMany({
            where: { roundId }
        });
    } catch (e) {
        console.error(e);
        return [];
    }
}
