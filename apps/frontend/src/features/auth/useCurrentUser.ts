import { useQuery } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import { ApiError } from '../../api/client'
import { getCurrentUser } from '../../api/auth'
import type { UserResponse } from '../../api/auth'

export const CURRENT_USER_QUERY_KEY = ['auth', 'me']

// A successful authentication can replace the browser's current identity without passing through
// the logout flow (for example, after a stale session or a password reset link). Remove every
// cached query before storing the new identity so private data from the previous account cannot
// be rendered while the new account's queries load.
export function setAuthenticatedUser(queryClient: QueryClient, user: UserResponse) {
  queryClient.clear()
  queryClient.setQueryData(CURRENT_USER_QUERY_KEY, user)
}

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
