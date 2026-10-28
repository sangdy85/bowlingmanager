import { createController, sourceCaptureCommand } from './controller.js';
import { getPacket, putPacket, clearPacket } from './store.js';

const ALARM = 'expire-band-photos';
async function activeTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!Number.isInteger(tab?.id)) throw Error('현재 브라우저 탭을 확인할 수 없습니다.');
    return tab;
}
async function execute(tabId, func, args = []) {
    const results = await chrome.scripting.executeScript({ target: { tabId }, func, args });
    if (results.length !== 1 || results[0].result === undefined) throw Error('화면 접근이 허용되지 않았습니다. 확장프로그램 아이콘을 다시 눌러주세요.');
    return results[0].result;
}
const handleCommand = createController({ activeTab, execute, getPacket, putPacket, clearPacket,
    createAlarm: when => chrome.alarms.create(ALARM, { when }), clearAlarm: () => chrome.alarms.clear(ALARM),
    openBand: () => chrome.tabs.create({ url: 'https://www.band.us/' }),
});

chrome.runtime.onMessage.addListener((message, sender, respond) => {
    const fromPopup = sender.id === chrome.runtime.id && sender.url === chrome.runtime.getURL('popup.html');
    const command = fromPopup ? message : sourceCaptureCommand(message, sender, chrome.runtime.id);
    if (!command) {
        // Do not silently drop our own source button's rejected request: the
        // page would mistake an empty response for a missing extension.
        if (sender.id === chrome.runtime.id && message?.action === 'capture-prepared') {
            respond({ ok: false, message: '공식 볼링매니저 화면 주소를 확인하지 못했습니다. 볼링매니저 페이지를 새로고침한 뒤 사진을 다시 준비해주세요.' });
        }
        return false;
    }
    handleCommand(command).then(result => respond({ ok: true, result }), error => respond({ ok: false, message: error.message || '작업에 실패했습니다.' }));
    return true;
});
chrome.alarms.onAlarm.addListener(alarm => { if (alarm.name === ALARM) void clearPacket(); });
chrome.runtime.onStartup.addListener(() => { void clearPacket(); });
chrome.runtime.onInstalled.addListener(() => { void clearPacket(); });
