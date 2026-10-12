import { useTranslation } from 'react-i18next'
import type { SearchHit } from '../../../api/search'
import QuoteSelection from '../QuoteSelection/QuoteSelection'
import styles from './ParagraphCard.module.css'

interface ParagraphCardProps extends SearchHit {
  onOpenDetail: (hit: SearchHit) => void
}

// A separate header button, not a click on the paragraph text itself — the text is already a
// gesture target for native selection (QuoteSelection's "Sauvegarder" flow); overloading it with
// "open detail" too would conflict with that.
export default function ParagraphCard({ paragraphId, text, startOffset, endOffset, volume, part, pageNumber, onOpenDetail }: ParagraphCardProps) {
  const { t } = useTranslation()

  return (
    <article className={styles.root}>
      <header className={styles.header}>
        <span className={styles.location}>{volume} · {part} · p.&nbsp;{pageNumber}</span>
        <button
          type="button"
          className={styles.detailButton}
          onClick={() => onOpenDetail({ paragraphId, text, startOffset, endOffset, volume, part, pageNumber })}
        >
          {t('paragraphCard.openDetailButton')}
        </button>
      </header>
      <QuoteSelection paragraphId={paragraphId} text={text} highlightRange={{ start: startOffset, end: endOffset }} />
    </article>
  )
}
