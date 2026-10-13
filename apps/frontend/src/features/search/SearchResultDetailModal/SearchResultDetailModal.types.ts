import type { SearchHit } from '../../../api/search'

export interface SearchResultDetailModalProps {
  hit: SearchHit | null
  onClose: () => void
}
