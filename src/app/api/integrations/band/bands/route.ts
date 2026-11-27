import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyCenterAdmin } from '@/lib/auth-utils';
import { getBands, bandErrorMessage } from '@/lib/band/client';
import { decryptBandToken } from '@/lib/band/token-crypto';
import { isBandConfigured, BAND_NOT_CONFIGURED_MESSAGE } from '@/lib/band/config';

export async function GET(request: NextRequest) {
    const centerId = request.nextUrl.searchParams.get('centerId');
    if (!centerId) return NextResponse.json({ error: 'centerId가 필요합니다.' }, { status: 400 });
    try {
        await verifyCenterAdmin(centerId);
        if (!isBandConfigured()) return NextResponse.json({ error: BAND_NOT_CONFIGURED_MESSAGE }, { status: 503 });
        const connection = await (prisma as any).bandConnection.findUnique({ where: { centerId } });
        if (!connection) return NextResponse.json({ error: 'BAND 연결이 필요합니다.' }, { status: 404 });
        const bands = await getBands(decryptBandToken(connection.accessTokenEncrypted));
        return NextResponse.json({ bands });
    } catch (error) {
        return NextResponse.json({ error: bandErrorMessage(error) }, { status: 502 });
    }
}
