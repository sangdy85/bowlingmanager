import { timingSafeEqual } from "node:crypto";

import { deliverPendingMobileNotifications } from "@/lib/mobile-api/notifications";
import { internalServerErrorResponse, mobileApiError, mobileApiSuccess } from "@/lib/mobile-api/response";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
    const configured = process.env.MOBILE_PUSH_WORKER_SECRET;
    const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
    if (!configured || !sameSecret(configured, provided)) return mobileApiError("UNAUTHORIZED", "인증이 필요합니다.", 401);
    try { return mobileApiSuccess(await deliverPendingMobileNotifications()); }
    catch (error) { console.error("Mobile notification delivery failed:", error); return internalServerErrorResponse(); }
}

function sameSecret(expected: string, actual: string) {
    const a = Buffer.from(expected); const b = Buffer.from(actual);
    return a.length === b.length && timingSafeEqual(a, b);
}
