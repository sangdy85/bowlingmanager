export async function GET() {
    return new Response("OK - Isolated Health Check", {
        status: 200,
        headers: { 'Content-Type': 'text/plain' }
    });
}
