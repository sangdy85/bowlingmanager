// In-memory UI fixtures only; no database connection or mutations.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createRenderer } = require('./helpers/dashboard-renderer.cjs');

test('admin layout retains SUPER_ADMIN-only access for every admin page', async () => {
  for (const page of ['admin', 'admin/users', 'admin/teams', 'admin/centers']) {
    for (const role of ['USER', 'CENTER_ADMIN']) await assert.rejects(createRenderer({ role }).render(page), /REDIRECT:\//);
    await assert.rejects(createRenderer({ authenticated: false }).render(page), /REDIRECT:\//);
  }
});
test('overview shows actual counts including zero without invented pending metrics', async () => {
  const html = await createRenderer({ role: 'SUPER_ADMIN', admin: { userCount: 1234, teamCount: 0, centerCount: 7 } }).render('admin');
  assert.ok(html.includes('1,234'));
  assert.ok(html.includes("총 팀</dt><dd>0"));
  assert.ok(html.includes('비활성 팀을 포함한 전체 팀'));
  assert.ok(html.includes('href="/inquiry"'));
  assert.ok(html.includes('href="/centers"'));
  assert.doesNotMatch(html, /승인 대기|입금 대기|처리 대기/);
});
test('active admin menu follows the current route including nested routes', async () => {
  for (const page of ['admin', 'admin/users', 'admin/teams', 'admin/centers']) {
    const html = await createRenderer({ role: 'SUPER_ADMIN' }).render(page);
    const links = [...html.matchAll(/<a href="([^"]+)" aria-current="page"/g)].map(match => match[1]);
    assert.deepEqual(links, ['/' + page]);
  }
  const html = await createRenderer({ role: 'SUPER_ADMIN', pathname: '/admin/teams/details' }).render('admin');
  assert.ok(html.includes('href="/admin/teams" aria-current="page"'));
});
test('all management lists have meaningful empty states', async () => {
  for (const [page, title] of [['users', '등록된 계정이 없어요'], ['teams', '등록된 활성 팀이 없어요'], ['centers', '등록된 볼링장이 없어요']]) {
    assert.ok((await createRenderer({ role: 'SUPER_ADMIN' }).render('admin/' + page)).includes(title));
  }
});
test('accounts retain role options, selected role and protected-account delete visibility', async () => {
  const html = await createRenderer({ role: 'SUPER_ADMIN', admin: { users: [{ id: 'safe', name: '보호 계정', email: 'sangdy85', role: 'SUPER_ADMIN' }, { id: 'member', name: '테스트 회원', email: 'fixture@example.invalid', role: 'USER' }] } }).render('admin/users');
  assert.ok(html.includes('aria-label="테스트 회원 계정 권한"'));
  for (const role of ['USER', 'CENTER_ADMIN', 'SUPER_ADMIN']) assert.ok(html.includes('value="' + role + '"'));
  assert.ok(html.includes('value="SUPER_ADMIN" selected=""'));
  assert.doesNotMatch(html, /aria-label="보호 계정 계정 삭제"/);
  assert.ok(html.includes('aria-label="테스트 회원 계정 삭제"'));
});
test('center registration retains names and required fields with associated labels', async () => {
  const html = await createRenderer({ role: 'SUPER_ADMIN' }).render('admin/centers');
  for (const name of ['name', 'phone', 'address', 'description']) {
    assert.ok(html.includes('for="center-' + name + '"'));
    const tag = html.match(/<(?:input|textarea)[^>]*>/g).find(tag => tag.includes('id="center-' + name + '"'));
    assert.ok(tag && tag.includes('name="' + name + '"'));
    if (name === 'name' || name === 'address') assert.ok(tag.includes('required=""'));
  }
});
test('team management keeps per-team records and both advanced feature states', async () => {
  const teams = [true, false].map((enabled, index) => ({ id: 'team-' + index, name: '테스트 팀 ' + index, code: 'FIXTURE', _count: { members: index + 1 }, createdAt: new Date('2026-10-01T00:00:00Z'), bowlerHiddenEnabled: enabled }));
  const html = await createRenderer({ role: 'SUPER_ADMIN', admin: { teams } }).render('admin/teams');
  assert.ok(html.includes('href="/team/team-0"'));
  assert.ok(html.includes('href="/team/team-1"'));
  assert.ok(html.includes('고급 기능 끄기'));
  assert.ok(html.includes('고급 기능 켜기'));
  assert.ok(html.includes('사용 중'));
  assert.ok(html.includes('꺼짐'));
});
