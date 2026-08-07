import type { FilterButtonProps } from './FilterButton.types'
import styles from './FilterButton.module.css'

export default function FilterButton({ active, onClick, children }: FilterButtonProps) {
  return (
    <button type="button" className={active ? `${styles.root} ${styles.isActive}` : styles.root} onClick={onClick}>
      {children}
    </button>
  )
}
