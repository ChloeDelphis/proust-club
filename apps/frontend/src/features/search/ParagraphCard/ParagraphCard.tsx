import type { SearchHit } from '../../../api/search'
import QuoteSelection from '../QuoteSelection/QuoteSelection'
import styles from './ParagraphCard.module.css'

interface ParagraphCardProps extends SearchHit {
  disabled: boolean
  onSelectionStart: () => void
  onSelectionEnd: () => void
}

export default function ParagraphCard({
  paragraphId,
  text,
  startOffset,
  endOffset,
  volume,
  part,
  pageNumber,
  disabled,
  onSelectionStart,
  onSelectionEnd,
}: ParagraphCardProps) {
  return (
    <article className={styles.root}>
      <header className={styles.header}>
        <span className={styles.location}>{volume} · {part} · p.&nbsp;{pageNumber}</span>
      </header>
      <QuoteSelection
        paragraphId={paragraphId}
        text={text}
        highlightRange={{ start: startOffset, end: endOffset }}
        disabled={disabled}
        onSelectionStart={onSelectionStart}
        onSelectionEnd={onSelectionEnd}
      />
    </article>
  )
}
