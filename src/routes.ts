/**
 * Two views, one bundle entry: the 3D island at `/` and the plain portfolio
 * page at PORTFOLIO_PATH. Navigation between them is a normal page load, so
 * the page never downloads three.js (App is lazy-loaded in main.tsx).
 * Hosts need a rewrite from /portfolio to index.html (vercel.json, public/_redirects).
 */

export const PORTFOLIO_PATH = '/portfolio'
/** `?tour` forces the island, even on phones (which get the page first). */
export const ISLAND_HREF = '/?tour'

/** Phones (portrait, or short landscape with touch) open the page first. */
const PHONE = '(max-width: 640px), (max-height: 500px) and (pointer: coarse)'

export function showPortfolioPage(): boolean {
  const path = window.location.pathname.replace(/\/+$/, '')
  if (path === PORTFOLIO_PATH) return true
  if (new URLSearchParams(window.location.search).has('tour')) return false
  return window.matchMedia(PHONE).matches
}
