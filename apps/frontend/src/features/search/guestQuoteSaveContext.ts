import { createContext } from 'react'

export type GuestQuoteSaveDraft = {
  paragraphId: number
  start: number
  end: number
  selectedText: string
  listName: string
  query: string
  page: number
  volumeId: number | null
  scrollY: number
}

export type GuestQuoteSaveContextValue = {
  draft: GuestQuoteSaveDraft | null
  setDraft: (draft: GuestQuoteSaveDraft) => void
  clearDraft: () => void
}

export const GuestQuoteSaveContext = createContext<GuestQuoteSaveContextValue | null>(null)
