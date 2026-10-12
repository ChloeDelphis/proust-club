import type { ReactNode } from 'react'

export interface DetailModalProps {
  paragraphId: number | null
  centerContent: ReactNode
  sideContent: ReactNode
  ariaLabel: string
  onOpenChange: (open: boolean) => void
}
