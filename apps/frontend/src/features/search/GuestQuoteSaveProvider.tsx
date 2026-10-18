import { useCallback, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { GuestQuoteSaveContext } from './guestQuoteSaveContext'
import type { GuestQuoteSaveDraft } from './guestQuoteSaveContext'

export default function GuestQuoteSaveProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<GuestQuoteSaveDraft | null>(null)
  const clearDraft = useCallback(() => setDraft(null), [])
  const value = useMemo(() => ({ draft, setDraft, clearDraft }), [draft, clearDraft])
  return (
    <GuestQuoteSaveContext.Provider value={value}>
      {children}
    </GuestQuoteSaveContext.Provider>
  )
}
