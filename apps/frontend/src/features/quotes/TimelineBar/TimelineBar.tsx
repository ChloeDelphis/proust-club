import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
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
const BOOKMARK_HEIGHT_NORMAL = 20
const BOOKMARK_HEIGHT_EXTENDED = 35
const BOOKMARK_WIDTH = 4
const PREVIEW_WIDTH = 110
const PREVIEW_HEIGHT = 45
const VOLUME_ROMAN_NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'] as const
const EMPTY_VOLUMES: VolumeResponse[] = []
const EMPTY_QUOTES: TimelineQuote[] = []

function percentToX(percent: number, viewBoxWidth: number): number {
  return percent * (viewBoxWidth / 100)
}

function getMotionDurationMs(element: Element, token: string): number {
  const duration = getComputedStyle(element).getPropertyValue(token).trim()
  const match = /^([\d.]+)(ms|s)$/.exec(duration)
  if (!match) return 0
  return Number(match[1]) * (match[2] === 's' ? 1000 : 1)
}

function snapSvgXToDevicePixelCenter(x: number, scale: number, trackLeft: number): number {
  // Responsive viewBox coordinates can land between device pixels and rasterize with uneven weight.
  const devicePixelRatio = window.devicePixelRatio || 1
  const deviceX = (trackLeft + x * scale) * devicePixelRatio
  const snappedDeviceX = Math.round(deviceX - 0.5) + 0.5
  return (snappedDeviceX / devicePixelRatio - trackLeft) / scale
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
  selectedPartId,
  onSelect,
  t,
  viewBoxWidth,
}: {
  volumes: VolumeResponse[]
  range: PageRange
  selectedVolumeId: number | null
  selectedPartId: number | null
  onSelect: (id: number) => void
  t: TranslateFn
  viewBoxWidth: number
}) {
  return (
    <>
      {volumes.map((volume, index) => {
        const x1 = percentToX(pageToPercent(volume.minPage, range), viewBoxWidth)
        // The delimiter is placed at the next volume's first page. Extend this zone to that
        // same boundary so an inclusive maxPage doesn't leave a sliver of unfilled space.
        const rightBoundaryPage = volumes[index + 1]?.minPage ?? volume.maxPage
        const x2 = percentToX(pageToPercent(rightBoundaryPage, range), viewBoxWidth)
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
              y={0}
              width={width}
              height={VIEWBOX_HEIGHT}
              className={zoneClassName}
              role="button"
              // Hidden zones stay mounted (for a smooth opacity transition) but drop out of the tab
              // order — pointer-events: none in CSS only blocks the mouse, not keyboard activation.
              tabIndex={isHidden ? -1 : 0}
              aria-hidden={isHidden}
              aria-label={isActive
                ? selectedPartId !== null
                  ? t('timelineBar.returnToVolume', { title: volume.title })
                  : t('timelineBar.zoomOutOfVolume')
                : t('timelineBar.zoomOnVolume', { title: volume.title })}
              onClick={() => onSelect(volume.id)}
              onKeyDown={activateOnEnterOrSpace(() => onSelect(volume.id))}
            />
            {/* Purely decorative — the rect above already carries the full accessible name. */}
            <foreignObject x={x1} y={0} width={width} height={VIEWBOX_HEIGHT} className={labelClassName} aria-hidden="true">
              <div className={styles.volumeLabelText}>
                <span className={styles.volumeNumeral}>{VOLUME_ROMAN_NUMERALS[volume.position - 1] ?? volume.position}</span>
                <span className={styles.volumeTitle}>{volume.title}</span>
              </div>
            </foreignObject>
          </g>
        )
      })}
    </>
  )
}

function VolumeDelimiters({
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

function PartStructure({
  volume,
  range,
  selectedPartId,
  onSelectPart,
  t,
  viewBoxWidth,
  viewBoxScale,
  trackLeft,
}: {
  volume: VolumeResponse
  range: PageRange
  selectedPartId: number | null
  onSelectPart: (partId: number, volumeId: number) => void
  t: TranslateFn
  viewBoxWidth: number
  viewBoxScale: number
  trackLeft: number
}) {
  return (
    <>
      {volume.parts.map((part, index) => {
        const nextPart = volume.parts[index + 1]
        const isSelected = selectedPartId === part.id
        const isHidden = selectedPartId !== null && !isSelected
        const startX = selectedPartId === null ? percentToX(pageToPercent(part.startPage, range), viewBoxWidth) : 0
        const endX = selectedPartId === null
          ? percentToX(pageToPercent(nextPart?.startPage ?? volume.maxPage, range), viewBoxWidth)
          : viewBoxWidth
        const zoneClassName = [styles.partZone, isSelected && styles.isActivePart, isHidden && styles.isHidden]
          .filter(Boolean)
          .join(' ')
        return (
          <g key={part.id}>
            <rect
              x={startX}
              y={0}
              width={Math.max(0, endX - startX)}
              height={VIEWBOX_HEIGHT}
              className={zoneClassName}
              role="button"
              tabIndex={isHidden ? -1 : 0}
              aria-hidden={isHidden}
              aria-label={isSelected
                ? t('timelineBar.returnToVolume', { title: volume.title })
                : t('timelineBar.zoomOnPart', { title: part.title })}
              aria-pressed={isSelected}
              onClick={() => onSelectPart(part.id, volume.id)}
              onKeyDown={activateOnEnterOrSpace(() => onSelectPart(part.id, volume.id))}
            />
            {!isHidden && (
              <foreignObject
                x={startX}
                y={0}
                width={Math.max(0, endX - startX)}
                height={VIEWBOX_HEIGHT}
                className={styles.partLabel}
                aria-hidden="true"
              >
                <div className={styles.partTitle}>{part.title}</div>
              </foreignObject>
            )}
            {selectedPartId === null && index > 0 && (
              <line
                x1={snapSvgXToDevicePixelCenter(startX, viewBoxScale, trackLeft)}
                x2={snapSvgXToDevicePixelCenter(startX, viewBoxScale, trackLeft)}
                y1={0}
                y2={VIEWBOX_HEIGHT}
                className={styles.partDelimiter}
              />
            )}
          </g>
        )
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
            y={VIEWBOX_HEIGHT - height}
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

export default function TimelineBar({ isConnected, activeTagId, selectedVolumeId, selectedPartId, onSelectVolume, onSelectPart, onOpenQuote }: TimelineBarProps) {
  const { t } = useTranslation()
  const [hoveredQuoteId, setHoveredQuoteId] = useState<string | null>(null)
  const trackRef = useRef<SVGSVGElement>(null)
  const [viewBoxWidth, setViewBoxWidth] = useState(VIEWBOX_WIDTH)
  const [viewBoxScale, setViewBoxScale] = useState(1)
  const [trackLeft, setTrackLeft] = useState(0)
  const [animatedRange, setAnimatedRange] = useState<PageRange | null>(null)
  const animatedRangeRef = useRef<PageRange | null>(null)

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
  const selectedPart = selectedVolume?.parts.find(part => part.id === selectedPartId)
  const selectedPartIndex = selectedPart
    ? selectedVolume?.parts.findIndex(part => part.id === selectedPart.id) ?? -1
    : -1
  const selectedPartEndPage = selectedPart && selectedVolume
    ? selectedVolume.parts[selectedPartIndex + 1]?.startPage ?? selectedVolume.maxPage
    : undefined
  const selectedPartEndExclusive = selectedPart && selectedVolume && selectedPartIndex === selectedVolume.parts.length - 1
    ? selectedVolume.maxPage + 1
    : selectedPartEndPage

  const range = useMemo(() => {
    if (volumes.length === 0) return { minPage: 0, maxPage: 0 }
    if (selectedPart && selectedPartEndPage !== undefined) {
      return { minPage: selectedPart.startPage, maxPage: selectedPartEndPage }
    }
    return selectedVolume
      ? { minPage: selectedVolume.minPage, maxPage: selectedVolume.maxPage }
      : { minPage: volumes[0].minPage, maxPage: volumes[volumes.length - 1].maxPage }
  }, [volumes, selectedVolume, selectedPart, selectedPartEndPage])

  useEffect(() => {
    if (volumes.length === 0) return

    const startRange = animatedRangeRef.current
    if (!startRange) {
      animatedRangeRef.current = range
      return
    }
    if (startRange.minPage === range.minPage && startRange.maxPage === range.maxPage) return

    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    const track = trackRef.current
    const durationMs = track ? getMotionDurationMs(track, '--motion-duration-zoom') : 0
    if (prefersReducedMotion || durationMs <= 0) {
      animatedRangeRef.current = range
      const frameId = requestAnimationFrame(() => setAnimatedRange(range))
      return () => cancelAnimationFrame(frameId)
    }

    const startTime = performance.now()
    let frameId = 0

    const animateRange = (now: number) => {
      const progress = Math.min(1, (now - startTime) / durationMs)
      const easedProgress = 1 - Math.pow(1 - progress, 3)
      const nextRange = {
        minPage: startRange.minPage + (range.minPage - startRange.minPage) * easedProgress,
        maxPage: startRange.maxPage + (range.maxPage - startRange.maxPage) * easedProgress,
      }

      animatedRangeRef.current = nextRange
      setAnimatedRange(nextRange)

      if (progress < 1) {
        frameId = requestAnimationFrame(animateRange)
      } else {
        animatedRangeRef.current = range
        setAnimatedRange(range)
      }
    }

    frameId = requestAnimationFrame(animateRange)
    return () => cancelAnimationFrame(frameId)
  }, [range, volumes.length])

  const groups = useMemo(() => {
    const visibleQuotes = quotes.filter(quote => {
      if (selectedVolume && quote.volumeId !== selectedVolume.id) return false
      if (selectedPart && (quote.pageNumber < selectedPart.startPage || quote.pageNumber >= (selectedPartEndExclusive ?? Number.POSITIVE_INFINITY))) return false
      return true
    })
    return positionTimelineQuotes(visibleQuotes, animatedRange ?? range)
  }, [quotes, selectedVolume, selectedPart, selectedPartEndExclusive, range, animatedRange])

  useLayoutEffect(() => {
    const track = trackRef.current
    if (!track) return

    const updateViewBoxWidth = () => {
      const { width, height, left } = track.getBoundingClientRect()
      if (width > 0 && height > 0) {
        setViewBoxWidth(width * (VIEWBOX_HEIGHT / height))
        setViewBoxScale(height / VIEWBOX_HEIGHT)
        setTrackLeft(left)
      }
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
      <div className={styles.zoomTitle}>
        {selectedVolume && (
          <div className={styles.zoomTitleBreadcrumb}>
            <button
              type="button"
              className={`${styles.zoomTitleLink} ${styles.zoomTitleRoot}`}
              aria-label={t('timelineBar.returnToAllWork')}
              onClick={() => onSelectVolume(null)}
            >
              {t('volumeList.allWork')}
            </button>
            <span className={styles.zoomTitleSeparator} aria-hidden="true">›</span>
            {selectedPart ? (
              <button
                type="button"
                className={`${styles.zoomTitleLink} ${styles.zoomTitleVolume}`}
                aria-label={t('timelineBar.returnToVolume', { title: selectedVolume.title })}
                onClick={() => onSelectVolume(selectedVolume.id)}
              >
                <span>{VOLUME_ROMAN_NUMERALS[selectedVolume.position - 1] ?? selectedVolume.position}</span>
                <span aria-hidden="true"> · </span>
                <span>{selectedVolume.title}</span>
              </button>
            ) : (
              <span className={styles.zoomTitleCurrent}>
                <span>{VOLUME_ROMAN_NUMERALS[selectedVolume.position - 1] ?? selectedVolume.position}</span>
                <span aria-hidden="true"> · </span>
                <span>{selectedVolume.title}</span>
              </span>
            )}
            {selectedPart && (
              <>
                <span className={styles.zoomTitleSeparator} aria-hidden="true">›</span>
                <span className={styles.zoomTitleCurrent}>{selectedPart.title}</span>
              </>
            )}
          </div>
        )}
      </div>
      <svg
        ref={trackRef}
        className={styles.track}
        viewBox={`0 0 ${viewBoxWidth} ${VIEWBOX_HEIGHT}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={selectedPart
          ? t(isConnected ? 'timelineBar.partTrackAriaLabel' : 'timelineBar.corpusPartTrackAriaLabel', {
            title: selectedPart.title,
            volume: selectedVolume?.title,
          })
          : selectedVolume
            ? t(isConnected ? 'timelineBar.zoomedTrackAriaLabel' : 'timelineBar.zoomedCorpusTrackAriaLabel', {
              title: selectedVolume.title,
              parts: selectedVolume.parts.map(part => part.title).join(', '),
            })
          : t(isConnected ? 'timelineBar.trackAriaLabel' : 'timelineBar.corpusTrackAriaLabel')}
      >
        <VolumeZones
          volumes={volumes}
          range={animatedRange ?? range}
          selectedVolumeId={selectedVolumeId}
          selectedPartId={selectedPart?.id ?? null}
          onSelect={onSelectVolume}
          t={t}
          viewBoxWidth={viewBoxWidth}
        />
        <VolumeDelimiters
          volumes={volumes}
          range={animatedRange ?? range}
          isHidden={selectedVolume !== undefined}
          viewBoxWidth={viewBoxWidth}
          viewBoxScale={viewBoxScale}
          trackLeft={trackLeft}
        />
        {selectedVolume && (
          <PartStructure
            volume={selectedVolume}
            range={animatedRange ?? range}
            selectedPartId={selectedPart?.id ?? null}
            onSelectPart={onSelectPart}
            t={t}
            viewBoxWidth={viewBoxWidth}
            viewBoxScale={viewBoxScale}
            trackLeft={trackLeft}
          />
        )}
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
