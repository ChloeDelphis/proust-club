import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { SearchOverviewMarker } from '../../../api/search'
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
const TITLE_TRACK_HEIGHT = 64
const BOOKMARK_HEIGHT_NORMAL = 20
const BOOKMARK_HEIGHT_EXTENDED = 35
const BOOKMARK_WIDTH = 0.75
const PREVIEW_WIDTH = 110
const PREVIEW_HEIGHT = 45
const VOLUME_ROMAN_NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'] as const
const EMPTY_VOLUMES: VolumeResponse[] = []
const EMPTY_QUOTES: TimelineQuote[] = []
const EMPTY_SEARCH_MARKERS: SearchOverviewMarker[] = []
const EMPTY_COUNTS = new Map<number, number>()
const TITLE_FONT_SIZES_REM = [0.625, 0.5625, 0.5, 0.4375, 0.375] as const
const TITLE_SIZE_CLASSES = ['', styles.compactTitle, styles.denseTitle, styles.tinyTitle, styles.microTitle] as const
let titleMeasureContext: CanvasRenderingContext2D | null = null

type TimelinePreview = { text: string; offsetPercent: number }

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

function titleFontClass(
  title: string,
  width: number,
  height: number,
  scale: number,
  horizontalPaddingRem: number,
  verticalPaddingRem: number,
): string {
  if (typeof document === 'undefined') return ''

  const rootStyle = getComputedStyle(document.documentElement)
  const rootFontSize = Number.parseFloat(rootStyle.fontSize) || 16
  const contentWidth = Math.max(1, (width - horizontalPaddingRem * rootFontSize) * scale)
  const contentHeight = Math.max(1, (height - verticalPaddingRem * rootFontSize) * scale)
  titleMeasureContext ??= document.createElement('canvas').getContext('2d')
  const context = titleMeasureContext
  if (!context) return ''

  const fontFamily = rootStyle.getPropertyValue('--font-reading').trim() || 'Georgia, serif'
  for (const [index, fontSizeRem] of TITLE_FONT_SIZES_REM.entries()) {
    const fontSize = fontSizeRem * rootFontSize * scale
    context.font = `400 ${fontSize}px ${fontFamily}`
    const lineCount = getWrappedLineCount(title, contentWidth, context)
    if (lineCount * fontSize * 1.4 <= contentHeight) return TITLE_SIZE_CLASSES[index] ?? ''
  }

  return TITLE_SIZE_CLASSES[TITLE_SIZE_CLASSES.length - 1] ?? ''
}

function getWrappedLineCount(text: string, maxWidth: number, context: CanvasRenderingContext2D): number {
  const words = text.trim().split(/\s+/).filter(Boolean)
  let lineCount = 1
  let lineWidth = 0
  const spaceWidth = context.measureText(' ').width

  for (const word of words) {
    const wordWidth = context.measureText(word).width
    if (lineWidth > 0 && lineWidth + spaceWidth + wordWidth <= maxWidth) {
      lineWidth += spaceWidth + wordWidth
      continue
    }
    if (wordWidth <= maxWidth) {
      if (lineWidth > 0) lineCount += 1
      lineWidth = wordWidth
      continue
    }

    if (lineWidth > 0) {
      lineCount += 1
      lineWidth = 0
    }
    for (const character of word) {
      const characterWidth = context.measureText(character).width
      if (lineWidth > 0 && lineWidth + characterWidth > maxWidth) {
        lineCount += 1
        lineWidth = characterWidth
      } else {
        lineWidth += characterWidth
      }
    }
  }

  return lineCount
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

function VolumeZones({
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
              // Hidden zones stay mounted (for a smooth opacity transition) but drop out of the tab
              // order — pointer-events: none in CSS only blocks the mouse, not keyboard activation.
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
            {/* Purely decorative — the rect above already carries the full accessible name. */}
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

function Bookmarks({
  groups,
  onOpen,
  onHoverChange,
  t,
  viewBoxWidth,
}: {
  groups: TimelineGroup<TimelineQuote>[]
  onOpen: (id: string) => void
  onHoverChange: (preview: TimelinePreview | null) => void
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
            onMouseEnter={() => onHoverChange({ text: quote.selectedText, offsetPercent: group.offsetPercent })}
            onMouseLeave={() => onHoverChange(null)}
            onFocus={() => onHoverChange({ text: quote.selectedText, offsetPercent: group.offsetPercent })}
            onBlur={() => onHoverChange(null)}
          />
        )
      })}
    </>
  )
}

function SearchMatches({
  groups,
  onHoverChange,
  t,
  viewBoxWidth,
}: {
  groups: TimelineGroup<SearchOverviewMarker>[]
  onHoverChange: (preview: TimelinePreview | null) => void
  t: TranslateFn
  viewBoxWidth: number
}) {
  return (
    <>
      {groups.map(group => {
        const marker = group.quotes[0]
        const x = percentToX(group.offsetPercent, viewBoxWidth)
        const height = group.isExtended ? BOOKMARK_HEIGHT_EXTENDED : BOOKMARK_HEIGHT_NORMAL
        const preview = { text: marker.previewText, offsetPercent: group.offsetPercent }
        return (
          <rect
            key={marker.paragraphId}
            x={x - BOOKMARK_WIDTH / 2}
            y={VIEWBOX_HEIGHT - height}
            width={BOOKMARK_WIDTH}
            height={height}
            className={styles.searchMatch}
            role="img"
            tabIndex={0}
            aria-label={t('timelineBar.searchMatchAriaLabel', { page: marker.pageNumber, preview: marker.previewText })}
            onMouseEnter={() => onHoverChange(preview)}
            onMouseLeave={() => onHoverChange(null)}
            onFocus={() => onHoverChange(preview)}
            onBlur={() => onHoverChange(null)}
          />
        )
      })}
    </>
  )
}

export default function TimelineBar({
  isConnected,
  activeTagId,
  selectedVolumeId,
  selectedPartId,
  corpusSearchActive = false,
  corpusSearchOverview,
  onSelectVolume,
  onSelectPart,
  onOpenQuote,
}: TimelineBarProps) {
  const { t } = useTranslation()
  const [hoveredPreview, setHoveredPreview] = useState<TimelinePreview | null>(null)
  const [, setFontMetricsReady] = useState(false)
  const trackRef = useRef<SVGSVGElement>(null)
  const [viewBoxWidth, setViewBoxWidth] = useState(VIEWBOX_WIDTH)
  const [viewBoxScale, setViewBoxScale] = useState(1)
  const [trackLeft, setTrackLeft] = useState(0)
  const [animatedRange, setAnimatedRange] = useState<PageRange | null>(null)
  const animatedRangeRef = useRef<PageRange | null>(null)

  useEffect(() => {
    let isMounted = true
    document.fonts?.ready.then(() => {
      if (isMounted) setFontMetricsReady(true)
    })
    return () => {
      isMounted = false
    }
  }, [])

  const volumesQuery = useVolumes()
  const timelineQuery = useTimeline(activeTagId, isConnected && !corpusSearchActive)
  const volumes = volumesQuery.data ?? EMPTY_VOLUMES
  const quotes = isConnected && !corpusSearchActive ? timelineQuery.data?.quotes ?? EMPTY_QUOTES : EMPTY_QUOTES
  const isPending = volumesQuery.isPending || (isConnected && !corpusSearchActive && timelineQuery.isPending)
  const isError = volumesQuery.isError || (isConnected && !corpusSearchActive && timelineQuery.isError)

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

  const volumeCounts = useMemo(
    () => new Map(corpusSearchOverview?.volumeCounts.map(({ volumeId, count }) => [volumeId, count] as const) ?? []),
    [corpusSearchOverview],
  )
  const partCounts = useMemo(
    () => new Map(corpusSearchOverview?.partCounts.map(({ partId, count }) => [partId, count] as const) ?? []),
    [corpusSearchOverview],
  )
  const visibleSearchMarkers = useMemo(() => {
    if (!corpusSearchActive || !corpusSearchOverview) return EMPTY_SEARCH_MARKERS
    return corpusSearchOverview.markers.filter(marker => {
      if (selectedVolume && marker.volumeId !== selectedVolume.id) return false
      if (selectedPart && (marker.pageNumber < selectedPart.startPage || marker.pageNumber >= (selectedPartEndExclusive ?? Number.POSITIVE_INFINITY))) return false
      return true
    })
  }, [corpusSearchActive, corpusSearchOverview, selectedVolume, selectedPart, selectedPartEndExclusive])

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

  const quoteGroups = useMemo(() => {
    const visibleQuotes = quotes.filter(quote => {
      if (selectedVolume && quote.volumeId !== selectedVolume.id) return false
      if (selectedPart && (quote.pageNumber < selectedPart.startPage || quote.pageNumber >= (selectedPartEndExclusive ?? Number.POSITIVE_INFINITY))) return false
      return true
    })
    return positionTimelineQuotes(visibleQuotes, animatedRange ?? range)
  }, [quotes, selectedVolume, selectedPart, selectedPartEndExclusive, range, animatedRange])
  const searchGroups = useMemo(
    () => positionTimelineQuotes(visibleSearchMarkers, animatedRange ?? range),
    [visibleSearchMarkers, animatedRange, range],
  )

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

  return (
    <section className={styles.root} aria-label={t('timelineBar.ariaLabel')}>
      <div className={styles.zoomTitle}>
        <div className={styles.zoomTitleBreadcrumb}>
          {selectedVolume ? (
            <button
              type="button"
              className={`${styles.zoomTitleLink} ${styles.zoomTitleRoot}`}
              aria-label={t('timelineBar.returnToAllWork')}
              onClick={() => onSelectVolume(null)}
            >
              {t('volumeList.allWork')}
            </button>
          ) : (
            <span className={`${styles.zoomTitleCurrent} ${styles.zoomTitleRoot}`} aria-current="page">
              {t('volumeList.allWork')}
            </span>
          )}
          {selectedVolume && (
            <>
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
            </>
          )}
        </div>
      </div>
      <svg
        ref={trackRef}
        className={styles.track}
        viewBox={`0 0 ${viewBoxWidth} ${VIEWBOX_HEIGHT}`}
        preserveAspectRatio="none"
        role="group"
        aria-label={selectedPart
          ? t(corpusSearchActive
            ? 'timelineBar.searchPartTrackAriaLabel'
            : isConnected ? 'timelineBar.partTrackAriaLabel' : 'timelineBar.corpusPartTrackAriaLabel', {
            title: selectedPart.title,
            volume: selectedVolume?.title,
            count: partCounts.get(selectedPart.id) ?? 0,
          })
          : selectedVolume
            ? t(corpusSearchActive
              ? 'timelineBar.searchZoomedTrackAriaLabel'
              : isConnected ? 'timelineBar.zoomedTrackAriaLabel' : 'timelineBar.zoomedCorpusTrackAriaLabel', {
              title: selectedVolume.title,
              parts: selectedVolume.parts.map(part => part.title).join(', '),
              count: volumeCounts.get(selectedVolume.id) ?? 0,
            })
          : t(corpusSearchActive
            ? 'timelineBar.searchTrackAriaLabel'
            : isConnected ? 'timelineBar.trackAriaLabel' : 'timelineBar.corpusTrackAriaLabel')}
      >
        <rect x={0} y={0} width={viewBoxWidth} height={TITLE_TRACK_HEIGHT} className={styles.titleTrackBackground} />
        <rect
          x={0}
          y={TITLE_TRACK_HEIGHT}
          width={viewBoxWidth}
          height={VIEWBOX_HEIGHT - TITLE_TRACK_HEIGHT}
          className={styles.bookmarkTrackBackground}
        />
        <VolumeZones
          volumes={volumes}
          range={animatedRange ?? range}
          selectedVolumeId={selectedVolumeId}
          selectedPartId={selectedPart?.id ?? null}
          onSelect={onSelectVolume}
          t={t}
          viewBoxWidth={viewBoxWidth}
          viewBoxScale={viewBoxScale}
          volumeCounts={corpusSearchActive && !selectedVolume ? volumeCounts : EMPTY_COUNTS}
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
            partCounts={corpusSearchActive ? partCounts : EMPTY_COUNTS}
          />
        )}
        {corpusSearchActive ? (
          <SearchMatches groups={searchGroups} onHoverChange={setHoveredPreview} t={t} viewBoxWidth={viewBoxWidth} />
        ) : isConnected && (
          <Bookmarks groups={quoteGroups} onOpen={onOpenQuote} onHoverChange={setHoveredPreview} t={t} viewBoxWidth={viewBoxWidth} />
        )}

        {hoveredPreview && (
          <foreignObject
            x={Math.min(Math.max(0, percentToX(hoveredPreview.offsetPercent, viewBoxWidth) - PREVIEW_WIDTH / 2), viewBoxWidth - PREVIEW_WIDTH)}
            y={0}
            width={PREVIEW_WIDTH}
            height={PREVIEW_HEIGHT}
          >
            <QuoteHoverPreview text={hoveredPreview.text} />
          </foreignObject>
        )}
      </svg>
    </section>
  )
}
