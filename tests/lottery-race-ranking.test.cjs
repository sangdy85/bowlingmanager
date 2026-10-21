const assert = require('node:assert/strict');
const { test } = require('node:test');
const path = require('node:path');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { createRenderer } = require('./helpers/dashboard-renderer.cjs');

const renderer = createRenderer();
const Race = renderer.load(path.resolve(__dirname, '../src/components/tournaments/LotteryRace.tsx')).default;
const { createLotteryRacePlan } = renderer.load(path.resolve(__dirname, '../src/lib/lottery-race.ts'));
function fixture(count, winners = Math.min(count, 5)) {
    const participants = Array.from({ length: count }, (_, index) => ({
        registrationId: 'ranking-fixture-' + index,
        registration: { guestName: '가상 선수 ' + (index + 1), guestTeamName: '가상팀' },
    }));
    const plan = count ? createLotteryRacePlan(count, winners, 50000, { seed: 42 }) : null;
    return { participants, plan };
}
function render(props, running = false) {
    return renderToStaticMarkup(React.createElement(Race, { ...props, running, onFinish() {} }));
}
function list(html, label) {
    const match = html.match(new RegExp('<ol[^>]*aria-label="' + label + '"[^>]*>([\\s\\S]*?)</ol>'));
    assert.ok(match, label);
    return match[1];
}

test('finished 43-person race shows all placings centrally, five prizes and the unchanged six-person sidebar', () => {
    const data = fixture(43);
    const html = render(data);
    const standings = list(html, '참가자 전체 최종 순위');
    assert.equal((standings.match(/<li /g) || []).length, 43);
    assert.deepEqual([...standings.matchAll(/<strong[^>]*>(.*?)<\/strong>/g)].map(m => m[1]), data.plan.order.map(index => data.participants[index].registration.guestName));
    assert.equal((standings.match(/<em>당첨<\/em>/g) || []).length, 5);
    const sidebar = list(html, '실시간 상위 순위');
    assert.equal((sidebar.match(/<li /g) || []).length, 6);
    assert.equal((sidebar.match(/>당첨<\/span>/g) || []).length, 5);
    assert.equal((sidebar.match(/>완주<\/span>/g) || []).length, 1);
    assert.match(html, /<section[^>]*aria-label="이번 레이스 전체 순위"/);
    assert.ok(html.includes('43/43명 도착'));
    assert.match(html, /aria-label="참가자 전체 최종 순위" tabindex="0"/);
});

test('only fully completed races reveal central standings; sidebar stays compact for small and large fields', () => {
    for (const count of [1, 20, 200]) {
        const data = fixture(count);
        assert.equal((list(render(data), '참가자 전체 최종 순위').match(/<li /g) || []).length, count);
        assert.equal((list(render(data), '실시간 상위 순위').match(/<li /g) || []).length, Math.min(6, count));
        assert.equal((list(render(data, true), '실시간 상위 순위').match(/<li /g) || []).length, Math.min(6, count));
        assert.ok(!render(data, true).includes('aria-label="이번 레이스 전체 순위"'));
    }
    const empty = render(fixture(0));
    assert.equal((list(empty, '실시간 상위 순위').match(/<li /g) || []).length, 0);
    assert.ok(empty.includes('참가 후보가 없습니다.'));
    assert.ok(!empty.includes('aria-label="이번 레이스 전체 순위"'));
});
