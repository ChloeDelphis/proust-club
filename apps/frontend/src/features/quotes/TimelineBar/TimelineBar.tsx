import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { SearchOverviewMarker } from '../../../api/search'
import type { VolumeResponse } from '../../../api/volume'
import type { TimelineQuote } from '../../../api/quote'
import Spinner from '../../../components/Spinner/Spinner'
import ErrorMessage from '../../../components/ErrorMessage/ErrorMessage'
import QuoteHoverPreview from '../QuoteHoverPreview/QuoteHoverPreview'
import { useTimeline } from '../useTimeline'
import { useVolumes } from '../useVolumes'
import { positionTimelineQuotes } from './positionTimelineQuotes'
import type { TimelineBarProps, TimelinePreview } from './TimelineBar.types'
import { Bookmarks, SearchMatches } from './TimelineMarkerLayers'
import { PartStructure, VolumeDelimiters, VolumeZones } from './TimelineStructureLayers'
import {
  PREVIEW_HEIGHT,
  PREVIEW_WIDTH,
  TITLE_TRACK_HEIGHT,
  VIEWBOX_HEIGHT,
  VOLUME_ROMAN_NUMERALS,
  percentToX,
} from './timelineSvgLayout'
import { useTimelineViewport } from './useTimelineViewport'
import styles from './TimelineBar.module.css'

const EMPTY_VOLUMES: VolumeResponse[] = []
const EMPTY_QUOTES: TimelineQuote[] = []
const EMPTY_SEARCH_MARKERS: SearchOverviewMarker[] = []
const EMPTY_COUNTS = new Map<number, number>()

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
  const { trackRef, viewBoxWidth, viewBoxScale, trackLeft, animatedRange } = useTimelineViewport({
    range,
    volumeCount: volumes.length,
    isPending,
    isError,
  })

  const quoteGroups = useMemo(() => {
    const visibleQuotes = quotes.filter(quote => {
      if (selectedVolume && quote.volumeId !== selectedVolume.id) return false
      if (selectedPart && (quote.pageNumber < selectedPart.startPage || quote.pageNumber >= (selectedPartEndExclusive ?? Number.POSITIVE_INFINITY))) return false
      return true
    })
    return positionTimelineQuotes(visibleQuotes, animatedRange)
  }, [quotes, selectedVolume, selectedPart, selectedPartEndExclusive, animatedRange])
  const searchGroups = useMemo(
    () => positionTimelineQuotes(visibleSearchMarkers, animatedRange),
    [visibleSearchMarkers, animatedRange],
  )

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
          range={animatedRange}
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
          range={animatedRange}
          isHidden={selectedVolume !== undefined}
          viewBoxWidth={viewBoxWidth}
          viewBoxScale={viewBoxScale}
          trackLeft={trackLeft}
        />
        {selectedVolume && (
          <PartStructure
            volume={selectedVolume}
            range={animatedRange}
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
