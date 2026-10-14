import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ApiError } from '../../../api/client'
import { addTagToQuote, MAX_TAGS_PER_QUOTE, removeTagFromQuote } from '../../../api/quote'
import { useTags } from '../../../hooks/useTags'
import { useTagSearch } from '../../../hooks/useTagSearch'
import { useToast } from '../../../components/Toast/useToast'
import Spinner from '../../../components/Spinner/Spinner'
import type { QuoteTagEditorProps } from './QuoteTagEditor.types'
import styles from './QuoteTagEditor.module.css'

// Live editing, unlike TagPickerPopup: every add/remove hits the API immediately (no "Terminer"
// step to collect a batch) — this quote already exists server-side, so there's nothing to defer
// until a later creation call.
export default function QuoteTagEditor({ quoteId, tags }: QuoteTagEditorProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const showToast = useToast()
  const { data: allTags, isPending } = useTags()
  const [search, setSearch] = useState('')

  const addMutation = useMutation({
    mutationFn: (name: string) => addTagToQuote(quoteId, { name }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['quotes'] })
      void queryClient.invalidateQueries({ queryKey: ['tags'] })
      setSearch('')
    },
    onError: error => {
      if (error instanceof ApiError && error.status === 409) {
        queryClient.invalidateQueries({ queryKey: ['quotes'] })
        showToast(t('tagPicker.maxTagsReached', { max: MAX_TAGS_PER_QUOTE }))
        return
      }
      showToast(t('quoteTagEditor.addErrorToast'))
    },
  })

  const removeMutation = useMutation({
    mutationFn: (tagId: string) => removeTagFromQuote(quoteId, tagId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] })
    },
    onError: () => {
      showToast(t('quoteTagEditor.removeErrorToast'))
    },
  })

  const attachedNames = new Set(tags.map(tag => tag.name.toLowerCase()))
  const tagLimitReached = tags.length >= MAX_TAGS_PER_QUOTE
  const { matches: candidateTags, canCreate } = useTagSearch(
    allTags ?? [],
    search,
    tag => attachedNames.has(tag.name.toLowerCase()),
  )

  return (
    <div className={styles.root}>
      {tags.length > 0 && (
        <ul className={styles.tags}>
          {tags.map(tag => (
            <li key={tag.id} className={styles.tag}>
              {tag.name}
              <button
                type="button"
                className={styles.removeButton}
                onClick={() => removeMutation.mutate(tag.id)}
                aria-label={t('tagPicker.removeTag', { name: tag.name })}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      {tagLimitReached && (
        <p className={styles.limitMessage} role="status" aria-live="polite">
          {t('tagPicker.maxTagsReached', { max: MAX_TAGS_PER_QUOTE })}
        </p>
      )}

      <input
        type="text"
        value={search}
        onChange={event => setSearch(event.target.value)}
        placeholder={t('quoteTagEditor.addPlaceholder')}
        className={styles.searchInput}
        aria-label={t('quoteTagEditor.addAriaLabel')}
        disabled={tagLimitReached || addMutation.isPending}
      />

      {isPending ? (
        <Spinner />
      ) : (
        candidateTags.length > 0 && (
          <ul className={styles.suggestions}>
            {candidateTags.map(tag => (
              <li key={tag.id}>
                <button type="button" disabled={tagLimitReached || addMutation.isPending} onClick={() => addMutation.mutate(tag.name)}>
                  {tag.name}
                </button>
              </li>
            ))}
          </ul>
        )
      )}

      {canCreate && (
        <button type="button" className={styles.createButton} disabled={tagLimitReached || addMutation.isPending} onClick={() => addMutation.mutate(search.trim())}>
          {t('tagPicker.createButton', { name: search.trim() })}
        </button>
      )}
    </div>
  )
}
