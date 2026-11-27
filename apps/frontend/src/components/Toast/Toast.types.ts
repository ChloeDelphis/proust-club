export interface ToastAction {
  label: string
  onClick: () => void
}

export type ToastVariant = 'success' | 'error'

export interface ToastOptions {
  action?: ToastAction
  variant?: ToastVariant
}

export interface ToastItem {
  id: number
  message: string
  action?: ToastAction
  variant: ToastVariant
}
