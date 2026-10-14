import { auth } from '@/auth';
import prisma from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import { todayInKorea } from '@/lib/competition-notices';
import { redirect } from 'next/navigation';

async function competitionAccess() {
    const session = await auth();
    if (!session?.user?.id) return {loggedIn:false, editor:null};
    const user = await prisma.user.findUnique({where: {id: session.user.id}, select: {id: true, role: true}});
    return {loggedIn:true, editor:user?.role === 'SUPER_ADMIN' ? user : null};
}
export async function competitionEditor() { return (await competitionAccess()).editor; }
export async function requireCompetitionEditor(path: string) {
    const access = await competitionAccess();
    if (!access.editor) redirect(access.loggedIn ? '/competitions' : `/login?callbackUrl=${encodeURIComponent(path)}`);
    return access.editor;
}
export function publicNoticeWhere(q: string, status: string, today = todayInKorea()): Prisma.CompetitionNoticeWhereInput {
    const current = new Date(`${today}T00:00:00Z`);
    return {
        published: true,
        ...(q ? {OR: [{title: {contains: q}}, {organizer: {contains: q}}, {venue: {contains: q}}, {format: {contains: q}}]} : {}),
        ...(status === 'upcoming' ? {endDate: {gte: current}} : status === 'finished' ? {endDate: {lt: current}} : status === 'registering' ? {registrationStartDate: {lte: current}, registrationEndDate: {gte: current}, endDate: {gte: current}} : {}),
    };
}
export async function publishedCompetition(id: string) {
    return prisma.competitionNotice.findFirst({where: {id, published: true}});
}
