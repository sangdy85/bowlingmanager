export const PUBLIC_ORIGIN = 'https://www.bowlingmanager.co.kr';
export const CANONICAL_HOSTNAME = 'www.bowlingmanager.co.kr';
export const LEGACY_HOSTNAME = 'bowlingmanager.co.kr';
export const PUBLIC_UPDATED = '2026-09-30';
export const PRIORITY_GUIDES = ['bowling-scoring-system', 'average-and-score-distribution', 'club-event-checklist'];

type CanonicalHostInput = {
  requestHostname?: string | null;
  host?: string | null;
  forwardedHost?: string | null;
};

function normalizeHostname(value?: string | null): string {
  const firstHost = value?.split(',')[0]?.trim().toLowerCase();
  if (!firstHost) return '';
  try {
    return new URL(`http://${firstHost}`).hostname.replace(/\.$/, '');
  } catch {
    return '';
  }
}

export function canonicalHostRedirectUrl(
  requestUrl: string,
  hosts: CanonicalHostInput,
  isProduction = process.env.NODE_ENV === 'production',
): string | null {
  if (!isProduction) return null;

  const candidates = [
    normalizeHostname(hosts.requestHostname),
    normalizeHostname(hosts.host),
    normalizeHostname(hosts.forwardedHost),
  ];
  const requestHost = candidates.find(
    hostname => hostname === LEGACY_HOSTNAME || hostname === CANONICAL_HOSTNAME,
  );
  if (requestHost !== LEGACY_HOSTNAME) return null;

  const destination = new URL(requestUrl);
  destination.protocol = 'https:';
  destination.hostname = CANONICAL_HOSTNAME;
  destination.port = '';
  return destination.toString();
}

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
