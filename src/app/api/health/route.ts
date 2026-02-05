export async function GET() {
    try {
        return new Response(JSON.stringify({
            status: 'ok',
            message: 'Minimal health check successful',
            env: {
                has_db: !!process.env.DATABASE_URL,
                has_auth: !!process.env.AUTH_SECRET,
                ver: process.version
            }
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (e) {
        return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
    }
}
