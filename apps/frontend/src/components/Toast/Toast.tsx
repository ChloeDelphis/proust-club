import { useTranslation } from 'react-i18next'
import type { ToastItem } from './Toast.types'
import styles from './Toast.module.css'

interface ToastProps {
  toast: ToastItem
  onDismiss: () => void
}

export default function Toast({ toast, onDismiss }: ToastProps) {
  const { t } = useTranslation()

  return (
    <div className={styles.root}>
      <span className={styles.message} role="status">{toast.message}</span>
      <button
        type="button"
        className={styles.closeButton}
        aria-label={t('components.toast.closeButton')}
        onClick={onDismiss}
      >
        <span aria-hidden="true">×</span>
      </button>
    </div>
  )
}
