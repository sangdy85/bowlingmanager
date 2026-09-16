import { mobileApiSuccess } from "@/lib/mobile-api/response";

export function GET() {
    return mobileApiSuccess({
        status: "ok",
        service: "bowlingmanager-mobile-api",
        version: "v1",
    });
}
