import { useCreateQuoteMutation } from '../useCreateQuoteMutation'
import { useTranslation } from 'react-i18next'
import { useToast } from '../../../components/Toast/useToast'
import { useCurrentUser } from '../../auth/useCurrentUser'
import DetailModal from '../../../components/DetailModal/DetailModal'
import TagPickerContent from '../TagPickerPopup/TagPickerContent'
import { buildHighlightSegments } from '../paragraphSegments'
import type { SearchResultDetailModalProps } from './SearchResultDetailModal.types'
import styles from './SearchResultDetailModal.module.css'

// The not-yet-saved counterpart to QuoteDetailModal: same two-column layout and progressive
// context, but the side panel is the tag picker + "Enregistrer" (reusing TagPickerContent)
// instead of an existing quote's comment/tags/delete. Reading context is public corpus data, so
// the modal itself opens for anyone — only the save UI in the side panel needs a session, same
// as the "Sauvegarder" contextual menu in QuoteSelection.
export default function SearchResultDetailModal({ hit, onClose }: SearchResultDetailModalProps) {
  const { t } = useTranslation()
  const { data: currentUser } = useCurrentUser()
  const isConnected = currentUser !== null && currentUser !== undefined
  const showToast = useToast()
  const createQuoteMutation = useCreateQuoteMutation()

  function handleSave(tagNames: string[]) {
    if (!hit) return
    createQuoteMutation.mutate(
      {
        paragraphId: hit.paragraphId,
        startOffset: hit.startOffset,
        endOffset: hit.endOffset,
        selectedText: hit.text.slice(hit.startOffset, hit.endOffset),
        tagNames,
      },
      {
        onSuccess: () => {
          showToast(t('quoteSelection.savedToast'))
          onClose()
        },
        onError: () => {
          showToast(t('quoteSelection.saveErrorToast'))
        },
      },
    )
  }

  const segments = hit ? buildHighlightSegments(hit.text, { start: hit.startOffset, end: hit.endOffset }) : []

  return (
    <DetailModal
      paragraphId={hit?.paragraphId ?? null}
      ariaLabel={t('searchResultDetailModal.ariaLabel')}
      closeDisabled={createQuoteMutation.isPending}
      // A save already in flight can't be aborted — same reasoning as TagPickerPopup's own guard,
      // see that component for the full explanation.
      onOpenChange={open => { if (!open && !createQuoteMutation.isPending) onClose() }}
      centerContent={hit && (
        <p className={styles.text}>
          {segments.map((segment, index) =>
            segment.highlighted ? (
              <mark key={index} className={styles.mark}>{segment.text}</mark>
            ) : (
              <span key={index}>{segment.text}</span>
            ),
          )}
        </p>
      )}
      sideContent={hit && (
        <>
          <p className={styles.meta}>
            {t('searchPage.resultLocation', { volume: hit.volume, part: hit.part, page: hit.pageNumber })}
          </p>
          {isConnected && <TagPickerContent onSave={handleSave} isSaving={createQuoteMutation.isPending} />}
        </>
      )}
    />
  )
}
