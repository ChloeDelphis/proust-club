import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { addTagToQuote, removeTagFromQuote } from '../../../api/quote'
import { useTags } from '../../../hooks/useTags'
import { useToast } from '../../../components/Toast/useToast'
import Spinner from '../../../components/Spinner/Spinner'
import type { QuoteTagEditorProps } from './QuoteTagEditor.types'
import styles from './QuoteTagEditor.module.css'

// Live editing, unlike TagPickerPopup: every add/remove hits the API immediately (no "Terminer"
// step to collect a batch) — this quote already exists server-side, so there's nothing to defer
// until a later creation call.
export default function QuoteTagEditor({ quoteId, tags }: QuoteTagEditorProps) {
  const queryClient = useQueryClient()
  const showToast = useToast()
  const { data: allTags, isPending } = useTags()
  const [search, setSearch] = useState('')

  const addMutation = useMutation({
    mutationFn: (name: string) => addTagToQuote(quoteId, { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] })
      setSearch('')
    },
    onError: () => {
      showToast("Le tag n'a pas pu être ajouté.")
    },
  })

  const removeMutation = useMutation({
    mutationFn: (tagId: number) => removeTagFromQuote(quoteId, tagId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] })
    },
    onError: () => {
      showToast("Le tag n'a pas pu être retiré.")
    },
  })

  const attachedNames = new Set(tags.map(tag => tag.name.toLowerCase()))
  const tagList = allTags ?? []
  const normalizedSearch = search.trim().toLowerCase()
  const candidateTags = tagList.filter(
    tag => !attachedNames.has(tag.name.toLowerCase()) && tag.name.toLowerCase().includes(normalizedSearch),
  )
  const exactMatchExists = tagList.some(tag => tag.name.toLowerCase() === normalizedSearch)
  const canCreate = normalizedSearch.length > 0 && !exactMatchExists

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
                aria-label={`Retirer ${tag.name}`}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <input
        type="text"
        value={search}
        onChange={event => setSearch(event.target.value)}
        placeholder="Ajouter un tag..."
        className={styles.searchInput}
        aria-label="Ajouter un tag"
      />

      {isPending ? (
        <Spinner />
      ) : (
        candidateTags.length > 0 && (
          <ul className={styles.suggestions}>
            {candidateTags.map(tag => (
              <li key={tag.id}>
                <button type="button" onClick={() => addMutation.mutate(tag.name)}>
                  {tag.name}
                </button>
              </li>
            ))}
          </ul>
        )
      )}

      {canCreate && (
        <button type="button" className={styles.createButton} onClick={() => addMutation.mutate(search.trim())}>
          Créer « {search.trim()} »
        </button>
      )}
    </div>
  )
}
