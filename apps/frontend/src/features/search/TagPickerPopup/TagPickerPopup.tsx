import { useState } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import { useTags } from '../../../hooks/useTags'
import { useTagSearch } from '../../../hooks/useTagSearch'
import Spinner from '../../../components/Spinner/Spinner'
import type { TagPickerPopupProps } from './TagPickerPopup.types'
import styles from './TagPickerPopup.module.css'

export default function TagPickerPopup({ onSave, onCancel, isSaving }: TagPickerPopupProps) {
  const { data: tags, isPending } = useTags()
  const [search, setSearch] = useState('')
  const [selectedNames, setSelectedNames] = useState<Set<string>>(new Set())

  const { matches: filteredTags, canCreate } = useTagSearch(tags ?? [], search)

  function toggleTag(name: string) {
    setSelectedNames(current => {
      const next = new Set(current)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  function createFromSearch() {
    const name = search.trim()
    setSelectedNames(current => new Set(current).add(name))
    setSearch('')
  }

  return (
    // While a save is in flight, every dismiss path (Escape, backdrop, ×) is ignored rather than
    // routed to onCancel: the request has already been sent and can't actually be aborted, so
    // "cancelling" here would only desync the UI from a save that's still going to complete —
    // resetting to idle now, then having the response arrive afterwards, either saves a citation
    // the user believes they cancelled (on success) or resurrects the "Sauvegarder" menu out of
    // nowhere for a selection the user already dismissed (on error).
    <Dialog.Root open onOpenChange={open => { if (!open && !isSaving) onCancel() }}>
      <Dialog.Portal>
        <Dialog.Backdrop className={styles.backdrop} data-testid="tag-picker-backdrop" />
        <Dialog.Popup className={styles.popup} aria-label="Choisir des tags">
          <Dialog.Close className={styles.closeButton} aria-label="Fermer" disabled={isSaving}>×</Dialog.Close>

          {selectedNames.size > 0 && (
            <ul className={styles.selectedList}>
              {Array.from(selectedNames).map(name => (
                <li key={name} className={styles.selectedChip}>
                  {name}
                  <button type="button" onClick={() => toggleTag(name)} aria-label={`Retirer ${name}`}>
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
            className={styles.saveButton}
            disabled={isSaving}
            onClick={() => onSave(Array.from(selectedNames))}
          >
            Enregistrer
          </button>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
