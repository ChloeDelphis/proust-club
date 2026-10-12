import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Dialog } from '@base-ui/react/dialog'
import { useParagraphContext } from '../../hooks/useParagraphContext'
import type { DetailModalProps } from './DetailModal.types'
import styles from './DetailModal.module.css'

export default function DetailModal({ paragraphId, centerContent, sideContent, ariaLabel, onOpenChange }: DetailModalProps) {
  const { t } = useTranslation()

  // Resets the context window when a different paragraph opens, without a useEffect — same
  // reasoning as QuoteDetailModal's renderedQuoteId: this component can stay mounted across
  // openings, so a plain useState initializer would only apply on first mount.
  const [renderedParagraphId, setRenderedParagraphId] = useState<number | null>(null)
  const [before, setBefore] = useState(0)
  const [after, setAfter] = useState(0)
  if (paragraphId !== null && paragraphId !== renderedParagraphId) {
    setRenderedParagraphId(paragraphId)
    setBefore(0)
    setAfter(0)
  } else if (paragraphId === null && renderedParagraphId !== null) {
    setRenderedParagraphId(null)
  }

  const { data, isPending } = useParagraphContext(paragraphId, before, after)

  return (
    <Dialog.Root open={paragraphId !== null} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className={styles.backdrop} />
        <Dialog.Popup className={styles.popup} aria-label={ariaLabel}>
          <Dialog.Close className={styles.closeButton} aria-label={t('tagPicker.close')}>×</Dialog.Close>

          {paragraphId !== null && (
            <div className={styles.layout}>
              <div className={styles.main}>
                <button
                  type="button"
                  className={styles.contextArrow}
                  disabled={isPending || !data?.hasMoreBefore}
                  onClick={() => setBefore(count => count + 1)}
                  aria-label={t('detailModal.showMoreBefore')}
                >
                  ▲
                </button>

                {data?.before.map(entry => (
                  <p key={entry.paragraphId} className={styles.contextParagraph}>{entry.text}</p>
                ))}

                <div className={styles.center}>{centerContent}</div>

                {data?.after.map(entry => (
                  <p key={entry.paragraphId} className={styles.contextParagraph}>{entry.text}</p>
                ))}

                <button
                  type="button"
                  className={styles.contextArrow}
                  disabled={isPending || !data?.hasMoreAfter}
                  onClick={() => setAfter(count => count + 1)}
                  aria-label={t('detailModal.showMoreAfter')}
                >
                  ▼
                </button>
              </div>

              <aside className={styles.side}>{sideContent}</aside>
            </div>
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
