import { useContext } from 'react'
import { ToastContext } from './ToastContext'

export function useToast(): (message: string) => void {
  const showToast = useContext(ToastContext)
  if (!showToast) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return showToast
}
