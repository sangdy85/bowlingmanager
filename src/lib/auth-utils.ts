import { auth } from "@/auth";
import prisma from "@/lib/prisma";

export class CenterAuthorizationError extends Error {}

async function requireSessionUserId() {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) throw new CenterAuthorizationError("로그인이 필요합니다.");
    return userId;
}

async function isCenterAdmin(centerId: string, userId: string) {
    const center = await prisma.bowlingCenter.findUnique({
        where: { id: centerId },
        select: { ownerId: true, managers: { select: { id: true } } },
    });
    return !!center && (center.ownerId === userId || center.managers.some(manager => manager.id === userId));
}

/**
 * Center owner or one of the center's managers. Mirrors the `isManager`
 * check the tournament pages use to show management UI.
 */
export async function verifyCenterAdmin(centerId: string) {
    const userId = await requireSessionUserId();
    if (!centerId || !(await isCenterAdmin(centerId, userId))) {
        throw new CenterAuthorizationError("해당 볼링장에 대한 관리 권한이 없습니다.");
    }
    return userId;
}

export async function verifyTournamentAdmin(tournamentId: string) {
    const tournament = await prisma.tournament.findUnique({
        where: { id: tournamentId },
        select: { centerId: true },
    });
    if (!tournament) throw new CenterAuthorizationError("대회를 찾을 수 없습니다.");
    const userId = await verifyCenterAdmin(tournament.centerId);
    return { userId, centerId: tournament.centerId, tournamentId };
}

export async function verifyRoundAdmin(roundId: string) {
    const round = await prisma.leagueRound.findUnique({
        where: { id: roundId },
        select: { tournamentId: true },
    });
    if (!round) throw new CenterAuthorizationError("라운드 정보를 찾을 수 없습니다.");
    return verifyTournamentAdmin(round.tournamentId);
}

export async function verifyRegistrationAdmin(registrationId: string) {
    const registration = await prisma.tournamentRegistration.findUnique({
        where: { id: registrationId },
        select: { tournamentId: true },
    });
    if (!registration) throw new CenterAuthorizationError("참가 신청 정보를 찾을 수 없습니다.");
    return verifyTournamentAdmin(registration.tournamentId);
}
