import {
    SCORE_GAME_TYPES,
    type ScoreBulkRow,
} from "@/lib/score-bulk-service";

export const MOBILE_OCR_IMAGE_FIELD = "image";
export const MOBILE_OCR_TEAM_FIELD = "teamId";
export const MOBILE_OCR_MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MOBILE_OCR_MIME_TYPES = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
]);

export type MobileScoreEntryTeam = {
    id: string;
    name: string;
    members: { id: string; name: string }[];
};

export type MobileOcrPlayer = {
    name: string;
    scores: number[];
    matchedMemberId: string | null;
};

export class MobileCaptureValidationError extends Error {
    constructor(
        public readonly code: string,
        message: string,
    ) {
        super(message);
        this.name = "MobileCaptureValidationError";
    }
}

export function normalizeMobileOcrPlayers(
    raw: unknown,
    members: MobileScoreEntryTeam["members"],
): MobileOcrPlayer[] | null {
    if (!Array.isArray(raw)) return null;

    const memberIdsByName = new Map<string, string | null>();
    for (const member of members) {
        if (memberIdsByName.has(member.name)) {
            memberIdsByName.set(member.name, null);
        } else {
            memberIdsByName.set(member.name, member.id);
        }
    }

    const players: MobileOcrPlayer[] = [];
    for (const value of raw) {
        if (!value || typeof value !== "object") continue;
        const record = value as Record<string, unknown>;
        if (typeof record.memberName !== "string" || !Array.isArray(record.scores)) continue;
        const name = record.memberName.trim();
        const scores = record.scores.filter(
            (score): score is number => Number.isInteger(score) && Number(score) >= 0 && Number(score) <= 300,
        );
        if (!name || scores.length === 0) continue;
        players.push({
            name,
            scores,
            matchedMemberId: memberIdsByName.get(name) ?? null,
        });
    }
    return players;
}

export function parseMobileBulkScoreRequest(value: unknown): {
    teamId: string;
    rows: ScoreBulkRow[];
} {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw invalidPayload();
    }
    const payload = value as Record<string, unknown>;
    const teamId = cleanRequiredString(payload.teamId, 100);
    const gameType = cleanRequiredString(payload.gameType, 30);
    const memo = cleanOptionalString(payload.memo, 500);
    const gameDate = parseDate(payload.gameDate);
    if (!SCORE_GAME_TYPES.includes(gameType as typeof SCORE_GAME_TYPES[number])) {
        throw new MobileCaptureValidationError("INVALID_GAME_TYPE", "경기 분류를 확인해주세요.");
    }
    if (!Array.isArray(payload.players) || payload.players.length === 0 || payload.players.length > 50) {
        throw new MobileCaptureValidationError("INVALID_PLAYERS", "저장할 선수 정보를 확인해주세요.");
    }

    const participantKeys = new Set<string>();
    const rows = payload.players.map((value) => {
        if (!value || typeof value !== "object" || Array.isArray(value)) {
            throw new MobileCaptureValidationError("INVALID_PLAYERS", "저장할 선수 정보를 확인해주세요.");
        }
        const player = value as Record<string, unknown>;
        const memberName = cleanRequiredString(player.name, 100);
        const memberId = player.memberId == null
            ? null
            : cleanRequiredString(player.memberId, 100);
        const participantKey = memberId ? `member:${memberId}` : `guest:${memberName}`;
        if (participantKeys.has(participantKey)) {
            throw new MobileCaptureValidationError(
                "DUPLICATE_PARTICIPANT",
                "같은 참가자를 중복으로 추가할 수 없습니다.",
            );
        }
        participantKeys.add(participantKey);
        if (!Array.isArray(player.scores) || player.scores.length === 0 || player.scores.length > 12) {
            throw new MobileCaptureValidationError("INVALID_SCORES", "선수별 점수를 확인해주세요.");
        }
        const scores = player.scores.map((score) => {
            if (!Number.isInteger(score) || Number(score) < 0 || Number(score) > 300) {
                throw new MobileCaptureValidationError(
                    "INVALID_SCORE",
                    "모든 점수는 0에서 300 사이의 정수여야 합니다.",
                );
            }
            return Number(score);
        });
        return {
            memberName,
            memberId,
            scores,
            gameDate,
            gameType,
            memo,
        };
    });

    return { teamId, rows };
}

function cleanRequiredString(value: unknown, maxLength: number) {
    if (typeof value !== "string") throw invalidPayload();
    const clean = value.trim();
    if (!clean || clean.length > maxLength) throw invalidPayload();
    return clean;
}

function cleanOptionalString(value: unknown, maxLength: number) {
    if (value == null || value === "") return null;
    if (typeof value !== "string") throw invalidPayload();
    const clean = value.trim();
    if (clean.length > maxLength) throw invalidPayload();
    return clean || null;
}

function parseDate(value: unknown) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        throw new MobileCaptureValidationError("INVALID_DATE", "경기 날짜를 확인해주세요.");
    }
    const parsed = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
        throw new MobileCaptureValidationError("INVALID_DATE", "경기 날짜를 확인해주세요.");
    }
    return parsed;
}

function invalidPayload() {
    return new MobileCaptureValidationError("INVALID_REQUEST", "요청 내용을 확인해주세요.");
}
