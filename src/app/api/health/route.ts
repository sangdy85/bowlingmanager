import { NextResponse } from 'next/server';

export async function GET() {
    return NextResponse.json({
        status: 'ok',
        time: new Date().toISOString(),
        env_check: {
            has_db_url: !!process.env.DATABASE_URL,
            has_auth_secret: !!process.env.AUTH_SECRET,
            node_env: process.env.NODE_ENV
        }
    });
}
