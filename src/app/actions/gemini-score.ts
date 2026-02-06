'use server';

import { GoogleGenerativeAI } from '@google/generative-ai';
import { prisma } from '@/lib/prisma'; // Import prisma

// Pricing constants (Approx KRW per token for Flash models)
// Input: ~$0.075/1M tokens (~0.1 KRW/1k) -> 0.0001 KRW/token
// Output: ~$0.30/1M tokens (~0.4 KRW/1k) -> 0.0004 KRW/token
// We use slightly conservative estimates.
const COST_PER_INPUT_TOKEN = 0.00015;
const COST_PER_OUTPUT_TOKEN = 0.0006;
const DAILY_BUDGET_KRW = 5000;

export type GeminiParsedRow = {
    memberName: string;
    scores: number[];
};

export async function analyzeScoreboardWithGemini(
    formData: FormData
): Promise<{ success: boolean; data?: GeminiParsedRow[]; message?: string; errorType?: 'QUOTA' | 'GENERAL' }> {
    console.log("Starting analyzeScoreboardWithGemini...");

    try {
        const apiKey = process.env.GOOGLE_API_KEY;
        if (!apiKey) {
            return {
                success: false,
                message: "API Key 설정이 되지 않았습니다. 서버를 재기동(restart) 해주세요."
            };
        }

        // 1. Check Daily Budget (Cost Control)
        // KST Date "YYYY-MM-DD"
        const kstDate = new Date(new Date().getTime() + 9 * 60 * 60 * 1000).toISOString().split('T')[0];

        const usage = await prisma.apiUsage.findUnique({
            where: { date: kstDate }
        });

        if (usage && usage.cost >= DAILY_BUDGET_KRW) {
            console.warn(`Daily Budget Exceeded for ${kstDate}: ${usage.cost.toFixed(2)} KRW`);
            return {
                success: false,
                message: "금일 AI 사용 예산(5,000원)을 초과했습니다. 관리자에게 문의하거나 내일 다시 시도해주세요.",
                errorType: 'QUOTA'
            };
        }

        const file = formData.get('image') as File;
        const knownMembersStr = formData.get('knownMembers') as string;

        if (!file) {
            return { success: false, message: "이미지 파일이 없습니다." };
        }

        const knownMembers = knownMembersStr ? JSON.parse(knownMembersStr) : [];

        // Convert file to base64
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const base64Data = buffer.toString('base64');
        const mimeType = file.type || 'image/jpeg';


        // Initialize lazily to avoid top-level failures
        const genAI = new GoogleGenerativeAI(apiKey);

        // Use User Requested Model
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        console.log(`Sending image (${mimeType}) to Gemini...`);

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
         - CRITICAL: If a score cell contains two numbers separated by a slash (e.g., '211/226'), take only the HIGHER number (e.g., 226). This is common when a player re-bowls a frame.
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

        // 2. Track Usage & Cost
        const usageMetadata = result.response.usageMetadata;
        if (usageMetadata) {
            const inputTokens = usageMetadata.promptTokenCount || 0;
            const outputTokens = usageMetadata.candidatesTokenCount || 0;

            const reqCost = (inputTokens * COST_PER_INPUT_TOKEN) + (outputTokens * COST_PER_OUTPUT_TOKEN);

            await prisma.apiUsage.upsert({
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
            });
            console.log(`Usage Tracked: ${inputTokens} in / ${outputTokens} out. Approx cost: ${reqCost.toFixed(2)} KRW`);
        }

        const text = response.text();

        console.log("Gemini Raw Output:", text);

        // Clean up code blocks if present
        const jsonString = text.replace(/```json/g, '').replace(/```/g, '').trim();

        let parsedData: GeminiParsedRow[];
        try {
            parsedData = JSON.parse(jsonString);
        } catch (e) {
            console.error("JSON Parse Error on Gemini output:", e);
            return { success: false, message: "AI 응답을 분석할 수 없습니다. (JSON Parsing Error)" };
        }

        return { success: true, data: parsedData };
    } catch (error: any) {
        console.error("Gemini Analysis Error:", error);

        // Quota Limit Error Handling
        if (error.message?.includes('429') || error.message?.includes('RESOURCE_EXHAUSTED')) {
            return {
                success: false,
                message: "오늘 무료 분석 횟수를 모두 사용했습니다. 내일 다시 시도해주세요.",
                errorType: 'QUOTA'
            };
        }

        return { success: false, message: error.message || "Failed to analyze image with AI." };
    }
}
