import { useContext } from 'react'
import { SelectionContext } from './SelectionContext'
import type { SelectionContextValue } from './SelectionContext'

export function useSelectionContext(): SelectionContextValue {
  const value = useContext(SelectionContext)
  if (!value) {
    throw new Error('useSelectionContext must be used within a SelectionContext.Provider')
  }
  return value
}
