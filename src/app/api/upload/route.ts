import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export async function POST(request: Request) {
    const data = await request.formData();
    const file: File | null = data.get("file") as unknown as File;

    if (!file) {
        return NextResponse.json({ success: false, error: "No file uploaded" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // 2MB Limit
    if (buffer.length > 2 * 1024 * 1024) {
        return NextResponse.json({ success: false, error: "File too large (Max 2MB)" }, { status: 400 });
    }

    // Ensure unique filename
    const filename = `${Date.now()}-${file.name.replace(/\s/g, '_')}`;

    // Save to public/uploads
    const uploadDir = path.join(process.cwd(), "public/uploads");

    try {
        await mkdir(uploadDir, { recursive: true });
        const filepath = path.join(uploadDir, filename);
        await writeFile(filepath, buffer);

        return NextResponse.json({
            success: true,
            url: `/uploads/${filename}`,
            size: buffer.length
        });
    } catch (error) {
        console.error("Error uploading file:", error);
        return NextResponse.json({ success: false, error: "Upload failed" }, { status: 500 });
    }
}
