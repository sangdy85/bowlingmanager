import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { defaultTeamGamePointTables, parseTeamGamePointTables, readTeamGamePointTables, serializeTeamGamePointTables } from "@/lib/mobile-api/team-game-points";
import { revokeSeasonPointPublication } from "@/lib/mobile-api/unified-season";

export const EVENT_ADMIN_ACTIONS = [
    "REOPEN_ATTENDANCE",
    "CLEAR_INDIVIDUAL_GROUPS",
    "RESET_TEAM_DRAFT",
    "RESET_LANES",
    "ADMIN_TEAM_OVERRIDE",
    "RESET_EVENT_PARTICIPANTS",
    "RESET_EVENT_VOTING",
    "RESET_EVENT_BALLOT",
    "REOPEN_PUBLICATION",
    "CHANGE_GAME_COUNT",
    "CLEAR_SCORES",
    "DELETE_EVENT",
] as const;

type EventAdminAction = typeof EVENT_ADMIN_ACTIONS[number];

export class EventAdminOperationError extends Error {
    constructor(public readonly code: string, message: string, public readonly status: number) {
        super(message);
        this.name = "EventAdminOperationError";
    }
}

const adminInclude = {
    team: {
        select: {
            ownerId: true,
            User: { select: { id: true } },
            members: { select: { id: true, userId: true, alias: true, user: { select: { name: true } } } },
        },
    },
    laneAssignments: { select: { id: true } },
    competitionTeams: {
        include: {
            captain: { select: { id: true, alias: true, user: { select: { name: true } } } },
            participants: {
                include: {
                    member: { select: { id: true, alias: true, user: { select: { name: true } } } },
                    guest: { select: { id: true, name: true } },
                },
                orderBy: [{ assignmentOrder: "asc" as const }, { id: "asc" as const }],
            },
        },
        orderBy: [{ draftOrder: "asc" as const }, { id: "asc" as const }],
    },
    competitionParticipants: {
        include: {
            member: { select: { id: true, alias: true, user: { select: { name: true } } } },
            guest: { select: { id: true, name: true } },
        },
        orderBy: [{ assignmentOrder: "asc" as const }, { id: "asc" as const }],
    },
    eventCompetitionParticipants: {
        include: {
            member: { select: { id: true, alias: true, user: { select: { name: true } } } },
            guest: { select: { id: true, name: true } },
        },
        orderBy: [{ revealOrder: "asc" as const }, { id: "asc" as const }],
    },
    eventCompetitionBallots: { select: { id: true, voterParticipantId: true } },
    seasonPublications: {
        where: { revokedAt: null },
        orderBy: { revision: "desc" as const },
        select: { id: true, resultSnapshot: true },
    },
    adminAudits: { orderBy: { createdAt: "desc" as const }, take: 20 },
    _count: { select: { scores: true, charges: true } },
} satisfies Prisma.TeamEventInclude;

type AdminEvent = Prisma.TeamEventGetPayload<{ include: typeof adminInclude }>;
type AdminTx = Prisma.TransactionClient;

export async function getEventAdminOperationsState(actorUserId: string, teamId: string, eventId: string) {
    const event = await loadAdminEvent(prisma, actorUserId, teamId, eventId);
    requireManager(event, actorUserId);
    return serializeAdminState(event);
}

export async function runEventAdminOperation(
    actorUserId: string,
    teamId: string,
    eventId: string,
    value: unknown,
    now = new Date(),
) {
    const body = asRecord(value);
    const action = body.action;
    if (!EVENT_ADMIN_ACTIONS.includes(action as EventAdminAction)) {
        throw new EventAdminOperationError("INVALID_ADMIN_ACTION", "관리자 운영 작업을 확인해주세요.", 400);
    }
    return prisma.$transaction(async (tx) => {
        const event = await loadAdminEvent(tx, actorUserId, teamId, eventId);
        requireManager(event, actorUserId);
        const beforeStatus = event.competitionStatus;
        let result: Record<string, unknown>;
        switch (action as EventAdminAction) {
            case "REOPEN_ATTENDANCE":
                result = await reopenAttendance(tx, event, body);
                break;
            case "CLEAR_INDIVIDUAL_GROUPS":
                result = await clearIndividualGroups(tx, event);
                break;
            case "RESET_TEAM_DRAFT":
                result = await resetTeamDraft(tx, event, body);
                break;
            case "RESET_LANES":
                result = await resetLanes(tx, event, body);
                break;
            case "ADMIN_TEAM_OVERRIDE":
                result = await overrideTeams(tx, event, body);
                break;
            case "RESET_EVENT_PARTICIPANTS":
                result = await resetEventParticipants(tx, event, body);
                break;
            case "RESET_EVENT_VOTING":
                result = await resetEventVoting(tx, event, body, now);
                break;
            case "RESET_EVENT_BALLOT":
                result = await resetEventBallot(tx, event, body);
                break;
            case "REOPEN_PUBLICATION":
                result = await reopenPublication(tx, event, now);
                break;
            case "CHANGE_GAME_COUNT":
                result = await changeGameCount(tx, event, body);
                break;
            case "CLEAR_SCORES":
                result = await clearScores(tx, event, body);
                break;
            case "DELETE_EVENT":
                result = await deleteEvent(tx, event, body, now, actorUserId);
                break;
        }
        if (action !== "DELETE_EVENT") {
            await createAudit(tx, event, actorUserId, action as EventAdminAction, beforeStatus, (result.status as string | null) ?? beforeStatus, result);
        }
        return result;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 60_000 });
}

async function reopenAttendance(tx: AdminTx, event: AdminEvent, body: Record<string, unknown>) {
    if (event.competitionType === "INDIVIDUAL") {
        if (event.competitionStatus !== "GROUPS_READY") stateError();
        await requireScoreClear(tx, event, body);
        await tx.teamEvent.update({ where: { id: event.id }, data: { competitionStatus: "ATTENDANCE_OPEN" } });
        return { status: "ATTENDANCE_OPEN", manualGroupsPreserved: true };
    }
    if (event.competitionType === "TEAM") return reopenTeamAttendance(tx, event, body);
    if (event.competitionType === "EVENT") return resetEventParticipants(tx, event, body);
    throw new EventAdminOperationError("COMPETITION_NOT_AVAILABLE", "대회 일정에서만 사용할 수 있습니다.", 409);
}

async function reopenTeamAttendance(tx: AdminTx, event: AdminEvent, body: Record<string, unknown>) {
    requireType(event, "TEAM");
    if (!["ATTENDANCE_LOCKED", "DRAFT_READY", "DRAFT_IN_PROGRESS", "LUCKY_DRAW", "TEAMS_FINALIZED", "LANES_ASSIGNED"].includes(event.competitionStatus)) {
        stateError();
    }
    const scoreCount = await requireScoreClear(tx, event, body);
    const hasCurrentTeamData = event.competitionTeams.some((item) => item.generation === event.draftGeneration) ||
        event.competitionParticipants.some((item) => item.generation === event.draftGeneration);
    const teamDataReset = hasCurrentTeamData || event.laneAssignments.length > 0;
    await tx.teamEventLaneAssignment.deleteMany({ where: { eventId: event.id } });
    await tx.teamEvent.update({ where: { id: event.id }, data: {
        ...(teamDataReset ? { draftGeneration: { increment: 1 } } : {}),
        currentPickNumber: 1,
        competitionStatus: "ATTENDANCE_OPEN",
        laneDrawStatus: "NOT_STARTED",
    } });
    return {
        status: "ATTENDANCE_OPEN",
        attendancePreserved: true,
        teamDataReset,
        generation: event.draftGeneration + (teamDataReset ? 1 : 0),
        scoresCleared: scoreCount,
    };
}

async function clearIndividualGroups(tx: AdminTx, event: AdminEvent) {
    requireType(event, "INDIVIDUAL");
    if (!["ATTENDANCE_OPEN", "GROUPS_READY"].includes(event.competitionStatus)) stateError();
    await tx.teamEventAttendance.updateMany({ where: { eventId: event.id }, data: { manualGroup: null } });
    await tx.teamEventGuest.updateMany({ where: { eventId: event.id }, data: { manualGroup: null } });
    return { status: event.competitionStatus, groupsCleared: true };
}

async function resetTeamDraft(tx: AdminTx, event: AdminEvent, body: Record<string, unknown>) {
    requireType(event, "TEAM");
    if (!["DRAFT_READY", "DRAFT_IN_PROGRESS", "LUCKY_DRAW", "TEAMS_FINALIZED", "LANES_ASSIGNED"].includes(event.competitionStatus)) stateError();
    const scoreCount = await requireScoreClear(tx, event, body);
    const generation = event.draftGeneration + 1;
    await tx.teamEventLaneAssignment.deleteMany({ where: { eventId: event.id } });
    await tx.teamEvent.update({ where: { id: event.id }, data: {
        draftGeneration: { increment: 1 }, currentPickNumber: 1,
        competitionStatus: "ATTENDANCE_LOCKED", laneDrawStatus: "NOT_STARTED",
    } });
    return { status: "ATTENDANCE_LOCKED", generation, scoresCleared: scoreCount };
}

async function resetLanes(tx: AdminTx, event: AdminEvent, body: Record<string, unknown>) {
    if (event.laneDrawStatus === "NOT_STARTED" && event.laneAssignments.length === 0) {
        throw new EventAdminOperationError("LANES_NOT_ASSIGNED", "초기화할 레인 배정이 없습니다.", 409);
    }
    const scoreCount = await requireScoreClear(tx, event, body);
    await tx.teamEventLaneAssignment.deleteMany({ where: { eventId: event.id } });
    const status = event.competitionType === "TEAM" && event.competitionStatus === "LANES_ASSIGNED"
        ? "TEAMS_FINALIZED"
        : event.competitionStatus;
    await tx.teamEvent.update({ where: { id: event.id }, data: { laneDrawStatus: "NOT_STARTED", competitionStatus: status } });
    return { status, laneDrawStatus: "NOT_STARTED", slotsPreserved: true, scoresCleared: scoreCount };
}

async function overrideTeams(tx: AdminTx, event: AdminEvent, body: Record<string, unknown>) {
    requireType(event, "TEAM");
    if (!["TEAMS_FINALIZED", "LANES_ASSIGNED"].includes(event.competitionStatus)) stateError();
    const raw = body.assignments;
    if (!Array.isArray(raw)) invalidAssignments();
    const assignments = raw.map((value) => {
        const item = asRecord(value);
        if (typeof item.participantId !== "string" || typeof item.competitionTeamId !== "string") invalidAssignments();
        return { participantId: item.participantId, competitionTeamId: item.competitionTeamId };
    });
    const participants = event.competitionParticipants.filter((item) => item.generation === event.draftGeneration);
    const teams = event.competitionTeams.filter((item) => item.generation === event.draftGeneration);
    const participantIds = new Set(participants.map((item) => item.id));
    const teamIds = new Set(teams.map((item) => item.id));
    if (assignments.length !== participants.length || new Set(assignments.map((item) => item.participantId)).size !== participants.length ||
        assignments.some((item) => !participantIds.has(item.participantId) || !teamIds.has(item.competitionTeamId))) invalidAssignments();
    for (const team of teams) {
        const captainParticipant = participants.find((item) => item.memberId === team.captainMemberId);
        if (!captainParticipant || assignments.find((item) => item.participantId === captainParticipant.id)?.competitionTeamId !== team.id) {
            throw new EventAdminOperationError("CAPTAIN_TEAM_REQUIRED", "각 팀장은 기존 TEAM에 유지해주세요.", 400);
        }
    }
    const scoreCount = await requireScoreClear(tx, event, body);
    const orderByTeam = new Map<string, number>();
    for (const assignment of assignments) {
        const nextOrder = (orderByTeam.get(assignment.competitionTeamId) ?? 0) + 1;
        orderByTeam.set(assignment.competitionTeamId, nextOrder);
        const participant = participants.find((item) => item.id === assignment.participantId)!;
        await tx.teamCompetitionParticipant.update({ where: { id: assignment.participantId }, data: {
            competitionTeamId: assignment.competitionTeamId,
            assignmentType: participant.competitionTeamId === assignment.competitionTeamId
                ? participant.assignmentType
                : "ADMIN_OVERRIDE",
            assignmentOrder: nextOrder,
        } });
    }
    await tx.teamEventLaneAssignment.deleteMany({ where: { eventId: event.id } });
    await tx.teamEvent.update({ where: { id: event.id }, data: { competitionStatus: "TEAMS_FINALIZED", laneDrawStatus: "NOT_STARTED" } });
    return {
        status: "TEAMS_FINALIZED", assignmentsUpdated: assignments.length,
        laneAssignmentsReset: event.laneAssignments.length > 0, scoresCleared: scoreCount,
        unbalanced: new Set(teams.map((team) => orderByTeam.get(team.id) ?? 0)).size > 1,
    };
}

async function resetEventParticipants(tx: AdminTx, event: AdminEvent, body: Record<string, unknown>) {
    requireType(event, "EVENT");
    if (!["EVENT_READY", "REVEALING", "FINAL_READY"].includes(event.competitionStatus)) stateError();
    const scoreCount = await requireScoreClear(tx, event, body);
    await tx.eventCompetitionBallot.deleteMany({ where: { eventId: event.id } });
    await tx.eventCompetitionParticipant.deleteMany({ where: { eventId: event.id } });
    await tx.teamEvent.update({ where: { id: event.id }, data: {
        competitionStatus: "ATTENDANCE_OPEN", eventRevealIndex: 0,
        eventNonVoterPolicy: null, eventTieBreakPolicy: null, eventVotingDeadlineAt: null,
    } });
    return { status: "ATTENDANCE_OPEN", attendancePreserved: true, scoresCleared: scoreCount };
}

async function resetEventVoting(tx: AdminTx, event: AdminEvent, body: Record<string, unknown>, now: Date) {
    requireType(event, "EVENT");
    if (!["EVENT_READY", "REVEALING", "FINAL_READY"].includes(event.competitionStatus)) stateError();
    const preserveBallots = body.preserveBallots === true;
    const durationMinutes = body.durationMinutes;
    if (!Number.isSafeInteger(durationMinutes) || ![10, 20, 30, 60].includes(durationMinutes as number)) {
        throw new EventAdminOperationError("INVALID_VOTING_DURATION", "투표 시간은 10, 20, 30, 60분 중 선택해주세요.", 400);
    }
    if (!preserveBallots) await tx.eventCompetitionBallot.deleteMany({ where: { eventId: event.id } });
    await tx.eventCompetitionParticipant.updateMany({ where: { eventId: event.id }, data: { revealedAt: null } });
    const deadline = new Date(now.getTime() + (durationMinutes as number) * 60_000);
    await tx.teamEvent.update({ where: { id: event.id }, data: {
        competitionStatus: "EVENT_READY", votingDurationMinutes: durationMinutes as number,
        eventVotingDeadlineAt: deadline, eventRevealIndex: 0,
        eventNonVoterPolicy: null, eventTieBreakPolicy: null,
    } });
    return { status: "EVENT_READY", ballotsPreserved: preserveBallots, voteDeadline: deadline.toISOString() };
}

async function resetEventBallot(tx: AdminTx, event: AdminEvent, body: Record<string, unknown>) {
    requireType(event, "EVENT");
    if (event.competitionStatus !== "EVENT_READY") stateError();
    if (typeof body.voterParticipantId !== "string") {
        throw new EventAdminOperationError("INVALID_PARTICIPANT", "투표를 초기화할 참가자를 확인해주세요.", 400);
    }
    const voter = event.eventCompetitionParticipants.find((item) => item.id === body.voterParticipantId);
    if (!voter) throw new EventAdminOperationError("INVALID_PARTICIPANT", "현재 EVENT 참가자를 찾을 수 없습니다.", 404);
    const deleted = await tx.eventCompetitionBallot.deleteMany({ where: { eventId: event.id, voterParticipantId: voter.id } });
    if (deleted.count !== 1) throw new EventAdminOperationError("BALLOT_NOT_FOUND", "제출된 투표가 없습니다.", 404);
    return { status: "EVENT_READY", voterParticipantId: voter.id, ballotReset: true };
}

async function reopenPublication(tx: AdminTx, event: AdminEvent, now: Date) {
    if (event.competitionStatus !== "PUBLISHED") stateError();
    await revokeSeasonPointPublication(tx, event.id, now, event.competitionMode === "OFFICIAL");
    let status: string;
    const data: Prisma.TeamEventUpdateInput = { seasonPublicationRevision: { increment: 1 } };
    if (event.competitionType === "INDIVIDUAL") {
        status = "GROUPS_READY";
    } else if (event.competitionType === "TEAM") {
        status = previousTeamStatus(event);
    } else if (event.competitionType === "EVENT") {
        status = "FINAL_READY";
        data.eventPublishedAt = null;
        data.eventPublishedSnapshot = null;
    } else {
        throw new EventAdminOperationError("COMPETITION_NOT_AVAILABLE", "대회 일정에서만 사용할 수 있습니다.", 409);
    }
    data.competitionStatus = status;
    await tx.teamEvent.update({ where: { id: event.id }, data });
    return { status, publicationRevoked: true };
}

async function changeGameCount(tx: AdminTx, event: AdminEvent, body: Record<string, unknown>) {
    if (!event.competitionEnabled || !event.competitionType) {
        throw new EventAdminOperationError("COMPETITION_NOT_AVAILABLE", "대회 일정에서만 사용할 수 있습니다.", 409);
    }
    if (event.competitionStatus === "PUBLISHED") {
        throw new EventAdminOperationError("REOPEN_REQUIRED", "발표 결과를 먼저 다시 열어주세요.", 409);
    }
    const gameCount = body.gameCount;
    if (!Number.isSafeInteger(gameCount) || (gameCount as number) < 1 || (gameCount as number) > 12) {
        throw new EventAdminOperationError("INVALID_GAME_COUNT", "경기 게임 수는 1~12 사이여야 합니다.", 400);
    }
    const scoreCount = await requireScoreClear(tx, event, body);
    let rankPoints = event.rankPoints;
    if (event.competitionType === "TEAM") {
        try {
            if (body.teamGamePointTables != null) {
                rankPoints = serializeTeamGamePointTables(parseTeamGamePointTables(body.teamGamePointTables, gameCount as number));
            } else {
                const oldCount = event.competitionGameCount ?? (gameCount as number);
                const previous = readTeamGamePointTables(event.rankPoints, oldCount);
                const defaults = defaultTeamGamePointTables(gameCount as number);
                rankPoints = serializeTeamGamePointTables(defaults.map((item, index) => previous[index]
                    ? { gameNumber: index + 1, points: previous[index].points }
                    : item));
            }
        } catch {
            throw new EventAdminOperationError("INVALID_TEAM_GAME_POINTS", "TEAM 게임별 포인트 설정을 확인해주세요.", 400);
        }
    }
    await tx.teamEvent.update({ where: { id: event.id }, data: { competitionGameCount: gameCount as number, rankPoints } });
    return { status: event.competitionStatus, gameCount, previousGameCount: event.competitionGameCount, scoresCleared: scoreCount };
}

async function clearScores(tx: AdminTx, event: AdminEvent, body: Record<string, unknown>) {
    if (body.clearScores !== true) {
        throw new EventAdminOperationError("SCORE_CLEAR_CONFIRMATION_REQUIRED", "점수 초기화 확인이 필요합니다.", 409);
    }
    if (event.competitionStatus === "PUBLISHED") {
        throw new EventAdminOperationError("REOPEN_REQUIRED", "발표 결과를 먼저 다시 열어주세요.", 409);
    }
    const deleted = await tx.score.deleteMany({ where: { teamEventId: event.id } });
    return { status: event.competitionStatus, scoresCleared: deleted.count };
}

async function deleteEvent(
    tx: AdminTx,
    event: AdminEvent,
    body: Record<string, unknown>,
    now: Date,
    actorUserId: string,
) {
    if (body.confirmTitle !== event.title) {
        throw new EventAdminOperationError("EVENT_TITLE_CONFIRMATION_REQUIRED", "삭제하려면 대회 제목을 정확히 입력해주세요.", 400);
    }
    const scoreCount = event._count.scores;
    if (scoreCount > 0 && body.clearScores !== true) {
        throw new EventAdminOperationError("SCORE_CLEAR_CONFIRMATION_REQUIRED", `현재 입력된 경기 점수 ${scoreCount}건 삭제 확인이 필요합니다.`, 409);
    }
    const publicationRevoked = event.seasonPublications.length > 0;
    if (publicationRevoked) await revokeSeasonPointPublication(tx, event.id, now, false);
    await createAudit(tx, event, actorUserId, "DELETE_EVENT", event.competitionStatus, null, {
        scoreCount, publicationRevoked, financeLinksPreserved: event._count.charges,
    });
    if (scoreCount > 0) await tx.score.deleteMany({ where: { teamEventId: event.id } });
    await tx.teamEvent.delete({ where: { id: event.id } });
    return {
        deleted: true, status: null, scoresCleared: scoreCount, publicationRevoked,
        financeLinksPreserved: event._count.charges,
    };
}

async function requireScoreClear(tx: AdminTx, event: AdminEvent, body: Record<string, unknown>) {
    const scoreCount = event._count.scores;
    if (scoreCount === 0) return 0;
    if (body.clearScores !== true) {
        throw new EventAdminOperationError("SCORE_CLEAR_CONFIRMATION_REQUIRED", `현재 입력된 경기 점수 ${scoreCount}건이 삭제됩니다.`, 409);
    }
    await tx.score.deleteMany({ where: { teamEventId: event.id } });
    return scoreCount;
}

async function createAudit(
    tx: AdminTx,
    event: AdminEvent,
    actorUserId: string,
    action: EventAdminAction,
    beforeStatus: string | null,
    afterStatus: string | null,
    details: unknown,
) {
    await tx.teamEventAdminAudit.create({ data: {
        eventId: event.id,
        eventSnapshotId: event.id,
        eventTitle: event.title,
        teamId: event.teamId,
        actorUserId,
        action,
        competitionType: event.competitionType,
        beforeStatus,
        afterStatus,
        detailsJson: JSON.stringify(details),
    } });
}

async function loadAdminEvent(
    db: Pick<typeof prisma, "teamEvent"> | Pick<AdminTx, "teamEvent">,
    actorUserId: string,
    teamId: string,
    eventId: string,
) {
    const event = await db.teamEvent.findFirst({
        where: { id: eventId, teamId, team: { isActive: true, members: { some: { userId: actorUserId } } } },
        include: adminInclude,
    });
    if (!event) throw new EventAdminOperationError("EVENT_NOT_FOUND", "일정을 찾을 수 없습니다.", 404);
    return event;
}

function serializeAdminState(event: AdminEvent) {
    const currentParticipants = event.competitionParticipants.filter((item) => item.generation === event.draftGeneration);
    const currentTeams = event.competitionTeams.filter((item) => item.generation === event.draftGeneration);
    return {
        eventId: event.id,
        title: event.title,
        competitionType: event.competitionType,
        competitionStatus: event.competitionStatus,
        laneDrawStatus: event.laneDrawStatus,
        gameCount: event.competitionGameCount,
        teamGamePointTables: event.competitionType === "TEAM" && event.competitionGameCount != null
            ? readTeamGamePointTables(event.rankPoints, event.competitionGameCount)
            : [],
        scoreCount: event._count.scores,
        activePublicationCount: event.seasonPublications.length,
        financeLinkCount: event._count.charges,
        generation: event.draftGeneration,
        teams: currentTeams.map((team) => ({
            id: team.id, name: team.name, captainMemberId: team.captainMemberId,
            members: team.participants.filter((item) => item.generation === event.draftGeneration).map((item) => ({
                participantId: item.id,
                participantKind: item.memberId ? "MEMBER" : "GUEST",
                memberId: item.memberId,
                guestId: item.guestId,
                name: item.member ? displayName(item.member) : item.guest?.name ?? "게스트",
                assignmentType: item.assignmentType,
            })),
        })),
        unassignedParticipants: currentParticipants.filter((item) => !item.competitionTeamId).map((item) => ({
            participantId: item.id,
            participantKind: item.memberId ? "MEMBER" : "GUEST",
            memberId: item.memberId,
            guestId: item.guestId,
            name: item.member ? displayName(item.member) : item.guest?.name ?? "게스트",
        })),
        eventParticipants: event.eventCompetitionParticipants.map((item) => ({
            participantId: item.id,
            name: item.member ? displayName(item.member) : item.guest?.name ?? "게스트",
            hasBallot: event.eventCompetitionBallots.some((ballot) => ballot.voterParticipantId === item.id),
        })),
        audits: event.adminAudits.map((audit) => ({
            id: audit.id, action: audit.action, beforeStatus: audit.beforeStatus,
            afterStatus: audit.afterStatus, createdAt: audit.createdAt.toISOString(),
        })),
    };
}

function previousTeamStatus(event: AdminEvent) {
    const raw = event.seasonPublications[0]?.resultSnapshot;
    if (raw) {
        try {
            const snapshot = JSON.parse(raw) as { previousStatus?: unknown };
            if (snapshot.previousStatus === "TEAMS_FINALIZED" || snapshot.previousStatus === "LANES_ASSIGNED") return snapshot.previousStatus;
        } catch {
            // Use current lane evidence for legacy snapshots.
        }
    }
    return event.laneAssignments.length > 0 ? "LANES_ASSIGNED" : "TEAMS_FINALIZED";
}

function requireManager(event: AdminEvent, actorUserId: string) {
    if (event.team.ownerId !== actorUserId && !event.team.User.some((item) => item.id === actorUserId)) {
        throw new EventAdminOperationError("FORBIDDEN", "관리자 운영 도구 권한이 없습니다.", 403);
    }
}

function requireType(event: AdminEvent, type: "INDIVIDUAL" | "TEAM" | "EVENT") {
    if (!event.competitionEnabled || event.competitionType !== type) {
        throw new EventAdminOperationError("COMPETITION_TYPE_MISMATCH", `${type} 대회에서만 사용할 수 있습니다.`, 409);
    }
}

function invalidAssignments(): never {
    throw new EventAdminOperationError("INVALID_TEAM_ASSIGNMENTS", "현재 참가자를 각각 하나의 TEAM에 배정해주세요.", 400);
}

function stateError(): never {
    throw new EventAdminOperationError("INVALID_COMPETITION_STATE", "현재 대회 단계에서는 수행할 수 없습니다.", 409);
}

function asRecord(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new EventAdminOperationError("INVALID_REQUEST", "요청 내용을 확인해주세요.", 400);
    }
    return value as Record<string, unknown>;
}

function displayName(member: { alias: string | null; user: { name: string } }) {
    return member.alias?.trim() || member.user.name;
}
