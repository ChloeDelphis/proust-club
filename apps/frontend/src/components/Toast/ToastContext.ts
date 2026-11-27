import { createContext } from 'react'
import type { ToastOptions } from './Toast.types'

export const ToastContext = createContext<((message: string, options?: ToastOptions) => void) | null>(null)
