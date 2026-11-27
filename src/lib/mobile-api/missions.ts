import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getBowlerHiddenCompetition } from "@/lib/mobile-api/bowler-hidden";
import { getTeamCompetitionState } from "@/lib/mobile-api/team-competition";
import { evaluateMission, HIDDEN_MISSIONS, MissionError, missionProgress, parseMission, snapshotMissionRanks, type MissionRank } from "@/lib/mobile-api/mission-rules";

type Db = Prisma.TransactionClient;
const missionSelect = { id: true, kind: true, threshold: true, points: true } as const;
const seasonSelect = { id: true, name: true, startDate: true, endDate: true } as const;
const memberSelect = { id: true, userId: true, alias: true, joinedAt: true, blindAt: true, user: { select: { name: true } } } as const;
async function access(db: Db, actor: string, teamId: string) {
    const team = await db.team.findFirst({ where: { id: teamId, isActive: true, members: { some: { userId: actor } } }, select: {
        id: true, name: true, ownerId: true, missionsEnabled: true, bowlerHiddenEnabled: true, User: { select: { id: true } },
    } });
    if (!team) throw new MissionError("TEAM_NOT_FOUND", "동호회를 찾을 수 없습니다.", 404);
    return { ...team, canManage: team.ownerId === actor || team.User.some(row => row.id === actor) };
}
async function scope(db: Db, team: Awaited<ReturnType<typeof access>>, actor: string, seasonId: string, memberId: string) {
    const [season, member] = await Promise.all([
        db.teamSeason.findFirst({ where: { id: seasonId, teamId: team.id }, select: seasonSelect }),
        db.teamMember.findFirst({ where: { id: memberId, teamId: team.id }, select: memberSelect }),
    ]);
    if (!season || !member || (member.blindAt && team.ownerId !== actor)) throw new MissionError("MISSION_TARGET_NOT_FOUND", "시즌 또는 회원을 찾을 수 없습니다.", 404);
    if (!team.canManage && member.userId !== actor) throw new MissionError("FORBIDDEN", "본인의 미션만 확인할 수 있습니다.", 403);
    return { season, member };
}
export async function getMissionConfig(actor: string, teamId: string) {
    const team = await access(prisma, actor, teamId);
    const seasons = await prisma.teamSeason.findMany({ where: { teamId }, orderBy: [{ startDate: "desc" }, { id: "asc" }], select: seasonSelect });
    return { enabled: team.missionsEnabled, bowlerHiddenEnabled: team.bowlerHiddenEnabled, canManage: team.canManage,
        seasons: seasons.map(row => ({ ...row, startDate: row.startDate.toISOString(), endDate: row.endDate.toISOString() })) };
}
async function detail(actor: string, team: Awaited<ReturnType<typeof access>>, season: Prisma.TeamSeasonGetPayload<{ select: typeof seasonSelect }>, member: Prisma.TeamMemberGetPayload<{ select: typeof memberSelect }>, now: Date) {
    const kinds = team.bowlerHiddenEnabled ? {} : { kind: { notIn: [...HIDDEN_MISSIONS] } };
    const [missions, manual, scores, publications, mini, calendar] = await Promise.all([
        prisma.teamMission.findMany({ where: { teamId: team.id, seasonId: season.id, memberId: member.id, ...kinds }, select: missionSelect, orderBy: [{ kind: "asc" }, { threshold: "asc" }] }),
        prisma.memberMissionProgress.findUnique({ where: { seasonId_memberId: { seasonId: season.id, memberId: member.id } }, select: { allCoverCount: true, revision: true } }),
        prisma.score.findMany({ where: { teamId: team.id, gameType: "정기전", score: { gte: 0, lte: 300 }, gameDate: { gte: season.startDate, lte: season.endDate }, OR: [{ teamEventId: null }, { TeamEvent: { teamId: team.id, eventDate: { gte: season.startDate, lte: season.endDate }, OR: [{ seasonId: season.id }, { seasonId: null }] } }] }, select: { score: true, userId: true, gameDate: true, teamEventId: true } }),
        team.bowlerHiddenEnabled ? prisma.seasonPointPublication.findMany({ where: { seasonId: season.id, revokedAt: null, competitionType: { in: ["INDIVIDUAL", "TEAM"] }, event: { teamId: team.id, competitionStatus: "PUBLISHED" } }, select: { competitionType: true, competitionDate: true, resultSnapshot: true } }) : [],
        team.bowlerHiddenEnabled ? prisma.teamEvent.findMany({ where: { teamId: team.id, competitionEnabled: true, competitionMode: "MINI", competitionStatus: "PUBLISHED", competitionType: { in: ["INDIVIDUAL", "TEAM"] }, eventDate: { gte: season.startDate, lte: season.endDate }, OR: [{ seasonId: season.id }, { seasonId: null }] }, select: { id: true, competitionType: true, eventDate: true } }) : [],
        prisma.teamEvent.findMany({ where: { teamId: team.id, gameType: "정기전", eventDate: { gte: season.startDate, lte: season.endDate }, OR: [{ seasonId: season.id }, { seasonId: null }] }, select: { id: true, eventDate: true } }),
    ]);
    const ranks: MissionRank[] = publications.flatMap(row => snapshotMissionRanks(row.resultSnapshot, row.competitionType, row.competitionDate));
    // MINI has no season-point ledger. Reuse the existing published result engine, never its point totals.
    if (missions.some(row => HIDDEN_MISSIONS.includes(row.kind))) for (const event of mini) {
        if (event.competitionType === "INDIVIDUAL") {
            const state = await getBowlerHiddenCompetition(actor, team.id, event.id);
            for (const row of state.overall) if (row.memberId) ranks.push({ memberId: row.memberId, type: "INDIVIDUAL", rank: row.rank, date: event.eventDate });
        } else {
            const state = await getTeamCompetitionState(actor, team.id, event.id);
            for (const row of state.results.individual) {
                const rank = state.results.teams.find(value => value.competitionTeamId === row.competitionTeamId)?.finalRank;
                if (row.memberId && rank) ranks.push({ memberId: row.memberId, type: "TEAM", rank, date: event.eventDate });
            }
        }
    }
    const progress = missionProgress({ scores, events: calendar.map(event => ({ id: event.id, date: event.eventDate })), ranks, userId: member.userId, memberId: member.id, start: season.startDate, end: season.endDate, joinedAt: member.joinedAt, now, allCoverCount: manual?.allCoverCount ?? 0 });
    const items = missions.map(row => evaluateMission(row, progress));
    return { teamId: team.id, teamName: team.name, memberId: member.id, memberName: member.alias?.trim() || member.user.name,
        season: { ...season, startDate: season.startDate.toISOString(), endDate: season.endDate.toISOString() },
        canManage: team.canManage, bowlerHiddenEnabled: team.bowlerHiddenEnabled,
        allCoverCount: manual?.allCoverCount ?? 0, allCoverRevision: manual?.revision ?? 0,
        attendedCount: progress.attendedCount, activityCount: progress.activityCount,
        earnedPoints: items.reduce((total, row) => total + row.earnedPoints, 0), achievedCount: items.filter(row => row.achieved).length, missions: items };
}
export async function getMemberMissions(actor: string, teamId: string, seasonId: string, memberId: string, now = new Date()) {
    const team = await access(prisma, actor, teamId);
    if (!team.missionsEnabled) throw new MissionError("MISSIONS_DISABLED", "미션 기능이 꺼져 있습니다.", 409);
    const target = await scope(prisma, team, actor, seasonId, memberId);
    return detail(actor, team, target.season, target.member, now);
}
export async function getMyMissions(actor: string, now = new Date()) {
    const memberships = await prisma.teamMember.findMany({ where: { userId: actor, blindAt: null, team: { isActive: true, missionsEnabled: true } }, select: { ...memberSelect, teamId: true } });
    const groups = [];
    for (const member of memberships) {
        const team = await access(prisma, actor, member.teamId);
        const seasons = await prisma.teamSeason.findMany({ where: { teamId: team.id, OR: [{ missions: { some: { memberId: member.id } } }, { startDate: { lte: now }, endDate: { gte: now } }] }, select: seasonSelect, orderBy: [{ startDate: "desc" }, { id: "asc" }] });
        for (const season of seasons) groups.push(await detail(actor, team, season, member, now));
    }
    return { earnedPoints: groups.reduce((total, row) => total + row.earnedPoints, 0), achievedCount: groups.reduce((total, row) => total + row.achievedCount, 0), groups };
}
function record(value: unknown) {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new MissionError("INVALID_REQUEST", "요청을 확인해주세요.", 400);
    return value as Record<string, unknown>;
}
function id(value: unknown): string {
    if (typeof value !== "string" || !value.trim() || value.length > 128) throw new MissionError("INVALID_REQUEST", "시즌과 회원 정보를 확인해주세요.", 400);
    return value;
}
export async function updateMissions(actor: string, teamId: string, value: unknown) {
    const body = record(value);
    try {
        return await prisma.$transaction(async tx => {
            const team = await access(tx, actor, teamId);
            if (!team.canManage) throw new MissionError("FORBIDDEN", "미션 관리 권한이 없습니다.", 403);
            const allowed: Record<string, string[]> = {
                SET_ENABLED: ["enabled", "expectedEnabled"], ADD_MISSION: ["seasonId", "memberId", "kind", "threshold", "points"],
                DELETE_MISSION: ["missionId"], UPDATE_MISSION: ["missionId", "kind", "threshold", "points"], SET_ALL_COVER: ["seasonId", "memberId", "count", "expectedRevision"],
            };
            if (typeof body.action !== "string" || !Object.prototype.hasOwnProperty.call(allowed, body.action) || Object.keys(body).some(key => key !== "action" && !allowed[body.action as string].includes(key))) throw new MissionError("INVALID_REQUEST", "요청 항목을 확인해주세요.", 400);
            if (body.action === "SET_ENABLED") {
                if (typeof body.enabled !== "boolean" || typeof body.expectedEnabled !== "boolean") throw new MissionError("INVALID_REQUEST", "미션 기능 설정을 확인해주세요.", 400);
                const result = await tx.team.updateMany({ where: { id: teamId, missionsEnabled: body.expectedEnabled }, data: { missionsEnabled: body.enabled } });
                if (result.count !== 1) throw new MissionError("MISSION_CONFLICT", "설정이 변경됐습니다. 다시 확인해주세요.", 409);
                return { enabled: body.enabled };
            }
            if (!team.missionsEnabled) throw new MissionError("MISSIONS_DISABLED", "미션 기능이 꺼져 있습니다.", 409);
            if (body.action === "DELETE_MISSION" || body.action === "UPDATE_MISSION") {
                const mission = await tx.teamMission.findFirst({ where: { id: id(body.missionId), teamId } });
                if (!mission) throw new MissionError("MISSION_NOT_FOUND", "미션을 찾을 수 없습니다.", 404);
                await scope(tx, team, actor, mission.seasonId, mission.memberId);
                if (body.action === "DELETE_MISSION") { await tx.teamMission.delete({ where: { id: mission.id } }); return { deleted: true }; }
                const parsed = parseMission(body);
                if (HIDDEN_MISSIONS.includes(parsed.kind) && !team.bowlerHiddenEnabled) throw new MissionError("HIDDEN_DISABLED", "배볼러 히든이 켜진 팀에서만 설정할 수 있습니다.", 403);
                await tx.teamMission.update({ where: { id: mission.id }, data: parsed }); return { saved: true };
            }
            const seasonId = id(body.seasonId), memberId = id(body.memberId);
            const target = await scope(tx, team, actor, seasonId, memberId);
            if (body.action === "SET_ALL_COVER") {
                if (!Number.isSafeInteger(body.count) || (body.count as number) < 0 || (body.count as number) > 10000 || !Number.isSafeInteger(body.expectedRevision) || (body.expectedRevision as number) < 0) throw new MissionError("INVALID_REQUEST", "올커버 횟수를 확인해주세요.", 400);
                const data = { allCoverCount: body.count as number, updatedByUserId: actor };
                if (body.expectedRevision === 0) await tx.memberMissionProgress.create({ data: { teamId, seasonId, memberId, ...data } });
                else {
                    const result = await tx.memberMissionProgress.updateMany({ where: { teamId, seasonId, memberId, revision: body.expectedRevision as number }, data: { ...data, revision: { increment: 1 } } });
                    if (result.count !== 1) throw new MissionError("MISSION_CONFLICT", "올커버 기록이 변경됐습니다. 다시 확인해주세요.", 409);
                }
                return { saved: true };
            }
            const mission = parseMission(body);
            if (HIDDEN_MISSIONS.includes(mission.kind) && !team.bowlerHiddenEnabled) throw new MissionError("HIDDEN_DISABLED", "배볼러 히든이 켜진 팀에서만 설정할 수 있습니다.", 403);
            if (await tx.teamMission.count({ where: { seasonId: target.season.id, memberId } }) >= 100) throw new MissionError("MISSION_LIMIT", "회원별 시즌 미션은 100개까지 설정할 수 있습니다.", 400);
            await tx.teamMission.create({ data: { teamId, seasonId, memberId, ...mission, createdByUserId: actor } }); return { saved: true };
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2002", "P2034"].includes(error.code)) throw new MissionError("MISSION_CONFLICT", "이미 등록된 미션이거나 다른 관리자가 변경했습니다. 새로고침 후 확인해주세요.", 409);
        throw error;
    }
}
