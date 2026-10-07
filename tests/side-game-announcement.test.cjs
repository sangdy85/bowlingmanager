const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const compiled = ts.transpileModule(fs.readFileSync('src/lib/side-game-announcement.ts', 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020}}).outputText;
const loaded = {exports: {}};
new Function('exports', 'module', compiled)(loaded.exports, loaded);
const {buildSideGameAnnouncementGroups: groups, formatSideGameAnnouncement: format} = loaded.exports;
const players = [{regId:'a',name:'김예원'}, {regId:'b',name:'문성복'}, {regId:'c',name:'김예원'}];
test('current selection is classified by registration ID, preserving duplicate names and ordering', () => {
 const result = groups(players, {a:new Set(['STANDARD','BALL']), b:new Set(['EXTRA']), c:new Set(['STANDARD'])});
 assert.deepEqual(result.map(g=>g.names), [['김예원','김예원'],['김예원'],['문성복']]);
});
test('empty groups and missing selection entries remain visible with zero names', () => {
 const result=groups(players, {});
 assert.equal(result.length,3); assert.ok(result.every(g=>g.names.length===0));
 assert.match(format(result,3), /참여자가 없습니다/);
});
test('copy text contains round, category, count and every selected name', () => {
 const result=format(groups(players,{a:new Set(['STANDARD']),b:new Set(['STANDARD','EXTRA'])}),3);
 assert.match(result,/\[3회차 사이드 게임 명단\]/);assert.match(result,/■ 기본 사이드 \(2명\)\n김예원\n문성복/);
 assert.match(result,/■ 볼사이드 \(2G\) \(0명\)/);assert.match(result,/■ 번외 \(3G\) \(1명\)\n문성복/);
});
test('announcement projection and formatting never mutate players or selection used by save', () => {
 const selection={a:new Set(['STANDARD']),b:new Set(['BALL'])};
 const before=JSON.stringify(Object.entries(selection).map(([id,s])=>[id,[...s]]));
 const snapshot=JSON.stringify(players);
 format(groups(players,selection),3);
 assert.equal(JSON.stringify(players),snapshot);assert.equal(JSON.stringify(Object.entries(selection).map(([id,s])=>[id,[...s]])),before);
});
test('extra game label uses existing game count and unsaved selection changes are reflected', () => {
 const selection={a:new Set(['EXTRA'])};assert.equal(groups(players,selection,4)[2].label,'번외 (4G)');
 selection.a.delete('EXTRA');assert.equal(groups(players,selection,4)[2].names.length,0);
 assert.doesNotMatch(format(groups([],{})),/undefined|null/);
});
