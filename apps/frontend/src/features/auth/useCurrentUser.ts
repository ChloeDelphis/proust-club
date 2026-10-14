import { useQuery } from '@tanstack/react-query'
import { ApiError } from '../../api/client'
import { getCurrentUser } from '../../api/auth'

export const CURRENT_USER_QUERY_KEY = ['auth', 'me']

export function useCurrentUser() {
  return useQuery({
    queryKey: CURRENT_USER_QUERY_KEY,
    queryFn: async ({ signal }) => {
      try {
        return await getCurrentUser(signal)
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) return null
        throw error
      }
    },
    retry: false,
  })
}
