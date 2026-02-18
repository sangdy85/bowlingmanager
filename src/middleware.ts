import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
    // POST 요청인 경우에만 헤더를 출력합니다 (서버 액션 디버깅용)
    if (request.method === 'POST') {
        console.log('--- [DEBUG] POST Request Headers ---');
        console.log('Method:', request.method);
        console.log('URL:', request.url);
        console.log('Origin:', request.headers.get('origin'));
        console.log('Host:', request.headers.get('host'));
        console.log('X-Forwarded-Proto:', request.headers.get('x-forwarded-proto'));
        console.log('X-Forwarded-Host:', request.headers.get('x-forwarded-host'));
        console.log('------------------------------------');
    }
    return NextResponse.next();
}

export const config = {
    matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
