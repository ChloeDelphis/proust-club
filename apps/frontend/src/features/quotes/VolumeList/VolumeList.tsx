import { useTranslation } from 'react-i18next'
import FilterButton from '../../../components/FilterButton/FilterButton'
import { useVolumes } from '../useVolumes'
import type { VolumeListProps } from './VolumeList.types'
import styles from './VolumeList.module.css'

export default function VolumeList({ selectedVolumeId, onSelectVolume }: VolumeListProps) {
  const { t } = useTranslation()

  const { data: volumes, isPending, isError } = useVolumes()

  if (isPending || isError || !volumes || volumes.length === 0) return null

  return (
    <nav aria-label={t('timelineBar.volumeFilterAriaLabel')}>
      <ul className={styles.list}>
        {volumes.map(volume => (
          <li key={volume.id}>
            <FilterButton variant="list" active={selectedVolumeId === volume.id} onClick={() => onSelectVolume(volume.id)}>
              {volume.title}
            </FilterButton>
          </li>
        ))}
      </ul>
    </nav>
  )
}
