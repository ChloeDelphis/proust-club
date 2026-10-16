import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { listQuotes } from '../../api/quote'
import { SEARCH_PAGE_SIZE } from './searchConstants'

type SavedQuotesQueryParams = {
  tagId: string | null
  query: string
  volumeId: number | null
  page: number
  enabled: boolean
}

export function useSavedQuotesQuery({ tagId, query, volumeId, page, enabled }: SavedQuotesQueryParams) {
  return useQuery({
    queryKey: ['quotes', tagId, query, volumeId, page],
    queryFn: async ({ signal }) => {
      const params = {
        tagId: tagId ?? undefined,
        q: query || undefined,
        volumeId: volumeId ?? undefined,
        page,
        size: SEARCH_PAGE_SIZE,
      }
      const response = await listQuotes(params, signal)
      const lastPage = Math.max(0, Math.ceil(response.total / response.size) - 1)
      if (response.total > 0 && page > lastPage) {
        return listQuotes({ ...params, page: lastPage }, signal)
      }
      return response
    },
    enabled,
    placeholderData: keepPreviousData,
  })
}
