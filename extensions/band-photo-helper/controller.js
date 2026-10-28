import { validatePacket, readPreparedSource, bandComposerAction } from './transfer.js';

// Only our isolated top-level content script may import prepared photos. A
// document can move between same-origin Next.js routes without being reloaded;
// its message context URL need not match the current location.href byte for
// byte. Bind both URLs to the same official origin instead. The content script
// reads the visible preview itself after a trusted click, never a
// page-supplied packet. It cannot inspect/attach/clear another tab's packet.
export function sourceCaptureCommand(message, sender, runtimeId) {
    if (sender.id !== runtimeId || sender.frameId !== 0 || !Number.isInteger(sender.tab?.id) || message?.action !== 'capture-prepared') return null;
    try {
        const source = new URL(sender.url);
        const current = new URL(message.packet?.sourceUrl);
        if (source.protocol !== 'https:' || source.port || source.username || source.password ||
            !['bowlingmanager.co.kr', 'www.bowlingmanager.co.kr'].includes(source.hostname) ||
            (sender.origin !== undefined && sender.origin !== source.origin) ||
            current.origin !== source.origin || current.username || current.password) return null;
        return { action: 'capture-prepared', packet: message.packet };
    } catch { return null; }
}

export function createController({ activeTab, execute, getPacket, putPacket, clearPacket, createAlarm, clearAlarm, openBand }) {
    let busy = false;
    const metadata = packet => packet ? { id: packet.id, names: packet.images.map(image => image.name), expiresAt: packet.expiresAt, text: packet.text } : null;
    return async function handleCommand(message) {
        if (!message || !['status', 'capture', 'capture-prepared', 'inspect', 'attach', 'clear'].includes(message.action)) throw Error('지원하지 않는 요청입니다.');
        if (busy) throw Error('사진 전달 작업 중입니다. 잠시 후 다시 눌러주세요.');
        busy = true;
        try {
            if (message.action === 'clear') { await clearPacket(); await clearAlarm(); return { cleared: true }; }
            if (message.action === 'status') return { packet: metadata(await getPacket()) };
            if (message.action === 'capture-prepared') {
                const packet = validatePacket(message.packet);
                await putPacket(packet); await createAlarm(packet.expiresAt);
                await openBand();
                return { packet: metadata(packet), openedBand: true };
            }
            const tab = await activeTab();
            if (message.action === 'capture') {
                const packet = validatePacket(await execute(tab.id, readPreparedSource));
                await putPacket(packet); await createAlarm(packet.expiresAt);
                // The normal BAND composer supports photos; the share popup does not.
                await openBand();
                return { packet: metadata(packet), openedBand: true };
            }
            const packet = await getPacket();
            if (!packet) throw Error('준비된 사진이 없거나 만료됐습니다. 볼링매니저에서 다시 가져와주세요.');
            if (message.action === 'inspect') return { ...await execute(tab.id, bandComposerAction), packet: metadata(packet), tabId: tab.id };
            if (!message.packetId || message.packetId !== packet.id || message.tabId !== tab.id || !/^\d+$/.test(message.bandId) || typeof message.composerId !== 'string' || message.composerId.length > 250) throw Error('대상 글쓰기 화면을 다시 확인해주세요.');
            const result = await execute(tab.id, bandComposerAction, [{ ...packet, expectedBandId: message.bandId, expectedComposerId: message.composerId }]);
            // Consume the packet after one dispatch, without claiming BAND accepted
            // or published it. Never automatically retry an upload.
            await clearPacket(); await clearAlarm();
            return result;
        } finally { busy = false; }
    };
}
