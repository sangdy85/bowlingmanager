import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getBowlerHiddenCompetition } from "@/lib/mobile-api/bowler-hidden";

type ParticipantKind = "MEMBER" | "GUEST";

export class CompetitionScoreError extends Error {
    constructor(public readonly code: string, message: string, public readonly status: number) {
        super(message);
        this.name = "CompetitionScoreError";
    }
}

const eventInclude = {
    team: {
        select: {
            name: true,
            ownerId: true,
            bowlerHiddenEnabled: true,
            User: { select: { id: true } },
            members: { select: { id: true, userId: true } },
        },
    },
    attendances: {
        where: { status: "ATTENDING" },
        orderBy: [{ createdAt: "asc" as const }, { id: "asc" as const }],
        include: { member: { select: { id: true, userId: true, alias: true, user: { select: { name: true } } } } },
    },
    guests: { orderBy: [{ createdAt: "asc" as const }, { id: "asc" as const }] },
    competitionTeams: {
        include: {
            participants: {
                include: {
                    member: { select: { id: true, userId: true, alias: true, user: { select: { name: true } } } },
                    guest: { select: { id: true, name: true } },
                },
            },
        },
    },
    eventCompetitionParticipants: {
        orderBy: [{ revealOrder: "asc" as const }, { id: "asc" as const }],
        include: {
            member: { select: { id: true, userId: true, alias: true, user: { select: { name: true } } } },
            guest: { select: { id: true, name: true } },
        },
    },
    scores: { orderBy: [{ createdAt: "asc" as const }, { id: "asc" as const }] },
} satisfies Prisma.TeamEventInclude;

type CompetitionEvent = Prisma.TeamEventGetPayload<{ include: typeof eventInclude }>;

export type CompetitionScoreParticipant = {
    participantId: string;
    participantKind: ParticipantKind;
    memberId: string | null;
    guestId: string | null;
    name: string;
    group: string | null;
    competitionTeamId: string | null;
    competitionTeamName: string | null;
    scores: number[];
};

export async function getCompetitionScoreEntry(actorUserId: string, teamId: string, eventId: string) {
    const event = await loadCompetitionEvent(actorUserId, teamId, eventId);
    assertManager(event, actorUserId);
    let participants = participantsFor(event);
    if (event.competitionType === "INDIVIDUAL") {
        const grouping = await getBowlerHiddenCompetition(actorUserId, teamId, eventId);
        const groupByParticipant = new Map((grouping.participantPreview ?? []).map((item) => [
            `${item.participantKind === "MEMBER" ? "member" : "guest"}:${item.participantId}`,
            item.effectiveGroup,
        ]));
        participants = participants.map((item) => ({ ...item, group: groupByParticipant.get(item.participantId) ?? null }));
    }
    const scores = scoresByParticipant(event, participants);
    const configuredGameCount = event.competitionGameCount;
    const existingGameCount = Math.max(0, ...participants.map((item) => scores.get(item.participantId)?.length ?? 0));
    const gameCount = configuredGameCount ?? (existingGameCount || 3);
    return {
        event: {
            id: event.id,
            teamId: event.teamId,
            teamName: event.team.name,
            title: event.title,
            date: kstDateKey(event.eventDate),
            gameType: event.gameType,
            competitionType: event.competitionType,
            competitionMode: event.competitionMode,
            status: event.competitionStatus,
        },
        gameCount,
        readOnly: event.competitionStatus === "PUBLISHED",
        participants: participants.map((item) => ({ ...item, scores: scores.get(item.participantId) ?? [] })),
    };
}

export async function saveCompetitionScores(actorUserId: string, teamId: string, eventId: string, value: unknown) {
    const input = parseInput(value);
    return prisma.$transaction(async (tx) => {
        const event = await tx.teamEvent.findFirst({
            where: { id: eventId, teamId, team: { isActive: true, members: { some: { userId: actorUserId } } } },
            include: eventInclude,
        });
        if (!event || !event.team.members.some((member) => member.userId === actorUserId)) {
            throw new CompetitionScoreError("EVENT_NOT_FOUND", "일정을 찾을 수 없습니다.", 404);
        }
        requireCompetition(event);
        assertManager(event, actorUserId);
        if (event.competitionStatus === "PUBLISHED") {
            throw new CompetitionScoreError("SCORES_READ_ONLY", "발표된 경기의 점수는 변경할 수 없습니다.", 409);
        }
        assertScoreEntryState(event);
        const participants = participantsFor(event);
        if (participants.length === 0) {
            throw new CompetitionScoreError("PARTICIPANTS_REQUIRED", "점수를 입력할 참가자가 없습니다.", 409);
        }
        const expectedIds = new Set(participants.map((item) => item.participantId));
        if (input.participants.length !== expectedIds.size || input.participants.some((item) => !expectedIds.has(item.participantId))) {
            throw new CompetitionScoreError("PARTICIPANT_MISMATCH", "현재 일정의 참가자 전체 점수를 입력해주세요.", 409);
        }
        const ids = input.participants.map((item) => item.participantId);
        if (new Set(ids).size !== ids.length) {
            throw new CompetitionScoreError("DUPLICATE_PARTICIPANT", "같은 참가자의 점수를 중복 제출할 수 없습니다.", 400);
        }
        const currentScores = scoresByParticipant(event, participants);
        const existingGameCount = Math.max(0, ...participants.map((item) => currentScores.get(item.participantId)?.length ?? 0));
        const expectedGameCount = event.competitionGameCount ?? (existingGameCount || 3);
        if (!expectedGameCount || expectedGameCount < 1 || expectedGameCount > 12 ||
            input.participants.some((item) => item.scores.length !== expectedGameCount)) {
            throw new CompetitionScoreError("INVALID_GAME_COUNT", "모든 참가자의 경기 수를 동일하게 입력해주세요.", 400);
        }
        const participantById = new Map(participants.map((item) => [item.participantId, item]));
        const createdAt = Date.now();
        const rows = input.participants.flatMap((item, participantIndex) => {
            const participant = participantById.get(item.participantId)!;
            return item.scores.map((score, gameIndex) => ({
                id: randomUUID(),
                score,
                gameDate: event.eventDate,
                gameType: event.gameType,
                userId: participant.userId,
                teamId: event.teamId,
                memo: event.title,
                guestName: participant.participantKind === "GUEST" ? participant.name : null,
                competitionMode: event.competitionMode,
                teamEventId: event.id,
                teamEventGuestId: participant.guestId,
                createdAt: new Date(createdAt + participantIndex * expectedGameCount + gameIndex),
            }));
        });
        await tx.score.deleteMany({ where: { teamEventId: event.id } });
        await tx.score.createMany({ data: rows });
        return { eventId: event.id, participantCount: participants.length, gameCount: expectedGameCount, savedCount: rows.length };
    }, { timeout: 60_000 });
}

function parseInput(value: unknown) {
    if (!value || typeof value !== "object" || Array.isArray(value)) invalidRequest();
    const participants = (value as Record<string, unknown>).participants;
    if (!Array.isArray(participants) || participants.length === 0) invalidRequest();
    return {
        participants: participants.map((item) => {
            if (!item || typeof item !== "object" || Array.isArray(item)) invalidRequest();
            const participantId = (item as Record<string, unknown>).participantId;
            const scores = (item as Record<string, unknown>).scores;
            if (typeof participantId !== "string" || !participantId || !Array.isArray(scores) || scores.length < 1 || scores.length > 12 ||
                scores.some((score) => !Number.isSafeInteger(score) || Number(score) < 0 || Number(score) > 300)) invalidRequest();
            return { participantId, scores: scores as number[] };
        }),
    };
}

function invalidRequest(): never {
    throw new CompetitionScoreError("INVALID_SCORES", "점수는 참가자별 게임마다 0~300으로 입력해주세요.", 400);
}

async function loadCompetitionEvent(actorUserId: string, teamId: string, eventId: string) {
    const event = await prisma.teamEvent.findFirst({
        where: { id: eventId, teamId, team: { isActive: true, members: { some: { userId: actorUserId } } } },
        include: eventInclude,
    });
    if (!event) throw new CompetitionScoreError("EVENT_NOT_FOUND", "일정을 찾을 수 없습니다.", 404);
    requireCompetition(event);
    return event;
}

function requireCompetition(event: CompetitionEvent) {
    if (!event.team.bowlerHiddenEnabled || !event.competitionEnabled ||
        !event.competitionType || !["INDIVIDUAL", "TEAM", "EVENT"].includes(event.competitionType)) {
        throw new CompetitionScoreError("COMPETITION_NOT_AVAILABLE", "Bowler Hidden 경기 점수 입력을 사용할 수 없습니다.", 409);
    }
}

function assertManager(event: CompetitionEvent, actorUserId: string) {
    if (event.team.ownerId !== actorUserId && !event.team.User.some((item) => item.id === actorUserId)) {
        throw new CompetitionScoreError("FORBIDDEN", "경기 점수 입력 권한이 없습니다.", 403);
    }
}

function assertScoreEntryState(event: CompetitionEvent) {
    const allowed = event.competitionType === "INDIVIDUAL"
        ? ["GROUPS_READY"]
        : event.competitionType === "TEAM"
            ? ["TEAMS_FINALIZED", "LANES_ASSIGNED"]
            : ["EVENT_READY"];
    if (!allowed.includes(event.competitionStatus)) {
        throw new CompetitionScoreError("INVALID_COMPETITION_STATE", "현재 경기 단계에서는 점수를 입력할 수 없습니다.", 409);
    }
}

type ParticipantInternal = Omit<CompetitionScoreParticipant, "scores"> & { userId: string | null };

function participantsFor(event: CompetitionEvent): ParticipantInternal[] {
    if (event.competitionType === "INDIVIDUAL") {
        return [
            ...event.attendances.flatMap((item) => item.member ? [{
                participantId: `member:${item.member.id}`, participantKind: "MEMBER" as const,
                memberId: item.member.id, guestId: null, userId: item.member.userId,
                name: item.memberDisplayName, group: item.manualGroup, competitionTeamId: null, competitionTeamName: null,
            }] : []),
            ...event.guests.map((guest) => ({
                participantId: `guest:${guest.id}`, participantKind: "GUEST" as const,
                memberId: null, guestId: guest.id, userId: null, name: guest.name,
                group: guest.manualGroup, competitionTeamId: null, competitionTeamName: null,
            })),
        ];
    }
    if (event.competitionType === "TEAM") {
        const teams = event.competitionTeams.filter((team) => team.generation === event.draftGeneration);
        return teams.flatMap((team) => team.participants
            .filter((item) => item.generation === event.draftGeneration)
            .map((item) => ({
                participantId: item.id, participantKind: item.member ? "MEMBER" as const : "GUEST" as const,
                memberId: item.memberId, guestId: item.guestId, userId: item.member?.userId ?? null,
                name: item.member ? displayName(item.member) : item.guest?.name ?? "게스트",
                group: null, competitionTeamId: team.id, competitionTeamName: team.name,
            })));
    }
    return event.eventCompetitionParticipants.map((item) => ({
        participantId: item.id, participantKind: item.member ? "MEMBER" as const : "GUEST" as const,
        memberId: item.memberId, guestId: item.guestId, userId: item.member?.userId ?? null,
        name: item.member ? displayName(item.member) : item.guest?.name ?? "게스트",
        group: null, competitionTeamId: null, competitionTeamName: null,
    }));
}

function scoresByParticipant(event: CompetitionEvent, participants: readonly ParticipantInternal[]) {
    const memberByUser = new Map(participants.flatMap((item) => item.userId ? [[item.userId, item.participantId] as const] : []));
    const guestById = new Map(participants.flatMap((item) => item.guestId ? [[item.guestId, item.participantId] as const] : []));
    const output = new Map<string, number[]>();
    for (const row of event.scores) {
        const participantId = row.userId ? memberByUser.get(row.userId) : row.teamEventGuestId ? guestById.get(row.teamEventGuestId) : undefined;
        if (!participantId || row.score < 0 || row.score > 300) continue;
        const values = output.get(participantId);
        if (values) values.push(row.score); else output.set(participantId, [row.score]);
    }
    return output;
}

function displayName(member: { alias: string | null; user: { name: string } }) {
    return member.alias?.trim() || member.user.name;
}

function kstDateKey(value: Date) {
    return new Date(value.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
