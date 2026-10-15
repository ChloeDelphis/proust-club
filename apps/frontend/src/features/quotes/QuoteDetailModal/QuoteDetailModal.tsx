import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { updateQuoteComment } from '../../../api/quote'
import { useToast } from '../../../components/Toast/useToast'
import DetailModal from '../../../components/DetailModal/DetailModal'
import QuoteTagEditor from '../QuoteTagEditor/QuoteTagEditor'
import type { QuoteDetailModalProps } from './QuoteDetailModal.types'
import styles from './QuoteDetailModal.module.css'

const dateFormatter = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
const COMMENT_MAX_LENGTH = 2000

export default function QuoteDetailModal({ quote, volumeTitle, onTagsChange, onClose }: QuoteDetailModalProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const showToast = useToast()

  // Resets the draft when a different quote opens, without a useEffect: this component stays
  // mounted across quote changes (only DetailModal's `paragraphId` prop toggles), so a plain
  // useState initializer would only apply on this component's own first mount, not on every
  // reopen. renderedQuoteId is reset to null on close (not just changed on a new id) so that
  // reopening the SAME quote also re-syncs the draft from the current `quote.comment` —
  // otherwise the leftover local draft from before closing would stick around instead of the
  // saved value.
  const [renderedQuoteId, setRenderedQuoteId] = useState<string | null>(null)
  const [commentDraft, setCommentDraft] = useState('')
  if (quote && quote.id !== renderedQuoteId) {
    setRenderedQuoteId(quote.id)
    setCommentDraft(quote.comment ?? '')
  } else if (!quote && renderedQuoteId !== null) {
    setRenderedQuoteId(null)
  }

  const updateCommentMutation = useMutation({
    mutationFn: ({ quoteId, comment }: { quoteId: string; comment: string }) => updateQuoteComment(quoteId, { comment }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['quotes'] })
    },
    onError: () => {
      showToast(t('quoteDetailModal.commentSaveErrorToast'))
    },
  })

  // Saved on close (cross/backdrop/Escape all route through this one onOpenChange), not on
  // textarea blur — closing is the natural "done editing" signal for a modal, unlike inline
  // editing outside one (see TagFilterBar's blur-commit pattern, which doesn't apply here).
  function handleClose() {
    if (updateCommentMutation.isPending) return
    if (quote) {
      const trimmed = commentDraft.trim()
      if (trimmed !== (quote.comment ?? '')) {
        updateCommentMutation.mutate(
          { quoteId: quote.id, comment: trimmed },
          { onSuccess: onClose },
        )
        return
      }
    }
    onClose()
  }

  return (
    <DetailModal
      paragraphId={quote?.paragraphId ?? null}
      ariaLabel={t('quoteDetailModal.ariaLabel')}
      onOpenChange={open => { if (!open) handleClose() }}
      closeDisabled={updateCommentMutation.isPending}
      centerContent={quote && <p className={styles.text}>{quote.selectedText}</p>}
      sideContent={quote && (
        <>
          <textarea
            className={styles.comment}
            value={commentDraft}
            onChange={event => setCommentDraft(event.target.value)}
            maxLength={COMMENT_MAX_LENGTH}
            placeholder={t('quoteDetailModal.commentPlaceholder')}
            aria-label={t('quoteDetailModal.commentAriaLabel')}
          />

          <QuoteTagEditor quoteId={quote.id} tags={quote.tags} onTagsChange={onTagsChange} />

          <p className={styles.meta}>
            {quote.pageNumber !== undefined
              ? t('quoteDetailModal.meta', {
                  volumePrefix: volumeTitle ? `${volumeTitle} — ` : '',
                  page: quote.pageNumber,
                  date: dateFormatter.format(new Date(quote.createdAt)),
                })
              : dateFormatter.format(new Date(quote.createdAt))}
          </p>
        </>
      )}
    />
  )
}
