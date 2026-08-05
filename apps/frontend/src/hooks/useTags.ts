import { useQuery } from '@tanstack/react-query'
import { listTags } from '../api/tag'

export function useTags() {
  return useQuery({
    queryKey: ['tags'],
    queryFn: ({ signal }) => listTags(signal),
  })
}
