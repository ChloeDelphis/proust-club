import { useContext } from 'react'
import { GuestQuoteSaveContext } from './guestQuoteSaveContext'

export function useGuestQuoteSave() {
  const context = useContext(GuestQuoteSaveContext)
  if (!context) throw new Error('useGuestQuoteSave must be used inside GuestQuoteSaveProvider')
  return context
}
