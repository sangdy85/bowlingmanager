const element = id => document.getElementById(id);
let destination = null;
let working = false;
async function command(action, extra = {}) {
    const response = await chrome.runtime.sendMessage({ action, ...extra });
    if (!response?.ok) throw Error(response?.message || '확장프로그램 연결을 확인해주세요.');
    return response.result;
}
function showPacket(packet) {
    element('packet').hidden = !packet;
    element('files').replaceChildren();
    if (!packet) return;
    for (const name of packet.names) {
        const item = document.createElement('li'); item.textContent = name; element('files').append(item);
    }
    element('expiry').textContent = `임시 보관 기한: ${new Date(packet.expiresAt).toLocaleTimeString('ko-KR')}`;
    element('caption').textContent = packet.text;
}
async function run(task) {
    if (working) return;
    working = true; document.querySelectorAll('button').forEach(button => { button.disabled = true; });
    element('status').textContent = '처리 중입니다…';
    try { await task(); } catch (error) { element('status').textContent = error.message || '작업을 완료하지 못했습니다.'; }
    finally { working = false; document.querySelectorAll('button').forEach(button => { button.disabled = false; }); }
}
element('capture').addEventListener('click', () => run(async () => {
    const result = await command('capture'); showPacket(result.packet);
    destination = null; element('destination').hidden = true;
    element('status').textContent = '사진을 가져왔습니다. BAND에서 대상 밴드의 글쓰기 창을 열어주세요.';
}));
element('inspect').addEventListener('click', () => run(async () => {
    destination = null; element('destination').hidden = true;
    const result = await command('inspect'); destination = result; showPacket(result.packet);
    element('band-name').textContent = `첨부 대상: ${result.bandName}`;
    element('draft-note').textContent = result.hasText ? '이미 작성한 문구는 그대로 두고 사진만 첨부합니다.' : '빈 글쓰기 창에 준비된 문구와 사진을 넣습니다.';
    element('destination').hidden = false;
    element('status').textContent = `대상 밴드와 사진 ${result.packet.names.length}개를 확인하고 첨부 버튼을 눌러주세요. 게시 버튼은 누르지 않습니다.`;
}));
element('attach').addEventListener('click', () => run(async () => {
    if (!destination) throw Error('대상 글쓰기 화면을 다시 확인해주세요.');
    const target = destination;
    destination = null; element('destination').hidden = true;
    const result = await command('attach', { packetId: target.packet.id, tabId: target.tabId, bandId: target.bandId, composerId: target.composerId });
    showPacket(null);
    element('status').textContent = `‘${result.bandName}’ 글쓰기 창에 사진 ${result.count}개를 전달 요청했습니다.\nBAND의 사진 업로드 완료와 미리보기를 확인한 뒤 직접 게시해주세요. 게시되지는 않았습니다.${!result.textInserted && !result.keptExistingText ? '\n문구는 추가되지 않았습니다. 볼링매니저에서 복사해 붙여넣어주세요.' : ''}`;
}));
element('clear').addEventListener('click', () => run(async () => {
    await command('clear'); destination = null; element('destination').hidden = true; showPacket(null); element('status').textContent = '준비된 사진과 문구를 지웠습니다.';
}));
void run(async () => {
    const result = await command('status'); showPacket(result.packet);
    element('status').textContent = result.packet ? '준비된 사진이 있습니다. BAND의 새 글쓰기 창에서 2번을 진행해주세요.' : '볼링매니저에서 공유 문구와 사진을 준비한 뒤 1번을 눌러주세요.';
});
