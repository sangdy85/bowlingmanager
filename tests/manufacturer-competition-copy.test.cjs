const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const bundle = require('../content/competition-notices/manufacturers-20261019.json');
const mod = { exports: {} };
const js = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/lib/competition-notices.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
new Function('module', 'exports', js)(mod, mod.exports);
const { validateCompetitionNotice, noticePhase, calendarDays, noticeDateKey } = mod.exports;

test('manufacturer copy validates against the existing notice form and defaults to unpublished', () => {
    assert.equal(bundle.checkedAt, '2026-10-19');
    assert.equal(bundle.entries.length, 5);
    assert.equal(new Set(bundle.entries.map(e => e.key)).size, 5);
    for (const entry of bundle.entries) {
        const row = validateCompetitionNotice(entry.input);
        assert.equal(row.published, false);
        assert((row.description + row.rules).includes(bundle.checkedAt));
        assert(row.rules.includes('출처:'));
        assert(row.rules.includes('원문'));
        assert(!/가상 예시|lorem ipsum/i.test(row.description));
        assert.equal(row.registrationUrl, null, 'never invent a direct application link');
        const source = new URL(entry.sourceUrl), linked = new URL(row.relatedUrl);
        assert(['bowlingkorea.com', 'brunswickkorea.co.kr', 'lordfield.com', 'www.perfectkorea.com'].includes(source.hostname));
        assert.equal(source.protocol, 'https:');
        assert.equal(linked.hostname, source.hostname);
        assert.equal(decodeURI(linked.pathname), decodeURI(source.pathname));
    }
});

test('expired registration and the completed Brunswick event are never described as newly open', () => {
    const expected = {
        'lordfield-championship-cup-2026-fourth': '접수 기간',
        'jinseung-thanks-jeju-2026-second': '접수 마감',
        'jinseung-senior-championship-2026-fourth': '접수 마감',
        'brunswick-challenge-cup-2026-fifth-suwon': '종료',
        'perfect-korea-gold-classic-2026-third': '접수 기간',
    };
    for (const entry of bundle.entries) assert.equal(noticePhase(validateCompetitionNotice(entry.input), bundle.checkedAt), expected[entry.key]);
    const lordfield = bundle.entries.find(e => e.key.startsWith('lordfield')).input;
    assert(lordfield.description.includes('10월 26일 오전 10시'));
    assert(lordfield.description.includes('선접수'));
    assert(lordfield.description.includes('일반 접수'));
});

test('existing calendar puts the verified events on their actual days, not on notice publication dates', () => {
    const october = calendarDays('2026-10').filter(d => noticeDateKey(d).startsWith('2026-10')).map(noticeDateKey);
    const rows = bundle.entries.map(e => validateCompetitionNotice(e.input));
    const dates = rows.filter(r => october.includes(noticeDateKey(r.startDate))).map(r => noticeDateKey(r.startDate)).sort();
    assert.deepEqual(dates, ['2026-10-18', '2026-10-20', '2026-10-25']);
    assert.equal(noticeDateKey(rows.find(r => r.organizer === '㈜로드필드').startDate), '2026-11-08');
});

const scheduleBundle = require('../content/competition-notices/upcoming-schedules-20261019.json');
const scheduleMod = { exports: {} };
const scheduleJs = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/lib/competition-schedules.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
new Function('require', 'module', 'exports', scheduleJs)(id => id.endsWith('.json') ? scheduleBundle : mod.exports, scheduleMod, scheduleMod.exports);
const scheduleRows = (q, status, month, today = '2026-10-19') => scheduleMod.exports.upcomingCompetitionSchedules(q, status, month, today);
test('early schedules never invent registration dates or bypass the notice form', () => {
    assert.equal(scheduleBundle.entries.length, 3);
    for (const row of scheduleBundle.entries) {
        assert(!('registrationStartDate' in row)); assert(!('registrationEndDate' in row));
        assert(row.paragraphs.join(' ').includes('2026-10-19'));
        for (const source of row.sources) assert(['bowlingkorea.com', 'lordfield.com'].includes(new URL(source.url).hostname));
    }
    assert.equal(scheduleRows('', 'registering').length, 0);
    assert.equal(scheduleRows('', 'finished').length, 0);
});
test('schedule announcements respect search, calendar month and expiry', () => {
    assert.equal(scheduleRows('', 'all').length, 3);
    assert.equal(scheduleRows('', 'upcoming', '2026-11').length, 1);
    assert.equal(scheduleRows('', 'all', '2026-12').length, 2);
    assert.equal(scheduleRows('로드필드', 'all').length, 1);
    assert.equal(scheduleRows('', 'all', '2026-10').length, 0);
    assert.equal(scheduleRows('', 'all', undefined, '2026-12-28').length, 0);
});
test('Gold Classic copy preserves the opening hour and conditional finals fee', () => {
    const row = bundle.entries.find(e => e.key === 'perfect-korea-gold-classic-2026-third').input;
    assert.equal(row.startDate, '2026-11-01');
    assert.equal(row.registrationStartDate, '2026-10-19');
    assert(row.description.includes('오후 1시')); assert(row.description.includes('개시 시각 이전'));
    assert(row.fee.includes('결승 진출 시')); assert(row.rules.includes('각 조 38명'));
});
