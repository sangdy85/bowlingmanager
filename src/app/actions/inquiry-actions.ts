'use server';

import prisma from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';

export async function createInquiry(formData: { title: string; content: string }) {
    const session = await auth();
    if (!session?.user?.id) throw new Error('Unauthorized');

    try {
        const inquiry = await prisma.inquiry.create({
            data: {
                title: formData.title,
                content: formData.content,
                authorId: session.user.id,
                status: 'PENDING',
            },
        });
        revalidatePath('/about');
        return { success: true, inquiry };
    } catch (error) {
        console.error('Failed to create inquiry:', error);
        return { success: false, error: '문의 등록 중 오류가 발생했습니다.' };
    }
}

export async function getInquiries() {
    const session = await auth();
    if (!session?.user?.id) return [];

    try {
        // If admin, show all inquiries. Otherwise, only show own inquiries.
        const isAdmin = session.user.role === 'SUPER_ADMIN';

        const inquiries = await prisma.inquiry.findMany({
            where: isAdmin ? {} : { authorId: session.user.id },
            include: {
                author: {
                    select: { name: true }
                }
            },
            orderBy: { createdAt: 'desc' },
        });
        return inquiries;
    } catch (error) {
        console.error('Failed to fetch inquiries:', error);
        return [];
    }
}

export async function answerInquiry(inquiryId: string, answer: string) {
    const session = await auth();
    if (session?.user?.role !== 'SUPER_ADMIN') throw new Error('Unauthorized');

    try {
        await prisma.inquiry.update({
            where: { id: inquiryId },
            data: {
                answer,
                status: 'ANSWERED',
            },
        });
        revalidatePath('/about');
        return { success: true };
    } catch (error) {
        console.error('Failed to answer inquiry:', error);
        return { success: false, error: '답변 등록 중 오류가 발생했습니다.' };
    }
}

export async function deleteInquiry(inquiryId: string) {
    const session = await auth();
    const isAdmin = session?.user?.role === 'SUPER_ADMIN';

    try {
        const inq = await prisma.inquiry.findUnique({ where: { id: inquiryId } });
        if (!inq) throw new Error('Inquiry not found');

        // Only author or admin can delete
        if (!isAdmin && inq.authorId !== session?.user?.id) {
            throw new Error('Unauthorized');
        }

        await prisma.inquiry.delete({
            where: { id: inquiryId },
        });
        revalidatePath('/about');
        return { success: true };
    } catch (error) {
        console.error('Failed to delete inquiry:', error);
        return { success: false, error: '문의 삭제 중 오류가 발생했습니다.' };
    }
}
