import { useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { VolumeResponse } from '../../../api/volume'
import type { TimelineQuote } from '../../../api/quote'
import Spinner from '../../../components/Spinner/Spinner'
import ErrorMessage from '../../../components/ErrorMessage/ErrorMessage'
import QuoteHoverPreview from '../QuoteHoverPreview/QuoteHoverPreview'
import { useTimeline } from '../useTimeline'
import { useVolumes } from '../useVolumes'
import { pageToPercent, positionTimelineQuotes } from './positionTimelineQuotes'
import type { PageRange, TimelineGroup } from './positionTimelineQuotes'
import type { TimelineBarProps } from './TimelineBar.types'
import styles from './TimelineBar.module.css'

// SVG viewBox units. The horizontal range follows the rendered aspect ratio so preserveAspectRatio
// can stretch the SVG uniformly: the track fills its container without distorting text or marks.
const VIEWBOX_WIDTH = 1000
const VIEWBOX_HEIGHT = 100
const TRACK_TOP = 50
const TRACK_BOTTOM = 95
const BOOKMARK_HEIGHT_NORMAL = 20
const BOOKMARK_HEIGHT_EXTENDED = 35
const BOOKMARK_WIDTH = 4
const PREVIEW_WIDTH = 110
const PREVIEW_HEIGHT = 45
const EMPTY_VOLUMES: VolumeResponse[] = []
const EMPTY_QUOTES: TimelineQuote[] = []

function percentToX(percent: number, viewBoxWidth: number): number {
  return percent * (viewBoxWidth / 100)
}

function activateOnEnterOrSpace(onActivate: () => void) {
  return (event: KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onActivate()
    }
  }
}

// The three SVG layers below are independent visual tracks sharing the same viewBox coordinate
// space — kept as local, unexported pieces of TimelineBar rather than promoted components, since
// none of them has a second consumer outside this feature.

type TranslateFn = ReturnType<typeof useTranslation>['t']

function VolumeZones({
  volumes,
  range,
  selectedVolumeId,
  onSelect,
  t,
  viewBoxWidth,
}: {
  volumes: VolumeResponse[]
  range: PageRange
  selectedVolumeId: number | null
  onSelect: (id: number) => void
  t: TranslateFn
  viewBoxWidth: number
}) {
  return (
    <>
      {volumes.map(volume => {
        const x1 = percentToX(pageToPercent(volume.minPage, range), viewBoxWidth)
        const x2 = percentToX(pageToPercent(volume.maxPage, range), viewBoxWidth)
        const width = Math.max(0, x2 - x1)
        // Only the *other* volumes hide when one is selected — the selected one's own zone stays
        // visible and interactive (now spanning the full track, since `range` narrows to its own
        // page bounds), so clicking it again can toggle the zoom back off.
        const isActive = volume.id === selectedVolumeId
        const isHidden = selectedVolumeId !== null && !isActive
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
              y={TRACK_TOP}
              width={width}
              height={TRACK_BOTTOM - TRACK_TOP}
              className={zoneClassName}
              role="button"
              // Hidden zones stay mounted (for a smooth opacity transition) but drop out of the tab
              // order — pointer-events: none in CSS only blocks the mouse, not keyboard activation.
              tabIndex={isHidden ? -1 : 0}
              aria-hidden={isHidden}
              aria-label={isActive ? t('timelineBar.zoomOutOfVolume') : t('timelineBar.zoomOnVolume', { title: volume.title })}
              onClick={() => onSelect(volume.id)}
              onKeyDown={activateOnEnterOrSpace(() => onSelect(volume.id))}
            />
            {/* Purely decorative — the rect above already carries the full accessible name. */}
            <foreignObject x={x1} y={0} width={width} height={VIEWBOX_HEIGHT} className={labelClassName} aria-hidden="true">
              <div className={styles.volumeLabelText}>{volume.title}</div>
            </foreignObject>
          </g>
        )
      })}
    </>
  )
}

function VolumeDelimiters({ volumes, range, isHidden, viewBoxWidth }: { volumes: VolumeResponse[]; range: PageRange; isHidden: boolean; viewBoxWidth: number }) {
  const className = isHidden ? `${styles.delimiter} ${styles.isHidden}` : styles.delimiter

  return (
    <>
      {volumes.slice(1).map(volume => {
        const x = percentToX(pageToPercent(volume.minPage, range), viewBoxWidth)
        return <line key={volume.id} x1={x} x2={x} y1={0} y2={VIEWBOX_HEIGHT} className={className} />
      })}
    </>
  )
}

function Bookmarks({
  groups,
  onOpen,
  onHoverChange,
  t,
  viewBoxWidth,
}: {
  groups: TimelineGroup[]
  onOpen: (id: string) => void
  onHoverChange: (id: string | null) => void
  t: TranslateFn
  viewBoxWidth: number
}) {
  const pageCounts = new Map<number, number>()
  for (const group of groups) {
    const page = group.quotes[0].pageNumber
    pageCounts.set(page, (pageCounts.get(page) ?? 0) + 1)
  }
  const pageIndexes = new Map<number, number>()

  return (
    <>
      {groups.map(group => {
        const quote = group.quotes[0]
        const page = quote.pageNumber
        const pageIndex = (pageIndexes.get(page) ?? 0) + 1
        pageIndexes.set(page, pageIndex)
        const pageCount = pageCounts.get(page) ?? 1
        const x = percentToX(group.offsetPercent, viewBoxWidth)
        const height = group.isExtended ? BOOKMARK_HEIGHT_EXTENDED : BOOKMARK_HEIGHT_NORMAL
        return (
          <rect
            key={quote.id}
            x={x - BOOKMARK_WIDTH / 2}
            y={TRACK_BOTTOM - height}
            width={BOOKMARK_WIDTH}
            height={height}
            className={styles.bookmark}
            role="button"
            tabIndex={0}
            aria-label={pageCount > 1
              ? t('timelineBar.bookmarkDuplicatePageAriaLabel', { page, index: pageIndex, total: pageCount })
              : t('timelineBar.bookmarkAriaLabel', { page })}
            onClick={() => onOpen(quote.id)}
            onKeyDown={activateOnEnterOrSpace(() => onOpen(quote.id))}
            onMouseEnter={() => onHoverChange(quote.id)}
            onMouseLeave={() => onHoverChange(null)}
            onFocus={() => onHoverChange(quote.id)}
            onBlur={() => onHoverChange(null)}
          />
        )
      })}
    </>
  )
}

export default function TimelineBar({ isConnected, activeTagId, selectedVolumeId, onSelectVolume, onOpenQuote }: TimelineBarProps) {
  const { t } = useTranslation()
  const [hoveredQuoteId, setHoveredQuoteId] = useState<string | null>(null)
  const trackRef = useRef<SVGSVGElement>(null)
  const [viewBoxWidth, setViewBoxWidth] = useState(VIEWBOX_WIDTH)

  const volumesQuery = useVolumes()
  const timelineQuery = useTimeline(activeTagId, isConnected)
  const volumes = volumesQuery.data ?? EMPTY_VOLUMES
  const quotes = isConnected ? timelineQuery.data?.quotes ?? EMPTY_QUOTES : EMPTY_QUOTES
  const isPending = volumesQuery.isPending || (isConnected && timelineQuery.isPending)
  const isError = volumesQuery.isError || (isConnected && timelineQuery.isError)

  // Hooks below must run unconditionally (before the isPending/isError/empty early returns).
  const volumesById = useMemo(
    () => new Map<number, VolumeResponse>(volumes.map(v => [v.id, v])),
    [volumes],
  )
  const selectedVolume = selectedVolumeId !== null ? volumesById.get(selectedVolumeId) : undefined

  const range = useMemo(() => {
    if (volumes.length === 0) return { minPage: 0, maxPage: 0 }
    return selectedVolume
      ? { minPage: selectedVolume.minPage, maxPage: selectedVolume.maxPage }
      : { minPage: volumes[0].minPage, maxPage: volumes[volumes.length - 1].maxPage }
  }, [volumes, selectedVolume])

  const groups = useMemo(() => {
    const visibleQuotes = selectedVolume ? quotes.filter(q => q.volumeId === selectedVolume.id) : quotes
    return positionTimelineQuotes(visibleQuotes, range)
  }, [quotes, selectedVolume, range])

  useLayoutEffect(() => {
    const track = trackRef.current
    if (!track) return

    const updateViewBoxWidth = () => {
      const { width, height } = track.getBoundingClientRect()
      if (width > 0 && height > 0) setViewBoxWidth(width * (VIEWBOX_HEIGHT / height))
    }

    updateViewBoxWidth()
    if (typeof ResizeObserver === 'undefined') return

    const observer = new ResizeObserver(updateViewBoxWidth)
    observer.observe(track)
    return () => observer.disconnect()
  }, [isPending, isError, volumes.length])

  if (isPending) return <Spinner />
  if (isError) return <ErrorMessage message={t('timelineBar.loadError')} />
  if (volumes.length === 0) return null

  const hoveredGroup = groups.find(g => g.quotes[0].id === hoveredQuoteId)

  return (
    <section className={styles.root} aria-label={t('timelineBar.ariaLabel')}>
      <svg
        ref={trackRef}
        className={styles.track}
        viewBox={`0 0 ${viewBoxWidth} ${VIEWBOX_HEIGHT}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={t(isConnected ? 'timelineBar.trackAriaLabel' : 'timelineBar.corpusTrackAriaLabel')}
      >
        <VolumeZones volumes={volumes} range={range} selectedVolumeId={selectedVolumeId} onSelect={onSelectVolume} t={t} viewBoxWidth={viewBoxWidth} />
        <VolumeDelimiters volumes={volumes} range={range} isHidden={selectedVolume !== undefined} viewBoxWidth={viewBoxWidth} />
        {isConnected && <Bookmarks groups={groups} onOpen={onOpenQuote} onHoverChange={setHoveredQuoteId} t={t} viewBoxWidth={viewBoxWidth} />}

        {hoveredGroup && (
          <foreignObject
            x={Math.min(Math.max(0, percentToX(hoveredGroup.offsetPercent, viewBoxWidth) - PREVIEW_WIDTH / 2), viewBoxWidth - PREVIEW_WIDTH)}
            y={0}
            width={PREVIEW_WIDTH}
            height={PREVIEW_HEIGHT}
          >
            <QuoteHoverPreview text={hoveredGroup.quotes[0].selectedText} />
          </foreignObject>
        )}
      </svg>
    </section>
  )
}
