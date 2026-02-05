export const runtime = 'edge';

export async function GET() {
    return new Response("OK - Isolated Health Check (Edge)", {
        status: 200,
        headers: { 'Content-Type': 'text/plain' }
    });
}
