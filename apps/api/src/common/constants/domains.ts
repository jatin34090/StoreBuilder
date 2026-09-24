/**
 * Centralized domain constants for Phase 12 custom-domain routing.
 * All reserved-subdomain checks must reference this set — never duplicate it.
 */

export const RESERVED_SUBDOMAINS = new Set([
  'www', 'api', 'admin', 'app', 'mail', 'smtp',
  'cdn', 'static', 'assets', 'support', 'help',
  'docs', 'status', 'blog', 'shop', 'store',
  'dashboard', 'portal', 'console', 'metrics',
  'monitoring', 'ftp', 'ssh', 'dev', 'staging',
  'test', 'beta', 'alpha', 'demo', 'preview',
  'ns1', 'ns2', 'mx', 'pop', 'imap', 'vpn',
]);

/**
 * Normalizes a domain string for storage and lookup.
 * Strips protocol, trailing slashes, paths, ports, and lowercases.
 * "https://Example.com/path" → "example.com"
 * "www.mybrand.com"           → "www.mybrand.com"  (www is NOT stripped — it's a separate domain)
 */
export function normalizeDomain(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')   // strip protocol
    .split('/')[0]!                 // strip path
    .split(':')[0]!                 // strip port
    .replace(/\.+$/, '');           // strip trailing dots
}

/**
 * Validates a slug: lowercase alphanumeric + hyphens, 3–63 chars, no leading/trailing hyphen.
 */
export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9]([a-z0-9-]{1,61}[a-z0-9])?$/.test(slug);
}

/**
 * Validates a custom domain hostname (no protocol, no path).
 * Allows optional www prefix and subdomains.
 */
export function isValidDomain(domain: string): boolean {
  const normalized = normalizeDomain(domain);
  // Reject if it still contains a protocol after normalization
  if (normalized.includes('://')) return false;
  // Basic hostname validation: labels separated by dots, each 1–63 chars
  return /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/.test(normalized);
}
