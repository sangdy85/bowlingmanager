import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { auth } from '@/auth';

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

        // Limit to 2MB as per frontend logic
        if (file.size > 2 * 1024 * 1024) {
            return NextResponse.json({ error: 'File size too large (max 2MB)' }, { status: 400 });
        }

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // Define upload path
        const uploadDir = join(process.cwd(), 'public', 'uploads');

        // Ensure directory exists
        try {
            await mkdir(uploadDir, { recursive: true });
        } catch (e) {
            // Already exists or other error handled by recursive: true
        }

        // Generate unique filename (Sanitize to alphanumeric only for safety)
        const timestamp = Date.now();
        const extension = file.name.split('.').pop() || 'png';
        const fileName = `${timestamp}.${extension}`;
        const path = join(uploadDir, fileName);

        // Save file
        await writeFile(path, buffer);
        console.log(`File saved to: ${path}`);

        const fileUrl = `/uploads/${fileName}`;

        return NextResponse.json({
            success: true,
            url: fileUrl,
            size: file.size
        });
    } catch (error: any) {
        console.error('Upload Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
