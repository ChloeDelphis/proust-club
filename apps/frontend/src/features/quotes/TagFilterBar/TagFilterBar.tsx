import { useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { deleteTag, renameTag } from '../../../api/tag'
import { ApiError } from '../../../api/client'
import { useTags } from '../../../hooks/useTags'
import { useToast } from '../../../components/Toast/useToast'
import FilterButton from '../../../components/FilterButton/FilterButton'
import type { TagFilterBarProps } from './TagFilterBar.types'
import styles from './TagFilterBar.module.css'

export default function TagFilterBar({ activeTagId, onSelectTag }: TagFilterBarProps) {
  const queryClient = useQueryClient()
  const showToast = useToast()
  const { data: tags } = useTags()

  const [editingTagId, setEditingTagId] = useState<number | null>(null)
  const [editingValue, setEditingValue] = useState('')
  // Enter/Escape both resolve the edit before the input's blur handler also fires —
  // this flag lets that following blur be ignored instead of double-committing.
  const suppressNextBlurRef = useRef(false)

  const renameMutation = useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) => renameTag(id, { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] })
      queryClient.invalidateQueries({ queryKey: ['quotes'] })
      setEditingTagId(null)
    },
    onError: error => {
      showToast(
        error instanceof ApiError && error.status === 409
          ? 'Ce nom de tag est déjà utilisé.'
          : "Le tag n'a pas pu être renommé.",
      )
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteTag(id),
    onSuccess: (_result, id) => {
      const wasActiveFilter = activeTagId === id
      queryClient.invalidateQueries({ queryKey: ['tags'] })
      // If this tag was the active filter, onSelectTag(null) below already triggers a fresh
      // fetch under the new query key — refetching the about-to-be-abandoned key too would
      // just be a wasted request. Other cached quote pages are still marked stale either way.
      queryClient.invalidateQueries({ queryKey: ['quotes'], refetchType: wasActiveFilter ? 'none' : 'active' })
      if (wasActiveFilter) onSelectTag(null)
    },
    onError: () => {
      showToast("Le tag n'a pas pu être supprimé.")
    },
  })

  function startEditing(id: number, currentName: string) {
    suppressNextBlurRef.current = false
    setEditingTagId(id)
    setEditingValue(currentName)
  }

  function commitEditing(id: number) {
    const name = editingValue.trim()
    if (!name) {
      setEditingTagId(null)
      return
    }
    renameMutation.mutate({ id, name })
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>, id: number) {
    if (event.key === 'Enter') {
      suppressNextBlurRef.current = true
      commitEditing(id)
    } else if (event.key === 'Escape') {
      suppressNextBlurRef.current = true
      setEditingTagId(null)
    }
  }

  function handleBlur(id: number) {
    if (suppressNextBlurRef.current) {
      suppressNextBlurRef.current = false
      return
    }
    commitEditing(id)
  }

  function handleDelete(id: number) {
    if (!window.confirm('Supprimer ce tag ?')) return
    deleteMutation.mutate(id)
  }

  const tagList = tags ?? []
  if (tagList.length === 0) return null

  return (
    <nav className={styles.root} aria-label="Filtrer par tag">
      <FilterButton active={activeTagId === null} onClick={() => onSelectTag(null)}>
        Tous
      </FilterButton>
      <ul className={styles.list}>
        {tagList.map(tag => (
          <li key={tag.id} className={styles.item}>
            {editingTagId === tag.id ? (
              <input
                type="text"
                className={styles.editInput}
                value={editingValue}
                autoFocus
                aria-label={`Renommer ${tag.name}`}
                onChange={event => setEditingValue(event.target.value)}
                onBlur={() => handleBlur(tag.id)}
                onKeyDown={event => handleKeyDown(event, tag.id)}
              />
            ) : (
              <>
                <FilterButton active={activeTagId === tag.id} onClick={() => onSelectTag(tag.id)}>
                  {tag.name}
                </FilterButton>
                <button
                  type="button"
                  className={styles.iconButton}
                  onClick={() => startEditing(tag.id, tag.name)}
                  aria-label={`Renommer ${tag.name}`}
                >
                  ✎
                </button>
                <button
                  type="button"
                  className={styles.iconButton}
                  onClick={() => handleDelete(tag.id)}
                  aria-label={`Supprimer ${tag.name}`}
                >
                  ×
                </button>
              </>
            )}
          </li>
        ))}
      </ul>
    </nav>
  )
}
