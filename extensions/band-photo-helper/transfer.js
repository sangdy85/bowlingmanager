export const MAX_PACKET_CHARACTERS = 36 * 1024 * 1024;
export const EXPIRY_MS = 20 * 60 * 1000;

export function validatePacket(value, now = Date.now()) {
    if (!value || value.version !== 1 || typeof value.text !== 'string' || !value.text.trim() || value.text.length > 20000) throw Error('공지 문구를 확인해주세요.');
    const url = new URL(value.sourceUrl);
    if (url.protocol !== 'https:' || !['bowlingmanager.co.kr', 'www.bowlingmanager.co.kr'].includes(url.hostname) || url.port || url.username || url.password) throw Error('볼링매니저 공식 사이트의 결과표만 가져올 수 있습니다.');
    const aboveText = value.aboveText === undefined ? value.text : value.aboveText;
    const belowText = value.belowText === undefined ? '' : value.belowText;
    if (typeof aboveText !== 'string' || typeof belowText !== 'string' || [aboveText, belowText].filter(Boolean).join('\n\n') !== value.text) throw Error('사진 위·아래 공지 문구가 일치하지 않습니다.');
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
        text: value.text, aboveText, belowText, images: value.images.map(({ name, dataUrl }) => ({ name, dataUrl })),
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
    const aboveText = field('공유할 공지 문구'), belowText = field('사진 아래에 쓰기');
    return { version: 1, sourceUrl: location.href, text: [aboveText, belowText].filter(Boolean).join('\n\n'), aboveText, belowText, images };
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
    const fold = text => text.replace(/[\u200b-\u200d\ufeff\s]/g, '');
    const originalText = fold(content.textContent);
    const aboveText = packet.aboveText === undefined ? packet.text : packet.aboveText;
    const belowText = packet.belowText || '';
    if (typeof aboveText !== 'string' || typeof belowText !== 'string' || [aboveText, belowText].filter(Boolean).join('\n\n') !== packet.text) throw Error('사진 위·아래 공지 문구를 다시 가져와주세요.');
    const sameTarget = () => dialog.isConnected && editor.isConnected && dialog.contains(editor) &&
        dialog.getAttribute('aria-labelledby') + ':' + dialog.querySelector('input[id^="postPhotoInput_"]')?.id === composerId &&
        location.protocol === 'https:' && ['band.us', 'www.band.us'].includes(location.hostname) &&
        location.pathname.match(/^\/band\/(\d+)\//)?.[1] === packet.expectedBandId;
    const sameComposer = () => sameTarget() && dialog.dataset.bmBandPhotoTransfer === packet.id;
    const photos = () => [...editor.querySelectorAll(':scope > .cke_widget_wrapper[type="photo"]')];
    const userText = () => {
        const clone = editor.cloneNode(true);
        clone.querySelectorAll('.cke_widget_wrapper[type="photo"], .placeholder[aria-hidden="true"]').forEach(node => node.remove());
        return fold(clone.textContent);
    };
    const caretAtEnd = () => {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount !== 1 || !selection.isCollapsed || !editor.contains(selection.anchorNode)) return false;
        const end = document.createRange();
        end.selectNodeContents(editor); end.collapse(false);
        if (selection.getRangeAt(0).compareBoundaryPoints(2, end) === 0) return true;
        // Editors may normalize the same visual endpoint into a trailing
        // empty paragraph. Accept that only when no text or photo follows.
        const tail = document.createRange();
        tail.selectNodeContents(editor); tail.setStart(selection.anchorNode, selection.anchorOffset);
        return !fold(tail.toString()) && !tail.cloneContents().querySelector('.cke_widget_wrapper[type="photo"], img._thumbnail');
    };
    const placeCaretAtEnd = () => {
        editor.focus();
        const selection = window.getSelection();
        if (!selection) throw Error('글 끝의 커서 위치를 확인할 수 없습니다.');
        const end = document.createRange();
        end.selectNodeContents(editor); end.collapse(false);
        selection.removeAllRanges(); selection.addRange(end);
        // Notify the visible editor before BAND opens its upload dialog, so
        // its saved insertion position follows the new collapsed selection.
        editor.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
        editor.dispatchEvent(new KeyboardEvent('keyup', { key: 'End', code: 'End', ctrlKey: true, bubbles: true }));
        if (!caretAtEnd()) throw Error('커서가 글 끝으로 이동하지 않아 사진 첨부를 중단했습니다.');
    };
    placeCaretAtEnd();
    await new Promise(resolve => setTimeout(resolve, 150));
    if (!sameTarget() || !inputs[0].isConnected || inputs[0].files?.length || dialog.querySelector('img') || userText() !== originalText || !caretAtEnd() || Date.now() >= packet.expiresAt) throw Error('사진 첨부 전에 작성창이나 글 끝의 커서가 바뀌었습니다. 다시 확인해주세요.');
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'files')?.set;
    if (!setter) throw Error('이 브라우저에서 파일 전달을 지원하지 않습니다.');
    setter.call(inputs[0], transfer.files);
    dialog.dataset.bmBandPhotoTransfer = packet.id;
    const count = inputs[0].files.length;
    if (count !== packet.images.length) throw Error('사진 파일을 모두 전달하지 못했습니다. BAND 화면을 확인해주세요.');
    // BAND first uploads into its own photo picker, then requires Attach.
    // Do not insert captions until those widgets exist in the actual editor.
    inputs[0].dispatchEvent(new Event('change', { bubbles: true }));
    const base = { bandId: match[1], bandName, count, textInserted: false, keptExistingText: hasText, uploadRequested: true, published: false };
    try {
        let attachmentConfirmed = false;
        const deadline = Date.now() + 30000;
        while (true) {
            if (!sameComposer() || Date.now() >= packet.expiresAt) throw Error('대상 밴드나 작성창이 바뀌었습니다.');
            if (userText() !== originalText) throw Error('사진을 올리는 동안 문구가 변경돼 자동 정리를 멈췄습니다.');
            const widgets = photos();
            if (widgets.length > count) throw Error('예상하지 않은 사진이 추가돼 자동 정리를 멈췄습니다.');
            if (widgets.length === count && widgets.every(widget => {
                const image = widget.querySelector('img._thumbnail');
                return image?.complete && image.naturalWidth > 0 && ![...widget.querySelectorAll('.uLoading')].some(visible);
            })) break;
            if (Date.now() >= deadline) throw Error('사진 첨부 완료를 확인하지 못했습니다. BAND의 업로드 상태를 확인해주세요.');
            const modals = [...document.querySelectorAll('[role="dialog"][aria-modal="true"]')].filter(visible);
            const uploadDialogs = modals.filter(node => node.querySelector('h1')?.textContent.trim() === '사진 올리기');
            if (uploadDialogs.length > 1) throw Error('사진 선택창이 여러 개 열려 자동 첨부를 멈췄습니다.');
            const upload = uploadDialogs[0];
            if (!attachmentConfirmed && upload && modals[modals.length - 1] === upload) {
                const thumbs = [...upload.querySelectorAll('.mediaContentItem > img._thumbImg')];
                if (thumbs.length > count) throw Error('사진 선택창의 사진 수가 달라 자동 첨부를 멈췄습니다.');
                const buttons = [...upload.querySelectorAll('button._submitBtn')].filter(button => button.textContent.trim() === '첨부하기');
                if (thumbs.length === count && buttons.length === 1 && !buttons[0].disabled &&
                    thumbs.every(image => image.complete && image.naturalWidth > 0) && ![...upload.querySelectorAll('.uLoading')].some(visible)) {
                    const attachButton = buttons[0];
                    attachmentConfirmed = true;
                    attachButton.click(); // Only photo Attach, never the post Publish button.
                }
            }
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        const widgets = photos();
        if (hasText) {
            // Preserve the original formatted text nodes; never rebuild a draft
            // with innerHTML or overwrite edits made during the upload.
            const nodes = [...editor.childNodes].filter(node => !widgets.includes(node) && fold(node.textContent || ''));
            if (nodes.some(node => node.nodeType === 1 && node.querySelector('.cke_widget_wrapper[type="photo"]'))) throw Error('작성창 구조가 달라 기존 글을 그대로 유지했습니다.');
            const fragment = document.createDocumentFragment();
            nodes.forEach(node => fragment.appendChild(node));
            editor.insertBefore(fragment, widgets[0]);
        } else {
            const insertCaption = (text, before) => {
                if (!text) return;
                const paragraph = document.createElement('p');
                paragraph.appendChild(document.createElement('br'));
                editor.insertBefore(paragraph, before);
                editor.focus();
                const selection = window.getSelection();
                if (!selection) throw Error('문구 입력 위치를 확인하지 못했습니다.');
                const range = document.createRange();
                range.selectNodeContents(paragraph);
                selection.removeAllRanges(); selection.addRange(range);
                if (!document.execCommand('insertText', false, text)) throw Error('문구를 넣지 못했습니다. 공지 문구 복사로 직접 입력해주세요.');
            };
            insertCaption(aboveText, widgets[0]);
            insertCaption(belowText, widgets[widgets.length - 1].nextSibling);
            base.textInserted = true;
        }
        editor.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: null }));
        placeCaretAtEnd();
        await new Promise(resolve => setTimeout(resolve, 500));
        if (!sameComposer()) throw Error('문구 확인 중 작성창이 바뀌었습니다.');
        const finalPhotos = photos(), children = [...editor.childNodes];
        const first = children.indexOf(finalPhotos[0]), last = children.indexOf(finalPhotos[finalPhotos.length - 1]);
        const captionText = node => {
            const clone = node.cloneNode(true);
            clone.querySelectorAll?.('.placeholder[aria-hidden="true"]').forEach(element => element.remove());
            return clone.textContent || '';
        };
        const before = fold(children.slice(0, first).map(captionText).join(''));
        const after = fold(children.slice(last + 1).map(captionText).join(''));
        if (finalPhotos.length !== count || first < 0 || before !== (hasText ? originalText : fold(aboveText)) || after !== (hasText ? '' : fold(belowText))) throw Error('문구와 사진의 최종 순서를 확인하지 못했습니다. 게시 전에 확인해주세요.');
        if (!caretAtEnd()) throw Error('글·사진 순서는 유지됐지만 커서가 이동했습니다. 추가 사진은 글 끝을 누른 뒤 첨부해주세요.');
        editor.firstElementChild?.scrollIntoView({ block: 'nearest' });
        return { ...base, layoutVerified: true, photoPlacement: 'between-captions', caretAtEnd: true };
    } catch (error) {
        // Files were already sent: consume the packet and never retry an upload
        // or report publishing success. The user can inspect the intact draft.
        return { ...base, layoutVerified: false, message: error.message || '사진과 문구 위치를 BAND에서 확인해주세요.' };
    }
}
