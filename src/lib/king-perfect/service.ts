import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { randomInt } from 'node:crypto';
import { getEligibleCandidates } from '@/lib/lottery-ui';
import { centerEnabled, convertedScore, defaultRules, ensure, integer, isKingPerfect, matchResults, monthlySchedule, prizeAmounts, qualificationRanking, round1Assignments, selectQualifiers, STAGES, validateRules, type Stage } from '@/lib/king-perfect/rules';

const include = {
  tournament: { include: { center: { include: { managers: { select: { id: true } } } } } },
  entries: { include: { member: { select: { centerId: true } }, attempts: { orderBy: { createdAt: 'asc' as const } }, seed: true, fees: true, sideEntries: true, luckyWin: true } },
  matches: { orderBy: [{ stage: 'asc' as const }, { slot: 'asc' as const }], include: { seats: { orderBy: { position: 'asc' as const }, include: { games: { orderBy: { number: 'asc' as const } } } } } },
} satisfies Prisma.KingPerfectEditionInclude;
type Edition = Prisma.KingPerfectEditionGetPayload<{ include: typeof include }>;
type Tx = Prisma.TransactionClient;
export type Command = { action: string; requestKey: string; revision: number; reason: string; data?: Record<string, unknown> };
function authorized(center: { id: string; ownerId: string; managers: { id: string }[] }, actorId: string) {
  ensure(actorId && (center.ownerId === actorId || center.managers.some(m => m.id === actorId)), '해당 센터 관리 권한이 없습니다.');
  ensure(centerEnabled(center.id), '킹퍼펙트 사용이 활성화되지 않은 센터입니다.');
}
async function load(tx: Tx, id: string, actorId: string) {
  const e = await tx.kingPerfectEdition.findUnique({ where: { id }, include });
  ensure(e && isKingPerfect(e.tournament.type, e.tournament.settings), '킹퍼펙트 회차가 없습니다.');
  authorized(e.tournament.center, actorId);
  ensure(e.entries.every(x => x.member.centerId === e.tournament.centerId), '센터 소속이 다른 참가자가 있습니다.');
  return e;
}
export async function createKingPerfect(actorId: string, centerId: string, name: string, month: string, requestKey: string) {
  ensure(typeof name === 'string' && name.trim().length > 0 && name.length <= 120, '대회명을 입력하세요.');
  ensure(typeof requestKey === 'string' && /^[a-zA-Z0-9-]{16,80}$/.test(requestKey), '생성 요청 키 오류');
  const schedule = monthlySchedule(month);
  return prisma.$transaction(async tx => {
    const center = await tx.bowlingCenter.findUnique({ where: { id: centerId }, include: { managers: { select: { id: true } } } });
    ensure(center, '센터가 없습니다.'); authorized(center, actorId);
    const old = await tx.kingPerfectEdition.findUnique({ where: { id: requestKey }, include: { tournament: true } });
    if (old) { ensure(old.tournament.centerId === centerId && old.month === month && old.tournament.name === name.trim(), '동일 요청 키가 다른 생성에 사용되었습니다.'); return old.tournamentId; }
    const t = await tx.tournament.create({ data: { centerId, name: name.trim(), type: 'CUSTOM', settings: JSON.stringify({ customMode: 'KING_PERFECT', rulesVersion: 1 }), maxParticipants: 24, startDate: schedule.startsAt, endDate: schedule.startsAt,
      kingPerfectEditions: { create: { id: requestKey, month, ...schedule, rules: JSON.stringify(defaultRules()), audits: { create: { requestKey, actorId, action: 'CREATE', reason: '킹퍼펙트 대회 생성', payload: '{}', before: '{}', after: JSON.stringify({ month, ...schedule }) } } } } } });
    return t.id;
  });
}
export async function getKingPerfectAdmin(actorId: string, editionId: string) {
  const e = await load(prisma, editionId, actorId);
  const rules = validateRules(JSON.parse(e.rules));
  let prizePreview = null;
  let prizeWarning = '';
  try { prizePreview = prizeAmounts(rules, e.entries.flatMap(x => x.fees)); }
  catch (error) { prizeWarning = error instanceof Error ? error.message : '정산 기준을 확인하세요.'; }
  const audits = await prisma.kingPerfectAudit.findMany({ where: { editionId }, orderBy: { createdAt: 'desc' }, take: 50, select: { id: true, actorId: true, action: true, reason: true, createdAt: true } });
  const sideResults = STAGES.flatMap(stage => ['STANDARD','BALL','EXTRA'].flatMap(category => {
    const games = category === 'STANDARD' ? Array.from({ length: rules.games[stage] }, (_, i) => i + 1) : [category === 'BALL' ? 2 : rules.games[stage]];
    return games.filter(number => number <= rules.games[stage]).map(number => {
      const rows = e.matches.filter(m => m.stage === stage).flatMap(m => m.seats).filter(s => e.entries.find(x => x.id === s.entryId)?.sideEntries.some(x => x.stage === stage && x.category === category)).flatMap(s => {
        const game = s.games.find(g => g.number === number);
        return game?.raw !== null && game?.raw !== undefined ? [{ entryId: s.entryId, raw: game.raw, total: stage === 'FINAL' ? game.raw : Math.min(game.raw + s.handicap, 300) }] : [];
      }).sort((a,b) => b.total - a.total);
      return { key: stage + category + number, label: stage + ' ' + number + 'G ' + category, rows: rows.map(r => ({ ...r, rank: rows.findIndex(x => x.total === r.total) + 1 })) };
    });
  }));
  // Do not serialize the included User/center relation to the browser.
  return { id: e.id, tournamentId: e.tournamentId, name: e.tournament.name, month: e.month, startsAt: e.startsAt, practiceAt: e.practiceAt, state: e.state, revision: e.revision, rules, published: e.published, settlement: e.settlement ? JSON.parse(e.settlement) : null,
    entries: e.entries.map(({ member: _member, ...entry }) => entry), matches: e.matches,
    ranking: qualificationRanking(e.entries, rules), prizePreview, prizeWarning, sideResults, audits };
}
export async function searchKingPerfectMembers(actorId: string, editionId: string, query: string) {
  const e = await load(prisma, editionId, actorId);
  ensure(typeof query === 'string' && query.trim().length >= 1 && query.length <= 50, '회원 이름 1~50자를 입력하세요.');
  return prisma.centerMember.findMany({ where: { centerId: e.tournament.centerId, OR: [{ alias: { contains: query.trim() } }, { User: { name: { contains: query.trim() } } }] },
    select: { id: true, alias: true, User: { select: { name: true, handicap: true } } }, take: 30 });
}
function text(data: Record<string, unknown>, key: string) { const s = data[key]; ensure(typeof s === 'string' && s.length > 0 && s.length <= 200, key + ' 오류'); return s; }
function ids(value: unknown) { ensure(Array.isArray(value) && value.length <= 1000 && value.every(x => typeof x === 'string'), '참가자 순서 형식 오류'); return value as string[]; }
function stageValue(data: Record<string, unknown>): Stage { const s = data.stage; ensure(STAGES.includes(s as Stage), '단계 오류'); return s as Stage; }
function entryFor(e: Edition, id: string) { const entry = e.entries.find(x => x.id === id); ensure(entry, '해당 회차 참가자가 아닙니다.'); return entry; }
function eligible(e: Edition, id: string) { const entry = entryFor(e, id); ensure(entry.eligibility === 'APPROVED' && !entry.athlete && !entry.cancelled, '회원 참가자격 승인 및 선수/프로 제외 확인이 필요합니다.'); return entry; }
async function createMatches(tx: Tx, e: Edition, stage: Stage, groups: { slot: number; tableIndex: number; lanes: number[]; entryIds: string[] }[]) {
  for (const g of groups) {
    const entrants = g.entryIds.map(id => eligible(e, id));
    await tx.kingPerfectMatch.create({ data: { editionId: e.id, stage, slot: g.slot, tableIndex: g.tableIndex, lanes: JSON.stringify(g.lanes), seats: { create: entrants.map((entry, i) => ({ entryId: entry.id, position: i + 1, handicap: stage === 'FINAL' ? 0 : entry.handicap })) } } });
    for (const entry of entrants) await tx.kingPerfectFee.upsert({ where: { entryId_source: { entryId: entry.id, source: stage } }, create: { entryId: entry.id, source: stage, stage, amount: 10000 }, update: {} });
  }
}
async function clearStages(tx: Tx, e: Edition, stages: Stage[]) {
  const matches = e.matches.filter(m => stages.includes(m.stage as Stage));
  const seatIds = matches.flatMap(m => m.seats.map(s => s.id));
  // A regenerated stage must not inherit side entries from its discarded roster.
  // The command's before snapshot preserves those entries for audit.
  await tx.kingPerfectSideEntry.deleteMany({ where: { entry: { editionId: e.id }, stage: { in: stages } } });
  await tx.kingPerfectGame.deleteMany({ where: { seatId: { in: seatIds } } });
  await tx.kingPerfectSeat.deleteMany({ where: { id: { in: seatIds } } });
  await tx.kingPerfectMatch.deleteMany({ where: { id: { in: matches.map(m => m.id) } } });
  // Fee ledger survives rollback. Operator explicitly reconciles cancellations/refunds.
}
export async function executeKingPerfect(actorId: string, editionId: string, command: Command) {
  ensure(command && typeof command === 'object', '요청 오류');
  integer(command.revision, 0, 2147483646, '버전');
  ensure(typeof command.requestKey === 'string' && /^[a-zA-Z0-9-]{16,80}$/.test(command.requestKey), '요청 키 오류');
  ensure(typeof command.reason === 'string' && command.reason.trim().length >= 2 && command.reason.length <= 500, '작업 사유를 2~500자로 입력하세요.');
  const payload = JSON.stringify({ action: command.action, data: command.data || {}, reason: command.reason });
  ensure(payload.length <= 100000, '요청 크기 초과');
  return prisma.$transaction(async tx => {
    const e = await load(tx, editionId, actorId);
    const previous = await tx.kingPerfectAudit.findUnique({ where: { editionId_requestKey: { editionId, requestKey: command.requestKey } } });
    if (previous) { ensure(previous.payload === payload && previous.actorId === actorId, '같은 요청 키의 내용이 다릅니다.'); return { success: true, replayed: true }; }
    const lock = await tx.kingPerfectEdition.updateMany({ where: { id: editionId, revision: command.revision }, data: { revision: { increment: 1 } } });
    ensure(lock.count === 1, '다른 관리자가 변경했습니다. 새로고침 후 다시 시도하세요.');
    const rules = validateRules(JSON.parse(e.rules)); const d = command.data || {};
    const qualifying = () => ensure(['QUALIFYING_OPEN', 'QUALIFYING_CLOSED'].includes(e.state), '예선이 확정되었습니다. 먼저 사유와 함께 잠금을 해제하세요.');
    const state = async (value: string) => tx.kingPerfectEdition.update({ where: { id: e.id }, data: { state: value } });
    switch (command.action) {
      case 'SETTINGS': {
        qualifying();
        ensure(e.entries.every(x => x.attempts.length === 0) || JSON.stringify({ selection: rules.selection, attemptLimit: rules.attemptLimit }) === JSON.stringify({ selection: (d.rules as typeof rules)?.selection, attemptLimit: (d.rules as typeof rules)?.attemptLimit }), '예선 기록이 있는 회차의 참가 제한/반영 방식은 변경할 수 없습니다.');
        const next = validateRules(d.rules);
        await tx.kingPerfectEdition.update({ where: { id: e.id }, data: { rules: JSON.stringify(next) } }); break;
      }
      case 'SETTLEMENT_SETTINGS': {
        ensure(!e.settlement, '정산 스냅샷이 확정되어 있습니다. 먼저 잠금을 해제하세요.');
        const next = validateRules({ ...rules, prizeBasis: d.prizeBasis, prizeBase: d.prizeBase, prizeConfirmed: d.prizeConfirmed });
        await tx.kingPerfectEdition.update({ where: { id: e.id }, data: { rules: JSON.stringify(next) } }); break;
      }
      case 'REGISTER': {
        ensure(e.state === 'QUALIFYING_OPEN', '예선 접수가 닫혀 있습니다.');
        const member = await tx.centerMember.findUnique({ where: { id: text(d,'memberId') }, include: { User: { select: { name: true, handicap: true } } } });
        ensure(member && member.centerId === e.tournament.centerId, '해당 센터 회원만 참가할 수 있습니다.');
        integer(member.User.handicap ?? 0, -300, 300, '회원 핸디');
        await tx.kingPerfectEntry.create({ data: { editionId, memberId: member.id, name: member.alias || member.User.name, handicap: member.User.handicap ?? 0 } }); break;
      }
      case 'ELIGIBILITY': {
        qualifying(); const entry = entryFor(e, text(d, 'entryId'));
        ensure(['APPROVED', 'REJECTED', 'PENDING'].includes(String(d.eligibility)) && typeof d.athlete === 'boolean' && typeof d.cancelled === 'boolean', '참가자격 설정 오류');
        ensure(!(d.athlete && d.eligibility === 'APPROVED'), '선수/프로는 승인할 수 없습니다.');
        integer(d.handicap, -300, 300, '핸디');
        await tx.kingPerfectEntry.update({ where: { id: entry.id }, data: { eligibility: String(d.eligibility), athlete: d.athlete, cancelled: d.cancelled, handicap: d.handicap } }); break;
      }
      case 'ATTEMPT': {
        ensure(e.state === 'QUALIFYING_OPEN', '예선 접수가 닫혀 있습니다.');
        ensure(rules.qualifyingConfirmed, '예선 규칙 확인 후 접수하세요.');
        const now = Date.now();
        ensure((!rules.registrationStart || now >= Date.parse(rules.registrationStart)) && (!rules.registrationEnd || now <= Date.parse(rules.registrationEnd)), '예선 접수 기간이 아닙니다.');
        ensure(d.freeGame === false, '프리게임은 접수할 수 없습니다.');
        const entry = eligible(e, text(d, 'entryId'));
        ensure(rules.attemptLimit === null || entry.attempts.filter(a => !a.voided).length < rules.attemptLimit, '예선 참가 횟수 초과');
        integer(d.raw, 0, 300, '원점수');
        const attempt = await tx.kingPerfectAttempt.create({ data: { entryId: entry.id, requestKey: command.requestKey, raw: d.raw, handicap: entry.handicap, converted: convertedScore(d.raw, entry.handicap, 'QUALIFYING', rules.handicapCap) } });
        await tx.kingPerfectFee.create({ data: { entryId: entry.id, source: attempt.id, stage: 'QUALIFYING', amount: 1000 } }); break;
      }
      case 'EDIT_ATTEMPT': {
        qualifying(); const entry = entryFor(e, text(d, 'entryId'));
        const a = entry.attempts.find(x => x.id === d.attemptId); ensure(a, '예선 기록이 없습니다.');
        integer(d.raw, 0, 300, '원점수'); integer(d.handicap, -300, 300, '핸디'); ensure(typeof d.voided === 'boolean', '취소 여부 오류');
        if (a.voided && !d.voided) {
          ensure(rules.attemptLimit === null || entry.attempts.filter(x => !x.voided).length < rules.attemptLimit, '예선 참가 횟수 초과');
          ensure(!entry.fees.some(f => f.source === a.id && f.status === 'REFUNDED'), '환불 기록은 참가비 상태를 먼저 조정한 후 복원하세요.');
          await tx.kingPerfectFee.updateMany({ where: { entryId: entry.id, source: a.id, status: 'CANCELLED' }, data: { status: 'UNPAID' } });
        }
        await tx.kingPerfectAttempt.update({ where: { id: a.id }, data: { raw: d.raw, handicap: d.handicap, converted: convertedScore(d.raw, d.handicap, 'QUALIFYING', rules.handicapCap), voided: d.voided } });
        if (d.voided) await tx.kingPerfectFee.updateMany({ where: { entryId: entry.id, source: a.id, status: 'UNPAID' }, data: { status: 'CANCELLED' } }); break;
      }
      case 'CLOSE': ensure(e.state === 'QUALIFYING_OPEN', '예선 접수 중에만 마감할 수 있습니다.'); await state('QUALIFYING_CLOSED'); break;
      case 'QUALIFIERS': {
        ensure(e.state === 'QUALIFYING_CLOSED', '예선 마감 후 확정하세요.');
        const rows = selectQualifiers(e.entries, rules, ids(d.tieOrder || []));
        for (const [i, r] of rows.entries()) await tx.kingPerfectSeed.create({ data: { editionId, entryId: r.entryId, position: i + 1, attemptId: r.attempt.id, raw: r.attempt.raw, handicap: r.attempt.handicap, converted: r.attempt.converted } });
        await state('QUALIFIERS_CONFIRMED'); break;
      }
      case 'SWAP_SEEDS': {
        ensure(e.state === 'QUALIFIERS_CONFIRMED', '1R 생성 전에 시드를 교체하세요.');
        const a = entryFor(e, text(d,'first')).seed, b = entryFor(e, text(d,'second')).seed;
        ensure(a && b && a.id !== b.id, '서로 다른 확정 시드 2명이 필요합니다.');
        await tx.kingPerfectSeed.update({ where: { id: a.id }, data: { position: 0 } });
        await tx.kingPerfectSeed.update({ where: { id: b.id }, data: { position: a.position } });
        await tx.kingPerfectSeed.update({ where: { id: a.id }, data: { position: b.position } }); break;
      }
      case 'GENERATE': {
        const stage = stageValue(d);
        const required = { ROUND1: 'QUALIFIERS_CONFIRMED', ROUND2: 'ROUND1_CONFIRMED', FINAL: 'ROUND2_CONFIRMED' }[stage];
        ensure(e.state === required, '이전 단계 확정 후 생성하세요.');
        ensure(rules.gamesConfirmed[stage] && rules.scoring[stage] && (stage === 'FINAL' || rules.handicapCap), '게임 수·점수 반영 방식·핸디 규칙을 확인하세요.');
        if (stage === 'ROUND1') {
          const seeds = e.entries.filter(x => x.seed).sort((a,b) => a.seed!.position - b.seed!.position);
          await createMatches(tx, e, stage, round1Assignments(seeds.map(x => x.id), rules.lanes));
        } else {
          const prevStage = stage === 'ROUND2' ? 'ROUND1' : 'ROUND2';
          const matches = e.matches.filter(m => m.stage === prevStage).sort((a,b) => a.slot - b.slot);
          ensure(matches.length === (stage === 'ROUND2' ? 12 : 4) && matches.every(m => m.confirmed && m.seats.filter(s => s.rank === 1).length === 1), '이전 단계 승자가 미확정입니다.');
          const winners = new Map(matches.map(m => [m.slot, m.seats.find(s => s.rank === 1)!.entryId]));
          if (stage === 'ROUND2') {
            ensure(rules.mappingConfirmed, '2R 승자 이동 매핑을 확인하세요.');
            await createMatches(tx, e, stage, rules.round2Mapping.map((slots,i) => ({ slot: i+1, tableIndex: i, lanes: rules.lanes[i], entryIds: slots.map(n => winners.get(n)!) })));
          } else await createMatches(tx, e, stage, [{ slot: 1, tableIndex: 0, lanes: rules.finalLanes, entryIds: [...winners.values()] }]);
        }
        await state(stage + '_READY'); break;
      }
      case 'START': { const stage = stageValue(d); ensure(e.state === stage + '_READY', '준비된 단계만 시작할 수 있습니다.'); await state(stage + '_ACTIVE'); break; }
      case 'SCORES': {
        const match = e.matches.find(m => m.id === d.matchId); ensure(match && e.state === match.stage + '_ACTIVE' && !match.confirmed, '진행 중인 미확정 경기만 입력할 수 있습니다.');
        ensure(Array.isArray(d.scores) && d.scores.length > 0 && d.scores.length <= 144, '점수 목록 오류');
        const seen = new Set<string>();
        for (const input of d.scores as { entryId: string; number: number; raw: number | null }[]) {
          const seat = match.seats.find(s => s.entryId === input.entryId); ensure(seat, '경기 참가자가 아닙니다.'); eligible(e, seat.entryId);
          integer(input.number, 1, rules.games[match.stage as Stage], '게임 번호');
          const key = seat.id + ':' + input.number; ensure(!seen.has(key), '중복 점수'); seen.add(key);
          const converted = input.raw === null ? null : convertedScore(input.raw, seat.handicap, match.stage as Stage, rules.handicapCap);
          await tx.kingPerfectGame.upsert({ where: { seatId_number: { seatId: seat.id, number: input.number } }, create: { seatId: seat.id, number: input.number, raw: input.raw, converted }, update: { raw: input.raw, converted } });
        } break;
      }
      case 'CONFIRM_MATCH': {
        const match = e.matches.find(m => m.id === d.matchId); ensure(match && !match.confirmed && e.state === match.stage + '_ACTIVE', '진행 중인 미확정 경기만 확정할 수 있습니다.');
        match.seats.forEach(s => eligible(e, s.entryId));
        const override = d.overrideOrder ? ids(d.overrideOrder) : null;
        if (override) ensure(d.exceptionConfirmed === true && override.length === match.seats.length && new Set(override).size === override.length && override.every(id => match.seats.some(s => s.entryId === id)), '특별 판정은 경기 참가자 전체를 한 번씩 지정하고 확인해야 합니다.');
        const calculated = matchResults(match.seats, match.stage as Stage, rules, override || ids(d.tieOrder || []));
        const rows = override ? calculated.sort((a,b) => override.indexOf(a.entryId) - override.indexOf(b.entryId)).map((r,i) => ({ ...r, rank: i + 1 })) : calculated;
        for (const row of rows) await tx.kingPerfectSeat.update({ where: { matchId_entryId: { matchId: match.id, entryId: row.entryId } }, data: { rawTotal: row.rawTotal, total: row.total, rank: row.rank } });
        await tx.kingPerfectMatch.update({ where: { id: match.id }, data: { confirmed: true } }); break;
      }
      case 'END_STAGE': {
        const stage = stageValue(d); ensure(e.state === stage + '_ACTIVE', '진행 중인 단계가 아닙니다.');
        const matches = e.matches.filter(m => m.stage === stage);
        ensure(matches.length === ({ ROUND1: 12, ROUND2: 4, FINAL: 1 }[stage]) && matches.every(m => m.confirmed), '모든 경기 점수 및 동점 판정을 확정하세요.');
        await state(stage === 'FINAL' ? 'FINISHED' : stage + '_CONFIRMED'); break;
      }
      case 'REOPEN': {
        const target = text(d, 'target'); ensure(['QUALIFYING', ...STAGES].includes(target), '잠금 해제 단계 오류');
        if (target === 'QUALIFYING') {
          await clearStages(tx, e, STAGES);
          await tx.kingPerfectSeed.deleteMany({ where: { editionId } });
          await state('QUALIFYING_OPEN');
        } else {
          const index = STAGES.indexOf(target as Stage); const matches = e.matches.filter(m => m.stage === target); ensure(matches.length > 0, '생성되지 않은 단계입니다.');
          await clearStages(tx, e, STAGES.slice(index + 1));
          await tx.kingPerfectMatch.updateMany({ where: { id: { in: matches.map(m => m.id) } }, data: { confirmed: false } });
          await tx.kingPerfectSeat.updateMany({ where: { matchId: { in: matches.map(m => m.id) } }, data: { rank: null, total: null, rawTotal: null } });
          await state(target + '_ACTIVE');
        }
        await tx.kingPerfectEdition.update({ where: { id: e.id }, data: { settlement: null, published: false } });
        await tx.kingPerfectLuckyWin.deleteMany({ where: { entry: { editionId } } });
        break;
      }
      case 'FEE': {
        ensure(!e.settlement, '정산 확정 후에는 원장을 수정할 수 없습니다. 정산 잠금을 먼저 해제하세요.');
        const fee = e.entries.flatMap(x => x.fees).find(f => f.id === d.feeId); ensure(fee, '해당 회차 참가비가 아닙니다.');
        ensure(['UNPAID','PAID','CANCELLED','REFUNDED'].includes(String(d.status)), '납부 상태 오류'); integer(d.amount, 0, 100000000, '참가비');
        await tx.kingPerfectFee.update({ where: { id: fee.id }, data: { amount: d.amount, status: String(d.status) } }); break;
      }
      case 'SETTLE': {
        ensure(e.state === 'FINISHED' && !e.settlement, '대회 종료 후 한 번만 정산할 수 있습니다.');
        const amounts = prizeAmounts(rules, e.entries.flatMap(x => x.fees)); ensure(amounts, '시상 기준 금액을 확인하세요.');
        const final = e.matches.find(m => m.stage === 'FINAL'); ensure(final?.confirmed, '결승 미확정');
        const winners = [...final.seats].sort((a,b) => a.rank! - b.rank!).map(s => ({ entryId: s.entryId, name: entryFor(e,s.entryId).name, rank: s.rank, raw: s.rawTotal, handicap: 0, amount: amounts.amounts[s.rank! - 1] }));
        await tx.kingPerfectEdition.update({ where: { id: e.id }, data: { settlement: JSON.stringify({ ...amounts, basis: rules.prizeBasis, winners, fees: e.entries.flatMap(x => x.fees), confirmedBy: actorId, confirmedAt: new Date().toISOString() }) } }); break;
      }
      case 'UNSETTLE': await tx.kingPerfectEdition.update({ where: { id: e.id }, data: { settlement: null, published: false } }); break;
      case 'PUBLISH': {
        ensure(typeof d.published === 'boolean' && (d.published === false || e.state === 'FINISHED'), '종료된 결과만 공개할 수 있습니다.');
        await tx.kingPerfectEdition.update({ where: { id: e.id }, data: { published: d.published } }); break;
      }
      case 'SIDE': {
        const stage = stageValue(d); const entry = eligible(e, text(d, 'entryId')); const category = text(d, 'category');
        ensure(['STANDARD','BALL','EXTRA'].includes(category) && typeof d.enabled === 'boolean', '사이드게임 설정 오류');
        ensure(category !== 'BALL' || rules.games[stage] >= 2, '볼사이드는 2게임 이상인 단계에서만 가능합니다.');
        ensure(e.matches.some(m => m.stage === stage && m.seats.some(s => s.entryId === entry.id)), '해당 단계 참가자만 등록할 수 있습니다.');
        ensure(!e.matches.some(m => m.stage === stage && m.confirmed), '경기 확정 후 사이드 참가 명단을 바꿀 수 없습니다.');
        if (d.enabled) await tx.kingPerfectSideEntry.upsert({ where: { entryId_stage_category: { entryId: entry.id, stage, category } }, create: { entryId: entry.id, stage, category }, update: {} });
        else await tx.kingPerfectSideEntry.deleteMany({ where: { entryId: entry.id, stage, category } }); break;
      }
      case 'DRAW': {
        integer(d.count, 1, 100, '추첨 인원'); ensure(typeof d.excludeRankers === 'boolean', '입상자 제외 설정 필요');
        ensure(e.state === 'FINISHED', '입상자 확정 후 추첨할 수 있습니다.');
        const scope = text(d, 'scope'); ensure(['ALL', ...STAGES].includes(scope), '추첨 대상 오류');
        const podium = e.matches.filter(m => m.stage === 'FINAL').flatMap(m => m.seats.map(s => s.entryId));
        const pool = getEligibleCandidates(e.entries.filter(x => x.eligibility === 'APPROVED' && !x.athlete && !x.cancelled && x.attempts.some(a => !a.voided) && (scope === 'ALL' || e.matches.some(m => m.stage === scope && m.seats.some(s => s.entryId === x.id)))).map(x => ({ registrationId: x.id, registration: { guestName: x.name } })), e.entries.filter(x => x.luckyWin).map(x => x.id), d.excludeRankers ? podium : [], 0);
        ensure(pool.length >= d.count, '중복/입상자를 제외한 추첨 대상이 부족합니다.');
        for (let i = 0; i < d.count; i++) { const [winner] = pool.splice(randomInt(pool.length), 1); await tx.kingPerfectLuckyWin.create({ data: { entryId: winner.registrationId } }); } break;
      }
      case 'NEW_EDITION': {
        const month = text(d,'month'); const schedule = monthlySchedule(month);
        await tx.kingPerfectEdition.create({ data: { tournamentId: e.tournamentId, month, ...schedule, rules: JSON.stringify(defaultRules()) } }); break;
      }
      default: throw new Error('지원하지 않는 작업입니다.');
    }
    const after = await tx.kingPerfectEdition.findUniqueOrThrow({ where: { id: editionId }, include });
    const snapshot = (value: Edition) => JSON.stringify({ state: value.state, rules: value.rules, entries: value.entries, matches: value.matches, settlement: value.settlement, published: value.published });
    await tx.kingPerfectAudit.create({ data: { editionId, requestKey: command.requestKey, actorId, action: command.action, reason: command.reason.trim(), payload, before: snapshot(e), after: snapshot(after) } });
    return { success: true, replayed: false };
  }, { timeout: 20000 });
}
