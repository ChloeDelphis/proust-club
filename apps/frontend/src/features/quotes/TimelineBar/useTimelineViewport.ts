import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { PageRange } from './positionTimelineQuotes'
import { VIEWBOX_HEIGHT, VIEWBOX_WIDTH } from './timelineSvgLayout'

type UseTimelineViewportParams = {
  range: PageRange
  volumeCount: number
  isPending: boolean
  isError: boolean
}

export function useTimelineViewport({ range, volumeCount, isPending, isError }: UseTimelineViewportParams) {
  const trackRef = useRef<SVGSVGElement>(null)
  const [viewBoxWidth, setViewBoxWidth] = useState(VIEWBOX_WIDTH)
  const [viewBoxScale, setViewBoxScale] = useState(1)
  const [trackLeft, setTrackLeft] = useState(0)
  const [animatedRange, setAnimatedRange] = useState<PageRange | null>(null)
  const animatedRangeRef = useRef<PageRange | null>(null)
  const [, setFontMetricsReady] = useState(false)

  useEffect(() => {
    let isMounted = true
    document.fonts?.ready.then(() => {
      if (isMounted) setFontMetricsReady(true)
    })
    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    if (volumeCount === 0) return

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
  }, [range, volumeCount])

  useLayoutEffect(() => {
    const track = trackRef.current
    if (!track) return

    const updateViewBox = () => {
      const { width, height, left } = track.getBoundingClientRect()
      if (width > 0 && height > 0) {
        setViewBoxWidth(width * (VIEWBOX_HEIGHT / height))
        setViewBoxScale(height / VIEWBOX_HEIGHT)
        setTrackLeft(left)
      }
    }

    updateViewBox()
    if (typeof ResizeObserver === 'undefined') return

    const observer = new ResizeObserver(updateViewBox)
    observer.observe(track)
    return () => observer.disconnect()
  }, [isPending, isError, volumeCount])

  return {
    trackRef,
    viewBoxWidth,
    viewBoxScale,
    trackLeft,
    animatedRange: animatedRange ?? range,
  }
}

function getMotionDurationMs(element: Element, token: string): number {
  const duration = getComputedStyle(element).getPropertyValue(token).trim()
  const match = /^([\d.]+)(ms|s)$/.exec(duration)
  if (!match) return 0
  return Number(match[1]) * (match[2] === 's' ? 1000 : 1)
}
