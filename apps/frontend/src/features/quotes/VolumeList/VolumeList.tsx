import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { getQuoteTimeline } from '../../../api/quote'
import type { VolumeListProps } from './VolumeList.types'
import styles from './VolumeList.module.css'

export default function VolumeList({ activeTagId, selectedVolumeId, onSelectVolume }: VolumeListProps) {
  const { t } = useTranslation()

  // Same query key as TimelineBar — TanStack Query dedupes the two calls into one request, no
  // prop-drilling of `data` between the sibling components (same pattern MyQuotesPage already uses
  // for its own, independent quote-list query).
  const { data, isPending, isError } = useQuery({
    queryKey: ['quotes', 'timeline', activeTagId],
    queryFn: ({ signal }) => getQuoteTimeline({ tagId: activeTagId ?? undefined }, signal),
    staleTime: 60_000,
  })

  if (isPending || isError || data.volumes.length === 0) return null

  return (
    <nav aria-label={t('timelineBar.volumeFilterAriaLabel')}>
      <ul className={styles.list}>
        <li>
          <button
            type="button"
            className={selectedVolumeId === null ? `${styles.item} ${styles.isActive}` : styles.item}
            onClick={() => onSelectVolume(null)}
          >
            {t('timelineBar.allVolumesFilter')}
          </button>
        </li>
        {data.volumes.map(volume => (
          <li key={volume.id}>
            <button
              type="button"
              className={selectedVolumeId === volume.id ? `${styles.item} ${styles.isActive}` : styles.item}
              onClick={() => onSelectVolume(volume.id)}
            >
              {volume.title}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  )
}
