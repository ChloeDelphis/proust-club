import type { ReactNode } from 'react'

export interface DetailModalProps {
  paragraphId: number | null
  centerContent: ReactNode
  sideContent: ReactNode
  ariaLabel: string
  onOpenChange: (open: boolean) => void
  /** Optional typography override so context matches caller-specific center text. */
  contextTextClassName?: string
  /** Disables the × close button — for a caller with its own irreversible action in flight. */
  closeDisabled?: boolean
  /** Adds a subtle veil while a nested dialog is active. */
  isDimmed?: boolean
}
