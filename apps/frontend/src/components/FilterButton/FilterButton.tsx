import type { FilterButtonProps } from './FilterButton.types'
import styles from './FilterButton.module.css'

export default function FilterButton({ active, onClick, variant = 'pill', children }: FilterButtonProps) {
  const base = variant === 'list' ? styles.list : styles.pill
  return (
    <button type="button" className={active ? `${base} ${styles.isActive}` : base} onClick={onClick}>
      {children}
    </button>
  )
}
