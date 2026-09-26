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
  const localRequire = id => Object.hasOwn(overrides, id)
    ? overrides[id]
    : id.startsWith('@/') ? loadTs(`src/${id.slice(2)}.ts`, overrides, cache) : nativeRequire(id);
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  new Function('require', 'module', 'exports', compiled)(localRequire, module, module.exports);
  return module.exports;
}

const service = loadTs('src/lib/mobile-api/team-game-points.ts', { '@/lib/prisma': {} });

test('team game point defaults distinguish the fourth game and preserve each game table', () => {
  const defaults = service.defaultTeamGamePointTables(4);
  assert.deepEqual(defaults.map(item => item.points.map(row => row.points)), [
    [5, 3, 2, 1], [5, 3, 2, 1], [5, 3, 2, 1], [6, 4, 2, 1],
  ]);
  const encoded = service.serializeTeamGamePointTables(defaults);
  assert.deepEqual(service.readTeamGamePointTables(encoded, 4), defaults);
});

test('legacy one-table game points remain compatible and dynamic rows stay consecutive', () => {
  const legacy = service.readTeamGamePointTables('{"1":5,"2":3}', 3);
  assert.deepEqual(legacy.map(item => item.points), [
    [{ rank: 1, points: 5 }, { rank: 2, points: 3 }],
    [{ rank: 1, points: 5 }, { rank: 2, points: 3 }],
    [{ rank: 1, points: 5 }, { rank: 2, points: 3 }],
  ]);
  assert.throws(() => service.parseTeamGamePointTables([
    { gameNumber: 1, points: [{ rank: 1, points: 5 }] },
    { gameNumber: 3, points: [{ rank: 1, points: 5 }] },
  ], 2));
});
