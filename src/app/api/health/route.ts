import { getPrisma } from "@/lib/prisma";

export async function GET() {
    try {
        const db = getPrisma();
        // A simple query to check DB connectivity
        const userCount = await db.user.count().catch(e => `Prisma Connection Error: ${e.message}`);

        return new Response(JSON.stringify({
            status: 'ok',
            message: 'Lazy health check successful',
            db_status: typeof userCount === 'number' ? 'connected' : userCount,
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
        return new Response(JSON.stringify({
            error: String(e),
            stack: e instanceof Error ? e.stack : null
        }), { status: 500 });
    }
}
