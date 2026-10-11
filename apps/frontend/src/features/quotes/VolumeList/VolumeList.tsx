import { useTranslation } from 'react-i18next'
import { useTimeline } from '../useTimeline'
import type { VolumeListProps } from './VolumeList.types'
import styles from './VolumeList.module.css'

export default function VolumeList({ activeTagId, selectedVolumeId, onSelectVolume }: VolumeListProps) {
  const { t } = useTranslation()

  // Same hook/query key as TimelineBar — TanStack Query dedupes the two calls into one request, no
  // prop-drilling of `data` between the sibling components (same pattern MyQuotesPage already uses
  // for its own, independent quote-list query).
  const { data, isPending, isError } = useTimeline(activeTagId)

  if (isPending || isError || data.volumes.length === 0) return null

  function itemClass(active: boolean) {
    return active ? `${styles.item} ${styles.isActive}` : styles.item
  }

  return (
    <nav aria-label={t('timelineBar.volumeFilterAriaLabel')}>
      <ul className={styles.list}>
        <li>
          <button type="button" className={itemClass(selectedVolumeId === null)} onClick={() => onSelectVolume(null)}>
            {t('timelineBar.allVolumesFilter')}
          </button>
        </li>
        {data.volumes.map(volume => (
          <li key={volume.id}>
            <button type="button" className={itemClass(selectedVolumeId === volume.id)} onClick={() => onSelectVolume(volume.id)}>
              {volume.title}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  )
}
