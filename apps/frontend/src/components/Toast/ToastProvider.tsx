import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { ToastItem } from './Toast.types'
import { ToastContext } from './ToastContext'
import Toast from './Toast'
import styles from './ToastProvider.module.css'

const DISPLAY_DURATION_MS = 5000

export default function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const nextId = useRef(0)
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>())

  const dismissToast = useCallback((id: number) => {
    const timer = timers.current.get(id)
    if (timer) clearTimeout(timer)
    timers.current.delete(id)
    setToasts(current => current.filter(toast => toast.id !== id))
  }, [])

  useEffect(() => () => {
    timers.current.forEach(timer => clearTimeout(timer))
    timers.current.clear()
  }, [])

  const showToast = useCallback((message: string) => {
    const id = nextId.current++
    setToasts(current => [...current, { id, message }])
    const timer = setTimeout(() => dismissToast(id), DISPLAY_DURATION_MS)
    timers.current.set(id, timer)
  }, [dismissToast])

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <div className={styles.container}>
        {toasts.map(toast => (
          <Toast key={toast.id} toast={toast} onDismiss={() => dismissToast(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}
