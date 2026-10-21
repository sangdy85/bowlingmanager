const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { createRenderer } = require('./helpers/dashboard-renderer.cjs');

function navigation(isLoggedIn, userRole = 'USER', pathname = '/') {
    const renderer = createRenderer({ authenticated: isLoggedIn, role: userRole, pathname });
    const Navbar = renderer.load(path.resolve(__dirname, '../src/components/Navbar.tsx')).default;
    return renderToStaticMarkup(React.createElement(Navbar, { isLoggedIn, userRole }));
}

test('public navigation preserves six categories and the guest login boundary', () => {
    const html = navigation(false);
    const primary = html.match(/<div class="Navbar_primaryLinks">([\s\S]*?)<\/div>/)[1];
    assert.equal((primary.match(/<a /g) || []).length, 6);
    assert.match(primary, /href="\/login"[^>]*>동호회<\/a>/);
    for (const route of ['centers', 'competitions', 'equipment', 'community', 'guide']) {
        assert.ok(primary.includes(`href="/${route}"`));
    }
    assert.match(html, /aria-expanded="false" aria-controls="main-navigation"/);
    assert.match(html, /href="\/register"/);
    assert.doesNotMatch(html, /사이트 관리|로그아웃/);
});

test('a nested page highlights exactly its category and preserves member account links', () => {
    const html = navigation(true, 'USER', '/equipment/example-product');
    assert.equal((html.match(/aria-current="page"/g) || []).length, 1);
    assert.match(html, /href="\/equipment"[^>]*aria-current="page"/);
    for (const route of ['team', 'personal', 'inquiry', 'settings']) assert.ok(html.includes(`href="/${route}"`));
    assert.match(html, /로그아웃/);
    assert.doesNotMatch(html, /href="\/admin"/);
});

test('super administrator account retains existing administration destinations', () => {
    const html = navigation(true, 'SUPER_ADMIN', '/centers/example-center');
    for (const route of ['admin', 'competitions/manage', 'centers', 'inquiry', 'settings']) assert.ok(html.includes(`href="/${route}"`));
    assert.match(html, /href="\/centers"[^>]*aria-current="page"/);
    assert.match(html, /<summary[^>]*>내 계정/);
});
