export const STATES = ['QUALIFYING_OPEN', 'QUALIFYING_CLOSED', 'QUALIFIERS_CONFIRMED', 'ROUND1_READY', 'ROUND1_ACTIVE', 'ROUND1_CONFIRMED', 'ROUND2_READY', 'ROUND2_ACTIVE', 'ROUND2_CONFIRMED', 'FINAL_READY', 'FINAL_ACTIVE', 'FINISHED'] as const;
export type Stage = 'ROUND1' | 'ROUND2' | 'FINAL';
export const STAGES: Stage[] = ['ROUND1', 'ROUND2', 'FINAL'];
export const PAIRS = [[1,22],[2,23],[3,24],[4,19],[5,20],[6,21],[7,16],[8,17],[9,18],[10,13],[11,14],[12,15]];
export type Rules = {
  rulesVersion: 1; attemptLimit: number | null; selection: 'BEST' | 'LATEST' | null; qualifyingConfirmed: boolean;
  games: Record<Stage, number>; gamesConfirmed: Record<Stage, boolean>;
  scoring: Record<Stage, 'SUM' | 'BEST_GAME' | null>;
  round2Mapping: number[][]; mappingConfirmed: boolean; handicapCap: 'LEAGUE_300' | 'UNCAPPED' | null;
  lanes: number[][]; finalLanes: number[]; bankAccount: string;
  registrationStart: string | null; registrationEnd: string | null;
  prizeBasis: 'PAID' | 'CHARGED' | 'MANUAL' | null; prizeBase: number | null; prizeConfirmed: boolean;
};
export function defaultRules(): Rules {
  return { rulesVersion: 1, attemptLimit: null, selection: null, qualifyingConfirmed: false,
    games: { ROUND1: 1, ROUND2: 1, FINAL: 1 }, gamesConfirmed: { ROUND1: false, ROUND2: false, FINAL: false },
    scoring: { ROUND1: null, ROUND2: null, FINAL: null },
    round2Mapping: [[1,2,3],[4,5,6],[7,8,9],[10,11,12]], mappingConfirmed: false,
    handicapCap: null, lanes: [[9,10],[11,12],[13,14],[15,16]], finalLanes: [9,10],
    bankAccount: '카카오뱅크 3333-23-7471201 / 정찬희', registrationStart: null, registrationEnd: null,
    prizeBasis: null, prizeBase: null, prizeConfirmed: false };
}
export function ensure(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
export function integer(value: unknown, min: number, max: number, label: string): asserts value is number {
  ensure(typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max, label + ': ' + min + '~' + max + ' 정수가 필요합니다.');
}
export function validateRules(input: unknown): Rules {
  ensure(input && typeof input === 'object', '설정 형식 오류');
  const r = input as Rules;
  ensure(r.rulesVersion === 1, '지원하지 않는 규칙 버전');
  if (r.attemptLimit !== null) integer(r.attemptLimit, 1, 10000, '참가 제한');
  ensure([null, 'BEST', 'LATEST'].includes(r.selection), '기록 반영 방식 오류');
  ensure([null, 'LEAGUE_300', 'UNCAPPED'].includes(r.handicapCap), '핸디 상한 설정 오류');
  for (const key of ['qualifyingConfirmed', 'mappingConfirmed', 'prizeConfirmed'] as const) ensure(typeof r[key] === 'boolean', '확인 여부 형식 오류');
  ensure(r.games && r.gamesConfirmed, '게임 수 설정 필요');
  for (const stage of STAGES) { integer(r.games[stage], 1, 12, '게임 수'); ensure(typeof r.gamesConfirmed[stage] === 'boolean', '게임 수 확인 필요'); }
  ensure(r.scoring && STAGES.every(stage => [null, 'SUM', 'BEST_GAME'].includes(r.scoring[stage])), '본선 점수 반영 방식 오류');
  ensure(Array.isArray(r.round2Mapping) && r.round2Mapping.length === 4 && r.round2Mapping.every(x => Array.isArray(x) && x.length === 3), '2R은 3명씩 4테이블이어야 합니다.');
  const slots = r.round2Mapping.flat(); slots.forEach(n => integer(n, 1, 12, '1R 매치 번호'));
  ensure(new Set(slots).size === 12, '1R 승자 12명은 각각 한 번만 배정해야 합니다.');
  ensure(Array.isArray(r.lanes) && r.lanes.length === 4 && r.lanes.every(x => Array.isArray(x) && x.length === 2), '레인 쌍 4개 필요');
  r.lanes.flat().forEach(n => integer(n, 1, 100, '레인'));
  ensure(new Set(r.lanes.flat()).size === 8, '레인 중복');
  ensure(Array.isArray(r.finalLanes) && r.finalLanes.length === 2 && new Set(r.finalLanes).size === 2, '결승 레인 쌍 필요');
  r.finalLanes.forEach(n => integer(n, 1, 100, '레인'));
  ensure(typeof r.bankAccount === 'string' && r.bankAccount.length <= 200, '계좌 형식 오류');
  for (const key of ['registrationStart', 'registrationEnd'] as const) ensure(r[key] === null || (typeof r[key] === 'string' && /(?:Z|[+-]\d{2}:\d{2})$/.test(r[key]!) && Number.isFinite(Date.parse(r[key]!))), '접수 일시는 시간대가 있는 ISO 형식이어야 합니다.');
  if (r.registrationStart && r.registrationEnd) ensure(Date.parse(r.registrationStart) < Date.parse(r.registrationEnd), '접수 종료는 시작 이후여야 합니다.');
  ensure([null, 'PAID', 'CHARGED', 'MANUAL'].includes(r.prizeBasis), '정산 기준 오류');
  if (r.prizeBase !== null) integer(r.prizeBase, 0, 100000000, '정산 기준 금액');
  if (r.qualifyingConfirmed) ensure(r.selection !== null, '예선 반영 방식을 선택하세요.');
  if (r.prizeConfirmed) ensure(r.prizeBasis && (r.prizeBasis !== 'MANUAL' || r.prizeBase !== null), '정산 기준 금액을 확인하세요.');
  return r;
}
export function monthlySchedule(month: string) {
  ensure(/^\d{4}-(0[1-9]|1[0-2])$/.test(month), '회차 월은 YYYY-MM 형식이어야 합니다.');
  const [year, m] = month.split('-').map(Number); integer(year, 2000, 2100, '연도');
  const day = 1 + ((7 - new Date(Date.UTC(year, m - 1, 1)).getUTCDay()) % 7) + 14;
  return { startsAt: new Date(Date.UTC(year, m - 1, day, 10, 0)), practiceAt: new Date(Date.UTC(year, m - 1, day, 9, 50)) };
}
export function convertedScore(raw: number, handicap: number, stage: 'QUALIFYING' | Stage, cap: Rules['handicapCap']) {
  integer(raw, 0, 300, '원점수'); integer(handicap, -300, 300, '핸디');
  if (stage === 'FINAL') return raw;
  if (stage === 'QUALIFYING') return raw + handicap;
  ensure(cap !== null, '상주리그 300점 상한 적용 여부를 확인하세요.');
  return cap === 'LEAGUE_300' ? Math.min(raw + handicap, 300) : raw + handicap;
}
export type RankingAttempt = { id: string; raw: number; handicap: number; converted: number; voided: boolean; createdAt: Date | string };
export type RankingEntry = { id: string; name: string; eligibility: string; athlete: boolean; cancelled: boolean; attempts: RankingAttempt[] };
export function qualificationRanking(entries: RankingEntry[], rules: Rules) {
  const rows = entries.filter(e => e.eligibility === 'APPROVED' && !e.athlete && !e.cancelled).flatMap(e => {
    const attempts = e.attempts.filter(a => !a.voided).sort((a, b) => rules.selection === 'LATEST'
      ? +new Date(b.createdAt) - +new Date(a.createdAt) || a.id.localeCompare(b.id)
      : b.converted - a.converted || +new Date(a.createdAt) - +new Date(b.createdAt) || a.id.localeCompare(b.id));
    return attempts[0] ? [{ entryId: e.id, name: e.name, attempt: attempts[0] }] : [];
  }).sort((a,b) => b.attempt.converted - a.attempt.converted || a.entryId.localeCompare(b.entryId));
  return rows.map((r, i) => ({ ...r, rank: rows.findIndex(x => x.attempt.converted === r.attempt.converted) + 1, tied: rows.filter(x => x.attempt.converted === r.attempt.converted).length > 1, position: i + 1 }));
}
// Display ordering never silently decides a tie.
export function resolveOrder<T extends { entryId: string; total: number }>(rows: T[], tieOrder: string[] = []): T[] {
  const groups = new Map<number, T[]>();
  rows.forEach(r => groups.set(r.total, [...(groups.get(r.total) || []), r]));
  ensure(new Set(tieOrder).size === tieOrder.length && tieOrder.every(id => rows.some(r => r.entryId === id)), '동점 순서에 중복 또는 다른 참가자가 있습니다.');
  for (const group of groups.values()) if (group.length > 1) ensure(group.every(r => tieOrder.includes(r.entryId)), '동점 판정이 필요합니다. 동점자 전체의 순서를 지정하세요.');
  return [...rows].sort((a,b) => b.total - a.total || tieOrder.indexOf(a.entryId) - tieOrder.indexOf(b.entryId));
}
export function selectQualifiers(entries: RankingEntry[], rules: Rules, tieOrder: string[] = []) {
  ensure(rules.qualifyingConfirmed && rules.selection, '예선 참가 횟수와 기록 반영 방식을 확인하세요.');
  const rows = qualificationRanking(entries, rules);
  ensure(rows.length >= 24, '승인된 유효 기록 보유자가 24명 필요합니다.');
  const cutoff = rows[23].attempt.converted;
  return resolveOrder(rows.filter(r => r.attempt.converted >= cutoff).map(r => ({ ...r, total: r.attempt.converted })), tieOrder).slice(0,24);
}
export function round1Assignments(entryIds: string[], lanes: number[][]) {
  ensure(entryIds.length === 24 && new Set(entryIds).size === 24, '서로 다른 24개 시드 필요');
  return PAIRS.map((pair, i) => ({ slot: i + 1, tableIndex: Math.floor(i / 3), lanes: lanes[Math.floor(i / 3)], entryIds: pair.map(n => entryIds[n - 1]) }));
}
export function matchResults(seats: { entryId: string; handicap: number; games: { number: number; raw: number | null }[] }[], stage: Stage, rules: Rules, tieOrder: string[] = []) {
  ensure(rules.gamesConfirmed[stage], stage + ' 게임 수를 확인하세요.');
  ensure(rules.scoring[stage], stage + ' 점수 반영 방식을 확인하세요.');
  const rows = seats.map(s => {
    const scores = Array.from({ length: rules.games[stage] }, (_, i) => s.games.find(g => g.number === i + 1)?.raw);
    ensure(scores.every(n => n !== null && n !== undefined), '미입력 점수가 있습니다. 0점과 미입력은 다릅니다.');
    const converted = (scores as number[]).map(n => convertedScore(n, s.handicap, stage, rules.handicapCap));
    const rawTotal = rules.scoring[stage] === 'BEST_GAME' ? Math.max(...scores as number[]) : (scores as number[]).reduce((a,b) => a + b, 0);
    const total = rules.scoring[stage] === 'BEST_GAME' ? Math.max(...converted) : converted.reduce((a,b) => a + b, 0);
    return { entryId: s.entryId, rawTotal, total };
  });
  return resolveOrder(rows, tieOrder).map((r, i) => ({ ...r, rank: i + 1 }));
}
export function prizeAmounts(rules: Rules, fees: { stage: string; amount: number; status: string }[]) {
  if (!rules.prizeConfirmed || !rules.prizeBasis) return null;
  const base = rules.prizeBasis === 'MANUAL' ? rules.prizeBase : fees.filter(f => f.stage === 'QUALIFYING' && (rules.prizeBasis === 'PAID' ? f.status === 'PAID' : ['PAID', 'UNPAID'].includes(f.status))).reduce((s,f) => s + f.amount, 0);
  ensure(base !== null, '정산 금액 미확정');
  ensure(base % 10 === 0, '원 단위 배분이 나누어떨어지지 않습니다. 기준 금액을 확인하세요.');
  return { base, amounts: [200000 + base * .5, 100000 + base * .3, 50000 + base * .1, 50000], unallocated: base * .1 };
}
export function isKingPerfect(type: string, settings: string | null) {
  try { return type === 'CUSTOM' && JSON.parse(settings || '{}').customMode === 'KING_PERFECT'; } catch { return false; }
}
export function centerEnabled(centerId: string) {
  return (process.env.KING_PERFECT_CENTER_IDS || '').split(',').map(x => x.trim()).filter(Boolean).includes(centerId);
}
