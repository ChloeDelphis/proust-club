import { useQuery } from '@tanstack/react-query'
import { getVolumes } from '../../api/volume'

export function useVolumes() {
  return useQuery({
    queryKey: ['corpus', 'volumes'],
    queryFn: ({ signal }) => getVolumes(signal),
    staleTime: Infinity,
  })
}
