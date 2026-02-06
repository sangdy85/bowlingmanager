import { getPrisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';

export async function GET() {
    const diagnostics: any = {
        timestamp: new Date().toISOString(),
        env: {
            AUTH_SECRET: process.env.AUTH_SECRET ? "PRESENT (masked)" : "MISSING",
            DATABASE_URL: process.env.DATABASE_URL ? "PRESENT (masked)" : "MISSING",
            NODE_ENV: process.env.NODE_ENV
        },
        database: "Not Tested"
    };

    try {
        const db = getPrisma();
        const startTime = Date.now();
        await db.$queryRaw`SELECT 1`;
        diagnostics.database = `OK (took ${Date.now() - startTime}ms)`;
    } catch (error: any) {
        diagnostics.database = `FAILED: ${error.message}`;
        console.error("Health Check DB Failure:", error);
    }

    return new Response(JSON.stringify(diagnostics, null, 2), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
    });
}
