import { randomInt } from "node:crypto";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import {
    BOWLER_HIDDEN_COMPETITION_TYPES,
    parseRankPoints,
    readRankPoints,
    serializeRankPoints,
} from "@/lib/mobile-api/bowler-hidden";

export const TEAM_EVENT_ATTENDANCE = ["UNANSWERED", "ATTENDING", "NOT_ATTENDING"] as const;
export const TEAM_EVENT_DRAW_MODES = ["BULK", "INDIVIDUAL"] as const;
export const TEAM_EVENT_DRAW_STATUSES = ["NOT_STARTED", "OPEN", "COMPLETED"] as const;
export const COMPETITION_MODES = ["OFFICIAL", "MINI"] as const;
export const TEAM_EVENT_LANE_LIMITS = { minLane: 1, maxLane: 24, minPosition: 1, maxPosition: 6 } as const;

type AttendanceStatus = typeof TEAM_EVENT_ATTENDANCE[number];
type DrawMode = typeof TEAM_EVENT_DRAW_MODES[number];
type DrawStatus = typeof TEAM_EVENT_DRAW_STATUSES[number];
type TeamRole = "OWNER" | "MANAGER" | "MEMBER";
type SlotInput = { laneNumber: number; position: number };
type EventInput = {
    title: string;
    date: string;
    time: string;
    location: string;
    gameType: string | null;
    attendanceEnabled: boolean;
    laneDrawEnabled: boolean;
    laneDrawMode: DrawMode;
    competitionEnabled: boolean;
    competitionType: "INDIVIDUAL" | "TEAM" | "EVENT" | null;
    competitionMode: "OFFICIAL" | "MINI" | null;
    competitionGameCount: number | null;
    rankPoints: { rank: number; points: number }[];
};

export class TeamEventError extends Error {
    constructor(public readonly code: string, message: string, public readonly status: number) {
        super(message);
    }
}

export function fisherYatesShuffle<T>(values: readonly T[], pick = randomInt): T[] {
    const result = [...values];
    for (let index = result.length - 1; index > 0; index -= 1) {
        const swapIndex = pick(index + 1);
        [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
    }
    return result;
}

export function kstDateKey(now = new Date()): string {
    return new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit",
    }).format(now);
}

export function parseTeamEventInput(value: unknown, bowlerHiddenEnabled = false): EventInput {
    const body = asRecord(value);
    const title = requiredText(body.title, 100, "일정 제목을 확인해주세요.");
    const date = parseDateKey(body.date);
    const time = typeof body.time === "string" && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(body.time)
        ? body.time : null;
    const location = requiredText(body.location, 120, "장소를 확인해주세요.");
    const gameType = body.gameType === null || body.gameType === undefined || body.gameType === ""
        ? null : requiredText(body.gameType, 40, "경기 유형을 확인해주세요.");
    const attendanceEnabled = body.attendanceEnabled;
    const laneDrawEnabled = body.laneDrawEnabled;
    const laneDrawMode = body.laneDrawMode;
    if (!time || typeof attendanceEnabled !== "boolean" || typeof laneDrawEnabled !== "boolean" ||
        !TEAM_EVENT_DRAW_MODES.includes(laneDrawMode as DrawMode)) {
        throw new TeamEventError("INVALID_REQUEST", "일정 정보를 확인해주세요.", 400);
    }
    const competitionEnabled = body.competitionEnabled === true;
    if (body.competitionEnabled !== undefined && typeof body.competitionEnabled !== "boolean") {
        throw new TeamEventError("INVALID_COMPETITION", "대회 설정을 확인해주세요.", 400);
    }
    if (competitionEnabled && !bowlerHiddenEnabled) {
        throw new TeamEventError("FEATURE_DISABLED", "Bowler Hidden 기능이 활성화되지 않은 팀입니다.", 403);
    }
    const requestedType = body.competitionType;
    const requestedMode = body.competitionMode;
    if (competitionEnabled && !BOWLER_HIDDEN_COMPETITION_TYPES.includes(requestedType as never)) {
        throw new TeamEventError("INVALID_COMPETITION", "대회 유형을 확인해주세요.", 400);
    }
    if (competitionEnabled && !COMPETITION_MODES.includes(requestedMode as never)) {
        throw new TeamEventError("INVALID_COMPETITION_MODE", "대회 적용 모드를 확인해주세요.", 400);
    }
    if (competitionEnabled && attendanceEnabled !== true) {
        throw new TeamEventError("ATTENDANCE_REQUIRED", "Bowler Hidden 대회는 참석 조사가 필요합니다.", 400);
    }
    if (competitionEnabled && requestedType === "TEAM" && laneDrawEnabled !== true) {
        throw new TeamEventError("LANE_CONFIG_REQUIRED", "TEAM 대회는 레인 배정 설정이 필요합니다.", 400);
    }
    const competitionGameCount = body.competitionGameCount;
    if (competitionEnabled && requestedType === "EVENT" &&
        (!Number.isSafeInteger(competitionGameCount) || (competitionGameCount as number) < 1 || (competitionGameCount as number) > 12)) {
        throw new TeamEventError("INVALID_GAME_COUNT", "EVENT 대회 게임 수는 1~12 사이여야 합니다.", 400);
    }
    let rankPoints: { rank: number; points: number }[] = [];
    try { rankPoints = competitionEnabled ? parseRankPoints(body.rankPoints ?? []) : []; }
    catch (error) {
        if (error instanceof Error && "code" in error) {
            throw new TeamEventError("INVALID_RANK_POINTS", error.message, 400);
        }
        throw error;
    }
    return {
        title, date, time, location, gameType, attendanceEnabled, laneDrawEnabled,
        laneDrawMode: laneDrawMode as DrawMode, competitionEnabled,
        competitionType: competitionEnabled ? requestedType as "INDIVIDUAL" | "TEAM" | "EVENT" : null,
        competitionMode: competitionEnabled ? requestedMode as "OFFICIAL" | "MINI" : null,
        competitionGameCount: competitionEnabled && requestedType === "EVENT" ? competitionGameCount as number : null,
        rankPoints,
    };
}

export function parseAttendanceStatus(value: unknown): AttendanceStatus {
    const status = asRecord(value).status;
    if (!TEAM_EVENT_ATTENDANCE.includes(status as AttendanceStatus) || status === "UNANSWERED") {
        throw new TeamEventError("INVALID_ATTENDANCE", "참석 여부를 확인해주세요.", 400);
    }
    return status as AttendanceStatus;
}

export function parseLaneSlots(value: unknown): SlotInput[] {
    const slots = asRecord(value).slots;
    if (!Array.isArray(slots) || slots.length > 144) {
        throw new TeamEventError("INVALID_LANE_CONFIG", "레인 좌석을 확인해주세요.", 400);
    }
    const seen = new Set<string>();
    return slots.map((item) => {
        const slot = asRecord(item);
        if (!Number.isInteger(slot.laneNumber) || !Number.isInteger(slot.position)) {
            throw new TeamEventError("INVALID_LANE_CONFIG", "레인 좌석을 확인해주세요.", 400);
        }
        const laneNumber = slot.laneNumber as number;
        const position = slot.position as number;
        if (laneNumber < TEAM_EVENT_LANE_LIMITS.minLane || laneNumber > TEAM_EVENT_LANE_LIMITS.maxLane ||
            position < TEAM_EVENT_LANE_LIMITS.minPosition || position > TEAM_EVENT_LANE_LIMITS.maxPosition) {
            throw new TeamEventError("INVALID_LANE_CONFIG", "레인은 1~24, 좌석은 1~6 범위여야 합니다.", 400);
        }
        const key = `${laneNumber}:${position}`;
        if (seen.has(key)) throw new TeamEventError("DUPLICATE_LANE_SLOT", "중복된 레인 좌석이 있습니다.", 400);
        seen.add(key);
        return { laneNumber, position };
    });
}

export function assertCompetitionModeChangeAllowed(input: {
    currentMode: string | null;
    nextMode: string | null;
    competitionStatus: string;
    attendanceStatuses: readonly string[];
    hasScores: boolean;
}) {
    if (input.currentMode === input.nextMode) return;
    const hasAttendance = input.attendanceStatuses.some((status) => status !== "UNANSWERED");
    if (hasAttendance || input.hasScores || input.competitionStatus !== "ATTENDANCE_OPEN") {
        throw new TeamEventError("COMPETITION_MODE_LOCKED", "대회 진행 후에는 적용 모드를 변경할 수 없습니다.", 409);
    }
}

export type TeamEventListScope = "ALL" | "UPCOMING" | "PAST";

export function parseTeamEventListScope(value: string | null): TeamEventListScope {
    if (value == null || value === "") return "ALL";
    if (value === "UPCOMING" || value === "PAST") return value;
    throw new TeamEventError("INVALID_SCOPE", "일정 조회 범위를 확인해주세요.", 400);
}

export function teamEventListQuery(scope: TeamEventListScope, now = new Date()) {
    const today = dateKeyToDate(kstDateKey(now));
    return {
        date: scope === "UPCOMING" ? { gte: today } : scope === "PAST" ? { lt: today } : undefined,
        orderBy: scope === "PAST"
            ? [{ eventDate: "desc" as const }, { eventTime: "desc" as const }, { id: "desc" as const }]
            : [{ eventDate: "asc" as const }, { eventTime: "asc" as const }, { id: "asc" as const }],
    };
}

export async function listTeamEvents(actorUserId: string, teamId: string, scope: TeamEventListScope = "ALL", now = new Date()) {
    const access = await getAccess(actorUserId, teamId);
    const query = teamEventListQuery(scope, now);
    const events = await prisma.teamEvent.findMany({
        where: {
            teamId,
            ...(query.date ? { eventDate: query.date } : {}),
        },
        orderBy: query.orderBy,
        include: eventInclude,
    });
    return { role: access.role, events: events.map((event) => serializeEvent(event, access)) };
}

export async function getTeamEvent(actorUserId: string, teamId: string, eventId: string) {
    const access = await getAccess(actorUserId, teamId);
    const event = await findEvent(teamId, eventId);
    return serializeEvent(event, access);
}

export async function createTeamEvent(actorUserId: string, teamId: string, value: unknown) {
    const access = await getAccess(actorUserId, teamId);
    requireManager(access.role);
    const input = parseTeamEventInput(value, access.bowlerHiddenEnabled);
    const event = await prisma.teamEvent.create({
        data: {
            teamId, createdById: actorUserId, title: input.title,
            eventDate: dateKeyToDate(input.date), eventTime: input.time, location: input.location,
            gameType: input.gameType, attendanceEnabled: input.attendanceEnabled,
            laneDrawEnabled: input.laneDrawEnabled, laneDrawMode: input.laneDrawMode,
            competitionEnabled: input.competitionEnabled, competitionType: input.competitionType,
            competitionMode: input.competitionMode,
            competitionStatus: input.competitionEnabled ? "ATTENDANCE_OPEN" : "DRAFT",
            competitionStartAt: input.competitionType === "EVENT" ? eventStartAt(input.date, input.time) : null,
            votingDurationMinutes: 30,
            competitionGameCount: input.competitionGameCount,
            rankPoints: serializeRankPoints(input.rankPoints),
        },
        include: eventInclude,
    });
    return serializeEvent(event, access);
}

export async function updateTeamEvent(actorUserId: string, teamId: string, eventId: string, value: unknown) {
    const access = await getAccess(actorUserId, teamId);
    requireManager(access.role);
    const current = await findEvent(teamId, eventId);
    const input = parseTeamEventInput(value, access.bowlerHiddenEnabled);
    if (current.competitionMode !== input.competitionMode && current.competitionEnabled) {
        const dayEnd = new Date(current.eventDate.getTime() + 24 * 60 * 60 * 1000);
        const hasScores = await prisma.score.count({ where: { teamId, gameDate: { gte: current.eventDate, lt: dayEnd }, ...(current.gameType ? { gameType: current.gameType } : {}) } }) > 0;
        assertCompetitionModeChangeAllowed({
            currentMode: current.competitionMode,
            nextMode: input.competitionMode,
            competitionStatus: current.competitionStatus,
            attendanceStatuses: current.attendances.map((item) => item.status),
            hasScores,
        });
    }
    if (current.competitionEnabled && (current.competitionType === "TEAM" || current.competitionType === "EVENT") &&
        current.competitionStatus !== "ATTENDANCE_OPEN") {
        throw new TeamEventError("EVENT_LOCKED", "대회 참석 마감 후에는 일정 설정을 변경할 수 없습니다.", 409);
    }
    if (current.laneDrawStatus !== "NOT_STARTED" && (
        input.date !== formatEventDate(current.eventDate) || input.gameType !== current.gameType ||
        input.attendanceEnabled !== current.attendanceEnabled || input.laneDrawEnabled !== current.laneDrawEnabled ||
        input.laneDrawMode !== current.laneDrawMode
    )) throw new TeamEventError("EVENT_LOCKED", "추첨 시작 후에는 날짜와 추첨 설정을 변경할 수 없습니다.", 409);
    const event = await prisma.teamEvent.update({
        where: { id: current.id },
        data: {
            title: input.title, eventDate: dateKeyToDate(input.date), eventTime: input.time,
            location: input.location, gameType: input.gameType,
            attendanceEnabled: input.attendanceEnabled, laneDrawEnabled: input.laneDrawEnabled,
            laneDrawMode: input.laneDrawMode,
            competitionEnabled: input.competitionEnabled, competitionType: input.competitionType,
            competitionMode: input.competitionMode,
            competitionStartAt: input.competitionType === "EVENT" ? eventStartAt(input.date, input.time) : null,
            votingDurationMinutes: 30,
            competitionGameCount: input.competitionGameCount,
            competitionStatus: input.competitionEnabled
                ? current.competitionEnabled ? current.competitionStatus : "ATTENDANCE_OPEN"
                : "DRAFT",
            rankPoints: serializeRankPoints(input.rankPoints),
        }, include: eventInclude,
    });
    return serializeEvent(event, access);
}

export async function deleteTeamEvent(actorUserId: string, teamId: string, eventId: string) {
    const access = await getAccess(actorUserId, teamId);
    requireManager(access.role);
    const event = await findEvent(teamId, eventId);
    if (event.competitionEnabled && (event.competitionType === "TEAM" || event.competitionType === "EVENT") &&
        event.competitionStatus !== "ATTENDANCE_OPEN") {
        throw new TeamEventError("EVENT_LOCKED", "대회 참가자 확정 후에는 일정을 삭제할 수 없습니다.", 409);
    }
    requireNotStarted(event.laneDrawStatus, "추첨 시작 후에는 일정과 추첨 결과를 삭제할 수 없습니다.");
    await prisma.teamEvent.delete({ where: { id: eventId } });
    return { deleted: true };
}

export async function updateMyAttendance(actorUserId: string, teamId: string, eventId: string, value: unknown) {
    const access = await getAccess(actorUserId, teamId);
    const event = await findEvent(teamId, eventId);
    if (!event.attendanceEnabled) throw new TeamEventError("ATTENDANCE_DISABLED", "참석 조사를 사용하지 않는 일정입니다.", 409);
    requireCompetitionAttendanceOpen(event);
    requireNotStarted(event.laneDrawStatus, "추첨 시작 후에는 참석 여부를 변경할 수 없습니다.");
    const status = parseAttendanceStatus(value);
    const displayName = access.member.alias?.trim() || access.member.user.name;
    await prisma.teamEventAttendance.upsert({
        where: { eventId_memberId: { eventId, memberId: access.member.id } },
        create: { eventId, memberId: access.member.id, memberDisplayName: displayName, status },
        update: { memberDisplayName: displayName, status },
    });
    return { status };
}

export async function addEventGuest(actorUserId: string, teamId: string, eventId: string, value: unknown) {
    const access = await getAccess(actorUserId, teamId); requireManager(access.role);
    const event = await findEvent(teamId, eventId); requireNotStarted(event.laneDrawStatus);
    requireCompetitionAttendanceOpen(event);
    const name = requiredText(asRecord(value).name, 40, "게스트 이름을 확인해주세요.");
    return prisma.teamEventGuest.create({ data: { eventId, name }, select: { id: true, name: true } });
}

export async function deleteEventGuest(actorUserId: string, teamId: string, eventId: string, guestId: string) {
    const access = await getAccess(actorUserId, teamId); requireManager(access.role);
    const event = await findEvent(teamId, eventId); requireNotStarted(event.laneDrawStatus);
    requireCompetitionAttendanceOpen(event);
    const result = await prisma.teamEventGuest.deleteMany({ where: { id: guestId, eventId } });
    if (result.count !== 1) throw new TeamEventError("GUEST_NOT_FOUND", "게스트를 찾을 수 없습니다.", 404);
    return { deleted: true };
}

export async function replaceEventLaneSlots(actorUserId: string, teamId: string, eventId: string, value: unknown) {
    const access = await getAccess(actorUserId, teamId); requireManager(access.role);
    const event = await findEvent(teamId, eventId); requireNotStarted(event.laneDrawStatus);
    if (!event.laneDrawEnabled) throw new TeamEventError("LANE_DRAW_DISABLED", "레인 추첨을 사용하지 않는 일정입니다.", 409);
    if (event.competitionEnabled && event.competitionType === "TEAM" &&
        event.competitionStatus !== "TEAMS_FINALIZED" && event.competitionStatus !== "LANES_ASSIGNED") {
        throw new TeamEventError("TEAMS_NOT_FINALIZED", "TEAM 확정 후 레인 좌석을 설정할 수 있습니다.", 409);
    }
    const slots = parseLaneSlots(value);
    await prisma.$transaction(async (tx) => {
        await tx.teamEventLaneSlot.deleteMany({ where: { eventId } });
        for (const slot of slots) await tx.teamEventLaneSlot.create({ data: { eventId, ...slot } });
    });
    return { slots };
}

export async function startEventDraw(actorUserId: string, teamId: string, eventId: string, now = new Date()) {
    const access = await getAccess(actorUserId, teamId); requireManager(access.role);
    const event = await findEvent(teamId, eventId);
    requireNotStarted(event.laneDrawStatus);
    if (event.competitionEnabled && event.competitionType === "TEAM") {
        throw new TeamEventError("TEAM_LANE_ASSIGNMENT_REQUIRED", "TEAM 대회는 팀별 순차 레인 배정을 사용해야 합니다.", 409);
    }
    if (!event.laneDrawEnabled) throw new TeamEventError("LANE_DRAW_DISABLED", "레인 추첨을 사용하지 않는 일정입니다.", 409);
    if (formatEventDate(event.eventDate) !== kstDateKey(now)) {
        throw new TeamEventError("DRAW_DATE_RESTRICTED", "레인 추첨은 일정 당일에만 시작할 수 있습니다.", 409);
    }
    const participantCount = event.attendances.filter((item) => item.status === "ATTENDING" && item.memberId).length + event.guests.length;
    if (participantCount !== event.laneSlots.length || participantCount === 0) {
        throw new TeamEventError("PARTICIPANT_SLOT_MISMATCH", `참석자와 게스트(${participantCount}명) 수가 선택 좌석(${event.laneSlots.length}개)과 같아야 합니다.`, 409);
    }
    if (event.laneDrawMode === "INDIVIDUAL") {
        const updated = await prisma.teamEvent.updateMany({ where: { id: eventId, laneDrawStatus: "NOT_STARTED" }, data: { laneDrawStatus: "OPEN" } });
        if (updated.count !== 1) throw new TeamEventError("DRAW_CONFLICT", "추첨 상태가 변경되었습니다. 새로고침해주세요.", 409);
        return { status: "OPEN" as DrawStatus };
    }
    await prisma.$transaction(async (tx) => {
        const updated = await tx.teamEvent.updateMany({ where: { id: eventId, laneDrawStatus: "NOT_STARTED" }, data: { laneDrawStatus: "COMPLETED" } });
        if (updated.count !== 1) throw new TeamEventError("DRAW_CONFLICT", "추첨 상태가 변경되었습니다. 새로고침해주세요.", 409);
        const participants = fisherYatesShuffle(drawParticipants(event));
        const slots = fisherYatesShuffle(event.laneSlots);
        for (let index = 0; index < participants.length; index += 1) {
            await tx.teamEventLaneAssignment.create({ data: assignmentData(eventId, participants[index], slots[index].id) });
        }
    });
    return { status: "COMPLETED" as DrawStatus };
}

export async function drawMyEventLane(actorUserId: string, teamId: string, eventId: string) {
    const access = await getAccess(actorUserId, teamId);
    return drawIndividual(teamId, eventId, { kind: "MEMBER", id: access.member.id }, access.role);
}

export async function drawGuestEventLane(actorUserId: string, teamId: string, eventId: string, guestId: string) {
    const access = await getAccess(actorUserId, teamId); requireManager(access.role);
    return drawIndividual(teamId, eventId, { kind: "GUEST", id: guestId }, access.role);
}

export async function assignRemainingEventLanes(actorUserId: string, teamId: string, eventId: string) {
    const access = await getAccess(actorUserId, teamId); requireManager(access.role);
    try {
        await prisma.$transaction(async (tx) => {
            const event = await tx.teamEvent.findFirst({ where: { id: eventId, teamId }, include: eventInclude });
            if (!event) throw new TeamEventError("EVENT_NOT_FOUND", "일정을 찾을 수 없습니다.", 404);
            requireIndividualOpen(event);
            const assignedMembers = new Set(event.laneAssignments.map((item) => item.memberId).filter(Boolean));
            const assignedGuests = new Set(event.laneAssignments.map((item) => item.guestId).filter(Boolean));
            const participants = fisherYatesShuffle(drawParticipants(event).filter((item) => item.kind === "MEMBER" ? !assignedMembers.has(item.id) : !assignedGuests.has(item.id)));
            const taken = new Set(event.laneAssignments.map((item) => item.slotId));
            const slots = fisherYatesShuffle(event.laneSlots.filter((slot) => !taken.has(slot.id)));
            if (participants.length !== slots.length) throw new TeamEventError("PARTICIPANT_SLOT_MISMATCH", "남은 참가자와 좌석 수가 일치하지 않습니다.", 409);
            for (let index = 0; index < participants.length; index += 1) {
                await tx.teamEventLaneAssignment.create({ data: assignmentData(eventId, participants[index], slots[index].id) });
            }
            await tx.teamEvent.update({ where: { id: eventId }, data: { laneDrawStatus: "COMPLETED" } });
        });
        return { status: "COMPLETED" as DrawStatus };
    } catch (error) { throw normalizeConflict(error); }
}

async function drawIndividual(teamId: string, eventId: string, target: DrawParticipantRef, role: TeamRole) {
    try {
        return await prisma.$transaction(async (tx) => {
            const event = await tx.teamEvent.findFirst({ where: { id: eventId, teamId }, include: eventInclude });
            if (!event) throw new TeamEventError("EVENT_NOT_FOUND", "일정을 찾을 수 없습니다.", 404);
            requireIndividualOpen(event);
            if (target.kind === "GUEST") requireManager(role);
            const participant = drawParticipants(event).find((item) => item.kind === target.kind && item.id === target.id);
            if (!participant) throw new TeamEventError("PARTICIPANT_NOT_FOUND", "추첨 참가자를 찾을 수 없습니다.", 404);
            const existing = event.laneAssignments.find((item) => target.kind === "MEMBER" ? item.memberId === target.id : item.guestId === target.id);
            if (existing) return serializeAssignment(existing);
            const taken = new Set(event.laneAssignments.map((item) => item.slotId));
            const available = event.laneSlots.filter((slot) => !taken.has(slot.id));
            if (available.length === 0) throw new TeamEventError("NO_LANE_SLOT", "남은 레인 좌석이 없습니다.", 409);
            const slot = available[randomInt(available.length)];
            const created = await tx.teamEventLaneAssignment.create({
                data: assignmentData(eventId, participant, slot.id),
                include: { slot: true },
            });
            if (event.laneAssignments.length + 1 === drawParticipants(event).length) {
                await tx.teamEvent.update({ where: { id: eventId }, data: { laneDrawStatus: "COMPLETED" } });
            }
            return serializeAssignment(created);
        });
    } catch (error) { throw normalizeConflict(error); }
}

const eventInclude = {
    team: {
        select: {
            name: true,
            members: {
                orderBy: { joinedAt: "asc" as const },
                select: { id: true, alias: true, user: { select: { name: true } } },
            },
        },
    },
    attendances: true,
    guests: true,
    laneSlots: { orderBy: [{ laneNumber: "asc" as const }, { position: "asc" as const }] },
    laneAssignments: { include: { slot: true }, orderBy: { createdAt: "asc" as const } },
} satisfies Prisma.TeamEventInclude;

type EventWithRelations = Prisma.TeamEventGetPayload<{ include: typeof eventInclude }>;
type DrawParticipantRef = { kind: "MEMBER" | "GUEST"; id: string };
type DrawParticipant = DrawParticipantRef & { name: string };

async function findEvent(teamId: string, eventId: string) {
    const event = await prisma.teamEvent.findFirst({ where: { id: eventId, teamId }, include: eventInclude });
    if (!event) throw new TeamEventError("EVENT_NOT_FOUND", "일정을 찾을 수 없습니다.", 404);
    return event;
}

async function getAccess(userId: string, teamId: string) {
    const team = await prisma.team.findFirst({
        where: { id: teamId, isActive: true, members: { some: { userId } } },
        select: {
            ownerId: true, bowlerHiddenEnabled: true, User: { select: { id: true } },
            members: { where: { userId }, take: 1, select: { id: true, alias: true, user: { select: { name: true } } } },
        },
    });
    const member = team?.members[0];
    if (!team || !member) throw new TeamEventError("TEAM_NOT_FOUND", "동호회를 찾을 수 없습니다.", 404);
    const role: TeamRole = team.ownerId === userId ? "OWNER" : team.User.some((item) => item.id === userId) ? "MANAGER" : "MEMBER";
    return { role, member, bowlerHiddenEnabled: team.bowlerHiddenEnabled };
}

function serializeEvent(event: EventWithRelations, access: Awaited<ReturnType<typeof getAccess>>) {
    const competitionVisible = access.bowlerHiddenEnabled && event.competitionEnabled;
    const attendanceByMember = new Map(event.attendances.map((item) => [item.memberId, item]));
    const myAttendance = attendanceByMember.get(access.member.id)?.status ?? "UNANSWERED";
    const assignments = event.laneAssignments.map(serializeAssignment).sort((a, b) => a.laneNumber - b.laneNumber || a.position - b.position);
    const myAssignment = event.laneAssignments.find((item) => item.memberId === access.member.id);
    const answeredMemberIds = new Set(event.attendances.filter((item) => item.memberId).map((item) => item.memberId));
    const counts = {
        attending: event.attendances.filter((item) => item.status === "ATTENDING" && item.memberId).length,
        notAttending: event.attendances.filter((item) => item.status === "NOT_ATTENDING" && item.memberId).length,
        unanswered: event.team.members.filter((member) => !answeredMemberIds.has(member.id) || attendanceByMember.get(member.id)?.status === "UNANSWERED").length,
        guests: event.guests.length,
    };
    return {
        id: event.id, teamId: event.teamId, teamName: event.team.name, title: event.title,
        date: formatEventDate(event.eventDate), time: event.eventTime, location: event.location,
        gameType: event.gameType, attendanceEnabled: event.attendanceEnabled,
        competitionType: competitionVisible ? event.competitionType : "NONE",
        competitionMode: competitionVisible ? event.competitionMode : null,
        laneDrawEnabled: event.laneDrawEnabled, laneDrawMode: event.laneDrawMode,
        laneDrawStatus: event.laneDrawStatus, myRole: access.role, myAttendance, counts,
        bowlerHiddenEnabled: access.bowlerHiddenEnabled,
        competition: competitionVisible ? {
            enabled: true,
            type: event.competitionType,
            mode: event.competitionMode,
            status: event.competitionStatus,
            rankPoints: readRankPoints(event.rankPoints),
            competitionStartAt: event.competitionStartAt?.toISOString() ?? null,
            voteCloseAt: event.competitionStartAt
                ? new Date(event.competitionStartAt.getTime() + event.votingDurationMinutes * 60_000).toISOString()
                : null,
            votingDurationMinutes: event.votingDurationMinutes,
            gameCount: event.competitionGameCount,
        } : null,
        guests: event.guests.map((guest) => ({ id: guest.id, name: guest.name })),
        slots: event.laneSlots.map((slot) => ({ id: slot.id, laneNumber: slot.laneNumber, position: slot.position })),
        assignments,
        myAssignment: myAssignment ? serializeAssignment(myAssignment) : null,
        attendance: access.role === "MEMBER" ? null : event.team.members.map((member) => ({
            memberId: member.id,
            name: attendanceByMember.get(member.id)?.memberDisplayName ?? member.alias?.trim() ?? member.user.name,
            status: attendanceByMember.get(member.id)?.status ?? "UNANSWERED",
        })),
        createdAt: event.createdAt.toISOString(), updatedAt: event.updatedAt.toISOString(),
    };
}

function serializeAssignment(item: EventWithRelations["laneAssignments"][number]) {
    return {
        id: item.id, memberId: item.memberId, guestId: item.guestId,
        name: item.participantDisplayName, laneNumber: item.slot.laneNumber, position: item.slot.position,
        label: `${item.slot.laneNumber}-${item.slot.position}`,
    };
}

function drawParticipants(event: EventWithRelations): DrawParticipant[] {
    return [
        ...event.attendances.filter((item) => item.status === "ATTENDING" && item.memberId)
            .map((item) => ({ kind: "MEMBER" as const, id: item.memberId!, name: item.memberDisplayName })),
        ...event.guests.map((item) => ({ kind: "GUEST" as const, id: item.id, name: item.name })),
    ];
}

function assignmentData(eventId: string, participant: DrawParticipant, slotId: string) {
    return {
        eventId, slotId, participantKind: participant.kind, participantDisplayName: participant.name,
        memberId: participant.kind === "MEMBER" ? participant.id : null,
        guestId: participant.kind === "GUEST" ? participant.id : null,
    };
}

function requireManager(role: TeamRole) {
    if (role === "MEMBER") throw new TeamEventError("FORBIDDEN", "일정 관리 권한이 없습니다.", 403);
}

function requireNotStarted(status: string, message = "추첨 시작 후에는 변경할 수 없습니다.") {
    if (status !== "NOT_STARTED") throw new TeamEventError("EVENT_LOCKED", message, 409);
}

function requireCompetitionAttendanceOpen(event: Pick<EventWithRelations, "competitionEnabled" | "competitionType" | "competitionStatus">) {
    if (event.competitionEnabled && (event.competitionType === "TEAM" || event.competitionType === "EVENT") && event.competitionStatus !== "ATTENDANCE_OPEN") {
        throw new TeamEventError("ATTENDANCE_LOCKED", "대회 참석이 마감되었습니다.", 409);
    }
}

function requireIndividualOpen(event: EventWithRelations) {
    if (event.competitionEnabled && event.competitionType === "TEAM") {
        throw new TeamEventError("TEAM_LANE_ASSIGNMENT_REQUIRED", "TEAM 대회는 팀별 순차 레인 배정을 사용해야 합니다.", 409);
    }
    if (event.laneDrawMode !== "INDIVIDUAL" || event.laneDrawStatus !== "OPEN") {
        throw new TeamEventError("DRAW_NOT_OPEN", "개별 레인 추첨이 진행 중이 아닙니다.", 409);
    }
}

function normalizeConflict(error: unknown): unknown {
    if (error instanceof TeamEventError) return error;
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return new TeamEventError("DRAW_CONFLICT", "다른 참가자의 추첨이 먼저 처리되었습니다. 다시 시도해주세요.", 409);
    }
    return error;
}

function asRecord(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new TeamEventError("INVALID_REQUEST", "요청 내용을 확인해주세요.", 400);
    }
    return value as Record<string, unknown>;
}

function requiredText(value: unknown, max: number, message: string): string {
    if (typeof value !== "string" || !value.trim() || value.trim().length > max) {
        throw new TeamEventError("INVALID_REQUEST", message, 400);
    }
    return value.trim();
}

function eventStartAt(date: string, time: string): Date {
    return new Date(`${date}T${time}:00+09:00`);
}

function parseDateKey(value: unknown): string {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        throw new TeamEventError("INVALID_DATE", "일정 날짜를 확인해주세요.", 400);
    }
    const date = dateKeyToDate(value);
    if (formatEventDate(date) !== value) throw new TeamEventError("INVALID_DATE", "일정 날짜를 확인해주세요.", 400);
    return value;
}

function dateKeyToDate(value: string): Date { return new Date(`${value}T00:00:00+09:00`); }
function formatEventDate(value: Date): string { return kstDateKey(value); }
