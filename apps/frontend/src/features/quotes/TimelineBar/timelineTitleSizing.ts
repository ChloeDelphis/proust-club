import styles from './TimelineBar.module.css'

const TITLE_FONT_SIZES_REM = [0.625, 0.5625, 0.5, 0.4375, 0.375] as const
const TITLE_SIZE_CLASSES = ['', styles.compactTitle, styles.denseTitle, styles.tinyTitle, styles.microTitle] as const

let titleMeasureContext: CanvasRenderingContext2D | null = null

export function titleFontClass(
  title: string,
  width: number,
  height: number,
  scale: number,
  horizontalPaddingRem: number,
  verticalPaddingRem: number,
): string {
  if (typeof document === 'undefined') return ''

  const rootStyle = getComputedStyle(document.documentElement)
  const rootFontSize = Number.parseFloat(rootStyle.fontSize) || 16
  const contentWidth = Math.max(1, (width - horizontalPaddingRem * rootFontSize) * scale)
  const contentHeight = Math.max(1, (height - verticalPaddingRem * rootFontSize) * scale)
  titleMeasureContext ??= document.createElement('canvas').getContext('2d')
  const context = titleMeasureContext
  if (!context) return ''

  const fontFamily = rootStyle.getPropertyValue('--font-reading').trim() || 'Georgia, serif'
  for (const [index, fontSizeRem] of TITLE_FONT_SIZES_REM.entries()) {
    const fontSize = fontSizeRem * rootFontSize * scale
    context.font = `400 ${fontSize}px ${fontFamily}`
    const lineCount = getWrappedLineCount(title, contentWidth, context)
    if (lineCount * fontSize * 1.4 <= contentHeight) return TITLE_SIZE_CLASSES[index] ?? ''
  }

  return TITLE_SIZE_CLASSES[TITLE_SIZE_CLASSES.length - 1] ?? ''
}

function getWrappedLineCount(text: string, maxWidth: number, context: CanvasRenderingContext2D): number {
  const words = text.trim().split(/\s+/).filter(Boolean)
  let lineCount = 1
  let lineWidth = 0
  const spaceWidth = context.measureText(' ').width

  for (const word of words) {
    const wordWidth = context.measureText(word).width
    if (lineWidth > 0 && lineWidth + spaceWidth + wordWidth <= maxWidth) {
      lineWidth += spaceWidth + wordWidth
      continue
    }
    if (wordWidth <= maxWidth) {
      if (lineWidth > 0) lineCount += 1
      lineWidth = wordWidth
      continue
    }

    if (lineWidth > 0) {
      lineCount += 1
      lineWidth = 0
    }
    for (const character of word) {
      const characterWidth = context.measureText(character).width
      if (lineWidth > 0 && lineWidth + characterWidth > maxWidth) {
        lineCount += 1
        lineWidth = characterWidth
      } else {
        lineWidth += characterWidth
      }
    }
  }

  return lineCount
}
