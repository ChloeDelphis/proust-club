import { useQuery } from '@tanstack/react-query'
import { getCurrentUser } from '../../api/auth'

export const CURRENT_USER_QUERY_KEY = ['auth', 'me']

export function useCurrentUser() {
  return useQuery({
    queryKey: CURRENT_USER_QUERY_KEY,
    queryFn: ({ signal }) => getCurrentUser(signal),
    retry: false,
  })
}
