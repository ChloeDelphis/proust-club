import type { SearchHit } from '../../../api/search'
import type { GuestQuoteSaveDraft } from '../guestQuoteSaveContext'

export interface SearchResultDetailModalProps {
  hit: SearchHit | null
  onClose: () => void
  resumeDraft?: GuestQuoteSaveDraft | null
  searchContext?: Pick<GuestQuoteSaveDraft, 'query' | 'page' | 'volumeId' | 'partId'>
}
