import { TeamEventError } from "@/lib/mobile-api/team-events";
export function assertPaymentWriteOrigin(request: Request) {
    if (request.headers.has("authorization")) return;
    if (request.headers.get("origin") !== new URL(request.url).origin) {
        throw new TeamEventError("FORBIDDEN", "요청 출처를 확인할 수 없습니다.", 403);
    }
}
