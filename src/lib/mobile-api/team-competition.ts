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

type Direction = "FORWARD" | "REVERSE";
type LaneSlot = { id: string; laneNumber: number; position: number };
type LaneTeam = { id: string; lanePriority: number; memberIds: string[] };
export const LUCKY_DRAW_RANDOM_BOUND = 2;

export class TeamCompetitionError extends Error {
    constructor(public readonly code: string, message: string, public readonly status: number) { super(message); }
}

export function snakeDraftTurn(pickNumber: number, teamCount: number) {
    if (!Number.isSafeInteger(pickNumber) || pickNumber < 1 || !Number.isSafeInteger(teamCount) || teamCount < 2) {
        throw new TeamCompetitionError("INVALID_DRAFT_STATE", "드래프트 순서를 계산할 수 없습니다.", 400);
    }
    const roundNumber = Math.floor((pickNumber - 1) / teamCount) + 1;
    const offset = (pickNumber - 1) % teamCount;
    const direction: Direction = roundNumber % 2 === 1 ? "FORWARD" : "REVERSE";
    return { roundNumber, direction, draftOrder: direction === "FORWARD" ? offset + 1 : teamCount - offset };
}

export function draftPlan(attendeeCount: number, captainCount: number) {
    if (!Number.isSafeInteger(attendeeCount) || !Number.isSafeInteger(captainCount) || captainCount < 2 || attendeeCount < captainCount) {
        throw new TeamCompetitionError("INVALID_CAPTAIN_COUNT", "참석자와 팀장 수를 확인해주세요.", 400);
    }
    const remaining = attendeeCount - captainCount;
    const draftPerTeam = Math.floor(remaining / captainCount);
    const draftTotal = draftPerTeam * captainCount;
    return { attendeeCount, captainCount, draftPerTeam, draftTotal, remainder: remaining - draftTotal };
}

export function secureShuffle<T>(values: readonly T[], pick = randomInt) {
    const output = [...values];
    for (let index = output.length - 1; index > 0; index -= 1) {
        const target = pick(index + 1);
        [output[index], output[target]] = [output[target], output[index]];
    }
    return output;
}

export function luckyDrawWins(consecutiveMisses: number, teamCount: number, pick = randomInt) {
    if (!Number.isSafeInteger(consecutiveMisses) || consecutiveMisses < 0 || !Number.isSafeInteger(teamCount) || teamCount < 2) {
        throw new TeamCompetitionError("INVALID_DRAFT_STATE", "행운권 상태를 계산할 수 없습니다.", 400);
    }
    return consecutiveMisses >= Math.max(1, teamCount - 1) || pick(LUCKY_DRAW_RANDOM_BOUND) === 0;
}

export function allocateTeamLaneBlocks(teams: readonly LaneTeam[], slots: readonly LaneSlot[]) {
    const orderedTeams = [...teams].sort((a, b) => a.lanePriority - b.lanePriority || a.id.localeCompare(b.id));
    const orderedSlots = [...slots].sort((a, b) => a.laneNumber - b.laneNumber || a.position - b.position || a.id.localeCompare(b.id));
    const memberCount = orderedTeams.reduce((sum, team) => sum + team.memberIds.length, 0);
    if (memberCount !== orderedSlots.length) {
        throw new TeamCompetitionError("PARTICIPANT_SLOT_MISMATCH", `참가자(${memberCount}명)와 좌석(${orderedSlots.length}개) 수가 같아야 합니다.`, 409);
    }
    let offset = 0;
    return orderedTeams.map((team) => {
        const teamSlots = orderedSlots.slice(offset, offset + team.memberIds.length);
        offset += team.memberIds.length;
        return {
            competitionTeamId: team.id,
            lanePriority: team.lanePriority,
            assignments: team.memberIds.map((memberId, index) => ({ memberId, slot: teamSlots[index] })),
        };
    });
}

export async function getTeamCompetitionState(actorUserId: string, teamId: string, eventId: string) {
    const event = await loadEvent(actorUserId, teamId, eventId);
    requireTeamCompetition(event);
    const generation = event.draftGeneration;
    const teams = currentTeams(event);
    const participants = currentParticipants(event);
    const availableParticipants = participants.length > 0
        ? participants.filter((item) => !item.competitionTeamId).map(serializeParticipant)
        : [
            ...attendingMembers(event).map((member) => ({
                participantId: `member:${member.id}`, participantKind: "MEMBER", memberId: member.id, guestId: null,
                name: displayName(member), assignmentType: null, assignmentOrder: null, laneSlot: null,
            })),
            ...event.guests.map((guest) => ({
                participantId: `guest:${guest.id}`, participantKind: "GUEST", memberId: null, guestId: guest.id,
                name: guest.name, assignmentType: null, assignmentOrder: null, laneSlot: null,
            })),
        ];
    const history = event.competitionDraftPicks.filter((item) => item.generation === generation);
    const plan = teams.length >= 2 ? draftPlan(participants.length, teams.length) : null;
    const turn = (event.competitionStatus === "DRAFT_IN_PROGRESS" || event.competitionStatus === "LUCKY_DRAW") && plan
        ? snakeDraftTurn(event.currentPickNumber, teams.length) : null;
    const currentTeam = turn ? teams.find((item) => item.draftOrder === turn.draftOrder) ?? null : null;
    const actorMember = event.team.members.find((item) => item.userId === actorUserId)!;
    const isManager = event.team.ownerId === actorUserId || event.team.User.some((item) => item.id === actorUserId);
    let result: Awaited<ReturnType<typeof calculateResults>> = event.competitionStatus === "PUBLISHED" ? publishedTeamResult(event) : await calculateResults(event);
    if (event.competitionStatus !== "PUBLISHED" && result.complete) {
        const seasonPoints = await getSeasonPointPreview(prisma, event);
        const ranked = rankFinalTeams(result.teams);
        result = { ...result, teams: ranked.map((team) => ({
            ...team, finalRankPreview: team.finalRank,
            seasonPointPreview: seasonPointsForRank(seasonPoints, team.finalRank),
        })) } as typeof result;
    }
    return {
        eventId, generation, status: event.competitionStatus, competitionMode: event.competitionMode, canManage: isManager,
        isCurrentCaptain: currentTeam?.captainMemberId === actorMember.id,
        currentTurn: turn && currentTeam ? {
            pickNumber: event.currentPickNumber, roundNumber: turn.roundNumber,
            direction: turn.direction, competitionTeamId: currentTeam.id,
            captainMemberId: currentTeam.captainMemberId,
            captainName: displayName(currentTeam.captain),
        } : null,
        plan,
        teams: teams.map((team) => serializeTeam(team, event)),
        remainingParticipants: availableParticipants,
        history: history.map((item) => ({
            id: item.id, generation: item.generation, pickNumber: item.pickNumber,
            roundNumber: item.roundNumber, direction: item.direction, pickType: item.pickType,
            competitionTeamId: item.competitionTeamId, teamName: item.competitionTeam.name,
            captainMemberId: item.captainMemberId,
            selectedParticipantId: item.selectedParticipantId,
            selectedMemberId: item.selectedParticipant?.memberId ?? null,
            selectedGuestId: item.selectedParticipant?.guestId ?? null,
            selectedDisplayName: item.selectedDisplayNameSnapshot,
            createdAt: item.createdAt.toISOString(),
        })),
        myTeam: teams.find((team) => team.participants.some((item) => item.member?.userId === actorUserId))?.id ?? null,
        results: result,
        policies: {
            guests: "INCLUDED_BY_EVENT_GUEST_ID",
            luckyDraw: `SERVER_RANDOM_1_IN_${LUCKY_DRAW_RANDOM_BOUND}_FORCED_AFTER_${Math.max(1, teams.length - 1)}_MISSES`,
            memberSlotOrder: "MANAGER_EXPLICIT_ORDER",
            finalPinTieBreak: "POINTS_EFFECTIVE_PINS_MEMBER_COUNT_HANDICAP_STABLE_ID",
            teamHandicapApplication: "EFFECTIVE_PIN_PLUS_TEAM_HANDICAP_PER_GAME",
        },
    };
}

export async function updateTeamCompetition(actorUserId: string, teamId: string, eventId: string, value: unknown) {
    const body = asRecord(value);
    switch (body.action) {
        case "LOCK_ATTENDANCE": return lockAttendance(actorUserId, teamId, eventId);
        case "CONFIGURE_CAPTAINS": return configureCaptains(actorUserId, teamId, eventId, body.captains);
        case "START_DRAFT": return startDraft(actorUserId, teamId, eventId);
        case "PICK": return pickParticipant(actorUserId, teamId, eventId, body.participantId ?? body.memberId);
        case "LUCKY_DRAW": return luckyDraw(actorUserId, teamId, eventId);
        case "AUTO_ASSIGN_REMAINDER": return autoAssignRemainder(actorUserId, teamId, eventId);
        case "RESET": return resetDraft(actorUserId, teamId, eventId);
        case "ASSIGN_LANES": return assignTeamLanes(actorUserId, teamId, eventId, body.teams);
        case "SET_HANDICAP": return setTeamHandicap(actorUserId, teamId, eventId, body.competitionTeamId, body.teamHandicap);
        case "PUBLISH": return publishTeamCompetition(actorUserId, teamId, eventId, body.tieBreakPolicy);
        case "REOPEN": return reopenTeamCompetition(actorUserId, teamId, eventId);
        default: throw new TeamCompetitionError("INVALID_ACTION", "TEAM 대회 작업을 확인해주세요.", 400);
    }
}

async function setTeamHandicap(
    actorUserId: string,
    teamId: string,
    eventId: string,
    competitionTeamId: unknown,
    teamHandicap: unknown,
) {
    if (typeof competitionTeamId !== "string" || !competitionTeamId ||
        !Number.isSafeInteger(teamHandicap) || (teamHandicap as number) < 0) {
        throw new TeamCompetitionError("INVALID_TEAM_HANDICAP", "팀 핸디캡은 0 이상의 정수여야 합니다.", 400);
    }
    const event = await loadEvent(actorUserId, teamId, eventId);
    requireManager(event, actorUserId); requireTeamCompetition(event);
    if (event.competitionStatus === "PUBLISHED") throw stateError();
    const result = await prisma.teamCompetitionTeam.updateMany({
        where: { id: competitionTeamId, eventId, generation: event.draftGeneration },
        data: { teamHandicap: teamHandicap as number },
    });
    if (result.count !== 1) throw new TeamCompetitionError("TEAM_NOT_FOUND", "대회 팀을 찾을 수 없습니다.", 404);
    return { competitionTeamId, teamHandicap };
}

async function lockAttendance(actorUserId: string, teamId: string, eventId: string) {
    const event = await loadEvent(actorUserId, teamId, eventId); requireManager(event, actorUserId); requireTeamCompetition(event);
    if (event.competitionStatus !== "ATTENDANCE_OPEN") throw stateError();
    const attending = attendingMembers(event);
    if (attending.length + event.guests.length < 2) throw new TeamCompetitionError("NOT_ENOUGH_PARTICIPANTS", "참석자와 게스트가 2명 이상 필요합니다.", 409);
    await prisma.teamEvent.update({ where: { id: eventId }, data: { competitionStatus: "ATTENDANCE_LOCKED" } });
    return { status: "ATTENDANCE_LOCKED" };
}

async function configureCaptains(actorUserId: string, teamId: string, eventId: string, raw: unknown) {
    const event = await loadEvent(actorUserId, teamId, eventId); requireManager(event, actorUserId); requireTeamCompetition(event);
    if (event.competitionStatus !== "ATTENDANCE_LOCKED") throw stateError();
    if (!Array.isArray(raw) || raw.length < 2) throw new TeamCompetitionError("INVALID_CAPTAINS", "팀장을 2명 이상 지정해주세요.", 400);
    const captains = raw.map((value) => {
        const item = asRecord(value);
        if (typeof item.memberId !== "string" || !Number.isSafeInteger(item.draftOrder) || (item.draftOrder as number) < 1) {
            throw new TeamCompetitionError("INVALID_CAPTAINS", "팀장과 드래프트 순서를 확인해주세요.", 400);
        }
        return { memberId: item.memberId, draftOrder: item.draftOrder as number };
    });
    const memberIds = new Set(captains.map((item) => item.memberId));
    const orders = new Set(captains.map((item) => item.draftOrder));
    if (memberIds.size !== captains.length || orders.size !== captains.length ||
        [...orders].some((order) => order < 1 || order > captains.length)) {
        throw new TeamCompetitionError("INVALID_CAPTAINS", "팀장과 순서는 중복 없이 1부터 이어져야 합니다.", 400);
    }
    const attending = attendingMembers(event);
    const attendingIds = new Set(attending.map((item) => item.id));
    if (captains.some((item) => !attendingIds.has(item.memberId))) {
        throw new TeamCompetitionError("CAPTAIN_NOT_ATTENDING", "참석 확정 회원만 팀장이 될 수 있습니다.", 409);
    }
    draftPlan(attending.length + event.guests.length, captains.length);
    await prisma.$transaction(async (tx) => {
        const claimed = await tx.teamEvent.updateMany({
            where: { id: eventId, teamId, competitionStatus: "ATTENDANCE_LOCKED", draftGeneration: event.draftGeneration },
            data: { competitionStatus: "DRAFT_READY", currentPickNumber: 1 },
        });
        if (claimed.count !== 1) throw stateError();
        const participantByMember = new Map<string, string>();
        for (const member of attending) {
            const participant = await tx.teamCompetitionParticipant.create({ data: { eventId, generation: event.draftGeneration, memberId: member.id } });
            participantByMember.set(member.id, participant.id);
        }
        for (const guest of event.guests) {
            await tx.teamCompetitionParticipant.create({ data: { eventId, generation: event.draftGeneration, guestId: guest.id } });
        }
        for (const captain of captains.sort((a, b) => a.draftOrder - b.draftOrder)) {
            const team = await tx.teamCompetitionTeam.create({ data: {
                eventId, generation: event.draftGeneration, name: `TEAM ${captain.draftOrder}`,
                captainMemberId: captain.memberId, draftOrder: captain.draftOrder,
            } });
            await tx.teamCompetitionParticipant.update({
                where: { id: participantByMember.get(captain.memberId)! },
                data: { competitionTeamId: team.id, assignmentType: "CAPTAIN", assignmentOrder: 0 },
            });
        }
    });
    return { status: "DRAFT_READY" };
}

async function startDraft(actorUserId: string, teamId: string, eventId: string) {
    const event = await loadEvent(actorUserId, teamId, eventId); requireManager(event, actorUserId); requireTeamCompetition(event);
    if (event.competitionStatus !== "DRAFT_READY") throw stateError();
    const teams = currentTeams(event); const participants = currentParticipants(event); const plan = draftPlan(participants.length, teams.length);
    if (plan.draftTotal === 0) {
        const remaining = participants.some((item) => !item.competitionTeamId);
        const status = remaining ? "LUCKY_DRAW" : "TEAMS_FINALIZED";
        await prisma.teamEvent.update({ where: { id: eventId }, data: { competitionStatus: status, currentPickNumber: 1 } });
        return { status };
    }
    const updated = await prisma.teamEvent.updateMany({ where: { id: eventId, competitionStatus: "DRAFT_READY" }, data: { competitionStatus: "DRAFT_IN_PROGRESS", currentPickNumber: 1 } });
    if (updated.count !== 1) throw stateError();
    return { status: "DRAFT_IN_PROGRESS", plan };
}

async function pickParticipant(actorUserId: string, teamId: string, eventId: string, participantIdentity: unknown) {
    if (typeof participantIdentity !== "string" || !participantIdentity) throw new TeamCompetitionError("INVALID_PARTICIPANT", "선택할 참가자를 확인해주세요.", 400);
    try {
        return await prisma.$transaction(async (tx) => {
            const event = await tx.teamEvent.findFirst({ where: {
                id: eventId, teamId, competitionEnabled: true, competitionType: "TEAM",
                team: { bowlerHiddenEnabled: true, members: { some: { userId: actorUserId } } },
            }, include: competitionInclude });
            if (!event) throw new TeamCompetitionError("EVENT_NOT_FOUND", "TEAM 대회를 찾을 수 없습니다.", 404);
            if (event.competitionStatus !== "DRAFT_IN_PROGRESS") throw stateError();
            const teams = currentTeams(event); const participants = currentParticipants(event); const plan = draftPlan(participants.length, teams.length);
            const turn = snakeDraftTurn(event.currentPickNumber, teams.length);
            const team = teams.find((item) => item.draftOrder === turn.draftOrder)!;
            const actorMember = event.team.members.find((item) => item.userId === actorUserId);
            if (!actorMember || team.captainMemberId !== actorMember.id) {
                throw new TeamCompetitionError("NOT_CURRENT_CAPTAIN", "현재 선택 순서의 팀장만 선수를 선택할 수 있습니다.", 403);
            }
            const participant = participants.find((item) => item.id === participantIdentity || item.memberId === participantIdentity || item.guestId === participantIdentity);
            if (!participant) throw new TeamCompetitionError("INVALID_PARTICIPANT", "참가자를 찾을 수 없습니다.", 404);
            if (participant.competitionTeamId) throw new TeamCompetitionError("PLAYER_ALREADY_DRAFTED", "이미 배정된 참가자입니다.", 409);
            const claimed = await tx.teamCompetitionParticipant.updateMany({ where: { id: participant.id, competitionTeamId: null }, data: {
                competitionTeamId: team.id, assignmentType: "DRAFT", assignmentOrder: event.currentPickNumber,
            } });
            if (claimed.count !== 1) throw new TeamCompetitionError("PLAYER_ALREADY_DRAFTED", "이미 배정된 참가자입니다.", 409);
            await tx.teamCompetitionDraftPick.create({ data: {
                eventId, generation: event.draftGeneration, pickNumber: event.currentPickNumber,
                roundNumber: turn.roundNumber, direction: turn.direction, captainMemberId: team.captainMemberId,
                competitionTeamId: team.id, selectedParticipantId: participant.id,
                selectedDisplayNameSnapshot: participantName(participant), pickType: "MANUAL_PICK",
            } });
            const advanced = await tx.teamEvent.updateMany({ where: {
                id: eventId, competitionStatus: "DRAFT_IN_PROGRESS", currentPickNumber: event.currentPickNumber,
            }, data: { currentPickNumber: { increment: 1 } } });
            if (advanced.count !== 1) throw new TeamCompetitionError("DRAFT_TURN_CONFLICT", "드래프트 순서가 변경되었습니다.", 409);
            if (event.currentPickNumber === plan.draftTotal) {
                const freshParticipants = participants.map((item) => item.id === participant.id
                    ? { ...item, competitionTeamId: team.id } : item);
                const remaining = freshParticipants.some((item) => !item.competitionTeamId);
                if (remaining) {
                    await tx.teamEvent.update({ where: { id: eventId }, data: { competitionStatus: "LUCKY_DRAW" } });
                    return { status: "LUCKY_DRAW", pickNumber: event.currentPickNumber };
                }
                await tx.teamEvent.update({ where: { id: eventId }, data: { competitionStatus: "TEAMS_FINALIZED" } });
                return { status: "TEAMS_FINALIZED", pickNumber: event.currentPickNumber };
            }
            return { status: "DRAFT_IN_PROGRESS", pickNumber: event.currentPickNumber };
        });
    } catch (error) {
        if (error instanceof TeamCompetitionError) throw error;
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
            throw new TeamCompetitionError("DRAFT_TURN_CONFLICT", "다른 선택이 먼저 처리되었습니다.", 409);
        }
        throw error;
    }
}

async function luckyDraw(actorUserId: string, teamId: string, eventId: string) {
    return prisma.$transaction(async (tx) => {
        const event = await tx.teamEvent.findFirst({ where: {
            id: eventId, teamId, competitionEnabled: true, competitionType: "TEAM",
            team: { bowlerHiddenEnabled: true, members: { some: { userId: actorUserId } } },
        }, include: competitionInclude });
        if (!event) throw new TeamCompetitionError("EVENT_NOT_FOUND", "TEAM 대회를 찾을 수 없습니다.", 404);
        if (event.competitionStatus !== "LUCKY_DRAW") throw stateError();
        const teams = currentTeams(event); const participants = currentParticipants(event);
        const remaining = participants.filter((item) => !item.competitionTeamId);
        if (remaining.length === 0) throw stateError();
        const turn = snakeDraftTurn(event.currentPickNumber, teams.length);
        const team = teams.find((item) => item.draftOrder === turn.draftOrder)!;
        const actorMember = event.team.members.find((item) => item.userId === actorUserId);
        if (!actorMember || team.captainMemberId !== actorMember.id) {
            throw new TeamCompetitionError("NOT_CURRENT_CAPTAIN", "현재 순서의 팀장만 행운권을 뽑을 수 있습니다.", 403);
        }
        const trailingMisses = [...event.competitionDraftPicks]
            .filter((item) => item.generation === event.draftGeneration)
            .reverse().findIndex((item) => item.pickType !== "LUCKY_DRAW_MISS");
        const consecutiveMisses = trailingMisses === -1
            ? event.competitionDraftPicks.filter((item) => item.generation === event.draftGeneration).length
            : trailingMisses;
        const won = luckyDrawWins(consecutiveMisses, teams.length);
        const participant = won ? secureShuffle(remaining)[0] : null;
        if (participant) {
            const claimed = await tx.teamCompetitionParticipant.updateMany({ where: { id: participant.id, competitionTeamId: null }, data: {
                competitionTeamId: team.id, assignmentType: "LUCKY_DRAW", assignmentOrder: event.currentPickNumber,
            } });
            if (claimed.count !== 1) throw new TeamCompetitionError("PLAYER_ALREADY_DRAFTED", "이미 배정된 참가자입니다.", 409);
        }
        await tx.teamCompetitionDraftPick.create({ data: {
            eventId, generation: event.draftGeneration, pickNumber: event.currentPickNumber,
            roundNumber: turn.roundNumber, direction: turn.direction, captainMemberId: team.captainMemberId,
            competitionTeamId: team.id, selectedParticipantId: participant?.id ?? null,
            selectedDisplayNameSnapshot: participant ? participantName(participant) : "꽝",
            pickType: participant ? "LUCKY_DRAW_WIN" : "LUCKY_DRAW_MISS",
        } });
        const remainingAfter = participant ? remaining.length - 1 : remaining.length;
        const status = remainingAfter === 0 ? "TEAMS_FINALIZED" : "LUCKY_DRAW";
        const advanced = await tx.teamEvent.updateMany({ where: {
            id: eventId, competitionStatus: "LUCKY_DRAW", currentPickNumber: event.currentPickNumber,
        }, data: { competitionStatus: status, currentPickNumber: { increment: 1 } } });
        if (advanced.count !== 1) throw new TeamCompetitionError("DRAFT_TURN_CONFLICT", "행운권 순서가 변경되었습니다.", 409);
        return { status, won: participant != null, participant: participant ? serializeParticipant(participant) : null };
    });
}

async function autoAssignRemainder(actorUserId: string, teamId: string, eventId: string) {
    const event = await loadEvent(actorUserId, teamId, eventId); requireManager(event, actorUserId); requireTeamCompetition(event);
    if (event.competitionStatus !== "LUCKY_DRAW" && event.competitionStatus !== "DRAFT_IN_PROGRESS") throw stateError();
    await prisma.$transaction((tx) => finalizeRandomRemainder(
        tx, eventId, event.draftGeneration, currentTeams(event), currentParticipants(event), event.currentPickNumber - 1,
    ));
    return { status: "TEAMS_FINALIZED" };
}

async function resetDraft(actorUserId: string, teamId: string, eventId: string) {
    const event = await loadEvent(actorUserId, teamId, eventId); requireManager(event, actorUserId); requireTeamCompetition(event);
    if (event.competitionStatus === "ATTENDANCE_OPEN") throw stateError();
    await prisma.$transaction(async (tx) => {
        await tx.teamEventLaneAssignment.deleteMany({ where: { eventId } });
        const reset = await tx.teamEvent.updateMany({ where: {
            id: eventId, draftGeneration: event.draftGeneration,
            competitionStatus: { not: "ATTENDANCE_OPEN" },
        }, data: {
            draftGeneration: { increment: 1 }, currentPickNumber: 1, competitionStatus: "ATTENDANCE_LOCKED",
            laneDrawStatus: "NOT_STARTED",
        } });
        if (reset.count !== 1) throw new TeamCompetitionError("DRAFT_TURN_CONFLICT", "드래프트 상태가 변경되었습니다.", 409);
    });
    return { status: "ATTENDANCE_LOCKED", generation: event.draftGeneration + 1 };
}

async function assignTeamLanes(actorUserId: string, teamId: string, eventId: string, raw: unknown) {
    const event = await loadEvent(actorUserId, teamId, eventId); requireManager(event, actorUserId); requireTeamCompetition(event);
    if (event.competitionStatus !== "TEAMS_FINALIZED") throw stateError();
    if (!Array.isArray(raw)) throw new TeamCompetitionError("INVALID_LANE_TEAMS", "팀별 레인 순서를 확인해주세요.", 400);
    const teams = currentTeams(event); const participants = currentParticipants(event);
    const input: LaneTeam[] = raw.map((value) => {
        const item = asRecord(value);
        const participantIds = item.participantIds ?? item.memberIds;
        if (typeof item.competitionTeamId !== "string" || !Number.isSafeInteger(item.lanePriority) || !Array.isArray(participantIds) ||
            participantIds.some((id) => typeof id !== "string")) throw new TeamCompetitionError("INVALID_LANE_TEAMS", "팀별 레인 순서를 확인해주세요.", 400);
        return { id: item.competitionTeamId, lanePriority: item.lanePriority as number, memberIds: participantIds as string[] };
    });
    const priorities = new Set(input.map((item) => item.lanePriority));
    if (input.length !== teams.length || new Set(input.map((item) => item.id)).size !== teams.length || priorities.size !== teams.length ||
        [...priorities].some((value) => value < 1 || value > teams.length)) throw new TeamCompetitionError("INVALID_LANE_TEAMS", "레인 우선순위는 1부터 이어져야 합니다.", 400);
    const expectedByTeam = new Map(teams.map((team) => [team.id, new Set(team.participants.map((item) => item.id))]));
    const submitted = input.flatMap((item) => item.memberIds);
    if (new Set(submitted).size !== participants.length || submitted.length !== participants.length || input.some((item) => {
        const expected = expectedByTeam.get(item.id); return !expected || item.memberIds.length !== expected.size || item.memberIds.some((id) => !expected.has(id));
    })) throw new TeamCompetitionError("INVALID_MEMBER_ORDER", "각 팀의 모든 참가자 순서를 명시해주세요.", 400);
    const blocks = allocateTeamLaneBlocks(input, event.laneSlots);
    const participantById = new Map(participants.map((item) => [item.id, item]));
    await prisma.$transaction(async (tx) => {
        const claimed = await tx.teamEvent.updateMany({
            where: { id: eventId, draftGeneration: event.draftGeneration, competitionStatus: "TEAMS_FINALIZED" },
            data: { competitionStatus: "LANES_ASSIGNED", laneDrawStatus: "COMPLETED" },
        });
        if (claimed.count !== 1) throw new TeamCompetitionError("LANE_ASSIGNMENT_CONFLICT", "레인 배정 상태가 변경되었습니다.", 409);
        await tx.teamEventLaneAssignment.deleteMany({ where: { eventId } });
        for (const block of blocks) {
            await tx.teamCompetitionTeam.update({ where: { id: block.competitionTeamId }, data: { lanePriority: block.lanePriority } });
            for (const assignment of block.assignments) {
                const participant = participantById.get(assignment.memberId)!;
                await tx.teamEventLaneAssignment.create({ data: {
                    eventId, slotId: assignment.slot.id, memberId: participant.memberId, guestId: participant.guestId,
                    participantKind: participant.memberId ? "MEMBER" : "GUEST", participantDisplayName: participantName(participant),
                } });
            }
        }
    });
    return { status: "LANES_ASSIGNED", blocks: blocks.map((block) => ({
        competitionTeamId: block.competitionTeamId, lanePriority: block.lanePriority,
        slots: block.assignments.map((item) => `${item.slot.laneNumber}-${item.slot.position}`),
    })) };
}

async function publishTeamCompetition(actorUserId: string, teamId: string, eventId: string, _rawPolicy: unknown) {
    const existing = await loadEvent(actorUserId, teamId, eventId); requireManager(existing, actorUserId); requireTeamCompetition(existing);
    if (existing.competitionStatus === "PUBLISHED") return { status: "PUBLISHED", alreadyPublished: true };
    if (existing.competitionStatus !== "TEAMS_FINALIZED" && existing.competitionStatus !== "LANES_ASSIGNED") throw stateError();
    const publishedAt = new Date();
    return prisma.$transaction(async (tx) => {
        const event = await tx.teamEvent.findFirst({ where: {
            id: eventId, teamId, competitionStatus: { in: ["TEAMS_FINALIZED", "LANES_ASSIGNED"] },
        }, include: competitionInclude });
        if (!event) throw stateError(); requireManager(event, actorUserId); requireTeamCompetition(event);
        const result = await calculateResults(event, tx);
        if (!result.complete) throw new TeamCompetitionError("SCORES_INCOMPLETE", "모든 TEAM 참가자의 점수 입력을 완료해주세요.", 409);
        const tiePolicy = "POINTS_EFFECTIVE_PINS_MEMBER_COUNT_HANDICAP_STABLE_ID";
        const rankedTeams = rankFinalTeams(result.teams);
        const pointTable = await getPublicationPointTable(tx, event);
        const publishedTeams = rankedTeams.map((team) => ({
            ...team, seasonPoint: seasonPointsForRank(pointTable, team.finalRank),
        }));
        const rankByTeam = new Map(publishedTeams.map((team) => [team.competitionTeamId, team.finalRank]));
        const awards = currentParticipants(event).filter((item) => item.competitionTeamId && item.memberId && item.member).map((participant) => {
            const rank = rankByTeam.get(participant.competitionTeamId!) ?? null;
            return {
                memberId: participant.memberId!, memberDisplayName: displayName(participant.member!),
                competitionTeamId: participant.competitionTeamId, finalRank: rank,
                points: seasonPointsForRank(pointTable, rank),
            };
        });
        const publication = await createSeasonPointPublication(tx, {
            event, pointTable, awards, publishedAt,
            resultSnapshot: { version: 1, previousStatus: event.competitionStatus, tieBreakPolicy: tiePolicy, ...result, teams: publishedTeams },
        });
        const updated = await tx.teamEvent.updateMany({ where: {
            id: eventId, competitionStatus: event.competitionStatus,
        }, data: { competitionStatus: "PUBLISHED" } });
        if (updated.count !== 1) throw new TeamCompetitionError("PUBLICATION_CONFLICT", "다른 발표 요청이 먼저 처리되었습니다.", 409);
        return { status: "PUBLISHED", seasonId: publication.seasonId, publicationId: publication.publicationId };
    });
}

async function reopenTeamCompetition(actorUserId: string, teamId: string, eventId: string) {
    const event = await loadEvent(actorUserId, teamId, eventId); requireManager(event, actorUserId); requireTeamCompetition(event);
    if (event.competitionStatus !== "PUBLISHED") throw stateError();
    const previousStatus = event.laneDrawStatus === "COMPLETED" ? "LANES_ASSIGNED" : "TEAMS_FINALIZED";
    await prisma.$transaction(async (tx) => {
        await revokeSeasonPointPublication(tx, eventId, new Date(), event.competitionMode === "OFFICIAL");
        const updated = await tx.teamEvent.updateMany({ where: { id: eventId, competitionStatus: "PUBLISHED" }, data: {
            competitionStatus: previousStatus, seasonPublicationRevision: { increment: 1 },
        } });
        if (updated.count !== 1) throw new TeamCompetitionError("PUBLICATION_CONFLICT", "TEAM 발표 상태가 변경되었습니다.", 409);
    });
    return { status: previousStatus, publicationRevoked: true };
}

export function rankFinalTeams<T extends {
    competitionTeamId: string;
    totalPoints: number;
    effectivePins: number;
    memberCount: number;
    teamHandicap: number;
}>(values: readonly T[]) {
    return [...values].sort((left, right) => {
        const points = right.totalPoints - left.totalPoints; if (points !== 0) return points;
        const pins = right.effectivePins - left.effectivePins; if (pins !== 0) return pins;
        const members = left.memberCount - right.memberCount; if (members !== 0) return members;
        const handicap = left.teamHandicap - right.teamHandicap; if (handicap !== 0) return handicap;
        return left.competitionTeamId.localeCompare(right.competitionTeamId);
    }).map((team, index) => ({ ...team, finalRank: index + 1 }));
}

async function finalizeRandomRemainder(
    tx: Prisma.TransactionClient, eventId: string, generation: number,
    teams: ReturnType<typeof currentTeams>, participants: ReturnType<typeof currentParticipants>, directPicks: number,
) {
    const remaining = secureShuffle(participants.filter((item) => !item.competitionTeamId));
    const sizes = new Map(teams.map((team) => [team.id, participants.filter((item) => item.competitionTeamId === team.id).length]));
    for (let index = 0; index < remaining.length; index += 1) {
        const team = [...teams].sort((a, b) => (sizes.get(a.id)! - sizes.get(b.id)!) || a.draftOrder - b.draftOrder)[0];
        const participant = remaining[index]; const pickNumber = directPicks + index + 1;
        await tx.teamCompetitionParticipant.update({ where: { id: participant.id }, data: {
            competitionTeamId: team.id, assignmentType: "RANDOM", assignmentOrder: pickNumber,
        } });
        await tx.teamCompetitionDraftPick.create({ data: {
            eventId, generation, pickNumber, roundNumber: 0, direction: "AUTOMATIC", captainMemberId: null,
            competitionTeamId: team.id, selectedParticipantId: participant.id,
            selectedDisplayNameSnapshot: participantName(participant), pickType: "AUTO_REMAINDER",
        } });
        sizes.set(team.id, sizes.get(team.id)! + 1);
    }
    await tx.teamEvent.update({ where: { id: eventId }, data: { competitionStatus: "TEAMS_FINALIZED", currentPickNumber: directPicks + 1 } });
}

const competitionInclude = {
    team: { select: {
        ownerId: true, bowlerHiddenEnabled: true, User: { select: { id: true } },
        members: { select: { id: true, userId: true, alias: true, user: { select: { name: true } } } },
    } },
    attendances: { include: { member: { select: { id: true, userId: true, alias: true, user: { select: { name: true } } } } } },
    guests: { select: { id: true, name: true } },
    competitionTeams: { include: {
        captain: { select: { id: true, userId: true, alias: true, user: { select: { name: true } } } },
        participants: { include: { member: { select: { id: true, userId: true, alias: true, user: { select: { name: true } } } }, guest: { select: { id: true, name: true } } }, orderBy: [{ assignmentOrder: "asc" as const }, { id: "asc" as const }] },
    } },
    competitionParticipants: { include: { member: { select: { id: true, userId: true, alias: true, user: { select: { name: true } } } }, guest: { select: { id: true, name: true } } } },
    competitionDraftPicks: { include: { competitionTeam: { select: { name: true } }, selectedParticipant: { select: { memberId: true, guestId: true } } }, orderBy: { pickNumber: "asc" as const } },
    laneSlots: { orderBy: [{ laneNumber: "asc" as const }, { position: "asc" as const }] },
    laneAssignments: { include: { slot: true } },
    seasonPublications: { where: { revokedAt: null }, orderBy: { revision: "desc" as const }, take: 1, select: { resultSnapshot: true, publishedAt: true } },
} satisfies Prisma.TeamEventInclude;
type CompetitionEvent = Prisma.TeamEventGetPayload<{ include: typeof competitionInclude }>;

async function loadEvent(userId: string, teamId: string, eventId: string) {
    const event = await prisma.teamEvent.findFirst({ where: {
        id: eventId, teamId, team: { isActive: true, members: { some: { userId } } },
    }, include: competitionInclude });
    if (!event) throw new TeamCompetitionError("EVENT_NOT_FOUND", "일정을 찾을 수 없습니다.", 404);
    return event;
}
function requireTeamCompetition(event: CompetitionEvent) {
    if (!event.team.bowlerHiddenEnabled) throw new TeamCompetitionError("FEATURE_DISABLED", "Bowler Hidden 기능이 활성화되지 않은 팀입니다.", 404);
    if (!event.competitionEnabled || event.competitionType !== "TEAM") throw new TeamCompetitionError("TEAM_COMPETITION_NOT_AVAILABLE", "TEAM 대회가 아닙니다.", 409);
}
function requireManager(event: CompetitionEvent, userId: string) {
    if (event.team.ownerId !== userId && !event.team.User.some((item) => item.id === userId)) {
        throw new TeamCompetitionError("FORBIDDEN", "TEAM 대회 관리 권한이 없습니다.", 403);
    }
}
function attendingMembers(event: CompetitionEvent) {
    return event.attendances.flatMap((item) => item.status === "ATTENDING" && item.member ? [item.member] : []);
}
function currentTeams(event: CompetitionEvent) { return event.competitionTeams.filter((item) => item.generation === event.draftGeneration).sort((a, b) => a.draftOrder - b.draftOrder); }
function currentParticipants(event: CompetitionEvent) { return event.competitionParticipants.filter((item) => item.generation === event.draftGeneration); }
function displayName(member: { alias: string | null; user: { name: string } }) { return member.alias?.trim() || member.user.name; }
function participantName(item: ReturnType<typeof currentParticipants>[number]) { return item.member ? displayName(item.member) : item.guest?.name ?? "게스트"; }
function serializeParticipant(item: ReturnType<typeof currentParticipants>[number]) { return {
    participantId: item.id, participantKind: item.memberId ? "MEMBER" : "GUEST",
    memberId: item.memberId, guestId: item.guestId, name: participantName(item),
    assignmentType: item.assignmentType, assignmentOrder: item.assignmentOrder,
}; }
function serializeTeam(team: ReturnType<typeof currentTeams>[number], event: CompetitionEvent) {
    const assignments = new Map(event.laneAssignments.map((item) => [item.memberId ?? item.guestId!, `${item.slot.laneNumber}-${item.slot.position}`]));
    return { id: team.id, name: team.name, draftOrder: team.draftOrder, lanePriority: team.lanePriority,
        teamHandicap: team.teamHandicap, captainMemberId: team.captainMemberId, captainName: displayName(team.captain),
        members: team.participants.map((item) => ({ ...serializeParticipant(item), laneSlot: assignments.get(item.memberId ?? item.guestId!) ?? null })),
    };
}
function stateError() { return new TeamCompetitionError("INVALID_COMPETITION_STATE", "현재 TEAM 대회 단계에서는 수행할 수 없습니다.", 409); }
function asRecord(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new TeamCompetitionError("INVALID_REQUEST", "요청 내용을 확인해주세요.", 400);
    return value as Record<string, unknown>;
}

function publishedTeamResult(event: CompetitionEvent): Awaited<ReturnType<typeof calculateResults>> {
    const publication = event.seasonPublications[0];
    if (!publication) throw new TeamCompetitionError("INVALID_RESULT_SNAPSHOT", "발표된 TEAM 결과를 불러올 수 없습니다.", 500);
    try {
        const snapshot = JSON.parse(publication.resultSnapshot) as { version?: unknown; complete?: unknown; teams?: unknown; individual?: unknown; games?: unknown };
        if (snapshot.version !== 1 || snapshot.complete !== true || !Array.isArray(snapshot.teams) || !Array.isArray(snapshot.individual) || !Array.isArray(snapshot.games)) throw new Error("invalid snapshot");
        return snapshot as unknown as Awaited<ReturnType<typeof calculateResults>>;
    } catch { throw new TeamCompetitionError("INVALID_RESULT_SNAPSHOT", "발표된 TEAM 결과를 불러올 수 없습니다.", 500); }
}

type ScoreReader = { score: { findMany: typeof prisma.score.findMany } };
async function calculateResults(event: CompetitionEvent, db: ScoreReader = prisma) {
    const teams = currentTeams(event); const participants = currentParticipants(event).filter((item) => item.competitionTeamId);
    if (teams.length === 0 || participants.length === 0) return { complete: false, individual: [], games: [], teams: [], requiresPinTieBreakPolicy: false };
    const memberUserIds = participants.flatMap((item) => item.member ? [item.member.userId] : []);
    const guestIds = participants.flatMap((item) => item.guestId ? [item.guestId] : []);
    const guestNames = participants.flatMap((item) => item.guest ? [item.guest.name] : []);
    const rows = await db.score.findMany({ where: {
        teamEventId: event.id, teamId: event.teamId, OR: [
            { userId: { in: memberUserIds } },
            { teamEventGuestId: { in: guestIds } },
            { guestName: { in: guestNames } },
        ], score: { gte: 0, lte: 300 },
    }, orderBy: [{ gameDate: "asc" }, { createdAt: "asc" }, { id: "asc" }], select: { id: true, userId: true, teamEventGuestId: true, guestName: true, score: true } });
    const scoresByParticipant = new Map<string, number[]>();
    const participantKey = (item: typeof participants[number]) => item.member ? `U:${item.member.userId}` : `G:${item.guestId}`;
    const guestByName = uniqueGuestIdsByName(
        participants.flatMap((item) => item.guestId && item.guest ? [{ id: item.guestId, name: item.guest.name }] : []),
    );
    for (const row of rows) {
        const key = row.userId ? `U:${row.userId}` : row.teamEventGuestId ? `G:${row.teamEventGuestId}` : row.guestName && guestByName.has(row.guestName) ? `G:${guestByName.get(row.guestName)}` : null;
        if (!key) continue;
        const values = scoresByParticipant.get(key); if (values) values.push(row.score); else scoresByParticipant.set(key, [row.score]);
    }
    const gameCount = Math.max(0, ...participants.map((item) => scoresByParticipant.get(participantKey(item))?.length ?? 0));
    const complete = gameCount > 0 && participants.every((item) => (scoresByParticipant.get(participantKey(item))?.length ?? 0) === gameCount);
    const effectivePlayerCount = Math.min(...teams.map((team) => team.participants.length));
    const points = new Map(readRankPoints(event.rankPoints).map((item) => [item.rank, item.points]));
    const teamTotals = new Map(teams.map((team) => [team.id, { points: 0, raw: 0, effective: 0, applied: 0 }]));
    const games = Array.from({ length: gameCount }, (_, gameIndex) => {
        const values = teams.map((team) => {
            const teamScores = team.participants.map((item) => scoresByParticipant.get(participantKey(item))?.[gameIndex] ?? null);
            if (teamScores.some((score) => score === null)) return { teamId: team.id, teamName: team.name, complete: false, rawTeamTotal: null, excludedScores: [], normalizedTeamTotal: null, handicapAppliedTotal: null, rank: null, points: null };
            const numeric = teamScores as number[]; const sorted = [...numeric].sort((a, b) => a - b);
            const excludedScores = sorted.slice(0, Math.max(0, sorted.length - effectivePlayerCount));
            const raw = numeric.reduce((sum, score) => sum + score, 0); const normalized = sorted.slice(sorted.length - effectivePlayerCount).reduce((sum, score) => sum + score, 0);
            return {
                teamId: team.id, teamName: team.name, complete: true,
                rawTeamTotal: raw, excludedScores, normalizedTeamTotal: normalized,
                teamHandicap: team.teamHandicap, handicapAppliedTotal: normalized + team.teamHandicap,
                rank: null as number | null, points: null as number | null,
            };
        });
        if (values.every((item) => item.complete)) {
            values.sort((a, b) => b.handicapAppliedTotal! - a.handicapAppliedTotal! || a.teamId.localeCompare(b.teamId));
            values.forEach((item, index) => {
                item.rank = index + 1; item.points = points.get(index + 1) ?? 0;
                const total = teamTotals.get(item.teamId)!;
                total.points += item.points;
                total.raw += item.rawTeamTotal!;
                total.effective += item.normalizedTeamTotal!;
                total.applied += item.handicapAppliedTotal!;
            });
        }
        return { gameNumber: gameIndex + 1, complete: values.every((item) => item.complete), teams: values };
    });
    const individual = participants.map((item) => {
        const scores = scoresByParticipant.get(participantKey(item)) ?? []; const total = scores.reduce((sum, score) => sum + score, 0);
        return { participantId: item.id, participantKind: item.memberId ? "MEMBER" : "GUEST", memberId: item.memberId, guestId: item.guestId,
            name: participantName(item), competitionTeamId: item.competitionTeamId!, scores, total, average: scores.length ? Number((total / scores.length).toFixed(1)) : null };
    }).sort((a, b) => b.total - a.total || a.participantId.localeCompare(b.participantId)).map((item, index) => ({ rank: index + 1, ...item }));
    const teamResults = teams.map((team) => ({
        competitionTeamId: team.id, name: team.name, memberCount: team.participants.length,
        teamHandicap: team.teamHandicap, totalPoints: teamTotals.get(team.id)!.points,
        rawPins: teamTotals.get(team.id)!.raw, effectivePins: teamTotals.get(team.id)!.effective,
        appliedPins: teamTotals.get(team.id)!.applied,
    }))
        .sort((a, b) => b.totalPoints - a.totalPoints || a.competitionTeamId.localeCompare(b.competitionTeamId));
    const pointCounts = new Map<number, number>(); teamResults.forEach((item) => pointCounts.set(item.totalPoints, (pointCounts.get(item.totalPoints) ?? 0) + 1));
    return {
        complete, effectivePlayerCount, individual, games,
        teams: teamResults.map((item, index) => ({
            ...item,
            finalRank: complete && pointCounts.get(item.totalPoints) === 1 ? index + 1 : null,
        })),
        requiresPinTieBreakPolicy: false,
    };
}

function uniqueGuestIdsByName(guests: readonly { id: string; name: string }[]) {
    const grouped = new Map<string, string[]>();
    for (const guest of guests) grouped.set(guest.name, [...(grouped.get(guest.name) ?? []), guest.id]);
    return new Map([...grouped].flatMap(([name, ids]) => ids.length === 1 ? [[name, ids[0]] as const] : []));
}
