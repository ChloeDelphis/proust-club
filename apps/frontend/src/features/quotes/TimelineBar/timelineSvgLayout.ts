// The horizontal range follows the rendered aspect ratio so the track fills its container
// without distorting text or markers.
export const VIEWBOX_WIDTH = 1000
export const VIEWBOX_HEIGHT = 100
export const TITLE_TRACK_HEIGHT = 64
export const BOOKMARK_HEIGHT_NORMAL = 20
export const BOOKMARK_HEIGHT_EXTENDED = 35
export const BOOKMARK_WIDTH = 0.75
export const PREVIEW_WIDTH = 110
export const PREVIEW_HEIGHT = 45
export const VOLUME_ROMAN_NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'] as const

export function percentToX(percent: number, viewBoxWidth: number): number {
  return percent * (viewBoxWidth / 100)
}

export function snapSvgXToDevicePixelCenter(x: number, scale: number, trackLeft: number): number {
  // Responsive viewBox coordinates can land between device pixels and rasterize with uneven weight.
  const devicePixelRatio = window.devicePixelRatio || 1
  const deviceX = (trackLeft + x * scale) * devicePixelRatio
  const snappedDeviceX = Math.round(deviceX - 0.5) + 0.5
  return (snappedDeviceX / devicePixelRatio - trackLeft) / scale
}
