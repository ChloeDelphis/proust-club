import type { ReactNode } from 'react'

export interface FilterButtonProps {
  active: boolean
  onClick: () => void
  /** @default 'pill' */
  variant?: 'pill' | 'list'
  children: ReactNode
}
