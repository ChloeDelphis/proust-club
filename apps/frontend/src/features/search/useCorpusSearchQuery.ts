import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { searchParagraphs } from '../../api/search'
import { SEARCH_PAGE_SIZE } from './searchConstants'

type CorpusSearchQueryParams = {
  query: string
  volumeId: number | null
  partId: number | null
  page: number
  enabled: boolean
}

export function useCorpusSearchQuery({ query, volumeId, partId, page, enabled }: CorpusSearchQueryParams) {
  return useQuery({
    queryKey: ['search', query, volumeId, partId, page],
    queryFn: ({ signal }) => searchParagraphs({
      q: query,
      volumeId: volumeId ?? undefined,
      partId: partId ?? undefined,
      page,
      size: SEARCH_PAGE_SIZE,
    }, signal),
    enabled,
    placeholderData: keepPreviousData,
  })
}
