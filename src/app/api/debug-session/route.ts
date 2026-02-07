import { auth } from "@/auth";

export async function GET() {
    const session = await auth();

    return new Response(JSON.stringify({
        hasSession: !!session,
        user: session?.user || null,
        expires: session?.expires || null,
        raw: session
    }, null, 2), {
        status: 200,
        headers: { "Content-Type": "application/json" }
    });
}
