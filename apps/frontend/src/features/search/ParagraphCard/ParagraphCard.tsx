import type { SearchHit } from '../../../api/search'
import QuoteSelection from '../QuoteSelection/QuoteSelection'
import styles from './ParagraphCard.module.css'

export default function ParagraphCard({ paragraphId, text, startOffset, endOffset, volume, part, pageNumber }: SearchHit) {
  return (
    <article className={styles.root}>
      <header className={styles.header}>
        <span className={styles.location}>{volume} · {part} · p.&nbsp;{pageNumber}</span>
      </header>
      <QuoteSelection paragraphId={paragraphId} text={text} highlightRange={{ start: startOffset, end: endOffset }} />
    </article>
  )
}
