import type { ReactNode } from 'react'

export interface FilterButtonProps {
  active: boolean
  onClick: () => void
  children: ReactNode
}
