import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getUnifiedSeasonRanking } from "@/lib/mobile-api/unified-season";

const NODE_TYPES = ["WILDCARD", "ROUND", "FINAL", "LOSER_REVIVAL", "PLACEMENT", "SPECIAL"] as const;
const CONDITION_TYPES = ["TOP_N", "RANK_RANGE", "ELIMINATED", "WINNER", "ADMIN_DEFINED"] as const;
const ENTRY_SOURCES = ["DIRECT_SEED", "PREVIOUS_NODE_ADVANCER", "PREVIOUS_NODE_ELIMINATED", "WILDCARD_WINNER", "ADMIN_ENTRY"] as const;

export class SeasonFinalError extends Error {
  constructor(public readonly code: string, message: string, public readonly status: number) { super(message); }
}

export type SeasonFinalStructure = {
  divisions: { code: string; name: string; sortOrder: number }[];
  nodes: { key: string; divisionCode?: string | null; name: string; type: string; sortOrder: number; gameCount: number; placementStart?: number | null; placementEnd?: number | null }[];
  transitions: { sourceKey: string; destinationKey: string; conditionType: string; rankStart?: number | null; rankEnd?: number | null; sortOrder: number; entrySource: string }[];
  seedEntries: { nodeKey: string; seedStart: number; seedEnd: number; sourceType: string; reason?: string | null }[];
};

type TeamAccess = { id: string; ownerId: string | null; bowlerHiddenEnabled: boolean; User: { id: string }[]; members: { userId: string }[] };

export function validateSeasonFinalStructure(structure: SeasonFinalStructure, participantCount?: number) {
  const errors: string[] = [];
  if (!structure || !Array.isArray(structure.divisions) || !Array.isArray(structure.nodes) || !Array.isArray(structure.transitions) || !Array.isArray(structure.seedEntries)) return ["대진 구조 형식을 확인해주세요."];
  const divisionCodes = new Set<string>();
  for (const division of structure.divisions) {
    if (!division.code?.trim() || divisionCodes.has(division.code)) errors.push("Division code는 중복 없이 필요합니다.");
    divisionCodes.add(division.code);
  }
  const nodes = new Map<string, SeasonFinalStructure["nodes"][number]>();
  for (const node of structure.nodes) {
    if (!node.key?.trim() || nodes.has(node.key)) errors.push("Node key는 중복 없이 필요합니다.");
    if (!(NODE_TYPES as readonly string[]).includes(node.type)) errors.push(`${node.key || "Node"} 유형이 올바르지 않습니다.`);
    if (!Number.isSafeInteger(node.gameCount) || node.gameCount < 1 || node.gameCount > 20) errors.push(`${node.key || "Node"} 경기 수는 1~20이어야 합니다.`);
    if (node.divisionCode && !divisionCodes.has(node.divisionCode)) errors.push(`${node.key}의 Division을 찾을 수 없습니다.`);
    if ((node.placementStart == null) !== (node.placementEnd == null) || (node.placementStart != null && (node.placementStart < 1 || node.placementEnd! < node.placementStart))) errors.push(`${node.key}의 순위 범위를 확인해주세요.`);
    nodes.set(node.key, node);
  }
  if ([...nodes.values()].filter((node) => node.type === "FINAL").length !== 1) errors.push("FINAL Node가 정확히 하나 필요합니다.");
  const adjacency = new Map<string, string[]>([...nodes.keys()].map((key) => [key, []]));
  const transitionRanges = new Map<string, { start: number; end: number }[]>();
  for (const transition of structure.transitions) {
    if (!nodes.has(transition.sourceKey) || !nodes.has(transition.destinationKey)) errors.push("Transition의 출발/도착 Node를 찾을 수 없습니다.");
    if (!(CONDITION_TYPES as readonly string[]).includes(transition.conditionType)) errors.push("Transition 조건을 확인해주세요.");
    if (!(ENTRY_SOURCES as readonly string[]).includes(transition.entrySource)) errors.push("Transition 참가 출처를 확인해주세요.");
    if (transition.sourceKey === transition.destinationKey) errors.push("Node가 자기 자신으로 이동할 수 없습니다.");
    adjacency.get(transition.sourceKey)?.push(transition.destinationKey);
    const range = transitionRange(transition);
    if (!range) errors.push(`${transition.sourceKey} Transition 순위 범위를 확인해주세요.`);
    else {
      const previous = transitionRanges.get(transition.sourceKey) ?? [];
      if (previous.some((item) => range.start <= item.end && range.end >= item.start)) errors.push(`${transition.sourceKey} Transition 순위가 겹칩니다.`);
      previous.push(range); transitionRanges.set(transition.sourceKey, previous);
    }
  }
  const visiting = new Set<string>(); const visited = new Set<string>();
  const visit = (key: string): boolean => {
    if (visiting.has(key)) return true; if (visited.has(key)) return false;
    visiting.add(key); for (const next of adjacency.get(key) ?? []) if (visit(next)) return true;
    visiting.delete(key); visited.add(key); return false;
  };
  if ([...nodes.keys()].some(visit)) errors.push("Tournament graph에 cycle이 있습니다.");
  const roots = new Set(structure.seedEntries.map((entry) => entry.nodeKey));
  const reachable = new Set<string>(); const stack = [...roots];
  while (stack.length) { const key = stack.pop()!; if (reachable.has(key)) continue; reachable.add(key); stack.push(...(adjacency.get(key) ?? [])); }
  for (const key of nodes.keys()) if (!reachable.has(key)) errors.push(`${key} Node에 도달할 수 없습니다.`);
  const placements = structure.nodes.filter((node) => node.placementStart != null).map((node) => ({ key: node.key, start: node.placementStart!, end: node.placementEnd! }));
  for (let i = 0; i < placements.length; i++) for (let j = i + 1; j < placements.length; j++) if (placements[i].start <= placements[j].end && placements[i].end >= placements[j].start) errors.push(`${placements[i].key}와 ${placements[j].key}의 최종 순위 범위가 겹칩니다.`);
  const assignedSeeds = new Set<number>();
  for (const entry of structure.seedEntries) {
    if (!nodes.has(entry.nodeKey) || !Number.isSafeInteger(entry.seedStart) || !Number.isSafeInteger(entry.seedEnd) || entry.seedStart < 1 || entry.seedEnd < entry.seedStart) errors.push("Seed entry 범위를 확인해주세요.");
    if (!(ENTRY_SOURCES as readonly string[]).includes(entry.sourceType)) errors.push("Seed entry 출처를 확인해주세요.");
    for (let seed = entry.seedStart; seed <= entry.seedEnd; seed++) { if (assignedSeeds.has(seed)) errors.push(`Seed ${seed}가 중복 배정되었습니다.`); assignedSeeds.add(seed); }
  }
  if (participantCount != null) {
    for (let seed = 1; seed <= participantCount; seed++) if (!assignedSeeds.has(seed)) errors.push(`Seed ${seed}의 시작 Node가 없습니다.`);
    if ([...assignedSeeds].some((seed) => seed > participantCount)) errors.push("참가자 수를 초과한 Seed가 배정되었습니다.");
  }
  return [...new Set(errors)];
}

export async function createSeasonFinal(actorUserId: string, teamId: string, input: { seasonId?: unknown; name?: unknown; competitionMode?: unknown }) {
  const access = await requireAccess(actorUserId, teamId, true);
  const seasonId = text(input.seasonId, "시즌을 선택해주세요.");
  const name = text(input.name, "최종전 이름을 입력해주세요.", 80);
  const competitionMode = input.competitionMode ?? "OFFICIAL";
  if (competitionMode !== "OFFICIAL" && competitionMode !== "MINI") throw new SeasonFinalError("INVALID_COMPETITION_MODE", "최종전 적용 모드를 확인해주세요.", 400);
  const season = await prisma.teamSeason.findFirst({ where: { id: seasonId, teamId: access.id }, select: { id: true } });
  if (!season) throw new SeasonFinalError("SEASON_NOT_FOUND", "시즌을 찾을 수 없습니다.", 404);
  const tournament = await prisma.seasonFinalTournament.create({ data: { teamId, seasonId, name, competitionMode }, select: { id: true } });
  return { tournamentId: tournament.id };
}

export async function getSeasonFinals(actorUserId: string, teamId: string, tournamentId?: string) {
  const access = await requireAccess(actorUserId, teamId, false);
  if (!tournamentId) {
    const items = await prisma.seasonFinalTournament.findMany({ where: { teamId }, orderBy: [{ createdAt: "desc" }, { id: "asc" }], select: { id: true, seasonId: true, name: true, status: true, competitionMode: true, lockedAt: true, startedAt: true, completedAt: true } });
    return { canManage: role(access, actorUserId) !== "MEMBER", canLock: role(access, actorUserId) === "OWNER", items };
  }
  const tournament = await prisma.seasonFinalTournament.findFirst({ where: { id: tournamentId, teamId }, include: {
    season: { select: { id: true, name: true } }, divisions: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] },
    participants: { orderBy: [{ seed: "asc" }, { id: "asc" }] },
    nodes: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }], include: { entries: { include: { participant: true }, orderBy: { createdAt: "asc" } }, results: { orderBy: { rank: "asc" } } } },
    transitions: { orderBy: [{ sourceNodeId: "asc" }, { sortOrder: "asc" }] },
  } });
  if (!tournament) throw new SeasonFinalError("TOURNAMENT_NOT_FOUND", "시즌 최종전을 찾을 수 없습니다.", 404);
  return { ...tournament, eligibilityConfig: parseConfig(tournament.eligibilityConfig), canManage: role(access, actorUserId) !== "MEMBER", canLock: role(access, actorUserId) === "OWNER" };
}

export async function saveSeasonFinalStructure(actorUserId: string, teamId: string, tournamentId: string, structure: SeasonFinalStructure) {
  await requireAccess(actorUserId, teamId, true);
  const errors = validateSeasonFinalStructure(structure);
  if (errors.length) throw new SeasonFinalError("INVALID_STRUCTURE", errors.join(" "), 400);
  await prisma.$transaction(async (tx) => {
    const tournament = await tx.seasonFinalTournament.findFirst({ where: { id: tournamentId, teamId }, select: { status: true } });
    if (!tournament) throw new SeasonFinalError("TOURNAMENT_NOT_FOUND", "시즌 최종전을 찾을 수 없습니다.", 404);
    if (tournament.status !== "DRAFT") throw new SeasonFinalError("TOURNAMENT_LOCKED", "확정된 대진 구조는 변경할 수 없습니다.", 409);
    await tx.seasonFinalTransition.deleteMany({ where: { tournamentId } });
    await tx.seasonFinalNodeEntry.deleteMany({ where: { node: { tournamentId } } });
    await tx.seasonFinalNode.deleteMany({ where: { tournamentId } });
    await tx.seasonFinalDivision.deleteMany({ where: { tournamentId } });
    const divisionIds = new Map<string, string>();
    for (const division of structure.divisions) { const created = await tx.seasonFinalDivision.create({ data: { tournamentId, ...division }, select: { id: true } }); divisionIds.set(division.code, created.id); }
    const nodeIds = new Map<string, string>();
    for (const node of structure.nodes) { const created = await tx.seasonFinalNode.create({ data: { tournamentId, key: node.key, name: node.name, type: node.type, sortOrder: node.sortOrder, gameCount: node.gameCount, placementStart: node.placementStart ?? null, placementEnd: node.placementEnd ?? null, divisionId: node.divisionCode ? divisionIds.get(node.divisionCode) : null }, select: { id: true } }); nodeIds.set(node.key, created.id); }
    for (const transition of structure.transitions) await tx.seasonFinalTransition.create({ data: { tournamentId, sourceNodeId: nodeIds.get(transition.sourceKey)!, destinationNodeId: nodeIds.get(transition.destinationKey)!, conditionType: transition.conditionType, rankStart: transition.rankStart ?? null, rankEnd: transition.rankEnd ?? null, sortOrder: transition.sortOrder, entrySource: transition.entrySource } });
    await tx.seasonFinalTournament.update({ where: { id: tournamentId }, data: { eligibilityConfig: JSON.stringify({ seedEntries: structure.seedEntries }) } });
  });
  return { saved: true };
}

export async function lockSeasonFinal(actorUserId: string, teamId: string, tournamentId: string) {
  const access = await requireAccess(actorUserId, teamId, true);
  if (role(access, actorUserId) !== "OWNER") throw new SeasonFinalError("OWNER_REQUIRED", "대진 구조 확정은 동호회장만 할 수 있습니다.", 403);
  const tournament = await prisma.seasonFinalTournament.findFirst({ where: { id: tournamentId, teamId }, include: { nodes: true, divisions: true, transitions: true } });
  if (!tournament) throw new SeasonFinalError("TOURNAMENT_NOT_FOUND", "시즌 최종전을 찾을 수 없습니다.", 404);
  if (tournament.status !== "DRAFT") throw new SeasonFinalError("TOURNAMENT_LOCKED", "이미 확정된 시즌 최종전입니다.", 409);
  const ranking = await getUnifiedSeasonRanking(actorUserId, teamId, { seasonId: tournament.seasonId });
  const structure = databaseStructure(tournament);
  const errors = validateSeasonFinalStructure(structure, ranking.rankings.length);
  if (!ranking.rankings.length) errors.push("시즌 순위 참가자가 없습니다.");
  if (errors.length) throw new SeasonFinalError("INVALID_STRUCTURE", errors.join(" "), 409);
  const nodeIds = new Map(tournament.nodes.map((node) => [node.key, node.id]));
  const seedEntries = structure.seedEntries;
  await prisma.$transaction(async (tx) => {
    const changed = await tx.seasonFinalTournament.updateMany({ where: { id: tournamentId, status: "DRAFT" }, data: { status: "LOCKED", lockedAt: new Date() } });
    if (changed.count !== 1) throw new SeasonFinalError("TOURNAMENT_LOCKED", "이미 확정된 시즌 최종전입니다.", 409);
    const participantIds = new Map<number, string>();
    for (const [index, row] of ranking.rankings.entries()) {
      const seed = index + 1;
      const rule = seedEntries.find((item) => seed >= item.seedStart && seed <= item.seedEnd);
      const participant = await tx.seasonFinalParticipant.create({ data: { tournamentId, memberId: row.id, displayNameSnapshot: row.name, seed, seasonPointsSnapshot: row.points, selectionSource: rule?.sourceType ?? "SEASON_RANK", selectionReason: rule?.reason ?? null }, select: { id: true } });
      participantIds.set(seed, participant.id);
    }
    for (const rule of seedEntries) for (let seed = rule.seedStart; seed <= rule.seedEnd; seed++) await tx.seasonFinalNodeEntry.create({ data: { nodeId: nodeIds.get(rule.nodeKey)!, participantId: participantIds.get(seed)!, sourceType: rule.sourceType } });
    const destinationNodeIds = new Set(tournament.transitions.map((item) => item.destinationNodeId));
    const readyNodeIds = tournament.nodes.filter((node) => seedEntries.some((entry) => entry.nodeKey === node.key) && !destinationNodeIds.has(node.id)).map((node) => node.id);
    if (readyNodeIds.length) await tx.seasonFinalNode.updateMany({ where: { id: { in: readyNodeIds } }, data: { status: "READY" } });
  });
  return { locked: true, participantCount: ranking.rankings.length };
}

export async function startSeasonFinal(actorUserId: string, teamId: string, tournamentId: string) {
  await requireAccess(actorUserId, teamId, true);
  const changed = await prisma.seasonFinalTournament.updateMany({ where: { id: tournamentId, teamId, status: "LOCKED" }, data: { status: "IN_PROGRESS", startedAt: new Date() } });
  if (changed.count !== 1) throw new SeasonFinalError("INVALID_STATUS", "확정된 시즌 최종전만 시작할 수 있습니다.", 409);
  return { started: true };
}

export async function saveSeasonFinalScores(actorUserId: string, teamId: string, tournamentId: string, nodeId: string, rawScores: unknown) {
  await requireAccess(actorUserId, teamId, true);
  if (!Array.isArray(rawScores) || rawScores.length > 1000) throw new SeasonFinalError("INVALID_SCORES", "점수를 확인해주세요.", 400);
  const scores = rawScores.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new SeasonFinalError("INVALID_SCORES", "점수를 확인해주세요.", 400);
    const { participantId, gameNumber, score } = item as Record<string, unknown>;
    if (typeof participantId !== "string" || !Number.isSafeInteger(gameNumber) || (gameNumber as number) < 1 || !Number.isSafeInteger(score) || (score as number) < 0 || (score as number) > 300) throw new SeasonFinalError("INVALID_SCORES", "점수는 게임별 0~300이어야 합니다.", 400);
    return { participantId, gameNumber: gameNumber as number, score: score as number };
  });
  await prisma.$transaction(async (tx) => {
    const node = await tx.seasonFinalNode.findFirst({ where: { id: nodeId, tournamentId, tournament: { teamId, status: "IN_PROGRESS" } }, include: { entries: { select: { participantId: true } } } });
    if (!node || !["READY", "IN_PROGRESS"].includes(node.status)) throw new SeasonFinalError("NODE_NOT_EDITABLE", "점수를 입력할 수 없는 Node입니다.", 409);
    const allowed = new Set(node.entries.map((entry) => entry.participantId));
    for (const score of scores) { if (!allowed.has(score.participantId) || score.gameNumber > node.gameCount) throw new SeasonFinalError("INVALID_SCORES", "Node 참가자와 경기 수를 확인해주세요.", 400); await tx.seasonFinalScore.upsert({ where: { nodeId_participantId_gameNumber: { nodeId, participantId: score.participantId, gameNumber: score.gameNumber } }, create: { nodeId, ...score }, update: { score: score.score } }); }
    await tx.seasonFinalNode.update({ where: { id: nodeId }, data: { status: "IN_PROGRESS" } });
  });
  return { saved: true };
}

export async function confirmSeasonFinalNode(actorUserId: string, teamId: string, tournamentId: string, nodeId: string) {
  await requireAccess(actorUserId, teamId, true);
  return prisma.$transaction(async (tx) => {
    const node = await tx.seasonFinalNode.findFirst({ where: { id: nodeId, tournamentId, tournament: { teamId, status: "IN_PROGRESS" } }, include: { entries: { include: { participant: true } }, scores: true, outgoing: { orderBy: { sortOrder: "asc" } } } });
    if (!node) throw new SeasonFinalError("NODE_NOT_FOUND", "Node를 찾을 수 없습니다.", 404);
    if (node.status === "COMPLETED") return { confirmed: true, alreadyConfirmed: true };
    const scoresByParticipant = new Map<string, number[]>();
    for (const entry of node.entries) scoresByParticipant.set(entry.participantId, []);
    for (const score of node.scores) scoresByParticipant.get(score.participantId)?.push(score.score);
    if ([...scoresByParticipant.values()].some((scores) => scores.length !== node.gameCount)) throw new SeasonFinalError("SCORES_INCOMPLETE", "모든 참가자의 경기 점수를 입력해주세요.", 409);
    const ranked = node.entries.map((entry) => ({ participantId: entry.participantId, seed: entry.participant.seed, totalPins: scoresByParticipant.get(entry.participantId)!.reduce((sum, value) => sum + value, 0) })).sort((a, b) => b.totalPins - a.totalPins || a.seed - b.seed).map((item, index) => ({ ...item, rank: index + 1 }));
    const now = new Date();
    for (const item of ranked) await tx.seasonFinalNodeResult.upsert({ where: { nodeId_participantId: { nodeId, participantId: item.participantId } }, create: { nodeId, participantId: item.participantId, totalPins: item.totalPins, average: item.totalPins / node.gameCount, rank: item.rank, confirmedAt: now }, update: { totalPins: item.totalPins, average: item.totalPins / node.gameCount, rank: item.rank, confirmedAt: now } });
    for (const item of ranked) {
      const transition = node.outgoing.find((candidate) => matchesTransition(candidate, item.rank, ranked.length));
      if (transition) await tx.seasonFinalNodeEntry.upsert({ where: { nodeId_participantId: { nodeId: transition.destinationNodeId, participantId: item.participantId } }, create: { nodeId: transition.destinationNodeId, participantId: item.participantId, sourceType: transition.entrySource, sourceNodeId: node.id }, update: {} });
      if (node.type === "FINAL") await tx.seasonFinalParticipant.update({ where: { id: item.participantId }, data: { finalPlacement: item.rank } });
      else if (node.placementStart != null) await tx.seasonFinalParticipant.update({ where: { id: item.participantId }, data: { finalPlacement: node.placementStart + item.rank - 1 } });
    }
    await tx.seasonFinalNode.update({ where: { id: node.id }, data: { status: "COMPLETED" } });
    const destinationIds = [...new Set(node.outgoing.map((item) => item.destinationNodeId))];
    for (const destinationNodeId of destinationIds) {
      const pendingPredecessors = await tx.seasonFinalTransition.count({ where: { destinationNodeId, sourceNode: { status: { not: "COMPLETED" } } } });
      if (pendingPredecessors === 0) await tx.seasonFinalNode.updateMany({ where: { id: destinationNodeId, status: "DRAFT" }, data: { status: "READY" } });
    }
    const remaining = await tx.seasonFinalNode.count({ where: { tournamentId, status: { not: "COMPLETED" } } });
    if (remaining === 0) await tx.seasonFinalTournament.update({ where: { id: tournamentId }, data: { status: "COMPLETED", completedAt: now } });
    return { confirmed: true, alreadyConfirmed: false, results: ranked.map(({ seed: _, ...item }) => item) };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

function transitionRange(transition: SeasonFinalStructure["transitions"][number]) {
  if (transition.conditionType === "WINNER") return { start: 1, end: 1 };
  if (transition.conditionType === "TOP_N") return Number.isSafeInteger(transition.rankEnd) && transition.rankEnd! >= 1 ? { start: 1, end: transition.rankEnd! } : null;
  if (["RANK_RANGE", "ELIMINATED", "ADMIN_DEFINED"].includes(transition.conditionType)) return Number.isSafeInteger(transition.rankStart) && Number.isSafeInteger(transition.rankEnd) && transition.rankStart! >= 1 && transition.rankEnd! >= transition.rankStart! ? { start: transition.rankStart!, end: transition.rankEnd! } : null;
  return null;
}
function matchesTransition(transition: { conditionType: string; rankStart: number | null; rankEnd: number | null }, rank: number, count: number) {
  if (transition.conditionType === "WINNER") return rank === 1;
  if (transition.conditionType === "TOP_N") return rank <= (transition.rankEnd ?? 0);
  if (transition.conditionType === "ELIMINATED" && transition.rankStart == null) return rank > (transition.rankEnd ?? count);
  return rank >= (transition.rankStart ?? 1) && rank <= (transition.rankEnd ?? count);
}
function databaseStructure(tournament: { eligibilityConfig: string; divisions: { id: string; code: string; name: string; sortOrder: number }[]; nodes: { id: string; key: string; name: string; type: string; sortOrder: number; gameCount: number; placementStart: number | null; placementEnd: number | null; divisionId: string | null }[]; transitions: { sourceNodeId: string; destinationNodeId: string; conditionType: string; rankStart: number | null; rankEnd: number | null; sortOrder: number; entrySource: string }[] }) {
  const divisionById = new Map(tournament.divisions.map((item) => [item.id, item.code]));
  const nodeById = new Map(tournament.nodes.map((item) => [item.id, item.key]));
  return { divisions: tournament.divisions.map(({ code, name, sortOrder }) => ({ code, name, sortOrder })), nodes: tournament.nodes.map((node) => ({ key: node.key, divisionCode: node.divisionId ? divisionById.get(node.divisionId) ?? null : null, name: node.name, type: node.type, sortOrder: node.sortOrder, gameCount: node.gameCount, placementStart: node.placementStart, placementEnd: node.placementEnd })), transitions: tournament.transitions.map((item) => ({ sourceKey: nodeById.get(item.sourceNodeId)!, destinationKey: nodeById.get(item.destinationNodeId)!, conditionType: item.conditionType, rankStart: item.rankStart, rankEnd: item.rankEnd, sortOrder: item.sortOrder, entrySource: item.entrySource })), seedEntries: parseConfig(tournament.eligibilityConfig).seedEntries ?? [] } as SeasonFinalStructure;
}
async function requireAccess(userId: string, teamId: string, manage: boolean) {
  const team = await prisma.team.findFirst({ where: { id: teamId, isActive: true, members: { some: { userId } } }, select: { id: true, ownerId: true, bowlerHiddenEnabled: true, User: { select: { id: true } }, members: { where: { userId }, select: { userId: true } } } }) as TeamAccess | null;
  if (!team) throw new SeasonFinalError("TEAM_NOT_FOUND", "동호회를 찾을 수 없습니다.", 404);
  if (!team.bowlerHiddenEnabled) throw new SeasonFinalError("FEATURE_DISABLED", "Bowler Hidden 기능이 활성화되지 않은 팀입니다.", 404);
  if (manage && role(team, userId) === "MEMBER") throw new SeasonFinalError("FORBIDDEN", "시즌 최종전 관리 권한이 없습니다.", 403);
  return team;
}
function role(team: TeamAccess, userId: string) { return team.ownerId === userId ? "OWNER" : team.User.some((item) => item.id === userId) ? "MANAGER" : "MEMBER"; }
function text(value: unknown, message: string, max = 120) { if (typeof value !== "string" || !value.trim() || value.trim().length > max) throw new SeasonFinalError("INVALID_INPUT", message, 400); return value.trim(); }
function parseConfig(value: string): { seedEntries?: SeasonFinalStructure["seedEntries"] } { try { const parsed = JSON.parse(value); return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {}; } catch { return {}; } }
