import { headers } from "next/headers";

export async function GET() {
    const headersList = await headers();
    const allHeaders: Record<string, string> = {};
    headersList.forEach((value, key) => {
        allHeaders[key] = value;
    });

    return new Response(JSON.stringify({
        message: "Header Inspection",
        protocol: headersList.get("x-forwarded-proto") || "unknown",
        host: headersList.get("host"),
        origin: headersList.get("origin"),
        allowed_origins: ["https://bowlingmanager.co.kr", "https://www.bowlingmanager.co.kr"],
        all_headers: allHeaders
    }, null, 2), {
        status: 200,
        headers: { "Content-Type": "application/json" }
    });
}
