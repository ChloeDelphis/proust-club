import { useTranslation } from 'react-i18next'
import type { SearchOverviewMarker } from '../../../api/search'
import type { TimelineQuote } from '../../../api/quote'
import type { TimelineGroup } from './positionTimelineQuotes'
import styles from './TimelineBar.module.css'
import { activateOnEnterOrSpace } from './timelineLayerUtils'
import type { TimelinePreview } from './TimelineBar.types'
import {
  BOOKMARK_HEIGHT_EXTENDED,
  BOOKMARK_HEIGHT_NORMAL,
  BOOKMARK_WIDTH,
  VIEWBOX_HEIGHT,
  percentToX,
} from './timelineSvgLayout'

type TranslateFn = ReturnType<typeof useTranslation>['t']

export function Bookmarks({
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

export function SearchMatches({
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
