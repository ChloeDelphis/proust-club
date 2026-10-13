import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useCreateQuoteMutation } from './useCreateQuoteMutation'
import * as quoteApi from '../../api/quote'

vi.mock('../../api/quote')

let queryClient: QueryClient

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

beforeEach(() => {
  vi.clearAllMocks()
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
})

afterEach(() => {
  queryClient.clear()
})

it('invalidates quote and tag caches after creating a quote', async () => {
  vi.mocked(quoteApi.createQuote).mockResolvedValue({} as quoteApi.QuoteSelectionResponse)
  queryClient.setQueryData(['quotes', 'timeline', null], { quotes: [] })
  queryClient.setQueryData(['tags'], [])

  const { result } = renderHook(() => useCreateQuoteMutation(), { wrapper })

  await act(async () => {
    await result.current.mutateAsync({
      paragraphId: 42,
      startOffset: 0,
      endOffset: 5,
      selectedText: 'hello',
      tagNames: ['Combray'],
    })
  })

  await waitFor(() => {
    expect(queryClient.getQueryState(['quotes', 'timeline', null])?.isInvalidated).toBe(true)
    expect(queryClient.getQueryState(['tags'])?.isInvalidated).toBe(true)
  })
})
