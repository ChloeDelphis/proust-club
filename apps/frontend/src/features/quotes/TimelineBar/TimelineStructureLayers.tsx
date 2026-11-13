import { useTranslation } from 'react-i18next'
import type { VolumeResponse } from '../../../api/volume'
import type { PageRange } from './positionTimelineQuotes'
import { pageToPercent } from './positionTimelineQuotes'
import styles from './TimelineBar.module.css'
import { titleFontClass } from './timelineTitleSizing'
import {
  TITLE_TRACK_HEIGHT,
  VOLUME_ROMAN_NUMERALS,
  VIEWBOX_HEIGHT,
  percentToX,
  snapSvgXToDevicePixelCenter,
} from './timelineSvgLayout'
import { activateOnEnterOrSpace } from './timelineLayerUtils'

type TranslateFn = ReturnType<typeof useTranslation>['t']

function SearchCountBadge({ x, count, isHidden = false }: { x: number; count: number | undefined; isHidden?: boolean }) {
  if (!count) return null
  const width = Math.max(16, String(count).length * 6 + 8)
  const height = 12
  const xLeft = x - width - 4
  const centerX = xLeft + width / 2
  const centerY = 4 + height / 2

  return (
    <g className={[styles.searchCountBadge, isHidden && styles.isHidden].filter(Boolean).join(' ')} aria-hidden="true">
      <rect x={xLeft} y={4} width={width} height={height} rx={height / 2} className={styles.searchCountBadgeBg} />
      <text x={centerX} y={centerY} className={styles.searchCountBadgeText}>{count}</text>
    </g>
  )
}

export function VolumeZones({
  volumes,
  range,
  selectedVolumeId,
  selectedPartId,
  onSelect,
  t,
  viewBoxWidth,
  viewBoxScale,
  volumeCounts,
}: {
  volumes: VolumeResponse[]
  range: PageRange
  selectedVolumeId: number | null
  selectedPartId: number | null
  onSelect: (id: number) => void
  t: TranslateFn
  viewBoxWidth: number
  viewBoxScale: number
  volumeCounts: ReadonlyMap<number, number>
}) {
  return (
    <>
      {volumes.map((volume, index) => {
        const x1 = percentToX(pageToPercent(volume.minPage, range), viewBoxWidth)
        // Extend the zone to the next volume's first page so no gap appears at the delimiter.
        const rightBoundaryPage = volumes[index + 1]?.minPage ?? volume.maxPage
        const x2 = percentToX(pageToPercent(rightBoundaryPage, range), viewBoxWidth)
        const width = Math.max(0, x2 - x1)
        // Keep the selected zone interactive so it can toggle back to the full view.
        const isActive = volume.id === selectedVolumeId
        const isHidden = selectedVolumeId !== null && !isActive
        const resultCount = volumeCounts.get(volume.id)
        const titleSizeClass = titleFontClass(volume.title, width, TITLE_TRACK_HEIGHT / 2, viewBoxScale, 0.5, 0.25)
        const zoneClassName = [styles.volumeZone, isActive && styles.isActiveZone, isHidden && styles.isHidden]
          .filter(Boolean)
          .join(' ')
        const labelClassName = [styles.volumeLabel, isActive && styles.isActiveLabel, isHidden && styles.isHidden]
          .filter(Boolean)
          .join(' ')
        return (
          <g key={volume.id}>
            <rect
              x={x1}
              y={0}
              width={width}
              height={VIEWBOX_HEIGHT}
              className={zoneClassName}
              role="button"
              // Hidden zones remain mounted for the opacity transition but leave the tab order.
              tabIndex={isHidden ? -1 : 0}
              aria-hidden={isHidden}
              aria-label={resultCount !== undefined
                ? isActive
                  ? selectedPartId !== null
                    ? t('timelineBar.returnToVolumeWithCount', { title: volume.title, count: resultCount })
                    : t('timelineBar.zoomOutOfVolumeWithCount', { count: resultCount })
                  : t('timelineBar.zoomOnVolumeWithCount', { title: volume.title, count: resultCount })
                : isActive
                  ? selectedPartId !== null
                    ? t('timelineBar.returnToVolume', { title: volume.title })
                    : t('timelineBar.zoomOutOfVolume')
                  : t('timelineBar.zoomOnVolume', { title: volume.title })}
              onClick={() => onSelect(volume.id)}
              onKeyDown={activateOnEnterOrSpace(() => onSelect(volume.id))}
            />
            <rect
              x={x1}
              y={0}
              width={width}
              height={TITLE_TRACK_HEIGHT}
              className={styles.volumeZoneHoverTitle}
              aria-hidden="true"
            />
            <rect
              x={x1}
              y={TITLE_TRACK_HEIGHT}
              width={width}
              height={VIEWBOX_HEIGHT - TITLE_TRACK_HEIGHT}
              className={styles.volumeZoneHoverBookmarks}
              aria-hidden="true"
            />
            {/* Decorative: the volume zone already exposes its full accessible name. */}
            <foreignObject x={x1} y={0} width={width} height={TITLE_TRACK_HEIGHT} className={labelClassName} aria-hidden="true">
              <div className={styles.volumeLabelText}>
                <span className={styles.volumeNumeral}>{VOLUME_ROMAN_NUMERALS[volume.position - 1] ?? volume.position}</span>
                <span className={`${styles.volumeTitle} ${titleSizeClass}`}>{volume.title}</span>
              </div>
            </foreignObject>
            <SearchCountBadge x={x2} count={resultCount} isHidden={isHidden} />
          </g>
        )
      })}
    </>
  )
}

export function VolumeDelimiters({
  volumes,
  range,
  isHidden,
  viewBoxWidth,
  viewBoxScale,
  trackLeft,
}: {
  volumes: VolumeResponse[]
  range: PageRange
  isHidden: boolean
  viewBoxWidth: number
  viewBoxScale: number
  trackLeft: number
}) {
  const className = isHidden ? `${styles.delimiter} ${styles.isHidden}` : styles.delimiter

  return (
    <>
      {volumes.slice(1).map(volume => {
        const x = snapSvgXToDevicePixelCenter(
          percentToX(pageToPercent(volume.minPage, range), viewBoxWidth),
          viewBoxScale,
          trackLeft,
        )
        return <line key={volume.id} x1={x} x2={x} y1={0} y2={VIEWBOX_HEIGHT} className={className} />
      })}
    </>
  )
}

export function PartStructure({
  volume,
  range,
  selectedPartId,
  onSelectPart,
  t,
  viewBoxWidth,
  viewBoxScale,
  trackLeft,
  partCounts,
}: {
  volume: VolumeResponse
  range: PageRange
  selectedPartId: number | null
  onSelectPart: (partId: number, volumeId: number) => void
  t: TranslateFn
  viewBoxWidth: number
  viewBoxScale: number
  trackLeft: number
  partCounts: ReadonlyMap<number, number>
}) {
  return (
    <>
      {volume.parts.map((part, index) => {
        const nextPart = volume.parts[index + 1]
        const isSelected = selectedPartId === part.id
        const isHidden = selectedPartId !== null && !isSelected
        const resultCount = partCounts.get(part.id)
        const startX = percentToX(pageToPercent(part.startPage, range), viewBoxWidth)
        const endX = percentToX(pageToPercent(nextPart?.startPage ?? volume.maxPage, range), viewBoxWidth)
        const width = Math.max(0, endX - startX)
        const titleSizeClass = titleFontClass(part.title, width, TITLE_TRACK_HEIGHT, viewBoxScale, 0.5, 1)
        const zoneClassName = [styles.partZone, isSelected && styles.isActivePart, isHidden && styles.isHidden]
          .filter(Boolean)
          .join(' ')
        const labelClassName = [styles.partLabel, isHidden && styles.isHidden].filter(Boolean).join(' ')
        return (
          <g key={part.id}>
            <rect
              x={startX}
              y={0}
              width={width}
              height={VIEWBOX_HEIGHT}
              className={zoneClassName}
              role="button"
              tabIndex={isHidden ? -1 : 0}
              aria-hidden={isHidden}
              aria-label={resultCount !== undefined
                ? isSelected
                  ? t('timelineBar.returnToVolumeWithCount', { title: volume.title, count: resultCount })
                  : t('timelineBar.zoomOnPartWithCount', { title: part.title, count: resultCount })
                : isSelected
                  ? t('timelineBar.returnToVolume', { title: volume.title })
                  : t('timelineBar.zoomOnPart', { title: part.title })}
              aria-pressed={isSelected}
              onClick={() => onSelectPart(part.id, volume.id)}
              onKeyDown={activateOnEnterOrSpace(() => onSelectPart(part.id, volume.id))}
            />
            <rect
              x={startX}
              y={0}
              width={width}
              height={TITLE_TRACK_HEIGHT}
              className={styles.partZoneHoverTitle}
              aria-hidden="true"
            />
            <rect
              x={startX}
              y={TITLE_TRACK_HEIGHT}
              width={width}
              height={VIEWBOX_HEIGHT - TITLE_TRACK_HEIGHT}
              className={styles.partZoneHoverBookmarks}
              aria-hidden="true"
            />
            <foreignObject
              x={startX}
              y={0}
              width={Math.max(0, endX - startX)}
              height={TITLE_TRACK_HEIGHT}
              className={labelClassName}
              aria-hidden="true"
            >
              <div className={`${styles.partTitle} ${titleSizeClass}`}>{part.title}</div>
            </foreignObject>
            <SearchCountBadge x={endX} count={resultCount} isHidden={isHidden} />
            {index > 0 && (
              <line
                x1={snapSvgXToDevicePixelCenter(startX, viewBoxScale, trackLeft)}
                x2={snapSvgXToDevicePixelCenter(startX, viewBoxScale, trackLeft)}
                y1={0}
                y2={VIEWBOX_HEIGHT}
                className={selectedPartId === null ? styles.partDelimiter : `${styles.partDelimiter} ${styles.isHidden}`}
              />
            )}
          </g>
        )
      })}
    </>
  )
}
