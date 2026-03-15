import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
    // 모든 요청의 헤더를 출력하여 서버 도달 여부를 확인합니다.
    console.log(`--- [DEBUG] ${request.method} Request ---`);
    console.log('Path:', request.nextUrl.pathname);
    console.log('Origin:', request.headers.get('origin'));
    console.log('Host:', request.headers.get('host'));
    console.log('Next-Action:', request.headers.get('next-action'));
    console.log('X-Forwarded-Proto:', request.headers.get('x-forwarded-proto'));
    console.log('------------------------------------');
    
    return NextResponse.next();
}

export const config = {
    matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
