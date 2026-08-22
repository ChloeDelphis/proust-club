import { useTranslation } from 'react-i18next'
import styles from './Pagination.module.css'

interface PaginationProps {
  page: number
  size: number
  total: number
  onPageChange: (page: number) => void
}

export default function Pagination({ page, size, total, onPageChange }: PaginationProps) {
  const { t } = useTranslation()
  const totalPages = Math.ceil(total / size)
  if (totalPages <= 1) return null

  const hasPrev = page > 0
  const hasNext = page < totalPages - 1

  return (
    <nav className={styles.root} aria-label={t('components.pagination.ariaLabel')}>
      <button
        className={styles.pageButton}
        onClick={() => onPageChange(page - 1)}
        disabled={!hasPrev}
      >
        {t('components.pagination.previous')}
      </button>
      <span className={styles.pageInfo}>{page + 1} / {totalPages}</span>
      <button
        className={styles.pageButton}
        onClick={() => onPageChange(page + 1)}
        disabled={!hasNext}
      >
        {t('components.pagination.next')}
      </button>
    </nav>
  )
}
