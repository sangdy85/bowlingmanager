export const dynamic = 'force-dynamic';

export async function GET() {
    return new Response("ULTRA-HEALTH-OK", {
        status: 200,
        headers: { 'Content-Type': 'text/plain' }
    });
}
