import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createQuote } from '../../api/quote'
import type { CreateQuoteParams } from '../../api/quote'

// A created quote may also create tags, so every save entry point must refresh both caches.
export function useCreateQuoteMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (params: CreateQuoteParams) => createQuote(params),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['quotes'] })
      void queryClient.invalidateQueries({ queryKey: ['tags'] })
    },
  })
}
