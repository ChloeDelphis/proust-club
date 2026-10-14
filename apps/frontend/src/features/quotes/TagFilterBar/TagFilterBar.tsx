import { useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { deleteTag, MAX_TAG_NAME_LENGTH, renameTag } from '../../../api/tag'
import { ApiError } from '../../../api/client'
import { useTags } from '../../../hooks/useTags'
import { useToast } from '../../../components/Toast/useToast'
import FilterButton from '../../../components/FilterButton/FilterButton'
import ErrorMessage from '../../../components/ErrorMessage/ErrorMessage'
import Spinner from '../../../components/Spinner/Spinner'
import type { TagFilterBarProps } from './TagFilterBar.types'
import styles from './TagFilterBar.module.css'

export default function TagFilterBar({ scope, activeTagId, onSelectSavedScope, onSelectTag, onSelectCorpusScope }: TagFilterBarProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const showToast = useToast()
  const { data: tags, isPending: tagsPending, isError: tagsError } = useTags()

  const [editingTagId, setEditingTagId] = useState<string | null>(null)
  const [editingValue, setEditingValue] = useState('')
  // Enter/Escape both resolve the edit before the input's blur handler also fires —
  // this flag lets that following blur be ignored instead of double-committing.
  const suppressNextBlurRef = useRef(false)

  const renameMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => renameTag(id, { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] })
      queryClient.invalidateQueries({ queryKey: ['quotes'] })
      setEditingTagId(null)
    },
    onError: error => {
      showToast(
        error instanceof ApiError && error.status === 409
          ? t('tagFilterBar.duplicateNameError')
          : t('tagFilterBar.renameErrorToast'),
      )
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteTag(id),
    onSuccess: (_result, id) => {
      const wasActiveFilter = activeTagId === id
      queryClient.invalidateQueries({ queryKey: ['tags'] })
      // If this tag was the active filter, onSelectSavedScope() below already triggers a fresh
      // fetch under the new query key — refetching the about-to-be-abandoned key too would
      // just be a wasted request. Other cached quote pages are still marked stale either way.
      queryClient.invalidateQueries({ queryKey: ['quotes'], refetchType: wasActiveFilter ? 'none' : 'active' })
      // Falls back to "saved, no tag" rather than all the way to corpus scope — deleting the
      // active filter shouldn't also kick the user out of the citations view they were in.
      if (wasActiveFilter) onSelectSavedScope()
    },
    onError: () => {
      showToast(t('tagFilterBar.deleteErrorToast'))
    },
  })

  function startEditing(id: string, currentName: string) {
    suppressNextBlurRef.current = false
    setEditingTagId(id)
    setEditingValue(currentName)
  }

  function commitEditing(id: string) {
    const name = editingValue.trim()
    if (!name) {
      setEditingTagId(null)
      return
    }
    renameMutation.mutate({ id, name })
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>, id: string) {
    if (event.key === 'Enter') {
      suppressNextBlurRef.current = true
      commitEditing(id)
    } else if (event.key === 'Escape') {
      suppressNextBlurRef.current = true
      setEditingTagId(null)
    }
  }

  function handleBlur(id: string) {
    if (suppressNextBlurRef.current) {
      suppressNextBlurRef.current = false
      return
    }
    commitEditing(id)
  }

  function handleDelete(id: string) {
    if (!window.confirm(t('tagFilterBar.deleteConfirm'))) return
    deleteMutation.mutate(id)
  }

  // Shared by the "saved citations" entry (tagId null) and real tag entries — clicking the
  // already-active one toggles back to corpus scope, otherwise selects it.
  function handleEntryClick(tagId: string | null) {
    if (scope === 'saved' && activeTagId === tagId) {
      onSelectCorpusScope()
    } else if (tagId === null) {
      onSelectSavedScope()
    } else {
      onSelectTag(tagId)
    }
  }

  const tagList = tags ?? []

  return (
    <nav className={styles.root} aria-label={t('tagFilterBar.ariaLabel')}>
      {tagsPending && <Spinner />}
      {tagsError && <ErrorMessage message={t('common.genericError')} />}
      <FilterButton active={scope === 'saved' && activeTagId === null} onClick={() => handleEntryClick(null)}>
        {t('tagFilterBar.savedScopeFilter')}
      </FilterButton>
      {tagList.length > 0 && (
      <ul className={styles.list}>
        {tagList.map(tag => (
          <li key={tag.id} className={styles.item}>
            {editingTagId === tag.id ? (
              <input
                type="text"
                className={styles.editInput}
                value={editingValue}
                autoFocus
                aria-label={t('tagFilterBar.renameTag', { name: tag.name })}
                maxLength={MAX_TAG_NAME_LENGTH}
                onChange={event => setEditingValue(event.target.value)}
                onBlur={() => handleBlur(tag.id)}
                onKeyDown={event => handleKeyDown(event, tag.id)}
              />
            ) : (
              <>
                <FilterButton active={scope === 'saved' && activeTagId === tag.id} onClick={() => handleEntryClick(tag.id)}>
                  {tag.name}
                </FilterButton>
                <button
                  type="button"
                  className={styles.iconButton}
                  onClick={() => startEditing(tag.id, tag.name)}
                  aria-label={t('tagFilterBar.renameTag', { name: tag.name })}
                >
                  ✎
                </button>
                <button
                  type="button"
                  className={styles.iconButton}
                  onClick={() => handleDelete(tag.id)}
                  aria-label={t('tagFilterBar.deleteTag', { name: tag.name })}
                >
                  ×
                </button>
              </>
            )}
          </li>
        ))}
      </ul>
      )}
    </nav>
  )
}
