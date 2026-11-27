import { NextRequest, NextResponse } from 'next/server';
import { readStoredPostImage, storedPostImagePath } from '@/lib/post-image-storage';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ filename: string }> }
) {
    try {
        const { filename } = await params;
        
        const url = `/api/images/${filename}`;
        if (!storedPostImagePath(url)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
        const image = await readStoredPostImage(url);

        // Return the image
        return new NextResponse(new Uint8Array(image.bytes), {
            headers: {
                'Content-Type': image.contentType,
                'Cache-Control': 'public, max-age=31536000, immutable',
            },
        });
    } catch (error) {
        console.error('Image Serving Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
