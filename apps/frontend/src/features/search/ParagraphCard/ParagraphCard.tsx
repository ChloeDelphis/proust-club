import { useTranslation } from 'react-i18next'
import type { SearchHit } from '../../../api/search'
import QuoteSelection from '../QuoteSelection/QuoteSelection'
import { createSearchExcerpt } from '../createSearchExcerpt'
import styles from './ParagraphCard.module.css'
import type { GuestQuoteSaveDraft } from '../guestQuoteSaveContext'

interface ParagraphCardProps {
  hit: SearchHit
  onOpenDetail: (hit: SearchHit) => void
  resumeDraft?: GuestQuoteSaveDraft | null
  searchContext?: Pick<GuestQuoteSaveDraft, 'query' | 'page' | 'volumeId'>
}

// The excerpt opens details on click, while an active native selection remains reserved for
// QuoteSelection's "Sauvegarder" flow.
export default function ParagraphCard({ hit, onOpenDetail, resumeDraft = null, searchContext = { query: '', page: 0, volumeId: null } }: ParagraphCardProps) {
  const { t } = useTranslation()
  const { paragraphId, text, startOffset, endOffset, volume, part, pageNumber } = hit
  const excerpt = createSearchExcerpt(text, { start: startOffset, end: endOffset })
  const excerptText = text.slice(excerpt.start, excerpt.end)

  return (
    <article className={styles.root}>
      <header className={styles.header}>
        <span className={styles.location}>
          {t('searchPage.resultLocation', { volume, part, page: pageNumber })}
        </span>
      </header>
      <QuoteSelection
        paragraphId={paragraphId}
        text={excerptText}
        highlightRange={{ start: startOffset - excerpt.start, end: endOffset - excerpt.start }}
        sourceOffset={excerpt.start}
        hasLeadingEllipsis={excerpt.hasLeadingEllipsis}
        hasTrailingEllipsis={excerpt.hasTrailingEllipsis}
        onOpenDetail={() => onOpenDetail(hit)}
        resumeDraft={resumeDraft}
        searchContext={searchContext}
      />
    </article>
  )
}
