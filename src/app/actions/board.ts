'use server';

import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export type PostData = {
    title: string;
    content: string;
    images?: { url: string; size: number }[];
}

export async function createPost(teamId: string, data: PostData) {
    const session = await auth();
    if (!session?.user?.id) {
        throw new Error("Unauthorized");
    }

    // Verify team membership
    const membership = await prisma.team.findFirst({
        where: {
            id: teamId,
            members: { some: { userId: session.user.id } }
        }
    });

    if (!membership) {
        throw new Error("Not a member of this team");
    }

    // Check Storage Limit (10MB)
    const newSize = data.images?.reduce((acc, img) => acc + img.size, 0) || 0;

    const aggregate = await prisma.postImage.aggregate({
        _sum: { size: true },
        where: { post: { teamId: teamId } }
    });
    const currentTotal = aggregate._sum.size || 0;

    if (currentTotal + newSize > 10 * 1024 * 1024) {
        throw new Error("팀 저장 용량(10MB)을 초과했습니다. 기존 게시글/이미지를 삭제해주세요.");
    }

    const post = await prisma.post.create({
        data: {
            title: data.title,
            content: data.content,
            teamId: teamId,
            authorId: session.user.id,
            images: {
                create: data.images?.map(img => ({ url: img.url, size: img.size })) || []
            }
        }
    });

    revalidatePath(`/team/${teamId}`);
    return { success: true, post };
}

export async function getRecentPosts(teamId: string, limit: number = 3) {
    const posts = await prisma.post.findMany({
        where: { teamId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: {
            author: {
                select: { name: true }
            }
        }
    });

    return posts;
}

export async function getPosts(teamId: string, page: number = 1, pageSize: number = 10) {
    const skip = (page - 1) * pageSize;

    const [posts, totalCount] = await prisma.$transaction([
        prisma.post.findMany({
            where: { teamId },
            orderBy: { createdAt: 'desc' },
            skip,
            take: pageSize,
            include: {
                author: {
                    select: { name: true, id: true }
                }
            }
        }),
        prisma.post.count({ where: { teamId } })
    ]);

    return { posts, totalCount, totalPages: Math.ceil(totalCount / pageSize) };
}

export async function getPost(postId: string) {
    const post = await prisma.post.findUnique({
        where: { id: postId },
        include: {
            author: { select: { name: true, id: true } },
            images: true
        }
    });
    return post;
}

export async function deletePost(postId: string, teamId: string) {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    const post = await prisma.post.findUnique({
        where: { id: postId },
        include: { team: true }
    });

    if (!post) return { success: false, error: "Post not found" };

    // Allow author or team owner to delete? For now, author only.
    if (post.authorId !== session.user.id) {
        return { success: false, error: "Forbidden" };
    }

    await prisma.post.delete({ where: { id: postId } });
    revalidatePath(`/team/${teamId}`);
    return { success: true };
}
