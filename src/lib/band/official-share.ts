// Official BAND Share Button API: https://developers.band.us/develop/guide/share
// Fixed allowlisted service domain, independent of location and caller input.
export const BAND_SHARE_ROUTE = 'bowlingmanager.co.kr';
// Our conservative interoperability budget, NOT a documented BAND API limit.
export const BAND_SHARE_URL_BUDGET = 8000;

export function buildBandShareLinks(text: string) {
    const encoded = encodeURIComponent(text);
    const suffix = `&route=${BAND_SHARE_ROUTE}`;
    const fullWeb = `https://band.us/plugin/share?body=${encoded}${suffix}`;
    const fullApp = `bandapp://create/post?text=${encoded}${suffix}`;
    const tooLong = Math.max(fullWeb.length, fullApp.length) > BAND_SHARE_URL_BUDGET;
    return {
        tooLong,
        urlLength: Math.max(fullWeb.length, fullApp.length),
        contentBytes: new TextEncoder().encode(text).length,
        // Long announcements are never silently truncated. Copy the whole body
        // and paste into an empty official composer instead of an oversized URL.
        webUrl: tooLong ? `https://band.us/plugin/share?body=${suffix}` : fullWeb,
        appUrl: tooLong ? `bandapp://create/post?text=${suffix}` : fullApp,
    };
}

export function openBandSharePopup(text: string, open: typeof window.open = window.open): boolean {
    const { webUrl } = buildBandShareLinks(text);
    // Synchronously opened only by a direct click. Clear opener before navigating
    // so we can detect popup blocking without giving the external page an opener.
    const popup = open('about:blank', '_blank', 'width=520,height=720,resizable=yes,scrollbars=yes');
    if (!popup) return false;
    popup.opener = null;
    popup.location.replace(webUrl);
    return true;
}
