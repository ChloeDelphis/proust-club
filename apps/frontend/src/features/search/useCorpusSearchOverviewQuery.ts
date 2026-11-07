import { useQuery } from '@tanstack/react-query'
import { getSearchOverview } from '../../api/search'

export function useCorpusSearchOverviewQuery(query: string, enabled: boolean) {
  return useQuery({
    queryKey: ['search', 'overview', query],
    queryFn: ({ signal }) => getSearchOverview({ q: query }, signal),
    enabled,
    staleTime: 60_000,
  })
}
