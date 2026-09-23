import { randomInt } from "node:crypto";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { readRankPoints } from "@/lib/mobile-api/bowler-hidden";
import {
    createSeasonPointPublication,
    getPublicationPointTable,
    getSeasonPointPreview,
    revokeSeasonPointPublication,
    seasonPointsForRank,
} from "@/lib/mobile-api/unified-season";

const NON_VOTER_POLICIES = ["INCLUDE_ACTUAL_ONLY", "EXCLUDE_FROM_RANKING"] as const;
const TIE_BREAK_POLICIES = ["ACTUAL_SCORE_THEN_ID", "STABLE_ID_ONLY"] as const;
type NonVoterPolicy = typeof NON_VOTER_POLICIES[number];
type TieBreakPolicy = typeof TIE_BREAK_POLICIES[number];
type Role = "OWNER" | "MANAGER" | "MEMBER";

export class EventCompetitionError extends Error {
    constructor(public readonly code: string, message: string, public readonly status: number) { super(message); }
}

export type EventScoreMutation = { teamId: string; userId: string | null; gameDate: Date; gameType: string | null };

export async function assertEventScoresMutable(
    mutations: readonly EventScoreMutation[],
    db: Pick<Prisma.TransactionClient, "teamEvent"> = prisma,
) {
    const keys = new Map<string, EventScoreMutation>();
    for (const item of mutations) {
        if (!item.userId) continue;
        keys.set(`${item.teamId}:${item.userId}:${item.gameDate.toISOString().slice(0, 10)}:${item.gameType ?? ""}`, item);
    }
    if (keys.size === 0) return;
    const event = await db.teamEvent.findFirst({
        where: {
            competitionEnabled: true,
            OR: [...keys.values()].map((item) => {
                const day = kstDayKey(item.gameDate);
                return {
                    teamId: item.teamId,
                    eventDate: { gte: new Date(`${day}T00:00:00+09:00`), lte: new Date(`${day}T23:59:59.999+09:00`) },
                    AND: [
                        { OR: [{ gameType: null }, { gameType: item.gameType }] },
                        { OR: [
                            {
                                competitionType: "EVENT", competitionStatus: { in: ["REVEALING", "FINAL_READY", "PUBLISHED"] },
                                eventCompetitionParticipants: { some: { member: { userId: item.userId! } } },
                            },
                            {
                                competitionType: "INDIVIDUAL", competitionStatus: "PUBLISHED",
                                attendances: { some: { status: "ATTENDING", member: { userId: item.userId! } } },
                            },
                            {
                                competitionType: "TEAM", competitionStatus: "PUBLISHED",
                                competitionParticipants: { some: { member: { userId: item.userId! } } },
                            },
                        ] },
                    ],
                };
            }),
        },
        select: { id: true },
    });
    if (event) throw new EventCompetitionError("EVENT_SCORE_LOCKED", "개표가 시작되었거나 발표된 대회의 점수는 변경할 수 없습니다.", 409);
}

export type EventCalculationParticipant = {
    participantId: string;
    memberId: string;
    name: string;
    scores: number[];
};
export type EventCalculationBallot = {
    voterParticipantId: string;
    selectedParticipantIds: string[];
};

export function calculateEventResults(
    participants: readonly EventCalculationParticipant[],
    ballots: readonly EventCalculationBallot[],
    rankPoints: readonly { rank: number; points: number }[],
    nonVoterPolicy: NonVoterPolicy,
    tieBreakPolicy: TieBreakPolicy,
) {
    const participantIds = new Set(participants.map((item) => item.participantId));
    const voteCounts = new Map(participants.map((item) => [item.participantId, 0]));
    const ballotByVoter = new Map<string, EventCalculationBallot>();
    for (const ballot of ballots) {
        if (ballotByVoter.has(ballot.voterParticipantId) || !participantIds.has(ballot.voterParticipantId) || ballot.selectedParticipantIds.length !== 3 ||
            new Set(ballot.selectedParticipantIds).size !== 3 || ballot.selectedParticipantIds.includes(ballot.voterParticipantId) ||
            ballot.selectedParticipantIds.some((id) => !participantIds.has(id))) {
            throw new EventCompetitionError("INVALID_BALLOT_DATA", "저장된 투표 데이터를 계산할 수 없습니다.", 500);
        }
        ballotByVoter.set(ballot.voterParticipantId, ballot);
        for (const selected of ballot.selectedParticipantIds) voteCounts.set(selected, (voteCounts.get(selected) ?? 0) + 1);
    }
    const actualByParticipant = new Map(participants.map((item) => [item.participantId, item.scores.reduce((sum, score) => sum + score, 0)]));
    const shareByParticipant = new Map(participants.map((item) => {
        const votes = voteCounts.get(item.participantId) ?? 0;
        return [item.participantId, votes === 0 ? null : actualByParticipant.get(item.participantId)! / votes] as const;
    }));
    const pointMap = new Map(rankPoints.map((item) => [item.rank, item.points]));
    const rows = participants.map((participant) => {
        const ballot = ballotByVoter.get(participant.participantId);
        const selections = ballot?.selectedParticipantIds.map((id) => ({
            participantId: id,
            shareScore: shareByParticipant.get(id) ?? null,
        })) ?? [];
        const voteBonus = [...selections].sort((left, right) => left.participantId.localeCompare(right.participantId))
            .reduce((sum, item) => sum + (item.shareScore ?? 0), 0);
        const actualScore = actualByParticipant.get(participant.participantId)!;
        return {
            participantId: participant.participantId, memberId: participant.memberId, name: participant.name,
            scores: participant.scores, actualScore, voteCount: voteCounts.get(participant.participantId) ?? 0,
            shareScore: shareByParticipant.get(participant.participantId) ?? null,
            hasVoted: ballot != null, selections, voteBonus, finalScore: actualScore + voteBonus,
            rank: null as number | null, seasonPoint: 0,
        };
    });
    const ranked = rows.filter((row) => nonVoterPolicy === "INCLUDE_ACTUAL_ONLY" || row.hasVoted).sort((left, right) => {
        const score = right.finalScore - left.finalScore;
        if (score !== 0) return score;
        if (tieBreakPolicy === "ACTUAL_SCORE_THEN_ID") {
            const actual = right.actualScore - left.actualScore;
            if (actual !== 0) return actual;
        }
        return left.participantId.localeCompare(right.participantId);
    });
    ranked.forEach((row, index) => { row.rank = index + 1; row.seasonPoint = pointMap.get(index + 1) ?? 0; });
    return rows.sort((left, right) => (left.rank ?? Number.MAX_SAFE_INTEGER) - (right.rank ?? Number.MAX_SAFE_INTEGER) || left.participantId.localeCompare(right.participantId));
}

export function validateVoteSelection(voterParticipantId: string, selectedParticipantIds: unknown, participantIds: ReadonlySet<string>) {
    if (!Array.isArray(selectedParticipantIds) || selectedParticipantIds.length !== 3 ||
        selectedParticipantIds.some((id) => typeof id !== "string" || !id)) {
        throw new EventCompetitionError("INVALID_VOTE", "정확히 3명의 참가자를 선택해주세요.", 400);
    }
    const values = selectedParticipantIds as string[];
    if (new Set(values).size !== 3) throw new EventCompetitionError("DUPLICATE_VOTE", "같은 참가자를 중복 선택할 수 없습니다.", 400);
    if (values.includes(voterParticipantId)) throw new EventCompetitionError("SELF_VOTE", "자기 자신에게 투표할 수 없습니다.", 400);
    if (values.some((id) => !participantIds.has(id))) throw new EventCompetitionError("INVALID_PARTICIPANT", "참석 확정 참가자만 선택할 수 있습니다.", 400);
    return values;
}

export function votingPhase(startAt: Date, durationMinutes: number, now = new Date()) {
    const closeAt = new Date(startAt.getTime() + durationMinutes * 60_000);
    return { open: now >= startAt && now < closeAt, closed: now >= closeAt, closeAt };
}

export function nextRevealStep(currentIndex: number, totalCount: number) {
    if (!Number.isSafeInteger(currentIndex) || !Number.isSafeInteger(totalCount) || currentIndex < 0 || totalCount < 1 || currentIndex >= totalCount) {
        throw new EventCompetitionError("REVEAL_COMPLETE", "모든 참가자의 개표가 완료되었습니다.", 409);
    }
    const revealedCount = currentIndex + 1;
    return { revealedCount, status: revealedCount === totalCount ? "FINAL_READY" : "REVEALING" };
}

export function eventScoresComplete(participants: readonly { scores: readonly number[] }[], expectedGameCount: number) {
    return participants.length >= 4 && Number.isSafeInteger(expectedGameCount) && expectedGameCount >= 1 &&
        participants.every((item) => item.scores.length === expectedGameCount && item.scores.every((score) => Number.isInteger(score) && score >= 0 && score <= 300));
}

export async function getEventCompetitionState(actorUserId: string, teamId: string, eventId: string, now = new Date()) {
    const event = await loadEvent(actorUserId, teamId, eventId);
    requireEventCompetition(event);
    const role = roleFor(event, actorUserId);
    const actorParticipant = event.eventCompetitionParticipants.find((item) => item.member.userId === actorUserId) ?? null;
    if (role === "MEMBER" && event.competitionStatus !== "ATTENDANCE_OPEN" && !actorParticipant) {
        throw new EventCompetitionError("NOT_PARTICIPANT", "참석 확정 참가자만 EVENT 대회 상태를 확인할 수 있습니다.", 403);
    }
    const phase = event.competitionStartAt ? votingPhase(event.competitionStartAt, event.votingDurationMinutes, now) : null;
    const status = effectiveStatus(event.competitionStatus, phase);
    if (event.competitionStatus === "PUBLISHED") return publishedState(event, role, actorParticipant?.id ?? null);
    const submitted = event.eventCompetitionBallots.length;
    const myBallot = actorParticipant ? event.eventCompetitionBallots.find((item) => item.voterParticipantId === actorParticipant.id) : null;
    const base = {
        eventId, status, competitionMode: event.competitionMode, canManage: role !== "MEMBER", isParticipant: actorParticipant != null,
        myParticipantId: actorParticipant?.id ?? null,
        voteOpenAt: event.competitionStartAt?.toISOString() ?? null,
        voteCloseAt: phase?.closeAt.toISOString() ?? null,
        serverNow: now.toISOString(), gameCount: event.competitionGameCount,
        participants: event.eventCompetitionParticipants.map((item) => ({ participantId: item.id, memberId: item.memberId, name: displayName(item.member) })),
        voting: { submittedCount: submitted, pendingCount: Math.max(0, event.eventCompetitionParticipants.length - submitted), mySelections: myBallot?.selections.map((item) => item.selectedParticipantId) ?? [] },
        policies: {
            guests: "EXCLUDED_V1_NO_ACCOUNT_OR_STABLE_SCORE_IDENTITY",
            voteModification: "ALLOWED_UNTIL_SERVER_CLOSE_TIME_LAST_COMPLETE_BALLOT_WINS",
            nonVoterPolicy: event.eventNonVoterPolicy,
            tieBreakPolicy: event.eventTieBreakPolicy,
            revealOrder: "CRYPTO_RANDOM_SNAPSHOT_AT_PREPARE",
            votePrivacy: "BALLOTS_PRIVATE_BEFORE_REVEAL",
        },
    };
    if (role === "MEMBER") return { ...base, reveal: { revealedCount: event.eventRevealIndex, totalCount: event.eventCompetitionParticipants.length }, finalPreview: null };
    const calculation = await calculateForEvent(event, prisma, await getSeasonPointPreview(prisma, event));
    const revealedIds = new Set(event.eventCompetitionParticipants.filter((item) => item.revealedAt).map((item) => item.id));
    const participantById = new Map(event.eventCompetitionParticipants.map((item) => [item.id, item]));
    const revealed = calculation.rows.filter((item) => revealedIds.has(item.participantId)).map((row) => ({
        participantId: row.participantId, name: row.name, actualScore: row.actualScore, voteCount: row.voteCount,
        shareScore: row.shareScore,
        voterNames: event.eventCompetitionBallots.filter((ballot) => ballot.selections.some((pick) => pick.selectedParticipantId === row.participantId))
            .map((ballot) => displayName(participantById.get(ballot.voterParticipantId)!.member)),
    }));
    return {
        ...base,
        scoreComplete: calculation.complete,
        reveal: {
            revealedCount: event.eventRevealIndex,
            totalCount: event.eventCompetitionParticipants.length,
            nextName: event.eventCompetitionParticipants.find((item) => !item.revealedAt)
                ? displayName(event.eventCompetitionParticipants.find((item) => !item.revealedAt)!.member)
                : null,
            revealed,
        },
        finalPreview: event.competitionStatus === "FINAL_READY" ? publicRanking(calculation.rows, true) : null,
    };
}

export async function updateEventCompetition(actorUserId: string, teamId: string, eventId: string, value: unknown, now = new Date()) {
    const body = asRecord(value);
    switch (body.action) {
        case "PREPARE": return prepare(actorUserId, teamId, eventId, now);
        case "VOTE": return submitVote(actorUserId, teamId, eventId, body.selectedParticipantIds, now);
        case "START_REVEAL": return startReveal(actorUserId, teamId, eventId, body.nonVoterPolicy, body.tieBreakPolicy, now);
        case "REVEAL_NEXT": return revealNext(actorUserId, teamId, eventId);
        case "PUBLISH": return publish(actorUserId, teamId, eventId);
        case "REOPEN": return reopen(actorUserId, teamId, eventId);
        default: throw new EventCompetitionError("INVALID_ACTION", "EVENT 대회 작업을 확인해주세요.", 400);
    }
}

async function prepare(actorUserId: string, teamId: string, eventId: string, now: Date) {
    const event = await loadEvent(actorUserId, teamId, eventId); requireManager(event, actorUserId); requireEventCompetition(event);
    if (event.competitionStatus !== "ATTENDANCE_OPEN") throw stateError();
    if (!event.competitionStartAt || now >= event.competitionStartAt) {
        throw new EventCompetitionError("COMPETITION_ALREADY_STARTED", "경기 시작 전에 참가자를 확정해주세요.", 409);
    }
    const members = attendingMembers(event);
    if (members.length < 4) throw new EventCompetitionError("NOT_ENOUGH_PARTICIPANTS", "EVENT 투표에는 참석자 4명 이상이 필요합니다.", 409);
    const shuffled = secureShuffle(members);
    await prisma.$transaction(async (tx) => {
        const claimed = await tx.teamEvent.updateMany({ where: { id: eventId, competitionStatus: "ATTENDANCE_OPEN" }, data: { competitionStatus: "EVENT_READY", eventRevealIndex: 0 } });
        if (claimed.count !== 1) throw stateError();
        for (let index = 0; index < shuffled.length; index += 1) {
            await tx.eventCompetitionParticipant.create({ data: { eventId, memberId: shuffled[index].id, revealOrder: index + 1 } });
        }
    });
    return { status: "EVENT_READY", participantCount: shuffled.length };
}

async function submitVote(actorUserId: string, teamId: string, eventId: string, rawSelections: unknown, now: Date) {
    const event = await loadEvent(actorUserId, teamId, eventId); requireEventCompetition(event);
    if (event.competitionStatus !== "EVENT_READY" || !event.competitionStartAt || !votingPhase(event.competitionStartAt, event.votingDurationMinutes, now).open) {
        throw new EventCompetitionError("VOTING_CLOSED", "현재 투표할 수 있는 시간이 아닙니다.", 409);
    }
    const voter = event.eventCompetitionParticipants.find((item) => item.member.userId === actorUserId);
    if (!voter) throw new EventCompetitionError("NOT_PARTICIPANT", "참석 확정 참가자만 투표할 수 있습니다.", 403);
    const selections = validateVoteSelection(voter.id, rawSelections, new Set(event.eventCompetitionParticipants.map((item) => item.id)));
    await prisma.$transaction(async (tx) => {
        const fresh = await tx.teamEvent.findFirst({ where: { id: eventId, teamId, competitionStatus: "EVENT_READY" }, select: { competitionStartAt: true, votingDurationMinutes: true } });
        if (!fresh?.competitionStartAt || !votingPhase(fresh.competitionStartAt, fresh.votingDurationMinutes, now).open) throw new EventCompetitionError("VOTING_CLOSED", "투표가 마감되었습니다.", 409);
        const ballot = await tx.eventCompetitionBallot.upsert({
            where: { voterParticipantId: voter.id },
            create: { eventId, voterParticipantId: voter.id, submittedAt: now },
            update: { submittedAt: now },
        });
        await tx.eventCompetitionVotePick.deleteMany({ where: { ballotId: ballot.id } });
        for (let index = 0; index < selections.length; index += 1) {
            await tx.eventCompetitionVotePick.create({ data: { ballotId: ballot.id, selectedParticipantId: selections[index], selectionOrder: index + 1 } });
        }
    });
    return { submitted: true, selectionCount: 3 };
}

async function startReveal(actorUserId: string, teamId: string, eventId: string, rawNonVoter: unknown, rawTieBreak: unknown, now: Date) {
    const event = await loadEvent(actorUserId, teamId, eventId); requireManager(event, actorUserId); requireEventCompetition(event);
    if (event.competitionStatus !== "EVENT_READY" || !event.competitionStartAt || !votingPhase(event.competitionStartAt, event.votingDurationMinutes, now).closed) throw stateError();
    if (!NON_VOTER_POLICIES.includes(rawNonVoter as NonVoterPolicy) || !TIE_BREAK_POLICIES.includes(rawTieBreak as TieBreakPolicy)) {
        throw new EventCompetitionError("POLICY_REQUIRED", "미투표자와 동점 처리 정책을 선택해주세요.", 400);
    }
    const calculation = await calculateForEvent(event);
    if (!calculation.complete) throw new EventCompetitionError("SCORES_INCOMPLETE", "모든 참가자의 경기 점수 입력을 완료해주세요.", 409);
    const updated = await prisma.teamEvent.updateMany({ where: { id: eventId, competitionStatus: "EVENT_READY" }, data: {
        competitionStatus: "REVEALING", eventNonVoterPolicy: rawNonVoter as string, eventTieBreakPolicy: rawTieBreak as string,
    } });
    if (updated.count !== 1) throw stateError();
    return { status: "REVEALING" };
}

async function revealNext(actorUserId: string, teamId: string, eventId: string) {
    const event = await loadEvent(actorUserId, teamId, eventId); requireManager(event, actorUserId); requireEventCompetition(event);
    if (event.competitionStatus !== "REVEALING") throw stateError();
    const next = event.eventCompetitionParticipants.find((item) => !item.revealedAt);
    if (!next) throw new EventCompetitionError("REVEAL_COMPLETE", "모든 참가자의 개표가 완료되었습니다.", 409);
    const step = nextRevealStep(event.eventRevealIndex, event.eventCompetitionParticipants.length);
    await prisma.$transaction(async (tx) => {
        const claimed = await tx.eventCompetitionParticipant.updateMany({ where: { id: next.id, revealedAt: null }, data: { revealedAt: new Date() } });
        if (claimed.count !== 1) throw new EventCompetitionError("REVEAL_CONFLICT", "다른 개표 요청이 먼저 처리되었습니다.", 409);
        const advanced = await tx.teamEvent.updateMany({ where: { id: eventId, competitionStatus: "REVEALING", eventRevealIndex: event.eventRevealIndex }, data: {
            eventRevealIndex: { increment: 1 }, ...(step.status === "FINAL_READY" ? { competitionStatus: "FINAL_READY" } : {}),
        } });
        if (advanced.count !== 1) throw new EventCompetitionError("REVEAL_CONFLICT", "개표 순서가 변경되었습니다.", 409);
    });
    return step;
}

async function publish(actorUserId: string, teamId: string, eventId: string) {
    const event = await loadEvent(actorUserId, teamId, eventId); requireManager(event, actorUserId); requireEventCompetition(event);
    if (event.competitionStatus === "PUBLISHED") return { status: "PUBLISHED", alreadyPublished: true };
    if (event.competitionStatus !== "FINAL_READY" || !event.eventNonVoterPolicy || !event.eventTieBreakPolicy) throw stateError();
    await prisma.$transaction(async (tx) => {
        const fresh = await tx.teamEvent.findFirst({ where: { id: eventId, teamId, competitionStatus: "FINAL_READY", eventPublishedSnapshot: null }, include: eventInclude });
        if (!fresh) throw stateError();
        const pointTable = await getPublicationPointTable(tx, fresh);
        const calculation = await calculateForEvent(fresh, tx, pointTable);
        if (!calculation.complete) throw new EventCompetitionError("SCORES_INCOMPLETE", "점수가 변경되어 결과를 발표할 수 없습니다.", 409);
        const publishedAt = new Date();
        const snapshot = JSON.stringify({ version: 1, publishedAt: publishedAt.toISOString(), rows: calculation.rows });
        await createSeasonPointPublication(tx, {
            event: fresh, pointTable, publishedAt,
            awards: calculation.rows.map((row) => ({
                memberId: row.memberId, memberDisplayName: row.name, finalRank: row.rank,
                points: seasonPointsForRank(pointTable, row.rank),
            })),
            resultSnapshot: { version: 1, rows: calculation.rows },
        });
        const updated = await tx.teamEvent.updateMany({ where: { id: eventId, competitionStatus: "FINAL_READY", eventPublishedSnapshot: null }, data: {
            competitionStatus: "PUBLISHED", eventPublishedAt: publishedAt, eventPublishedSnapshot: snapshot,
        } });
        if (updated.count !== 1) throw stateError();
    });
    return { status: "PUBLISHED" };
}

async function reopen(actorUserId: string, teamId: string, eventId: string) {
    const event = await loadEvent(actorUserId, teamId, eventId); requireManager(event, actorUserId); requireEventCompetition(event);
    if (event.competitionStatus !== "PUBLISHED") throw stateError();
    const reopenedAt = new Date();
    await prisma.$transaction(async (tx) => {
        await revokeSeasonPointPublication(tx, eventId, reopenedAt, event.competitionMode === "OFFICIAL");
        const updated = await tx.teamEvent.updateMany({
            where: { id: eventId, teamId, competitionStatus: "PUBLISHED" },
            data: {
                competitionStatus: "FINAL_READY", eventPublishedAt: null, eventPublishedSnapshot: null,
                seasonPublicationRevision: { increment: 1 },
            },
        });
        if (updated.count !== 1) throw stateError();
    });
    return { status: "FINAL_READY", publicationRevoked: true };
}

const eventInclude = {
    team: { select: { ownerId: true, bowlerHiddenEnabled: true, User: { select: { id: true } }, members: { select: { id: true, userId: true, alias: true, user: { select: { name: true } } } } } },
    attendances: { include: { member: { select: { id: true, userId: true, alias: true, user: { select: { name: true } } } } } },
    eventCompetitionParticipants: { include: { member: { select: { id: true, userId: true, alias: true, user: { select: { name: true } } } } }, orderBy: { revealOrder: "asc" as const } },
    eventCompetitionBallots: { include: { selections: { orderBy: { selectionOrder: "asc" as const } } } },
} satisfies Prisma.TeamEventInclude;
type EventCompetition = Prisma.TeamEventGetPayload<{ include: typeof eventInclude }>;

async function loadEvent(userId: string, teamId: string, eventId: string) {
    const event = await prisma.teamEvent.findFirst({ where: { id: eventId, teamId, team: { isActive: true, members: { some: { userId } } } }, include: eventInclude });
    if (!event) throw new EventCompetitionError("EVENT_NOT_FOUND", "일정을 찾을 수 없습니다.", 404);
    return event;
}
function requireEventCompetition(event: EventCompetition) {
    if (!event.team.bowlerHiddenEnabled) throw new EventCompetitionError("FEATURE_DISABLED", "Bowler Hidden 기능이 활성화되지 않은 팀입니다.", 404);
    if (!event.competitionEnabled || event.competitionType !== "EVENT") throw new EventCompetitionError("EVENT_COMPETITION_NOT_AVAILABLE", "EVENT 대회가 아닙니다.", 409);
}
function roleFor(event: EventCompetition, userId: string): Role { return event.team.ownerId === userId ? "OWNER" : event.team.User.some((item) => item.id === userId) ? "MANAGER" : "MEMBER"; }
function requireManager(event: EventCompetition, userId: string) { if (roleFor(event, userId) === "MEMBER") throw new EventCompetitionError("FORBIDDEN", "EVENT 대회 관리 권한이 없습니다.", 403); }
function attendingMembers(event: EventCompetition) { return event.attendances.flatMap((item) => item.status === "ATTENDING" && item.member ? [item.member] : []); }
function displayName(member: { alias: string | null; user: { name: string } }) { return member.alias?.trim() || member.user.name; }
function stateError() { return new EventCompetitionError("INVALID_COMPETITION_STATE", "현재 EVENT 대회 단계에서는 수행할 수 없습니다.", 409); }
function kstDayKey(value: Date) { return new Date(value.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10); }
function secureShuffle<T>(values: readonly T[]) { const output = [...values]; for (let i = output.length - 1; i > 0; i -= 1) { const target = randomInt(i + 1); [output[i], output[target]] = [output[target], output[i]]; } return output; }
function effectiveStatus(status: string, phase: ReturnType<typeof votingPhase> | null) {
    if (status !== "EVENT_READY" || !phase) return status;
    return phase.closed ? "VOTING_CLOSED" : phase.open ? "VOTING_OPEN" : "SCHEDULED";
}
function asRecord(value: unknown): Record<string, unknown> { if (!value || typeof value !== "object" || Array.isArray(value)) throw new EventCompetitionError("INVALID_REQUEST", "요청 내용을 확인해주세요.", 400); return value as Record<string, unknown>; }

type ScoreReader = { score: { findMany: typeof prisma.score.findMany } };
async function calculateForEvent(
    event: EventCompetition,
    db: ScoreReader = prisma,
    seasonPoints: readonly { rank: number; points: number }[] = readRankPoints(event.rankPoints),
) {
    if (!event.competitionGameCount) return { complete: false, rows: [] as ReturnType<typeof calculateEventResults> };
    const day = new Date(event.eventDate.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const start = new Date(`${day}T00:00:00+09:00`); const end = new Date(`${day}T23:59:59.999+09:00`);
    const rows = await db.score.findMany({ where: {
        teamId: event.teamId, userId: { in: event.eventCompetitionParticipants.map((item) => item.member.userId) }, score: { gte: 0, lte: 300 },
        gameDate: { gte: start, lte: end }, ...(event.gameType ? { gameType: event.gameType } : {}),
    }, orderBy: [{ gameDate: "asc" }, { createdAt: "asc" }, { id: "asc" }], select: { userId: true, score: true } });
    const scores = new Map<string, number[]>();
    for (const row of rows) if (row.userId) { const current = scores.get(row.userId); if (current) current.push(row.score); else scores.set(row.userId, [row.score]); }
    const participants = event.eventCompetitionParticipants.map((item) => ({ participantId: item.id, memberId: item.memberId, name: displayName(item.member), scores: scores.get(item.member.userId) ?? [] }));
    const complete = eventScoresComplete(participants, event.competitionGameCount);
    if (!event.eventNonVoterPolicy || !event.eventTieBreakPolicy) return { complete, rows: [] as ReturnType<typeof calculateEventResults> };
    return { complete, rows: calculateEventResults(participants, event.eventCompetitionBallots.map((ballot) => ({ voterParticipantId: ballot.voterParticipantId, selectedParticipantIds: ballot.selections.map((item) => item.selectedParticipantId) })), seasonPoints, event.eventNonVoterPolicy as NonVoterPolicy, event.eventTieBreakPolicy as TieBreakPolicy) };
}

function publicRanking(rows: ReturnType<typeof calculateEventResults>, manager: boolean) {
    return rows.map((row) => ({
        rank: row.rank, participantId: row.participantId, memberId: row.memberId, name: row.name,
        actualScore: row.actualScore, voteCount: row.voteCount, shareScore: row.shareScore,
        voteBonus: row.voteBonus, finalScore: row.finalScore, seasonPoint: row.seasonPoint,
        ...(manager ? { selections: row.selections.map((selection) => ({
            ...selection, name: rows.find((candidate) => candidate.participantId === selection.participantId)?.name ?? "",
        })) } : {}),
    }));
}
function publishedState(event: EventCompetition, role: Role, actorParticipantId: string | null) {
    let snapshot: { version: number; publishedAt: string; rows: ReturnType<typeof calculateEventResults> };
    try { snapshot = JSON.parse(event.eventPublishedSnapshot ?? "") as typeof snapshot; }
    catch { throw new EventCompetitionError("INVALID_RESULT_SNAPSHOT", "발표 결과를 불러올 수 없습니다.", 500); }
    if (snapshot.version !== 1 || !Array.isArray(snapshot.rows)) throw new EventCompetitionError("INVALID_RESULT_SNAPSHOT", "발표 결과를 불러올 수 없습니다.", 500);
    const my = actorParticipantId ? snapshot.rows.find((row) => row.participantId === actorParticipantId) ?? null : null;
    return {
        eventId: event.id, status: "PUBLISHED", competitionMode: event.competitionMode, canManage: role !== "MEMBER", isParticipant: actorParticipantId != null,
        myParticipantId: actorParticipantId,
        publishedAt: snapshot.publishedAt, ranking: publicRanking(snapshot.rows, false),
        myResult: my ? { ...publicRanking(snapshot.rows, true).find((row) => row.participantId === my.participantId)! } : null,
        policies: { guests: "EXCLUDED_V1_NO_ACCOUNT_OR_STABLE_SCORE_IDENTITY", nonVoterPolicy: event.eventNonVoterPolicy, tieBreakPolicy: event.eventTieBreakPolicy },
    };
}
