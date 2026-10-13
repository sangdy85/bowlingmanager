// Run: node --test tests/dashboard-ui.test.cjs
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createRenderer, fixtureRecords } = require('./helpers/dashboard-renderer.cjs');

test('empty personal dashboard offers a first record without fabricating a chart or average', async () => {
  const html = await createRenderer().render();
  assert.match(html, /아직 이 연도의 기록이 없어요/);
  assert.match(html, /href="\/score\/add"/);
  assert.doesNotMatch(html, /id="score-trend-title"/);
  assert.match(html, /평균 점수<\/dt><dd>—/);
});
test('dashboard retains zero and over-300 scores from the shared summary and uses accessible chart text', async () => {
  const html = await createRenderer({ records: fixtureRecords([0, 310]) }).render();
  assert.match(html, /155\.0/);
  assert.match(html, /310/);
  assert.match(html, /최근 2게임 기준/);
  assert.match(html, /<desc id="score-trend-description">[^<]*0점[^<]*310점/);
  assert.match(html, /aria-pressed="true"/);
});
test('member has details and team links but no unauthorized score registration shortcut', async () => {
  const html = await createRenderer({ manager: false }).render();
  assert.doesNotMatch(html, /href="\/score\/add"/);
  assert.match(html, /href="#personal-details"/);
  assert.match(html, /팀 관리자에게 점수 등록을 요청/);
});
test('recent ten exclude impromptu games while the original detailed statistics still include them', async () => {
  const records = fixtureRecords(Array.from({ length: 12 }, (_, index) => 150 + index));
  records[11].gameType = '벙개';
  const html = await createRenderer({ records }).render();
  assert.match(html, /최근 10게임 기준/);
  assert.match(html, /벙개 \(전체\)/);
  assert.match(html, /id="personal-details"/);
  assert.doesNotMatch(html.match(/<desc id="score-trend-description">([^<]*)/)[1], /161점/);
});
test('existing anonymous and no-membership redirects remain enforced', async () => {
  await assert.rejects(createRenderer({ authenticated: false }).render(), /REDIRECT:\/login/);
  await assert.rejects(createRenderer({ hasTeam: false }).render(), /REDIRECT:\/dashboard/);
  const html = await createRenderer({ hasTeam: false }).render('dashboard');
  assert.match(html, /href="\/team\/create"/);
  assert.match(html, /href="\/team\/join"/);
});

test('eligible pentagon appears once above recent records with accessible values and unchanged axes', async () => {
  const html = await createRenderer({ records: fixtureRecords([180, 190, 200]) }).render();
  assert.equal((html.match(/aria-label="개인 기록 오각형 그래프"/g) || []).length, 1);
  assert.ok(html.indexOf('id="personal-radar"') < html.indexOf('id="recent-games"'));
  assert.ok(html.includes("0–10 척도. 정기전: 기량(에버)"));
  for (const label of ['포텐셜', '기복', '안정감', '성실']) assert.ok(html.includes(label));
});
test('fewer than three sessions shows guidance without manufacturing pentagon data', async () => {
  const html = await createRenderer({ records: fixtureRecords([180, 190]) }).render();
  assert.match(html, /기록이 쌓이면 프로필이 보여요/);
  assert.doesNotMatch(html, /aria-label="개인 기록 오각형 그래프"/);
  assert.match(html, /id="score-trend-title"/);
});
