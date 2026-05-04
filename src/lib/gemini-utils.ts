import { GoogleGenerativeAI } from '@google/generative-ai';
import prisma from '@/lib/prisma';
import { v4 as uuidv4 } from 'uuid';

// 비용 상수 (Flash 모델 기준 토큰당 대략적인 원화 환산)
export const COST_PER_INPUT_TOKEN = 0.00015;
export const COST_PER_OUTPUT_TOKEN = 0.0006;
export const DAILY_BUDGET_KRW = 5000; // 일일 전체 예산
export const USER_DAILY_LIMIT = 10;   // 사용자당 일일 무료 횟수

export async function getKstDate() {
    return new Date(new Date().getTime() + 9 * 60 * 60 * 1000).toISOString().split('T')[0];
}

/**
 * Gemini 응답에서 JSON 문자열을 안전하게 추출합니다.
 */
export function extractJson(text: string): string {
    // 1. 기본 청소
    let cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();

    // 2. JSON 구조 찾기 (배열 우선)
    const startIdxArr = cleanText.indexOf('[');
    const startIdxObj = cleanText.indexOf('{');
    
    let startIdx = -1;
    let isArray = false;

    if (startIdxArr !== -1 && (startIdxObj === -1 || (startIdxArr < startIdxObj))) {
        startIdx = startIdxArr;
        isArray = true;
    } else if (startIdxObj !== -1) {
        startIdx = startIdxObj;
        isArray = false;
    }

    if (startIdx === -1) return cleanText;

    let sub = cleanText.slice(startIdx);
    
    const closingChar = isArray ? ']' : '}';
    
    let searchIdx = sub.length;
    while (searchIdx > 0) {
        const lastBracket = sub.lastIndexOf(closingChar, searchIdx);
        if (lastBracket === -1) break;

        let candidate = sub.slice(0, lastBracket + 1).trim();
        
        try {
            JSON.parse(candidate);
            return candidate;
        } catch (e) {
            // 트레일링 콤마 제거 시도
            const commaMatch = candidate.match(/,\s*[\]}]$/);
            if (commaMatch) {
                const fixedCandidate = candidate.replace(/,\s*([\]}])$/, '$1');
                try {
                    JSON.parse(fixedCandidate);
                    return fixedCandidate;
                } catch (e2) {}
            }
            searchIdx = lastBracket - 1;
        }
    }

    // 배열인 경우 잘린 마지막 객체 닫기 시도
    if (isArray) {
        let lastObjClose = sub.lastIndexOf('}');
        if (lastObjClose !== -1) {
            let candidate = sub.slice(0, lastObjClose + 1).trim() + ']';
            candidate = candidate.replace(/,\s*\]$/, ']');
            try {
                JSON.parse(candidate);
                return candidate;
            } catch (e) {}
        }
    }

    return sub;
}

/**
 * 사용자의 AI 쿼터 및 전체 예산을 확인합니다.
 */
export async function checkUserAiQuota(userId: string, date: string): Promise<{ hasQuota: boolean; message?: string }> {
    const usage = await prisma.userApiUsage.upsert({
        where: { userId_date: { userId, date } },
        update: {},
        create: { userId, date, count: 0, id: uuidv4(), updatedAt: new Date() },
    });

    const globalUsage = await prisma.apiUsage.upsert({
        where: { date },
        update: {},
        create: { date, count: 0, inputTokens: 0, outputTokens: 0, cost: 0, updatedAt: new Date() },
    });

    if (usage.count >= USER_DAILY_LIMIT) {
        return { hasQuota: false, message: `오늘 무료 분석 횟수(${USER_DAILY_LIMIT}회)를 모두 사용했습니다. 내일 다시 시도해주세요.` };
    }
    
    if (globalUsage.cost >= DAILY_BUDGET_KRW) {
        return { hasQuota: false, message: "금일 전체 AI 사용 예산을 초과했습니다. 내일 다시 시도해주세요." };
    }

    return { hasQuota: true };
}

/**
 * AI 사용량을 기록합니다.
 */
export async function incrementUserAiUsage(userId: string, date: string, inputTokens = 0, outputTokens = 0) {
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

/**
 * Gemini API 에러를 분석하여 통합된 에러 정보를 반환합니다.
 */
export function handleGeminiError(error: any): { message: string; errorType: 'QUOTA' | 'GENERAL' } {
    const msg = error?.message || String(error);
    console.error("Gemini Utility Error Handler:", error);

    if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) {
        return {
            message: "서비스 할당량(API Quota)을 초과했습니다. 잠시 후 다시 시도하거나 내일 이용해 주세요.",
            errorType: 'QUOTA'
        };
    }

    return {
        message: "AI 분석 중 오류가 발생했습니다: " + msg,
        errorType: 'GENERAL'
    };
}
