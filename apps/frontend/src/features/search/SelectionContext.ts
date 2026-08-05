import { createContext } from 'react'

export interface SelectionContextValue {
  activeParagraphId: number | null
  startSelection: (paragraphId: number) => void
  endSelection: () => void
}

export const SelectionContext = createContext<SelectionContextValue | null>(null)
