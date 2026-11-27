const assert = require('node:assert/strict');
const path = require('node:path');
const { test } = require('node:test');
const { createRenderer } = require('./helpers/dashboard-renderer.cjs');

const centerA = { id: 'center-a', name: '테스트 볼링장', address: '서울 테스트 주소' };
const centerB = { id: 'center-b', name: '테스트 볼링장', address: '부산 테스트 주소' };
const account = { id: 'fixture-user', name: '테스트 관리자', email: 'manager@example.invalid', role: 'CENTER_ADMIN' };

test('accounts distinguish same-named centers by address and center-specific links', async () => {
  const html = await createRenderer({ role: 'SUPER_ADMIN', admin: { users: [{ ...account, ownedCenters: [centerA], managedCenters: [centerA, centerB] }] } }).render('admin/users');
  assert.equal((html.match(/href="\/centers\/center-a"/g) || []).length, 1);
  assert.equal((html.match(/href="\/centers\/center-b"/g) || []).length, 1);
  for (const text of [centerA.address, centerB.address, '등록 소유자', '지정 관리자']) assert.ok(html.includes(text));
});
test('CENTER_ADMIN without assignments is flagged; an owner is not presented as an assigned manager', async () => {
  const missing = await createRenderer({ role: 'SUPER_ADMIN', admin: { users: [account] } }).render('admin/users');
  assert.ok(missing.includes('담당 볼링장 미연결'));
  const owner = await createRenderer({ role: 'SUPER_ADMIN', admin: { users: [{ ...account, ownedCenters: [centerA] }] } }).render('admin/users');
  assert.ok(owner.includes('지정 관리자 연결 없음 · 소유 관계만 등록되어 있습니다.'));
});
test('each center shows only its assigned managers and a separate owner', async () => {
  const owner = { id: 'owner', name: '등록 소유자 테스트', email: 'owner@example.invalid' };
  const centers = [{ ...centerA, code: 'TESTA', owner, managers: [account] }, { ...centerB, code: 'TESTB', owner, managers: [] }];
  const html = await createRenderer({ role: 'SUPER_ADMIN', admin: { centers } }).render('admin/centers');
  const cards = html.match(/<article[\s\S]*?<\/article>/g);
  assert.ok(cards[0].includes('manager@example.invalid'));
  assert.ok(cards[0].includes('지정 관리자 1명'));
  assert.ok(!cards[1].includes('manager@example.invalid'));
  assert.ok(cards[1].includes('아직 연결된 관리자가 없습니다'));
});
test('center assignments are still behind the SUPER_ADMIN layout gate', async () => {
  for (const role of ['USER', 'CENTER_ADMIN']) {
    await assert.rejects(createRenderer({ role, admin: { users: [account] } }).render('admin/users'), /REDIRECT:\//);
    await assert.rejects(createRenderer({ role }).render('admin/centers'), /REDIRECT:\//);
  }
});
test('existing center guard allows center A assignment but denies center B and a role-only administrator', async () => {
  const renderer = createRenderer({ role: 'CENTER_ADMIN', admin: { centers: [{ ...centerA, managers: [{ id: 'fixture-user' }] }, { ...centerB, managers: [{ id: 'someone-else' }] }] } });
  const { verifyCenterAdmin } = renderer.load(path.resolve(__dirname, '../src/lib/auth-utils.ts'));
  assert.equal(await verifyCenterAdmin('center-a'), 'fixture-user');
  await assert.rejects(verifyCenterAdmin('center-b'), /관리 권한이 없습니다/);
  const roleOnly = createRenderer({ role: 'CENTER_ADMIN', admin: { centers: [{ ...centerA, managers: [] }] } });
  await assert.rejects(roleOnly.load(path.resolve(__dirname, '../src/lib/auth-utils.ts')).verifyCenterAdmin('center-a'), /관리 권한이 없습니다/);
});
