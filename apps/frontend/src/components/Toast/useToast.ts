import { useContext } from 'react'
import { ToastContext } from './ToastContext'
import type { ToastOptions } from './Toast.types'

export function useToast(): (message: string, options?: ToastOptions) => void {
  const showToast = useContext(ToastContext)
  if (!showToast) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return showToast
}
