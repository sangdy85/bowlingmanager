export const runtime = 'edge';

export async function GET() {
    return new Response("ULTRA-HEALTH-OK", {
        status: 200,
        headers: { 'Content-Type': 'text/plain' }
    });
}
