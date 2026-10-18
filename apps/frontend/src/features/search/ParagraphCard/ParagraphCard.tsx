import { useTranslation } from 'react-i18next'
import type { SearchHit } from '../../../api/search'
import QuoteSelection from '../QuoteSelection/QuoteSelection'
import styles from './ParagraphCard.module.css'
import type { GuestQuoteSaveDraft } from '../guestQuoteSaveContext'

interface ParagraphCardProps {
  hit: SearchHit
  onOpenDetail: (hit: SearchHit) => void
  resumeDraft?: GuestQuoteSaveDraft | null
  searchContext?: Pick<GuestQuoteSaveDraft, 'query' | 'page' | 'volumeId'>
}

// A separate header button, not a click on the paragraph text itself — the text is already a
// gesture target for native selection (QuoteSelection's "Sauvegarder" flow); overloading it with
// "open detail" too would conflict with that.
export default function ParagraphCard({ hit, onOpenDetail, resumeDraft = null, searchContext = { query: '', page: 0, volumeId: null } }: ParagraphCardProps) {
  const { t } = useTranslation()
  const { paragraphId, text, startOffset, endOffset, volume, part, pageNumber } = hit

  return (
    <article className={styles.root}>
      <header className={styles.header}>
        <span className={styles.location}>
          {t('searchPage.resultLocation', { volume, part, page: pageNumber })}
        </span>
        <button type="button" className={styles.detailButton} onClick={() => onOpenDetail(hit)}>
          {t('paragraphCard.openDetailButton')}
        </button>
      </header>
      <QuoteSelection
        paragraphId={paragraphId}
        text={text}
        highlightRange={{ start: startOffset, end: endOffset }}
        resumeDraft={resumeDraft}
        searchContext={searchContext}
      />
    </article>
  )
}
