/**
 * Cold-outreach personalization: `?for=acme` makes the captain greet
 * "Ahoy, Acme crew!". The value comes from the URL, so it is cleaned up
 * (letters, digits, spaces and & . ' - only, at most MAX_LENGTH characters)
 * and only ever rendered as text.
 */

const MAX_LENGTH = 24

export function sanitizeVisitor(raw: string | null): string | null {
  if (!raw) return null
  const s = raw
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N} &.'-]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_LENGTH)
    .trim()
  if (!/[\p{L}\p{N}]/u.test(s)) return null
  // "acme corp" -> "Acme Corp", but "OpenAI" and "eBay"-style names keep their own casing.
  return s.replace(/(^|\s)(\p{Ll})(?=[\p{Ll}\s&.'-]*(\s|$))/gu, (_, sp: string, c: string) => sp + c.toUpperCase())
}

/** The visiting team's name, or null when the link isn't personalized. */
export const VISITOR = sanitizeVisitor(new URLSearchParams(window.location.search).get('for'))

/** Keep `?for=` on links between the island and the page. */
export function withVisitor(href: string): string {
  if (!VISITOR) return href
  const url = new URL(href, window.location.origin)
  url.searchParams.set('for', VISITOR)
  return url.pathname + url.search
}
