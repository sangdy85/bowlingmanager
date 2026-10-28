// Runs only on the two official BowlingManager HTTPS origins, in the isolated
// extension world. Never accept a page-supplied photo packet or synthetic click.
void (async () => {
    if (window !== window.top || location.protocol !== 'https:' || location.port ||
        !['bowlingmanager.co.kr', 'www.bowlingmanager.co.kr'].includes(location.hostname)) return;
    const { readPreparedSource } = await import(chrome.runtime.getURL('transfer.js'));
    let busy = false;
    document.addEventListener('click', async event => {
        const button = event.target instanceof Element && event.target.closest('button[data-band-photo-helper="capture"]');
        if (!event.isTrusted || !button || button.disabled || busy) return;
        const requestId = button.getAttribute('data-band-photo-request');
        if (!requestId || requestId.length > 250) return;
        busy = true;
        try {
            // Read synchronously before React marks the preview busy. The same
            // edited caption and prepared PNGs are reused.
            const packet = readPreparedSource();
            const response = await chrome.runtime.sendMessage({ action: 'capture-prepared', packet });
            if (!response?.ok) throw Error(response?.message || '사진 전달 확장프로그램의 응답이 없습니다. 확장프로그램 목록에서 새로고침한 뒤 볼링매니저 페이지도 새로고침해주세요.');
            queueMicrotask(() => window.dispatchEvent(new CustomEvent('bm-band-photo-helper-result', {
                detail: { requestId, ok: true, count: response.result.packet.names.length },
            })));
        } catch (error) {
            queueMicrotask(() => window.dispatchEvent(new CustomEvent('bm-band-photo-helper-result', {
                detail: { requestId, ok: false, message: /Extension context invalidated|Receiving end does not exist/i.test(error.message || '')
                    ? '확장프로그램이 업데이트되었습니다. 볼링매니저 페이지를 새로고침한 뒤 사진을 다시 준비해주세요.'
                    : error.message || '사진을 가져오지 못했습니다.' },
            })));
        } finally { busy = false; }
    }, true);
    document.documentElement.dataset.bmBandPhotoHelper = chrome.runtime.getManifest().version;
    window.dispatchEvent(new Event('bm-band-photo-helper-ready'));
})();
