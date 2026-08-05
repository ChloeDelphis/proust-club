import { useCallback, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { ToastItem } from './Toast.types'
import { ToastContext } from './ToastContext'
import Toast from './Toast'
import styles from './ToastProvider.module.css'

const DISPLAY_DURATION_MS = 3000

export default function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const nextId = useRef(0)

  const showToast = useCallback((message: string) => {
    const id = nextId.current++
    setToasts(current => [...current, { id, message }])
    setTimeout(() => {
      setToasts(current => current.filter(toast => toast.id !== id))
    }, DISPLAY_DURATION_MS)
  }, [])

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <div className={styles.container}>
        {toasts.map(toast => (
          <Toast key={toast.id} toast={toast} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}
