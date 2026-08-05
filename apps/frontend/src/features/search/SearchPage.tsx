import { useState } from 'react'
import type { ReactNode } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { searchParagraphs } from '../../api/search'
import SearchForm from './SearchForm/SearchForm'
import ResultList from './ResultList/ResultList'
import Spinner from '../../components/Spinner/Spinner'
import ErrorMessage from '../../components/ErrorMessage/ErrorMessage'
import EmptyState from '../../components/EmptyState/EmptyState'
import styles from './SearchPage.module.css'

const PAGE_SIZE = 10

export default function SearchPage() {
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)
  const [activeSelectionParagraphId, setActiveSelectionParagraphId] = useState<number | null>(null)

  // A selection in progress no longer makes sense once the visible results change underneath it.
  // Adjusted during render (not in an effect) — the React-recommended way to reset state when
  // inputs change, see https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  const [lastSelectionResetKey, setLastSelectionResetKey] = useState({ query, page })
  if (lastSelectionResetKey.query !== query || lastSelectionResetKey.page !== page) {
    setLastSelectionResetKey({ query, page })
    setActiveSelectionParagraphId(null)
  }

  const isQueryValid = query.length >= 2

  const { data, isPending, isFetching, isError } = useQuery({
    queryKey: ['search', query, page],
    queryFn: ({ signal }) => searchParagraphs({ q: query, page, size: PAGE_SIZE }, signal),
    enabled: isQueryValid,
    placeholderData: keepPreviousData,
  })

  function handleSearch(q: string) {
    setQuery(q)
    setPage(0)
  }

  let content: ReactNode = null

  if (isQueryValid) {
    if (isPending) {
      content = <Spinner />
    } else if (isError) {
      content = <ErrorMessage message="Une erreur est survenue. Veuillez réessayer." />
    } else if (data.results.length === 0) {
      content = <EmptyState message={`Aucun résultat pour « ${query} ».`} />
    } else {
      content = (
        <ResultList
          results={data.results}
          total={data.total}
          page={data.page}
          size={data.size}
          isFetching={isFetching}
          onPageChange={setPage}
          activeSelectionParagraphId={activeSelectionParagraphId}
          onSelectionStart={setActiveSelectionParagraphId}
          onSelectionEnd={() => setActiveSelectionParagraphId(null)}
        />
      )
    }
  }

  return (
    <main className={styles.root}>
      <h1 className={styles.title}>Proust Club</h1>
      <SearchForm onSubmit={handleSearch} />
      {content}
    </main>
  )
}
