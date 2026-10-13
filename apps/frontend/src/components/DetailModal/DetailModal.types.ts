import type { ReactNode } from 'react'

export interface DetailModalProps {
  paragraphId: number | null
  centerContent: ReactNode
  sideContent: ReactNode
  ariaLabel: string
  onOpenChange: (open: boolean) => void
  /** Disables the × close button — for a caller with its own irreversible action in flight. */
  closeDisabled?: boolean
}
