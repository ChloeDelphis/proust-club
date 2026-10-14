import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useTags } from '../../../hooks/useTags'
import { useTagSearch } from '../../../hooks/useTagSearch'
import { MAX_TAGS_PER_QUOTE } from '../../../api/quote'
import { MAX_TAG_NAME_LENGTH } from '../../../api/tag'
import Spinner from '../../../components/Spinner/Spinner'
import ErrorMessage from '../../../components/ErrorMessage/ErrorMessage'
import type { TagPickerContentProps } from './TagPickerContent.types'
import styles from './TagPickerContent.module.css'

// The tag search/select/create UI, with no opinion on how it's framed (own Dialog vs. embedded
// inline in another layout) — TagPickerPopup wraps this in its own Dialog for the QuoteSelection
// flow; a two-column detail modal's side panel embeds it directly instead.
export default function TagPickerContent({ onSave, isSaving }: TagPickerContentProps) {
  const { t } = useTranslation()
  const { data: tags, isPending, isError } = useTags()
  const [search, setSearch] = useState('')
  const [selectedNames, setSelectedNames] = useState<Set<string>>(new Set())
  const tagLimitReached = selectedNames.size >= MAX_TAGS_PER_QUOTE

  const { matches: filteredTags, canCreate } = useTagSearch(tags ?? [], search)

  function toggleTag(name: string) {
    setSelectedNames(current => {
      const next = new Set(current)
      if (next.has(name)) next.delete(name)
      else if (next.size < MAX_TAGS_PER_QUOTE) next.add(name)
      return next
    })
  }

  function createFromSearch() {
    const name = search.trim()
    setSelectedNames(current => {
      if (current.size >= MAX_TAGS_PER_QUOTE) return current
      return new Set(current).add(name)
    })
    setSearch('')
  }

  return (
    <>
      {selectedNames.size > 0 && (
        <ul className={styles.selectedList}>
          {Array.from(selectedNames).map(name => (
            <li key={name} className={styles.selectedChip}>
              {name}
              <button type="button" onClick={() => toggleTag(name)} aria-label={t('tagPicker.removeTag', { name })}>
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
        placeholder={t('tagPicker.searchPlaceholder')}
        className={styles.searchInput}
        aria-label={t('tagPicker.searchAriaLabel')}
        maxLength={MAX_TAG_NAME_LENGTH}
      />

      {isPending ? (
        <Spinner />
      ) : (
        <>
          {isError && <ErrorMessage message={t('common.genericError')} />}
          <ul className={styles.tagList}>
            {filteredTags.map(tag => (
              <li key={tag.id}>
                <label className={styles.tagOption}>
                  <input
                    type="checkbox"
                    checked={selectedNames.has(tag.name)}
                    disabled={!selectedNames.has(tag.name) && tagLimitReached}
                    onChange={() => toggleTag(tag.name)}
                  />
                  {tag.name}
                </label>
              </li>
            ))}
          </ul>
        </>
      )}

      {canCreate && (
        <button type="button" className={styles.createButton} disabled={tagLimitReached} onClick={createFromSearch}>
          {t('tagPicker.createButton', { name: search.trim() })}
        </button>
      )}

      <button
        type="button"
        className={styles.saveButton}
        disabled={isSaving}
        onClick={() => onSave(Array.from(selectedNames))}
      >
        {t('tagPicker.saveButton')}
      </button>
    </>
  )
}
