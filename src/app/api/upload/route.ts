import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { PostImageStorageError, storePostImages } from '@/lib/post-image-storage';

export async function POST(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const formData = await request.formData();
        const file = formData.get('file') as File | null;

        if (!file) {
            return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
        }

        const [stored] = await storePostImages([file]);

        return NextResponse.json({
            success: true,
            url: stored.url,
            size: stored.size,
        });
    } catch (error: unknown) {
        if (error instanceof PostImageStorageError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        console.error('Upload Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
