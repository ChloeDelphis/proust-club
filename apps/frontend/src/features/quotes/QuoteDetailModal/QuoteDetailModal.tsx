import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Dialog } from '@base-ui/react/dialog'
import { updateQuoteComment } from '../../../api/quote'
import { useToast } from '../../../components/Toast/useToast'
import QuoteTagEditor from '../QuoteTagEditor/QuoteTagEditor'
import type { QuoteDetailModalProps } from './QuoteDetailModal.types'
import styles from './QuoteDetailModal.module.css'

const dateFormatter = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
const COMMENT_MAX_LENGTH = 2000

export default function QuoteDetailModal({ quote, volumeTitle, onClose }: QuoteDetailModalProps) {
  const queryClient = useQueryClient()
  const showToast = useToast()

  // Resets the draft when a different quote opens, without a useEffect: this component stays
  // mounted across quote changes (only the Dialog's `open` prop toggles), so a plain useState
  // initializer would only apply on this component's own first mount, not on every reopen.
  const [renderedQuoteId, setRenderedQuoteId] = useState<number | null>(null)
  const [commentDraft, setCommentDraft] = useState('')
  if (quote && quote.id !== renderedQuoteId) {
    setRenderedQuoteId(quote.id)
    setCommentDraft(quote.comment ?? '')
  }

  const updateCommentMutation = useMutation({
    mutationFn: ({ quoteId, comment }: { quoteId: number; comment: string }) => updateQuoteComment(quoteId, { comment }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] })
    },
    onError: () => {
      showToast("Le commentaire n'a pas pu être enregistré.")
    },
  })

  // Saved on close (cross/backdrop/Escape all route through this one Dialog.onOpenChange), not
  // on textarea blur — closing is the natural "done editing" signal for a modal, unlike inline
  // editing outside one (see TagFilterBar's blur-commit pattern, which doesn't apply here).
  function handleClose() {
    if (quote) {
      const trimmed = commentDraft.trim()
      if (trimmed !== (quote.comment ?? '')) {
        updateCommentMutation.mutate({ quoteId: quote.id, comment: trimmed })
      }
    }
    onClose()
  }

  return (
    <Dialog.Root open={quote !== null} onOpenChange={open => { if (!open) handleClose() }}>
      <Dialog.Portal>
        <Dialog.Backdrop className={styles.backdrop} />
        <Dialog.Popup className={styles.popup} aria-label="Citation">
          <Dialog.Close className={styles.closeButton} aria-label="Fermer">×</Dialog.Close>
          {quote && (
            <>
              <p className={styles.text}>{quote.selectedText}</p>

              <textarea
                className={styles.comment}
                value={commentDraft}
                onChange={event => setCommentDraft(event.target.value)}
                maxLength={COMMENT_MAX_LENGTH}
                placeholder="Ajouter un commentaire personnel..."
                aria-label="Commentaire personnel"
              />

              <QuoteTagEditor quoteId={quote.id} tags={quote.tags} />

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
