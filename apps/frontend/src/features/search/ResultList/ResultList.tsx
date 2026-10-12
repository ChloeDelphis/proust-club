import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import Pagination from '../../../components/Pagination/Pagination'
import styles from './ResultList.module.css'

interface ResultListProps<T> {
  results: T[]
  getKey: (item: T) => string | number
  renderItem: (item: T) => ReactNode
  total: number
  page: number
  size: number
  isFetching: boolean
  onPageChange: (page: number) => void
}

// Card-agnostic on purpose — same "count + list + pagination" shape for corpus search results
// (ParagraphCard) and the saved-citations list (QuoteCard), the two real consumers.
export default function ResultList<T>({ results, getKey, renderItem, total, page, size, isFetching, onPageChange }: ResultListProps<T>) {
  const { t } = useTranslation()
  return (
    <section className={isFetching ? `${styles.root} ${styles.isFetching}` : styles.root}>
      <p className={styles.count}>
        {t('resultList.resultCount', { count: total })}
      </p>
      <ul className={styles.list}>
        {results.map(item => (
          <li key={getKey(item)}>{renderItem(item)}</li>
        ))}
      </ul>
      <Pagination page={page} size={size} total={total} onPageChange={onPageChange} />
    </section>
  )
}
