import { useState } from 'react'
import type { ReactNode } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { searchParagraphs } from '../../api/search'
import SearchForm from './SearchForm/SearchForm'
import ResultList from './ResultList/ResultList'
import Spinner from '../../components/Spinner/Spinner'
import ErrorMessage from '../../components/ErrorMessage/ErrorMessage'
import EmptyState from '../../components/EmptyState/EmptyState'
import styles from './SearchPage.module.css'

const PAGE_SIZE = 10

export default function SearchPage() {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)

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
      content = <ErrorMessage message={t('searchPage.error')} />
    } else if (data.results.length === 0) {
      content = <EmptyState message={t('searchPage.emptyState', { query })} />
    } else {
      content = (
        <ResultList
          results={data.results}
          total={data.total}
          page={data.page}
          size={data.size}
          isFetching={isFetching}
          onPageChange={setPage}
        />
      )
    }
  }

  return (
    <main className={styles.root}>
      <h1 className={styles.title}>{t('header.brand')}</h1>
      <SearchForm onSubmit={handleSearch} />
      {content}
    </main>
  )
}
