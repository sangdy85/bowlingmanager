import { GoogleGenerativeAI } from "@google/generative-ai";
import {
    checkUserAiQuota,
    extractJson,
    getKstDate,
    handleGeminiError,
    incrementUserAiUsage,
} from "@/lib/gemini-utils";

export type GeminiParsedRow = {
    memberName: string;
    scores: number[];
};

export type ScoreboardOcrResult = {
    success: boolean;
    data?: GeminiParsedRow[];
    message?: string;
    errorType?: "QUOTA" | "GENERAL";
};

type GeneratedContent = {
    text: string;
    inputTokens: number;
    outputTokens: number;
};

export type ScoreboardOcrDependencies = {
    getApiKey: () => string | undefined;
    getDate: () => Promise<string>;
    checkQuota: (userId: string, date: string) => Promise<{ hasQuota: boolean; message?: string }>;
    generate: (apiKey: string, prompt: string, image: Buffer, mimeType: string) => Promise<GeneratedContent>;
    incrementUsage: (userId: string, date: string, inputTokens: number, outputTokens: number) => Promise<void>;
    handleError: (error: unknown) => { message: string; errorType: "QUOTA" | "GENERAL" };
};

const defaultDependencies: ScoreboardOcrDependencies = {
    getApiKey: () => process.env.GOOGLE_API_KEY,
    getDate: getKstDate,
    checkQuota: checkUserAiQuota,
    incrementUsage: incrementUserAiUsage,
    handleError: handleGeminiError,
    async generate(apiKey, prompt, image, mimeType) {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
            model: "gemini-2.5-flash",
            generationConfig: {
                responseMimeType: "application/json",
                maxOutputTokens: 8192,
            },
        });
        const result = await model.generateContent([
            prompt,
            {
                inlineData: {
                    data: image.toString("base64"),
                    mimeType,
                },
            },
        ]);
        const response = await result.response;
        return {
            text: response.text(),
            inputTokens: response.usageMetadata?.promptTokenCount || 0,
            outputTokens: response.usageMetadata?.candidatesTokenCount || 0,
        };
    },
};

export async function analyzeScoreboardImage(
    input: {
        userId: string;
        image: Buffer;
        mimeType: string;
        knownMembers: string[];
    },
    dependencies: ScoreboardOcrDependencies = defaultDependencies,
): Promise<ScoreboardOcrResult> {
    try {
        const apiKey = dependencies.getApiKey();
        if (!apiKey) {
            return {
                success: false,
                message: "API Key 설정이 되지 않았습니다. 서버를 재기동(restart) 해주세요.",
                errorType: "GENERAL",
            };
        }

        const date = await dependencies.getDate();
        const quota = await dependencies.checkQuota(input.userId, date);
        if (!quota.hasQuota) {
            return {
                success: false,
                message: quota.message,
                errorType: "QUOTA",
            };
        }

        const generated = await dependencies.generate(
            apiKey,
            scoreboardPrompt(input.knownMembers),
            input.image,
            input.mimeType,
        );
        await dependencies.incrementUsage(
            input.userId,
            date,
            generated.inputTokens,
            generated.outputTokens,
        );
        const parsed = JSON.parse(extractJson(generated.text));
        return { success: true, data: parsed as GeminiParsedRow[] };
    } catch (error) {
        const handled = dependencies.handleError(error);
        return {
            success: false,
            message: handled.message,
            errorType: handled.errorType,
        };
    }
}

function scoreboardPrompt(knownMembers: string[]) {
    return `
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
}
