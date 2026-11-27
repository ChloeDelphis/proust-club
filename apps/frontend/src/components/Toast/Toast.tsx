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
    <div className={`${styles.root} ${toast.variant === 'error' ? styles.isError : ''}`}>
      <span className={styles.message} role="status">{toast.message}</span>
      {toast.action && (
        <button
          type="button"
          className={styles.actionButton}
          onClick={() => {
            onDismiss()
            toast.action?.onClick()
          }}
        >
          {toast.action.label}
        </button>
      )}
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
