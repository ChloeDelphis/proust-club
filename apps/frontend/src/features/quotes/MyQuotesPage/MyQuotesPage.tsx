import { useState } from 'react'
import type { ReactNode } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { Navigate } from 'react-router'
import { useCurrentUser } from '../../auth/useCurrentUser'
import { listQuotes } from '../../../api/quote'
import TagFilterBar from '../TagFilterBar/TagFilterBar'
import QuoteCard from '../QuoteCard/QuoteCard'
import Pagination from '../../../components/Pagination/Pagination'
import Spinner from '../../../components/Spinner/Spinner'
import ErrorMessage from '../../../components/ErrorMessage/ErrorMessage'
import EmptyState from '../../../components/EmptyState/EmptyState'
import styles from './MyQuotesPage.module.css'

const PAGE_SIZE = 10

export default function MyQuotesPage() {
  const { isPending: isUserPending, isSuccess: isConnected } = useCurrentUser()
  const [tagId, setTagId] = useState<number | null>(null)
  const [page, setPage] = useState(0)

  function handleSelectTag(id: number | null) {
    setTagId(id)
    setPage(0)
  }

  const { data, isPending, isFetching, isError } = useQuery({
    queryKey: ['quotes', tagId, page],
    queryFn: ({ signal }) => listQuotes({ tagId: tagId ?? undefined, page, size: PAGE_SIZE }, signal),
    enabled: isConnected,
    placeholderData: keepPreviousData,
  })

  if (isUserPending) {
    return (
      <main className={styles.root}>
        <Spinner />
      </main>
    )
  }

  if (!isConnected) {
    return <Navigate to="/login" replace />
  }

  let content: ReactNode = null

  if (isPending) {
    content = <Spinner />
  } else if (isError) {
    content = <ErrorMessage message="Une erreur est survenue. Veuillez réessayer." />
  } else if (data.results.length === 0) {
    content = (
      <EmptyState
        message={tagId === null ? 'Aucune citation sauvegardée pour le moment.' : 'Aucune citation avec ce tag.'}
      />
    )
  } else {
    content = (
      <>
        <ul className={isFetching ? `${styles.list} ${styles.isFetching}` : styles.list}>
          {data.results.map(quote => (
            <li key={quote.id}>
              <QuoteCard quote={quote} />
            </li>
          ))}
        </ul>
        <Pagination page={data.page} size={data.size} total={data.total} onPageChange={setPage} />
      </>
    )
  }

  return (
    <main className={styles.root}>
      <h1 className={styles.title}>Mes citations</h1>
      <TagFilterBar activeTagId={tagId} onSelectTag={handleSelectTag} />
      {content}
    </main>
  )
}
