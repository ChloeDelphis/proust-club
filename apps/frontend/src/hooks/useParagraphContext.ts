import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { getParagraphContext } from '../api/paragraph'

// `before`/`after` grow as the caller clicks the context arrows — keepPreviousData avoids a
// flash back to an empty state while the larger batch is being fetched. paragraphId is nullable
// because the caller is typically a modal driven by "which paragraph, if any, is open".
export function useParagraphContext(paragraphId: number | null, before: number, after: number) {
  return useQuery({
    queryKey: ['paragraph-context', paragraphId, before, after],
    queryFn: ({ signal }) => getParagraphContext(paragraphId as number, { before, after }, signal),
    enabled: paragraphId !== null,
    placeholderData: keepPreviousData,
  })
}
