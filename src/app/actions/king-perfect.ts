'use server';
import { auth } from '@/auth';
import { revalidatePath } from 'next/cache';
import { executeKingPerfect, searchKingPerfectMembers, type Command } from '@/lib/king-perfect/service';
async function actor() {
  const session = await auth();
  if (!session?.user?.id) throw new Error('로그인이 필요합니다.');
  return session.user.id;
}
export async function kingPerfectCommand(editionId: string, command: Command) {
  try {
    const result = await executeKingPerfect(await actor(), editionId, command);
    revalidatePath('/centers', 'layout');
    return { ...result, error: null };
  } catch (e) { return { success: false, replayed: false, error: e instanceof Error ? e.message : '저장하지 못했습니다.' }; }
}
export async function kingPerfectMemberSearch(editionId: string, query: string) {
  return searchKingPerfectMembers(await actor(), editionId, query);
}
