import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => {
        headers[key] = value;
    });

    console.log('--- [DEBUG API] Request Headers ---');
    console.log(JSON.stringify(headers, null, 2));

    return NextResponse.json({
        message: "Debug headers received",
        method: request.method,
        url: request.url,
        headers: headers
    });
}

export async function POST(request: NextRequest) {
    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => {
        headers[key] = value;
    });

    console.log('--- [DEBUG API] POST Headers ---');
    console.log(JSON.stringify(headers, null, 2));

    return NextResponse.json({
        message: "Debug POST headers received",
        method: request.method,
        headers: headers
    });
}
