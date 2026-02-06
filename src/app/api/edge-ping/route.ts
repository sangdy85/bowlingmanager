export const runtime = 'edge';

export async function GET() {
    return new Response(JSON.stringify({ message: "Edge Ping Success" }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
    });
}
