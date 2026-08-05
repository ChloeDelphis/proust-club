import { useMemo, useRef, useState } from 'react'
import type { MouseEvent, ReactNode } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useCurrentUser } from '../../auth/useCurrentUser'
import { useToast } from '../../../components/Toast/useToast'
import { createQuote } from '../../../api/quote'
import type { CreateQuoteParams } from '../../../api/quote'
import { deriveMarkerLabels, getWordBoundaries, snapToNearestBoundary, trimSelection } from '../selectionOffsets'
import { buildParagraphSegments } from '../paragraphSegments'
import type { ParagraphSegment, SelectionMarkers } from '../paragraphSegments'
import { getOffsetFromPoint } from './cursorOffset'
import TagPickerPopup from '../TagPickerPopup/TagPickerPopup'
import type { QuoteSelectionProps, Phase } from './QuoteSelection.types'
import styles from './QuoteSelection.module.css'

function markerLabel(role: 'start' | 'end'): string {
  return role === 'start' ? 'début' : 'fin'
}

function renderSegments(segments: ParagraphSegment[], onMarkerClick?: (role: 'start' | 'end') => void): ReactNode {
  return segments.map((segment, index) => {
    if (segment.type === 'text') {
      return segment.highlighted ? (
        <mark key={index} className={styles.mark}>{segment.text}</mark>
      ) : (
        <span key={index}>{segment.text}</span>
      )
    }

    if (onMarkerClick) {
      return (
        <button
          key={index}
          type="button"
          className={styles.marker}
          onClick={event => {
            event.stopPropagation()
            onMarkerClick(segment.role)
          }}
        >
          {markerLabel(segment.role)}
        </button>
      )
    }

    return (
      <span key={index} className={styles.markerPreview} aria-hidden="true">
        {markerLabel(segment.role)}
      </span>
    )
  })
}

export default function QuoteSelection({
  paragraphId,
  text,
  highlightRange,
  disabled,
  onSelectionStart,
  onSelectionEnd,
}: QuoteSelectionProps) {
  const { isSuccess: isConnected } = useCurrentUser()
  const showToast = useToast()
  const containerRef = useRef<HTMLParagraphElement>(null)
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' })

  const boundaries = useMemo(() => getWordBoundaries(text), [text])

  const createQuoteMutation = useMutation({
    mutationFn: (params: CreateQuoteParams) => createQuote(params),
  })

  const markers: SelectionMarkers = useMemo(() => {
    if (phase.kind === 'idle') return { start: null, end: null }
    if (phase.kind === 'ready' || phase.kind === 'tagPopup') return { start: phase.a, end: phase.b }

    if (phase.settled.length === 0) {
      return { start: phase.live, end: null }
    }
    const live = phase.live ?? phase.settled[0]
    return deriveMarkerLabels(phase.settled[0], live)
  }, [phase])

  const segments = useMemo(
    () => buildParagraphSegments(text, highlightRange, markers),
    [text, highlightRange, markers],
  )

  function handleMouseMove(event: MouseEvent<HTMLParagraphElement>) {
    if (phase.kind !== 'placing' || !containerRef.current) return
    const rawOffset = getOffsetFromPoint(containerRef.current, event.clientX, event.clientY)
    if (rawOffset === null) return
    setPhase({ kind: 'placing', settled: phase.settled, live: snapToNearestBoundary(rawOffset, boundaries) })
  }

  function handleContainerClick() {
    if (phase.kind !== 'placing' || phase.live === null) return
    const offset = phase.live

    if (phase.settled.length === 1 && offset === phase.settled[0]) {
      return // no-op: dropping the second marker on the first one's boundary (empty selection)
    }

    const nextSettled = [...phase.settled, offset]
    if (nextSettled.length === 2) {
      const { start, end } = deriveMarkerLabels(nextSettled[0], nextSettled[1])
      setPhase({ kind: 'ready', a: start, b: end })
    } else {
      setPhase({ kind: 'placing', settled: nextSettled, live: null })
    }
  }

  function handleMarkerClick(role: 'start' | 'end') {
    if (phase.kind !== 'ready') return
    const own = role === 'start' ? phase.a : phase.b
    const other = role === 'start' ? phase.b : phase.a
    setPhase({ kind: 'placing', settled: [other], live: own })
  }

  function handleStart() {
    onSelectionStart()
    setPhase({ kind: 'placing', settled: [], live: null })
  }

  function handleValidate() {
    if (phase.kind !== 'ready') return
    setPhase({ kind: 'tagPopup', a: phase.a, b: phase.b })
  }

  function handleCancel() {
    setPhase({ kind: 'idle' })
    onSelectionEnd()
  }

  function saveQuote(rawStart: number, rawEnd: number, tagNames: string[]) {
    const { start, end } = trimSelection(text, rawStart, rawEnd)
    createQuoteMutation.mutate(
      { paragraphId, startOffset: start, endOffset: end, selectedText: text.slice(start, end), tagNames },
      {
        onSuccess: () => {
          showToast('Citation enregistrée.')
          setPhase({ kind: 'idle' })
          onSelectionEnd()
        },
        onError: () => {
          showToast("La citation n'a pas pu être enregistrée.")
          setPhase({ kind: 'ready', a: rawStart, b: rawEnd })
        },
      },
    )
  }

  function handleFinishPopup(tagNames: string[]) {
    if (phase.kind !== 'tagPopup') return
    saveQuote(phase.a, phase.b, tagNames)
  }

  function handleDismissPopup() {
    if (phase.kind !== 'tagPopup') return
    saveQuote(phase.a, phase.b, [])
  }

  return (
    <div className={styles.root}>
      <p
        ref={containerRef}
        className={phase.kind !== 'idle' ? `${styles.text} ${styles.isSelecting}` : styles.text}
        onMouseMove={handleMouseMove}
        onClick={handleContainerClick}
      >
        {renderSegments(segments, phase.kind === 'ready' ? handleMarkerClick : undefined)}
      </p>

      {isConnected && phase.kind !== 'tagPopup' && (
        <div className={styles.controls}>
          {phase.kind === 'idle' && (
            <button type="button" onClick={handleStart} disabled={disabled}>
              Sauvegarder une citation
            </button>
          )}
          {(phase.kind === 'placing' || phase.kind === 'ready') && (
            <>
              <button type="button" onClick={handleCancel}>
                Annuler
              </button>
              {phase.kind === 'ready' && (
                <button type="button" onClick={handleValidate}>
                  Valider la sélection
                </button>
              )}
            </>
          )}
        </div>
      )}

      {phase.kind === 'tagPopup' && <TagPickerPopup onFinish={handleFinishPopup} onDismiss={handleDismissPopup} />}
    </div>
  )
}
