/** Set while the pointer is over a landmark, so the hover highlight shows a pointer cursor. */
let hovered = false

export const setLandmarkHovered = (v: boolean) => {
  hovered = v
}

export const isLandmarkHovered = () => hovered
