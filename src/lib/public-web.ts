// Keep the existing non-www default; production redirects still need verification.
export const PUBLIC_ORIGIN = 'https://bowlingmanager.co.kr';
export const PUBLIC_UPDATED = '2026-09-30';
export const PRIORITY_GUIDES = ['bowling-scoring-system', 'average-and-score-distribution', 'club-event-checklist'];

// Eligible inventory is explicit. Execution remains off until production auto-ad
// exclusions and consent settings are checked. Ownership meta is independent.
export const AD_CONTENT_ALLOWLIST = ['/', ...PRIORITY_GUIDES.map(slug => `/guide/${slug}`)];
export const ADS_EXECUTION_ENABLED = false;
export function canExecuteAds(pathname: string): boolean {
  return ADS_EXECUTION_ENABLED && AD_CONTENT_ALLOWLIST.includes(pathname);
}

export const PRIVATE_ROBOTS_PATHS = ['/admin', '/api', '/settings', '/personal', '/score', '/dashboard', '/team', '/stats'];
export function privateRobotsRules() {
  return PRIVATE_ROBOTS_PATHS.flatMap(path => [`${path}$`, `${path}/`, `${path}?`]);
}

export function safeContentUrl(url: string): string {
  if (/[\\\u0000-\u0020]/.test(url)) return '';
  if (/^https:\/\//i.test(url)) return url;
  if (/^\/(?!\/)/.test(url) || /^#[\w-]+$/.test(url)) return url;
  return '';
}
