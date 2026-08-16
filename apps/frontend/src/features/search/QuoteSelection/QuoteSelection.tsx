import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useCurrentUser } from '../../auth/useCurrentUser'
import { useToast } from '../../../components/Toast/useToast'
import { createQuote } from '../../../api/quote'
import type { CreateQuoteParams } from '../../../api/quote'
import { snapSelectionOutward, trimSelection } from '../selectionOffsets'
import { getSelectionOffsets } from '../selectionRangeOffset'
import { buildHighlightSegments } from '../paragraphSegments'
import TagPickerPopup from '../TagPickerPopup/TagPickerPopup'
import type { QuoteSelectionProps, Phase } from './QuoteSelection.types'
import styles from './QuoteSelection.module.css'

export default function QuoteSelection({ paragraphId, text, highlightRange }: QuoteSelectionProps) {
  const { isSuccess: isConnected } = useCurrentUser()
  const showToast = useToast()
  const containerRef = useRef<HTMLParagraphElement>(null)
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' })

  const segments = useMemo(() => buildHighlightSegments(text, highlightRange), [text, highlightRange])

  const createQuoteMutation = useMutation({
    mutationFn: (params: CreateQuoteParams) => createQuote(params),
  })

  // Native selection is unique per document — restricting this to a single paragraph, and only
  // ever having one active at a time across the whole results page, both fall out for free from
  // checking that the Range is fully contained in this instance's own container. No shared
  // context needed to coordinate across paragraphs (unlike the old repositionable-markers UI).
  // Not gated on `isConnected`: tracking the selection is harmless for an anonymous visitor too
  // (only rendering the contextual menu below is gated on it), and not gating here avoids this
  // effect's setup racing against `useCurrentUser`'s query resolving.
  useEffect(() => {
    function handleSelectionChange() {
      const container = containerRef.current
      const selection = window.getSelection()

      // A single functional update, so the tag panel (once open) is never yanked away by a
      // selectionchange firing while it's up — the original text selection is deliberately left
      // intact behind it (see the "Sauvegarder" button's onMouseDown below), so it can still
      // report a live, non-collapsed selection at that point.
      setPhase(current => {
        if (current.kind === 'tagPanel') return current
        const toIdle: Phase = current.kind === 'selected' ? { kind: 'idle' } : current

        if (!container || !selection || selection.isCollapsed || selection.rangeCount === 0) return toIdle

        const offsets = getSelectionOffsets(container, selection.getRangeAt(0))
        if (!offsets) return toIdle

        const extended = snapSelectionOutward(text, offsets.start, offsets.end)
        const trimmed = trimSelection(text, extended.start, extended.end)
        if (trimmed.start >= trimmed.end) return toIdle

        return { kind: 'selected', start: trimmed.start, end: trimmed.end }
      })
    }

    document.addEventListener('selectionchange', handleSelectionChange)
    return () => document.removeEventListener('selectionchange', handleSelectionChange)
  }, [text])

  function handleSaveClick() {
    if (phase.kind !== 'selected') return
    setPhase({ kind: 'tagPanel', start: phase.start, end: phase.end })
  }

  // The native selection is deliberately left intact while the tag panel is open (see the
  // "Sauvegarder" button's onMouseDown below) — leaving idle without clearing it would strand a
  // visible highlight with no menu to act on it.
  function resetToIdle() {
    window.getSelection()?.removeAllRanges()
    setPhase({ kind: 'idle' })
  }

  function handleSave(tagNames: string[]) {
    if (phase.kind !== 'tagPanel') return
    const { start, end } = phase
    createQuoteMutation.mutate(
      { paragraphId, startOffset: start, endOffset: end, selectedText: text.slice(start, end), tagNames },
      {
        onSuccess: () => {
          showToast('Citation enregistrée.')
          resetToIdle()
        },
        onError: () => {
          showToast("La citation n'a pas pu être enregistrée.")
          setPhase({ kind: 'selected', start, end })
        },
      },
    )
  }

  function handleCancelPanel() {
    if (phase.kind !== 'tagPanel') return
    resetToIdle()
  }

  return (
    <div className={styles.root}>
      <p ref={containerRef} className={styles.text}>
        {segments.map((segment, index) =>
          segment.highlighted ? (
            <mark key={index} className={styles.mark}>{segment.text}</mark>
          ) : (
            <span key={index}>{segment.text}</span>
          ),
        )}
      </p>

      {isConnected && phase.kind === 'selected' && (
        <div className={styles.contextualMenu}>
          <button
            type="button"
            // Without this, the button's own mousedown collapses the native selection before the
            // click fires (default browser behavior for a mousedown outside the selected text) —
            // that would both hide the highlight and flip `phase` back to idle via the
            // selectionchange handler above, before handleSaveClick ever runs.
            onMouseDown={event => event.preventDefault()}
            onClick={handleSaveClick}
          >
            Sauvegarder
          </button>
        </div>
      )}

      {phase.kind === 'tagPanel' && (
        <TagPickerPopup onSave={handleSave} onCancel={handleCancelPanel} isSaving={createQuoteMutation.isPending} />
      )}
    </div>
  )
}
