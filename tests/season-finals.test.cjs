// Synthetic fixtures only. No database or production calls.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { createRequire } = require('node:module');

function loadTs(relative, overrides = {}, cache = new Map()) {
  const filename = path.resolve(__dirname, '..', relative);
  if (cache.has(filename)) return cache.get(filename).exports;
  const module = { exports: {} }; cache.set(filename, module);
  const nativeRequire = createRequire(filename);
  const localRequire = id => {
    if (Object.hasOwn(overrides, id)) return overrides[id];
    if (id.startsWith('@/')) return loadTs(`src/${id.slice(2)}.ts`, overrides, cache);
    return nativeRequire(id);
  };
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  new Function('require', 'module', 'exports', compiled)(localRequire, module, module.exports);
  return module.exports;
}

const service = loadTs('src/lib/mobile-api/season-finals.ts', {
  '@/lib/prisma': {},
  '@/lib/mobile-api/unified-season': { getUnifiedSeasonRanking: async () => ({ rankings: [] }) },
});

function validStructure() {
  return {
    divisions: [
      { code: 'A', name: 'A조', sortOrder: 1 },
      { code: 'B', name: 'B조', sortOrder: 2 },
    ],
    nodes: [
      { key: 'A_FINAL', divisionCode: 'A', name: 'A조 결승', type: 'ROUND', sortOrder: 1, gameCount: 1 },
      { key: 'B_R1', divisionCode: 'B', name: 'B조 1라운드', type: 'ROUND', sortOrder: 2, gameCount: 1 },
      { key: 'REVIVAL', divisionCode: 'B', name: '패자부활전', type: 'LOSER_REVIVAL', sortOrder: 3, gameCount: 2 },
      { key: 'PLACEMENT', divisionCode: 'B', name: '4~6위 결정전', type: 'PLACEMENT', sortOrder: 4, gameCount: 2, placementStart: 4, placementEnd: 6 },
      { key: 'FINAL', divisionCode: 'A', name: '챔피언 결정전', type: 'FINAL', sortOrder: 5, gameCount: 2 },
    ],
    transitions: [
      { sourceKey: 'A_FINAL', destinationKey: 'FINAL', conditionType: 'TOP_N', rankEnd: 2, sortOrder: 1, entrySource: 'PREVIOUS_NODE_ADVANCER' },
      { sourceKey: 'A_FINAL', destinationKey: 'REVIVAL', conditionType: 'RANK_RANGE', rankStart: 3, rankEnd: 4, sortOrder: 2, entrySource: 'PREVIOUS_NODE_ELIMINATED' },
      { sourceKey: 'B_R1', destinationKey: 'FINAL', conditionType: 'WINNER', sortOrder: 1, entrySource: 'PREVIOUS_NODE_ADVANCER' },
      { sourceKey: 'B_R1', destinationKey: 'REVIVAL', conditionType: 'RANK_RANGE', rankStart: 2, rankEnd: 3, sortOrder: 2, entrySource: 'PREVIOUS_NODE_ELIMINATED' },
      { sourceKey: 'REVIVAL', destinationKey: 'FINAL', conditionType: 'WINNER', sortOrder: 1, entrySource: 'PREVIOUS_NODE_ADVANCER' },
      { sourceKey: 'REVIVAL', destinationKey: 'PLACEMENT', conditionType: 'RANK_RANGE', rankStart: 2, rankEnd: 3, sortOrder: 2, entrySource: 'PREVIOUS_NODE_ELIMINATED' },
    ],
    seedEntries: [
      { nodeKey: 'A_FINAL', seedStart: 1, seedEnd: 3, sourceType: 'DIRECT_SEED' },
      { nodeKey: 'B_R1', seedStart: 4, seedEnd: 6, sourceType: 'DIRECT_SEED' },
    ],
  };
}

test('dynamic A/B, loser revival and placement DAG validates without a hardcoded bracket', () => {
  assert.deepEqual(service.validateSeasonFinalStructure(validStructure(), 6), []);
});

test('validator rejects cycles, overlapping transitions and duplicate seed assignment', () => {
  const structure = validStructure();
  structure.transitions.push({ sourceKey: 'FINAL', destinationKey: 'A_FINAL', conditionType: 'WINNER', sortOrder: 1, entrySource: 'PREVIOUS_NODE_ADVANCER' });
  structure.transitions.push({ sourceKey: 'A_FINAL', destinationKey: 'PLACEMENT', conditionType: 'RANK_RANGE', rankStart: 2, rankEnd: 3, sortOrder: 3, entrySource: 'PREVIOUS_NODE_ELIMINATED' });
  structure.seedEntries.push({ nodeKey: 'B_R1', seedStart: 3, seedEnd: 3, sourceType: 'ADMIN_ENTRY' });
  const errors = service.validateSeasonFinalStructure(structure, 6).join(' ');
  assert.match(errors, /cycle/);
  assert.match(errors, /겹칩니다/);
  assert.match(errors, /중복/);
});

test('validator rejects unreachable nodes, missing final and unassigned participants', () => {
  const structure = validStructure();
  structure.nodes = structure.nodes.filter(node => node.type !== 'FINAL');
  structure.transitions = structure.transitions.filter(item => item.destinationKey !== 'FINAL');
  structure.nodes.push({ key: 'ORPHAN', divisionCode: 'B', name: '고립 Node', type: 'SPECIAL', sortOrder: 9, gameCount: 1 });
  structure.seedEntries[1].seedEnd = 5;
  const errors = service.validateSeasonFinalStructure(structure, 6).join(' ');
  assert.match(errors, /FINAL/);
  assert.match(errors, /도달/);
  assert.match(errors, /Seed 6/);
});

test('migration is additive and contains graph integrity indexes', () => {
  const sql = fs.readFileSync(path.resolve(__dirname, '../prisma/migrations/20260923090000_add_season_final_tournament/migration.sql'), 'utf8');
  assert.doesNotMatch(sql, /DROP TABLE|DELETE FROM|^\s*UPDATE\s/im);
  assert.match(sql, /SeasonFinalTournament_seasonId_key/);
  assert.match(sql, /SeasonFinalNode_tournamentId_key_key/);
  assert.match(sql, /SeasonFinalNodeEntry_nodeId_participantId_key/);
  assert.match(sql, /SeasonFinalScore_nodeId_participantId_gameNumber_key/);
});

test('season final supports MINI as tournament-local results without season point publication side effects', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../src/lib/mobile-api/season-finals.ts'), 'utf8');
  const migration = fs.readFileSync(path.resolve(__dirname, '../prisma/migrations/20260923130000_add_competition_mode/migration.sql'), 'utf8');
  assert.match(source, /competitionMode !== "OFFICIAL" && competitionMode !== "MINI"/);
  assert.match(source, /data: \{ teamId, seasonId, name, competitionMode \}/);
  assert.doesNotMatch(source, /createSeasonPointPublication|seasonPointEntry\.(?:create|createMany)/);
  assert.match(migration, /SeasonFinalTournament" ADD COLUMN "competitionMode" TEXT NOT NULL DEFAULT 'OFFICIAL'/);
});
