import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm } from "node:fs/promises";
import { basename, extname, resolve, sep } from "node:path";
import sharp from "sharp";

export const POST_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const TEAM_POST_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
export const POST_IMAGE_MAX_COUNT = 10;

const acceptedImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export type PostImageUpload = Pick<File, "name" | "size" | "type" | "arrayBuffer">;
export type StoredPostImage = { url: string; size: number; path: string };

export class PostImageStorageError extends Error {
    constructor(public readonly code: string, message: string, public readonly status = 400) {
        super(message);
    }
}

function uploadDirectory() {
    return resolve(process.cwd(), "public", "uploads");
}

export async function storePostImages(files: readonly PostImageUpload[]) {
    if (files.length > POST_IMAGE_MAX_COUNT) {
        throw new PostImageStorageError("TOO_MANY_IMAGES", `이미지는 최대 ${POST_IMAGE_MAX_COUNT}개까지 첨부할 수 있습니다.`);
    }
    const stored: StoredPostImage[] = [];
    try {
        await mkdir(uploadDirectory(), { recursive: true });
        for (const file of files) {
            if (!acceptedImageTypes.has(file.type)) {
                throw new PostImageStorageError("INVALID_IMAGE_TYPE", "JPEG, PNG, WebP 이미지만 첨부할 수 있습니다.");
            }
            if (file.size < 1 || file.size > POST_IMAGE_MAX_BYTES) {
                throw new PostImageStorageError("INVALID_IMAGE_SIZE", "이미지는 한 장당 5MB 이하여야 합니다.");
            }
            const fileName = `${Date.now()}-${randomUUID()}.webp`;
            const path = resolve(uploadDirectory(), fileName);
            const buffer = Buffer.from(await file.arrayBuffer());
            await sharp(buffer)
                .resize(1200, 1200, { fit: "inside", withoutEnlargement: true })
                .webp({ quality: 80 })
                .toFile(path);
            stored.push({ url: `/api/images/${fileName}`, size: file.size, path });
        }
        return stored;
    } catch (error) {
        await removeStoredPostImages(stored);
        if (error instanceof PostImageStorageError) throw error;
        throw new PostImageStorageError("IMAGE_PROCESSING_FAILED", "이미지를 처리하지 못했습니다.");
    }
}

export async function removeStoredPostImages(images: readonly Pick<StoredPostImage, "path">[]) {
    await Promise.all(images.map((image) => rm(image.path, { force: true }).catch(() => undefined)));
}

export async function removeStoredPostImagesStrict(images: readonly Pick<StoredPostImage, "path">[]) {
    const results = await Promise.allSettled(images.map((image) => rm(image.path, { force: true })));
    if (results.some((result) => result.status === "rejected")) {
        throw new PostImageStorageError(
            "IMAGE_CLEANUP_FAILED",
            "게시글은 삭제되었지만 일부 첨부 이미지 정리가 완료되지 않았습니다.",
            500,
        );
    }
}

export function storedPostImagePath(url: string) {
    const prefixes = ["/api/images/", "/uploads/"];
    const prefix = prefixes.find((candidate) => url.startsWith(candidate));
    if (!prefix) return null;
    const encoded = url.slice(prefix.length);
    let filename: string;
    try { filename = decodeURIComponent(encoded); } catch { return null; }
    if (!filename || filename !== basename(filename) || !/^[A-Za-z0-9._-]+$/.test(filename)) return null;
    const directory = uploadDirectory();
    const path = resolve(directory, filename);
    return path.startsWith(`${directory}${sep}`) ? path : null;
}

export async function readStoredPostImage(url: string) {
    const path = storedPostImagePath(url);
    if (!path) throw new PostImageStorageError("IMAGE_NOT_FOUND", "첨부 이미지를 찾을 수 없습니다.", 404);
    try {
        const bytes = await readFile(path);
        const extension = extname(path).toLowerCase();
        const contentType = extension === ".jpg" || extension === ".jpeg"
            ? "image/jpeg"
            : extension === ".webp"
                ? "image/webp"
                : extension === ".gif"
                    ? "image/gif"
                    : extension === ".svg"
                        ? "image/svg+xml"
                        : "image/png";
        return { bytes, contentType };
    } catch {
        throw new PostImageStorageError("IMAGE_NOT_FOUND", "첨부 이미지를 찾을 수 없습니다.", 404);
    }
}
