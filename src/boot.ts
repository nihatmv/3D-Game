/**
 * The loading screen is plain HTML in index.html (it shows the name before any
 * JS runs). Fade it out once there's something to see: the page on mount, the
 * island after the canvas has drawn its first frames.
 */
export function hideBoot() {
  const el = document.getElementById('boot')
  if (!el || el.classList.contains('done')) return
  el.classList.add('done')
  setTimeout(() => el.remove(), 600)
}
