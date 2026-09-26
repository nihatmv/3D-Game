/** Tracks whether Shift is held, so hover feedback can switch to "remove" mode. */

let shift = false

if (typeof window !== 'undefined') {
  const update = (e: KeyboardEvent | PointerEvent) => {
    shift = e.shiftKey
  }
  window.addEventListener('keydown', update)
  window.addEventListener('keyup', update)
  window.addEventListener('pointermove', update)
  window.addEventListener('blur', () => (shift = false))
}

export const isShiftHeld = () => shift
