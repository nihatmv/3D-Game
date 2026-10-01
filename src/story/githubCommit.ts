/**
 * Latest public commit for the GitPulse lighthouse, from the GitHub REST API
 * (no token: 60 requests/hour per visitor IP). Cached in localStorage for
 * CACHE_MS so repeat visits don't spend the quota. Resolves null on any failure
 * (offline, rate limit, no recent pushes); callers show the fallback from projects.ts.
 */

export type Commit = { repo: string; message: string; date?: string; url?: string; live: boolean }

const CACHE_KEY = 'gitpulse-commit-v1'
const CACHE_MS = 30 * 60 * 1000
const API = 'https://api.github.com'

type PushEvent = {
  type: string
  created_at: string
  repo: { name: string }
  payload?: { head?: string; commits?: { sha: string; message: string }[] }
}

function readCache(user: string): Commit | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const c = JSON.parse(raw) as { user: string; at: number; commit: Commit }
    return c.user === user && Date.now() - c.at < CACHE_MS ? c.commit : null
  } catch {
    return null
  }
}

function writeCache(user: string, commit: Commit) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ user, at: Date.now(), commit }))
  } catch {
    // Storage blocked (private mode): just fetch again next visit.
  }
}

async function getJson<T>(url: string): Promise<T | null> {
  const res = await fetch(url, { headers: { Accept: 'application/vnd.github+json' } })
  return res.ok ? ((await res.json()) as T) : null
}

async function fetchLatest(user: string): Promise<Commit | null> {
  const events = await getJson<PushEvent[]>(`${API}/users/${encodeURIComponent(user)}/events/public?per_page=30`)
  const push = events?.find((e) => e.type === 'PushEvent')
  if (!push) return null
  const repo = push.repo.name
  const sha = push.payload?.head
  let message = push.payload?.commits?.at(-1)?.message
  // Newer event payloads may leave out the commit list: look the head commit up instead.
  if (!message && sha) {
    const c = await getJson<{ commit: { message: string } }>(`${API}/repos/${repo}/commits/${sha}`)
    message = c?.commit.message
  }
  if (!message) return null
  return {
    repo,
    message: message.split('\n')[0],
    date: push.created_at,
    url: sha ? `https://github.com/${repo}/commit/${sha}` : `https://github.com/${repo}`,
    live: true,
  }
}

let pending: Promise<Commit | null> | null = null

/** One request per page load at most; null when the username is still a placeholder. */
export function latestCommit(user: string): Promise<Commit | null> {
  if (!user || user.startsWith('TODO')) return Promise.resolve(null)
  const cached = readCache(user)
  if (cached) return Promise.resolve(cached)
  pending ??= fetchLatest(user)
    .then((c) => {
      if (c) writeCache(user, c)
      return c
    })
    .catch(() => null)
  return pending
}

/** "3 hours ago" style label for a commit date. */
export function timeAgo(iso: string, now = Date.now()): string {
  const s = Math.max(0, (now - Date.parse(iso)) / 1000)
  const units: [number, string][] = [
    [86400 * 30, 'month'],
    [86400 * 7, 'week'],
    [86400, 'day'],
    [3600, 'hour'],
    [60, 'minute'],
  ]
  for (const [sec, name] of units) {
    const n = Math.floor(s / sec)
    if (n >= 1) return `${n} ${name}${n > 1 ? 's' : ''} ago`
  }
  return 'just now'
}
