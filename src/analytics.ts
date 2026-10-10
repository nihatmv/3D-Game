import { VISITOR } from './visitor'

/**
 * Tiny analytics hook. Code calls `track(event, props)`; which service
 * receives it is set by env vars only (no keys in the code):
 *
 *   VITE_ANALYTICS_PROVIDER=plausible
 *   VITE_PLAUSIBLE_DOMAIN=yourdomain.com
 *   VITE_PLAUSIBLE_SRC=https://plausible.io/js/script.js   (optional, for self-hosting)
 *
 * With no provider set, events are dropped (and logged in dev). To add a
 * service, write another `Provider` and register it in PROVIDERS.
 * Every event carries `for` (the ?for= team) when the link was personalized.
 */

export type AnalyticsEvent = 'tour_started' | 'landmark_completed' | 'skip_clicked' | 'tour_finished' | 'explore_clicked' | 'contact_clicked' | 'time_changed'
type Props = Record<string, string | number>
type Provider = { send: (event: AnalyticsEvent, props: Props, done: () => void) => void }

type PlausibleFn = ((event: string, opts?: { props?: Props; callback?: () => void }) => void) & { q?: unknown[] }

function plausible(): Provider | null {
  const domain = import.meta.env.VITE_PLAUSIBLE_DOMAIN as string | undefined
  if (!domain) return null
  const w = window as unknown as { plausible?: PlausibleFn }
  // Queue calls made before the script loads (Plausible's documented stub).
  w.plausible ??= Object.assign((...args: unknown[]) => void (w.plausible!.q ??= []).push(args), {}) as PlausibleFn
  const script = document.createElement('script')
  script.defer = true
  script.dataset.domain = domain
  script.src = (import.meta.env.VITE_PLAUSIBLE_SRC as string | undefined) ?? 'https://plausible.io/js/script.js'
  document.head.appendChild(script)
  return { send: (event, props, done) => w.plausible!(event, { props, callback: done }) }
}

const PROVIDERS: Record<string, () => Provider | null> = { plausible }

const provider: Provider | null = PROVIDERS[import.meta.env.VITE_ANALYTICS_PROVIDER as string]?.() ?? null

export function track(event: AnalyticsEvent, props: Props = {}, done: () => void = () => {}) {
  const all = VISITOR ? { ...props, for: VISITOR } : props
  if (import.meta.env.DEV) console.info('[analytics]', event, all)
  if (!provider) return done()
  try {
    provider.send(event, all, done)
  } catch {
    done()
  }
}
