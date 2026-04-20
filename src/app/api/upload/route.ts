import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { auth } from '@/auth';
import sharp from 'sharp';

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

        // Limit to 5MB (increased from 2MB as we process with sharp)
        if (file.size > 5 * 1024 * 1024) {
            return NextResponse.json({ error: 'File size too large (max 5MB)' }, { status: 400 });
        }

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // Define upload path
        const uploadDir = join(process.cwd(), 'public', 'uploads');

        // Ensure directory exists
        try {
            await mkdir(uploadDir, { recursive: true });
        } catch (e) {
            // Error handled by recursive: true
        }

        // Generate safe unique filename (using timestamp)
        const timestamp = Date.now();
        const fileName = `${timestamp}.webp`;
        const path = join(uploadDir, fileName);

        // Process with sharp and save as webp
        await sharp(buffer)
            .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
            .webp({ quality: 80 })
            .toFile(path);

        console.log(`File processed and saved to: ${path}`);

        // Return the NEW API route URL
        const fileUrl = `/api/images/${fileName}`;

        return NextResponse.json({
            success: true,
            url: fileUrl,
            size: buffer.length // approximate
        });
    } catch (error: any) {
        console.error('Upload Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
