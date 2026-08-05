import styles from './Pagination.module.css'

interface PaginationProps {
  page: number
  size: number
  total: number
  onPageChange: (page: number) => void
}

export default function Pagination({ page, size, total, onPageChange }: PaginationProps) {
  const totalPages = Math.ceil(total / size)
  if (totalPages <= 1) return null

  const hasPrev = page > 0
  const hasNext = page < totalPages - 1

  return (
    <nav className={styles.root} aria-label="Pagination">
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
  )
}
