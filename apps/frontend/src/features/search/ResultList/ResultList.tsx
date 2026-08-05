import type { SearchHit } from '../../../api/search'
import ParagraphCard from '../ParagraphCard/ParagraphCard'
import Pagination from '../../../components/Pagination/Pagination'
import styles from './ResultList.module.css'

interface ResultListProps {
  results: SearchHit[]
  total: number
  page: number
  size: number
  isFetching: boolean
  onPageChange: (page: number) => void
}

export default function ResultList({ results, total, page, size, isFetching, onPageChange }: ResultListProps) {
  return (
    <section className={isFetching ? `${styles.root} ${styles.isFetching}` : styles.root}>
      <p className={styles.count}>
        {total} résultat{total > 1 ? 's' : ''}
      </p>
      <ul className={styles.list}>
        {results.map(hit => (
          <li key={hit.paragraphId}>
            <ParagraphCard {...hit} />
          </li>
        ))}
      </ul>
      <Pagination page={page} size={size} total={total} onPageChange={onPageChange} />
    </section>
  )
}
