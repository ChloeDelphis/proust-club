import { Dialog } from '@base-ui/react/dialog'
import type { QuoteDetailModalProps } from './QuoteDetailModal.types'
import styles from './QuoteDetailModal.module.css'

const dateFormatter = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

// Read-only for this v1 — no delete/tag management here, that stays on the quote card in the
// list below. See private/tickets/timeline-modale-actions.md for the future want.
export default function QuoteDetailModal({ quote, volumeTitle, onClose }: QuoteDetailModalProps) {
  return (
    <Dialog.Root open={quote !== null} onOpenChange={open => { if (!open) onClose() }}>
      <Dialog.Portal>
        <Dialog.Backdrop className={styles.backdrop} />
        <Dialog.Popup className={styles.popup} aria-label="Citation">
          <Dialog.Close className={styles.closeButton} aria-label="Fermer">×</Dialog.Close>
          {quote && (
            <>
              <p className={styles.text}>{quote.selectedText}</p>
              {quote.tags.length > 0 && (
                <ul className={styles.tags}>
                  {quote.tags.map(tag => (
                    <li key={tag.id} className={styles.tag}>{tag.name}</li>
                  ))}
                </ul>
              )}
              <p className={styles.meta}>
                {volumeTitle && `${volumeTitle} — `}page {quote.pageNumber} · {dateFormatter.format(new Date(quote.createdAt))}
              </p>
            </>
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
