// export const runtime = 'edge'; // Removed to test standard Node.js runtime

export async function GET() {
    return new Response("OK - Isolated Health Check (Edge)", {
        status: 200,
        headers: { 'Content-Type': 'text/plain' }
    });
}
