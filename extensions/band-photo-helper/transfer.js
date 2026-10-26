export const MAX_PACKET_CHARACTERS = 36 * 1024 * 1024;
export const EXPIRY_MS = 20 * 60 * 1000;

export function validatePacket(value, now = Date.now()) {
    if (!value || value.version !== 1 || typeof value.text !== 'string' || !value.text.trim() || value.text.length > 20000) throw Error('공지 문구를 확인해주세요.');
    const url = new URL(value.sourceUrl);
    if (url.protocol !== 'https:' || !['bowlingmanager.co.kr', 'www.bowlingmanager.co.kr'].includes(url.hostname) || url.port || url.username || url.password) throw Error('볼링매니저 공식 사이트의 결과표만 가져올 수 있습니다.');
    if (!Array.isArray(value.images) || !value.images.length || value.images.length > 20) throw Error('PNG 사진 1~20개를 준비해주세요.');
    let total = value.text.length;
    const names = new Set();
    for (const image of value.images) {
        if (!image || typeof image.name !== 'string' || !/^[^\\/\x00-\x1f]{1,180}\.png$/i.test(image.name) || names.has(image.name)) throw Error('사진 파일 이름이 올바르지 않거나 중복됩니다.');
        names.add(image.name);
        if (typeof image.dataUrl !== 'string' || !/^data:image\/png;base64,iVBORw0KGgo[A-Za-z0-9+/]*={0,2}$/.test(image.dataUrl)) throw Error('준비된 PNG 사진만 전달할 수 있습니다.');
        total += image.dataUrl.length;
        if (total > MAX_PACKET_CHARACTERS) throw Error('사진 용량이 전달 한도(인코딩 기준 36MB)를 넘습니다. 결과표를 나눠 전달해주세요.');
    }
    // Construct an allowlisted copy. Do not persist arbitrary page fields.
    return {
        version: 1, id: crypto.randomUUID(), sourceUrl: url.origin + url.pathname,
        text: value.text, images: value.images.map(({ name, dataUrl }) => ({ name, dataUrl })),
        createdAt: now, expiresAt: now + EXPIRY_MS,
    };
}

// These functions are serialized by chrome.scripting. Keep them self-contained
// and limited to the visible, explicitly opened sharing/composer UI.
export function readPreparedSource() {
    if (location.protocol !== 'https:' || !['bowlingmanager.co.kr', 'www.bowlingmanager.co.kr'].includes(location.hostname) || location.port) throw Error('볼링매니저 공식 사이트에서 실행해주세요.');
    const visible = element => element.getClientRects().length > 0;
    const dialogs = [...document.querySelectorAll('dialog[open]')].filter(element => visible(element) &&
        document.getElementById(element.getAttribute('aria-labelledby'))?.textContent.trim() === 'BAND 공식 공유하기');
    if (dialogs.length !== 1) throw Error('볼링매니저에서 BAND 공유 미리보기를 먼저 열어주세요.');
    const dialog = dialogs[0];
    const approval = [...dialog.querySelectorAll('label')].find(label => label.textContent.includes('선수 이름·팀·경기 기록의 공유 범위'))?.querySelector('input[type="checkbox"]');
    if (!approval?.checked || approval.disabled) throw Error('공유 범위 확인을 체크하고 사진 준비가 끝날 때까지 기다려주세요.');
    const field = name => {
        const label = [...dialog.querySelectorAll('label[for]')].find(element => element.textContent.trim() === name);
        const element = label && document.getElementById(label.htmlFor);
        if (!element || !dialog.contains(element) || element.tagName !== 'TEXTAREA' || element.disabled) throw Error('공지 문구 입력란을 확인할 수 없습니다.');
        return element.value.trim();
    };
    const images = [...dialog.querySelectorAll('section[aria-label="BAND 첨부 사진"] figure')].map(figure => {
        const image = figure.querySelector('img');
        const name = figure.querySelector('figcaption button')?.textContent.trim().replace(/ 저장$/, '');
        if (!image || !name || !visible(image)) throw Error('사진 미리보기를 확인해주세요.');
        return { name, dataUrl: image.getAttribute('src') };
    });
    if (!images.length) throw Error('선택 주차 결과표 4종 준비 또는 사진 만들기를 먼저 눌러주세요.');
    return { version: 1, sourceUrl: location.href, text: [field('공유할 공지 문구'), field('사진 아래에 쓰기')].filter(Boolean).join('\n\n'), images };
}

export async function bandComposerAction(packet = null) {
    if (location.protocol !== 'https:' || !['band.us', 'www.band.us'].includes(location.hostname) || location.port) throw Error('BAND 일반 웹사이트에서 실행해주세요.');
    const match = location.pathname.match(/^\/band\/(\d+)\/(?:post|notices)(?:\/\d+)?\/?$/);
    if (!match) throw Error('대상 밴드의 게시글 화면을 열어주세요. 공유 팝업·채팅·프로필에서는 첨부하지 않습니다.');
    const visible = element => element.getClientRects().length > 0;
    const dialogs = [...document.querySelectorAll('[role="dialog"][aria-modal="true"]')].filter(element => visible(element) &&
        document.getElementById(element.getAttribute('aria-labelledby'))?.textContent.trim() === '글쓰기');
    if (dialogs.length !== 1) throw Error('대상 밴드에서 글쓰기 버튼을 눌러 새 작성창을 먼저 열어주세요.');
    const dialog = dialogs[0];
    const inputs = [...dialog.querySelectorAll('input[type="file"][id^="postPhotoInput_"][accept="image/*"][name="attachment"]')];
    const editors = [...dialog.querySelectorAll('.contentEditor._richEditor[contenteditable="true"]')];
    if (inputs.length !== 1 || editors.length !== 1 || !inputs[0].multiple || inputs[0].disabled || !visible(editors[0])) throw Error('지원하는 BAND 글쓰기 구조를 찾지 못했습니다. 사진을 직접 첨부해주세요.');
    if (dialog.dataset.bmBandPhotoTransfer || inputs[0].files?.length || dialog.querySelector('img')) throw Error('이 작성창에는 이미 사진이 있거나 전달을 시도했습니다. 중복 첨부하지 않습니다. 새 작성창을 사용해주세요.');
    const bandName = [...document.querySelectorAll('h1 a')].find(element => {
        try { return new URL(element.href).pathname === `/band/${match[1]}/post`; } catch { return false; }
    })?.textContent.trim() || `밴드 ${match[1]}`;
    const editor = editors[0];
    const content = editor.cloneNode(true);
    content.querySelectorAll('.placeholder[aria-hidden="true"]').forEach(element => element.remove());
    const hasText = Boolean(content.textContent.replace(/[\u200b-\u200d\ufeff]/g, '').trim());
    const composerId = dialog.getAttribute('aria-labelledby') + ':' + inputs[0].id;
    if (!packet) return { bandId: match[1], bandName, hasText, composerId };
    if (packet.expectedBandId !== match[1]) throw Error('확인한 대상 밴드가 바뀌었습니다. 다시 확인해주세요.');
    if (packet.expectedComposerId !== composerId) throw Error('글쓰기 창이 바뀌었습니다. 현재 작성창을 다시 확인해주세요.');
    if (!packet.id || !packet.images?.length || packet.images.length > 20 || Date.now() >= packet.expiresAt) throw Error('사진 전달 준비가 만료됐습니다. 다시 가져와주세요.');
    const transfer = new DataTransfer();
    for (const image of packet.images) {
        if (!/^data:image\/png;base64,iVBORw0KGgo[A-Za-z0-9+/]*={0,2}$/.test(image.dataUrl) || !/^[^\\/\x00-\x1f]{1,180}\.png$/i.test(image.name)) throw Error('PNG 사진 형식을 확인해주세요.');
        const bytes = Uint8Array.from(atob(image.dataUrl.split(',')[1]), char => char.charCodeAt(0));
        transfer.items.add(new File([bytes], image.name, { type: 'image/png' }));
    }
    // No page API, cookie, token or network calls. Only the normal file input
    // change event that BAND's own photo selector handles. Never click publish.
    const selection = window.getSelection();
    if (!selection) throw Error('사진을 붙일 문구 아래 위치를 확인하지 못했습니다. 다시 시도해주세요.');
    const selectEditor = collapseToEnd => {
        editor.focus();
        const range = document.createRange();
        range.selectNodeContents(editor);
        if (collapseToEnd) range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
    };
    let textInserted = false;
    if (!hasText) {
        // Replace only the known-empty editor, including BAND's placeholder.
        // Never select or replace a draft that already contains user text.
        selectEditor(false);
        try { textInserted = document.execCommand('insertText', false, packet.text); } catch { /* Report below before attaching photos. */ }
        if (!textInserted) throw Error('공지 문구를 넣지 못해 사진 전달을 멈췄습니다. BAND에 문구를 먼저 붙여넣은 뒤 다시 첨부해주세요.');
    }
    // BAND's rich editor remembers the caret separately from the file input.
    // Put it after the caption and notify normal editor selection handlers
    // before delivering files; otherwise its old bookmark may precede the text.
    selectEditor(true);
    document.execCommand('insertParagraph', false);
    editor.dispatchEvent(new KeyboardEvent('keyup', { key: 'End', code: 'End', bubbles: true }));
    editor.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    await new Promise(resolve => setTimeout(resolve, 150));
    if (!dialog.isConnected || !visible(editor) || !dialog.contains(editor) || !inputs[0].isConnected || !dialog.contains(inputs[0]) ||
        dialog.getAttribute('aria-labelledby') + ':' + inputs[0].id !== composerId ||
        location.pathname.match(/^\/band\/(\d+)\//)?.[1] !== packet.expectedBandId ||
        Date.now() >= packet.expiresAt || inputs[0].files?.length || dialog.querySelector('img') ||
        !selection.isCollapsed || !selection.anchorNode || !editor.contains(selection.anchorNode)) {
        throw Error('사진을 준비하는 동안 글쓰기 화면이나 입력 위치가 바뀌었습니다. 현재 작성창을 다시 확인해주세요.');
    }
    const remaining = document.createRange();
    remaining.selectNodeContents(editor);
    remaining.setStart(selection.anchorNode, selection.anchorOffset);
    if (remaining.toString().replace(/[\u200b-\u200d\ufeff]/g, '').trim()) {
        throw Error('사진을 준비하는 동안 커서가 문구 앞으로 이동했습니다. 현재 작성창을 다시 확인해주세요.');
    }
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'files')?.set;
    if (!setter) throw Error('이 브라우저에서 파일 전달을 지원하지 않습니다.');
    setter.call(inputs[0], transfer.files);
    dialog.dataset.bmBandPhotoTransfer = packet.id;
    const count = inputs[0].files.length;
    if (count !== packet.images.length) throw Error('사진 파일을 모두 전달하지 못했습니다. BAND 화면을 확인해주세요.');
    inputs[0].dispatchEvent(new Event('change', { bubbles: true }));
    return { bandId: match[1], bandName, count, textInserted, keptExistingText: hasText, photoPlacement: 'after-caption', uploadRequested: true, published: false };
}
