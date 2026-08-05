import { useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { listTags } from '../../../api/tag'
import { useClickOutside } from '../../../hooks/useClickOutside'
import Spinner from '../../../components/Spinner/Spinner'
import type { TagPickerPopupProps } from './TagPickerPopup.types'
import styles from './TagPickerPopup.module.css'

export default function TagPickerPopup({ onFinish, onDismiss }: TagPickerPopupProps) {
  const popupRef = useRef<HTMLDivElement>(null)
  useClickOutside(popupRef, onDismiss)

  const { data: tags, isPending } = useQuery({
    queryKey: ['tags'],
    queryFn: ({ signal }) => listTags(signal),
  })
  const [search, setSearch] = useState('')
  const [selectedNames, setSelectedNames] = useState<Set<string>>(new Set())

  const normalizedSearch = search.trim().toLowerCase()
  const filteredTags = (tags ?? []).filter(tag => tag.name.toLowerCase().includes(normalizedSearch))
  const exactMatchExists = (tags ?? []).some(tag => tag.name.toLowerCase() === normalizedSearch)
  const canCreate = normalizedSearch.length > 0 && !exactMatchExists

  function toggleTag(name: string) {
    setSelectedNames(current => {
      const next = new Set(current)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  function removeSelected(name: string) {
    setSelectedNames(current => {
      const next = new Set(current)
      next.delete(name)
      return next
    })
  }

  function createFromSearch() {
    const name = search.trim()
    setSelectedNames(current => new Set(current).add(name))
    setSearch('')
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.root} ref={popupRef} role="dialog" aria-label="Choisir des tags">
        <button type="button" className={styles.closeButton} onClick={onDismiss} aria-label="Fermer">
          ×
        </button>

        {selectedNames.size > 0 && (
          <ul className={styles.selectedList}>
            {Array.from(selectedNames).map(name => (
              <li key={name} className={styles.selectedChip}>
                {name}
                <button type="button" onClick={() => removeSelected(name)} aria-label={`Retirer ${name}`}>
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
          placeholder="Chercher un tag..."
          className={styles.searchInput}
          aria-label="Chercher un tag"
        />

        {isPending ? (
          <Spinner />
        ) : (
          <ul className={styles.tagList}>
            {filteredTags.map(tag => (
              <li key={tag.id}>
                <label className={styles.tagOption}>
                  <input type="checkbox" checked={selectedNames.has(tag.name)} onChange={() => toggleTag(tag.name)} />
                  {tag.name}
                </label>
              </li>
            ))}
          </ul>
        )}

        {canCreate && (
          <button type="button" className={styles.createButton} onClick={createFromSearch}>
            Créer « {search.trim()} »
          </button>
        )}

        <button
          type="button"
          className={styles.finishButton}
          onClick={() => onFinish(Array.from(selectedNames))}
        >
          Terminer
        </button>
      </div>
    </div>
  )
}
