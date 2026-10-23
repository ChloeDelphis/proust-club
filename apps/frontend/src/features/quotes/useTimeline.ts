import { useQuery } from '@tanstack/react-query'
import { getQuoteTimeline } from '../../api/quote'

// Personal bookmark data for the connected user's timeline. Structural volume metadata is loaded
// separately through useVolumes, so anonymous browsing never requests this personal endpoint.
export function useTimeline(activeTagId: string | null, enabled = true) {
  return useQuery({
    queryKey: ['quotes', 'timeline', activeTagId],
    queryFn: ({ signal }) => getQuoteTimeline({ tagId: activeTagId ?? undefined }, signal),
    staleTime: 60_000,
    enabled,
  })
}
