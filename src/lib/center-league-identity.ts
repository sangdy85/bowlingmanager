import type { Prisma } from '@prisma/client';
import type { LeagueMemberOption } from './league-score-identity';

const nameKey = (name?: string | null) => name?.trim().normalize('NFC') || '';

/** Only memberships of this center's actual teams can establish a roster identity. */
export async function getCenterLeagueMembers(db: Prisma.TransactionClient, centerId: string): Promise<LeagueMemberOption[]> {
    const [centerMembers, teamMembers] = await Promise.all([
        db.centerMember.findMany({
            where: { centerId, Team: { centerId } },
            select: { userId: true, teamId: true, User: { select: { name: true } } },
        }),
        db.teamMember.findMany({
            where: { team: { centerId } },
            select: { userId: true, teamId: true, user: { select: { name: true } } },
        }),
    ]);
    const members = new Map<string, LeagueMemberOption>();
    for (const row of [...centerMembers.map(m => ({ ...m, name: m.User.name })),
        ...teamMembers.map(m => ({ ...m, name: m.user.name }))]) {
        if (!row.teamId || !nameKey(row.name)) continue;
        members.set(JSON.stringify([row.teamId, row.userId]), {
            userId: row.userId, teamId: row.teamId, name: row.name.trim(), squad: null, allSquads: true,
        });
    }
    return [...members.values()];
}

/** Called inside the membership transaction; never changes scores, names or handicaps. */
export async function linkCenterTeamGuestRecords(
    tx: Prisma.TransactionClient, centerId: string, teamId: string, userId: string,
) {
    const result = { linkedScores: 0, linkedRegistrations: 0, reviewRequired: false };
    const members = await getCenterLeagueMembers(tx, centerId);
    const member = members.find(m => m.userId === userId && m.teamId === teamId);
    if (!member) return result;
    const name = nameKey(member.name);
    const candidates = members.filter(m => m.teamId === teamId && nameKey(m.name) === name);
    if (new Set(candidates.map(m => m.userId)).size !== 1) return { ...result, reviewRequired: true };

    const scores = await tx.leagueMatchupIndividualScore.findMany({
        where: { teamId, LeagueMatchup: { round: { tournament: { centerId } } } },
        select: { id: true, matchupId: true, playerName: true, userId: true, User: { select: { name: true } } },
    });
    const registrations = await tx.tournamentRegistration.findMany({
        where: { teamId, tournament: { centerId } },
        select: { id: true, tournamentId: true, guestName: true, userId: true, user: { select: { name: true } } },
    });
    // An existing different account using this name is also an ambiguity, even if it left the roster.
    if (scores.some(s => s.userId && s.userId !== userId && nameKey(s.playerName || s.User?.name) === name)
        || registrations.some(r => r.userId && r.userId !== userId && nameKey(r.user?.name) === name)) {
        return { ...result, reviewRequired: true };
    }

    const guestScores = scores.filter(s => !s.userId && nameKey(s.playerName) === name);
    const safeIds = guestScores.filter(s => {
        const conflict = scores.some(other => other.id !== s.id && other.matchupId === s.matchupId
            && (other.userId === userId || (!other.userId && nameKey(other.playerName) === name)));
        if (conflict) result.reviewRequired = true;
        return !conflict;
    }).map(s => s.id);
    if (safeIds.length) {
        const linked = await tx.leagueMatchupIndividualScore.updateMany({
            where: { id: { in: safeIds }, userId: null }, data: { userId },
        });
        result.linkedScores = linked.count;
    }

    const guestRegistrations = registrations.filter(r => !r.userId && nameKey(r.guestName) === name);
    for (const guest of guestRegistrations) {
        if (guestRegistrations.filter(r => r.tournamentId === guest.tournamentId).length > 1) {
            result.reviewRequired = true;
            continue;
        }
        const existing = await tx.tournamentRegistration.findUnique({
            where: { tournamentId_userId: { tournamentId: guest.tournamentId, userId } }, select: { id: true },
        });
        // Do not delete registrations or combine overlapping participation/payment records automatically.
        if (existing) { result.reviewRequired = true; continue; }
        await tx.tournamentRegistration.update({ where: { id: guest.id }, data: { userId } });
        result.linkedRegistrations++;
    }
    return result;
}
