import { getMobileApiUserId } from "@/lib/mobile-api/auth";
import {
    MOBILE_OCR_IMAGE_FIELD,
    MOBILE_OCR_MAX_IMAGE_BYTES,
    MOBILE_OCR_MIME_TYPES,
    MOBILE_OCR_TEAM_FIELD,
    normalizeMobileOcrPlayers,
} from "@/lib/mobile-api/score-capture";
import {
    internalServerErrorResponse,
    mobileApiError,
    mobileApiSuccess,
    unauthorizedResponse,
} from "@/lib/mobile-api/response";
import { listManageableScoreTeams } from "@/lib/score-bulk-service";
import { analyzeScoreboardImage } from "@/lib/scoreboard-ocr";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
    try {
        const userId = await getMobileApiUserId(request);
        if (!userId) return unauthorizedResponse();

        let formData: FormData;
        try {
            formData = await request.formData();
        } catch {
            return mobileApiError("INVALID_MULTIPART", "이미지 요청 형식을 확인해주세요.", 400);
        }
        const image = formData.get(MOBILE_OCR_IMAGE_FIELD);
        const teamId = formData.get(MOBILE_OCR_TEAM_FIELD);
        if (!(image instanceof File) || image.size === 0) {
            return mobileApiError("MISSING_IMAGE", "점수판 이미지를 선택해주세요.", 400);
        }
        if (!MOBILE_OCR_MIME_TYPES.has(image.type)) {
            return mobileApiError("UNSUPPORTED_IMAGE", "JPEG, PNG 또는 WebP 이미지를 선택해주세요.", 415);
        }
        if (image.size > MOBILE_OCR_MAX_IMAGE_BYTES) {
            return mobileApiError("IMAGE_TOO_LARGE", "이미지 크기는 10MB 이하여야 합니다.", 413);
        }
        if (typeof teamId !== "string" || !teamId) {
            return mobileApiError("TEAM_REQUIRED", "팀을 선택해주세요.", 400);
        }

        const teams = await listManageableScoreTeams(userId);
        const team = teams.find((candidate) => candidate.id === teamId);
        if (!team) {
            return mobileApiError("FORBIDDEN", "선택한 팀에 점수를 등록할 권한이 없습니다.", 403);
        }

        const analysis = await analyzeScoreboardImage({
            userId,
            image: Buffer.from(await image.arrayBuffer()),
            mimeType: image.type,
            knownMembers: team.members.map((member) => member.name),
        });
        if (!analysis.success) {
            if (analysis.errorType === "QUOTA") {
                return mobileApiError(
                    "OCR_QUOTA_EXCEEDED",
                    analysis.message || "오늘 사용할 수 있는 이미지 분석 횟수를 초과했습니다.",
                    429,
                );
            }
            return mobileApiError(
                "OCR_ANALYSIS_FAILED",
                "점수판을 분석하지 못했습니다. 이미지를 확인하고 다시 시도해주세요.",
                502,
            );
        }

        const players = normalizeMobileOcrPlayers(analysis.data, team.members);
        if (!players || players.length === 0) {
            return mobileApiError(
                "OCR_NO_RESULTS",
                "이미지에서 저장할 수 있는 점수를 찾지 못했습니다.",
                422,
            );
        }
        return mobileApiSuccess({ players });
    } catch (error) {
        console.error("Mobile API scoreboard OCR failed:", error);
        return internalServerErrorResponse();
    }
}
