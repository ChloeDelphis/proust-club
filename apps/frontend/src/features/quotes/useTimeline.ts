import { useQuery } from '@tanstack/react-query'
import { getQuoteTimeline } from '../../api/quote'

// Shared by TimelineBar and VolumeList — same queryKey/queryFn, so TanStack Query dedupes the two
// calls into a single request rather than fetching the timeline twice. Extracted here rather than
// left duplicated in both components, so the query shape only has to change in one place.
export function useTimeline(activeTagId: string | null) {
  return useQuery({
    queryKey: ['quotes', 'timeline', activeTagId],
    queryFn: ({ signal }) => getQuoteTimeline({ tagId: activeTagId ?? undefined }, signal),
    staleTime: 60_000,
  })
}
