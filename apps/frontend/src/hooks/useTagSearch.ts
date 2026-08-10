import type { TagResponse } from '../api/tag'

interface UseTagSearchResult {
  matches: TagResponse[]
  canCreate: boolean
}

// Shared by TagPickerPopup (batch tag selection before a quote exists) and QuoteTagEditor (live
// tag editing on an existing quote) — both search an existing tag list and offer to create one
// that doesn't match. `exclude` lets a caller hide tags it already shows elsewhere (QuoteTagEditor
// excludes already-attached tags from the suggestion list).
export function useTagSearch(tags: TagResponse[], search: string, exclude?: (tag: TagResponse) => boolean): UseTagSearchResult {
  const normalizedSearch = search.trim().toLowerCase()
  const matches = tags.filter(
    tag => (!exclude || !exclude(tag)) && tag.name.toLowerCase().includes(normalizedSearch),
  )
  const exactMatchExists = tags.some(tag => tag.name.toLowerCase() === normalizedSearch)
  const canCreate = normalizedSearch.length > 0 && !exactMatchExists

  return { matches, canCreate }
}
