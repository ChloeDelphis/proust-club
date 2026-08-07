import { useMemo, useState, type KeyboardEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getQuoteTimeline } from '../../../api/quote'
import type { TimelineQuote, TimelineVolume } from '../../../api/quote'
import Spinner from '../../../components/Spinner/Spinner'
import ErrorMessage from '../../../components/ErrorMessage/ErrorMessage'
import FilterButton from '../../../components/FilterButton/FilterButton'
import QuoteHoverPreview from '../QuoteHoverPreview/QuoteHoverPreview'
import QuoteDetailModal from '../QuoteDetailModal/QuoteDetailModal'
import { pageToPercent, positionTimelineQuotes } from './positionTimelineQuotes'
import type { TimelineBarProps } from './TimelineBar.types'
import styles from './TimelineBar.module.css'

// SVG viewBox units, not pixels — preserveAspectRatio="none" stretches this to the container's
// real size, so the same layout math works at any width without touching the DOM (no
// getBoundingClientRect/ResizeObserver, see positionTimelineQuotes.ts).
const VIEWBOX_WIDTH = 1000
const TRACK_TOP = 100
const TRACK_BOTTOM = 190
const BOOKMARK_HEIGHT_NORMAL = 40
const BOOKMARK_HEIGHT_EXTENDED = 70
const BOOKMARK_WIDTH = 8
const PREVIEW_WIDTH = 220
const PREVIEW_HEIGHT = 90

function percentToX(percent: number): number {
  return percent * (VIEWBOX_WIDTH / 100)
}

function activateOnEnterOrSpace(onActivate: () => void) {
  return (event: KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onActivate()
    }
  }
}

export default function TimelineBar({ activeTagId }: TimelineBarProps) {
  const [selectedVolumeId, setSelectedVolumeId] = useState<number | null>(null)
  const [hoveredQuoteId, setHoveredQuoteId] = useState<number | null>(null)
  const [openQuote, setOpenQuote] = useState<TimelineQuote | null>(null)

  const { data, isPending, isError } = useQuery({
    queryKey: ['quotes', 'timeline', activeTagId],
    queryFn: ({ signal }) => getQuoteTimeline({ tagId: activeTagId ?? undefined }, signal),
    staleTime: 60_000,
  })

  // Hooks below must run unconditionally (before the isPending/isError/empty early returns),
  // so each guards against a still-undefined `data` internally rather than skipping the hook.
  const volumesById = useMemo(
    () => new Map<number, TimelineVolume>((data?.volumes ?? []).map(v => [v.id, v])),
    [data?.volumes],
  )
  const selectedVolume = selectedVolumeId !== null ? volumesById.get(selectedVolumeId) : undefined

  const range = useMemo(() => {
    if (!data || data.volumes.length === 0) return { minPage: 0, maxPage: 0 }
    return selectedVolume
      ? { minPage: selectedVolume.minPage, maxPage: selectedVolume.maxPage }
      : { minPage: data.volumes[0].minPage, maxPage: data.volumes[data.volumes.length - 1].maxPage }
  }, [data, selectedVolume])

  const groups = useMemo(() => {
    if (!data) return []
    const visibleQuotes = selectedVolume ? data.quotes.filter(q => q.volumeId === selectedVolume.id) : data.quotes
    return positionTimelineQuotes(visibleQuotes, range)
  }, [data, selectedVolume, range])

  if (isPending) return <Spinner />
  if (isError) return <ErrorMessage message="La frise n'a pas pu être chargée." />
  if (data.volumes.length === 0) return null

  const hoveredGroup = groups.find(g => g.quotes[0].id === hoveredQuoteId)

  return (
    <section className={styles.root} aria-label="Frise de mes citations">
      <nav className={styles.volumeFilters} aria-label="Filtrer par tome">
        <FilterButton active={selectedVolumeId === null} onClick={() => setSelectedVolumeId(null)}>
          Tous les tomes
        </FilterButton>
        {data.volumes.map(volume => (
          <FilterButton key={volume.id} active={selectedVolumeId === volume.id} onClick={() => setSelectedVolumeId(volume.id)}>
            {volume.title}
          </FilterButton>
        ))}
      </nav>

      <svg
        className={styles.track}
        viewBox={`0 0 ${VIEWBOX_WIDTH} 200`}
        preserveAspectRatio="none"
        role="img"
        aria-label="Positions des citations sauvegardées dans l'œuvre"
      >
        {!selectedVolume && data.volumes.map(volume => {
          const x1 = percentToX(pageToPercent(volume.minPage, range))
          const x2 = percentToX(pageToPercent(volume.maxPage, range))
          return (
            <rect
              key={volume.id}
              x={x1}
              y={TRACK_TOP}
              width={Math.max(0, x2 - x1)}
              height={TRACK_BOTTOM - TRACK_TOP}
              className={styles.volumeZone}
              role="button"
              tabIndex={0}
              aria-label={`Zoomer sur ${volume.title}`}
              onClick={() => setSelectedVolumeId(volume.id)}
              onKeyDown={activateOnEnterOrSpace(() => setSelectedVolumeId(volume.id))}
            />
          )
        })}

        {!selectedVolume && data.volumes.slice(1).map(volume => {
          const x = percentToX(pageToPercent(volume.minPage, range))
          return <line key={volume.id} x1={x} x2={x} y1={TRACK_TOP} y2={TRACK_BOTTOM} className={styles.delimiter} />
        })}

        {groups.map(group => {
          const quote = group.quotes[0]
          const x = percentToX(group.offsetPercent)
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
              aria-label={`Citation page ${quote.pageNumber}`}
              onClick={() => setOpenQuote(quote)}
              onKeyDown={activateOnEnterOrSpace(() => setOpenQuote(quote))}
              onMouseEnter={() => setHoveredQuoteId(quote.id)}
              onMouseLeave={() => setHoveredQuoteId(null)}
              onFocus={() => setHoveredQuoteId(quote.id)}
              onBlur={() => setHoveredQuoteId(null)}
            />
          )
        })}

        {hoveredGroup && (
          <foreignObject
            x={Math.min(Math.max(0, percentToX(hoveredGroup.offsetPercent) - PREVIEW_WIDTH / 2), VIEWBOX_WIDTH - PREVIEW_WIDTH)}
            y={0}
            width={PREVIEW_WIDTH}
            height={PREVIEW_HEIGHT}
          >
            <QuoteHoverPreview text={hoveredGroup.quotes[0].selectedText} />
          </foreignObject>
        )}
      </svg>

      <QuoteDetailModal
        quote={openQuote}
        volumeTitle={openQuote ? volumesById.get(openQuote.volumeId)?.title : undefined}
        onClose={() => setOpenQuote(null)}
      />
    </section>
  )
}
