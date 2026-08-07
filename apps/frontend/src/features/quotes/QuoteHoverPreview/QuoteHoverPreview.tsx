import type { QuoteHoverPreviewProps } from './QuoteHoverPreview.types'
import styles from './QuoteHoverPreview.module.css'

const MAX_LENGTH = 120

export default function QuoteHoverPreview({ text }: QuoteHoverPreviewProps) {
  const truncated = text.length > MAX_LENGTH ? `${text.slice(0, MAX_LENGTH)}…` : text

  return (
    <span className={styles.root} role="tooltip">
      {truncated}
    </span>
  )
}
