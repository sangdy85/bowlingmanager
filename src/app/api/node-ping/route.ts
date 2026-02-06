export const runtime = 'nodejs';

export async function GET() {
    return new Response(JSON.stringify({ message: "Node.js Ping Success" }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
    });
}
