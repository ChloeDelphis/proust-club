import type { ToastItem } from './Toast.types'
import styles from './Toast.module.css'

interface ToastProps {
  toast: ToastItem
}

export default function Toast({ toast }: ToastProps) {
  return (
    <div className={styles.root} role="status">
      {toast.message}
    </div>
  )
}
