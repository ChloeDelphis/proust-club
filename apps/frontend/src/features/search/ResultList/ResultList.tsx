import type { SearchHit } from '../../../api/search'
import ParagraphCard from '../ParagraphCard/ParagraphCard'
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
  const totalPages = Math.ceil(total / size)
  const hasPrev = page > 0
  const hasNext = page < totalPages - 1

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
      {totalPages > 1 && (
        <nav className={styles.pagination} aria-label="Pagination">
          <button
            className={styles.pageButton}
            onClick={() => onPageChange(page - 1)}
            disabled={!hasPrev}
          >
            ← Précédent
          </button>
          <span className={styles.pageInfo}>{page + 1} / {totalPages}</span>
          <button
            className={styles.pageButton}
            onClick={() => onPageChange(page + 1)}
            disabled={!hasNext}
          >
            Suivant →
          </button>
        </nav>
      )}
    </section>
  )
}
