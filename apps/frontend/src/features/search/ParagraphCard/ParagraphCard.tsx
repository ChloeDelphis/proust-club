import type { SearchHit } from '../../../api/search'
import styles from './ParagraphCard.module.css'

export default function ParagraphCard({ text, startOffset, endOffset, volume, part, pageNumber }: SearchHit) {
  const before = text.substring(0, startOffset)
  const match = text.substring(startOffset, endOffset)
  const after = text.substring(endOffset)

  return (
    <article className={styles.root}>
      <header className={styles.header}>
        <span className={styles.location}>{volume} · {part} · p.&nbsp;{pageNumber}</span>
      </header>
      <p className={styles.text}>
        {before}<mark className={styles.mark}>{match}</mark>{after}
      </p>
    </article>
  )
}
