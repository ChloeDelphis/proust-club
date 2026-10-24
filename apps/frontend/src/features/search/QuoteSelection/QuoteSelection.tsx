import { useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { useCurrentUser } from '../../auth/useCurrentUser'
import { ApiError } from '../../../api/client'
import { useToast } from '../../../components/Toast/useToast'
import { computeSelectionPhase } from '../computeSelectionPhase'
import { buildHighlightSegments } from '../paragraphSegments'
import { useCreateQuoteMutation } from '../useCreateQuoteMutation'
import TagPickerPopup from '../TagPickerPopup/TagPickerPopup'
import AuthenticationPrompt from '../TagPickerPopup/AuthenticationPrompt'
import { createRangeForOffsets } from '../selectionRangeOffset'
import { useGuestQuoteSave } from '../useGuestQuoteSave'
import type { QuoteSelectionProps, Phase } from './QuoteSelection.types'
import styles from './QuoteSelection.module.css'

export default function QuoteSelection({
  paragraphId,
  text,
  highlightRange,
  sourceOffset = 0,
  hasLeadingEllipsis = false,
  hasTrailingEllipsis = false,
  onOpenDetail,
  resumeDraft = null,
  searchContext = { query: '', page: 0, volumeId: null },
}: QuoteSelectionProps) {
  const { t } = useTranslation()
  const { data: currentUser, isPending: isUserPending } = useCurrentUser()
  const navigate = useNavigate()
  const { setDraft, clearDraft } = useGuestQuoteSave()
  const isConnected = currentUser !== null && currentUser !== undefined
  const isAuthResolved = !isUserPending
  const showToast = useToast()
  const containerRef = useRef<HTMLSpanElement>(null)
  const saveInFlightRef = useRef(false)
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' })
  const phaseRef = useRef(phase)
  const [saveError, setSaveError] = useState<string | null>(null)

  function updatePhase(next: Phase) {
    phaseRef.current = next
    setPhase(next)
  }

  // A slow save can resolve after this instance has unmounted (e.g. the user changed the search
  // query or page while it was in flight) — `createQuoteMutation`'s callbacks are plain functions,
  // not tied to this component's lifecycle, so `onSuccess` would still run. Guards the one call
  // in that path with a real, observable side effect outside React (`removeAllRanges` acts on the
  // whole document's selection, not just this paragraph's): React's own `setPhase` calls need no
  // such guard, since React already silently no-ops a state update on an unmounted component.
  const isMountedRef = useRef(true)
  useEffect(() => {
    // Sets it back to `true` on setup, not just `false` on cleanup: React 18 StrictMode's dev-only
    // mount→cleanup→mount double-invoke would otherwise run the cleanup once and leave this stuck
    // at `false` for the component's entire real lifetime — the same class of bug already hit and
    // documented in ConfirmEmailPage.tsx.
    isMountedRef.current = true
    return () => { isMountedRef.current = false }
  }, [])

  const segments = useMemo(() => buildHighlightSegments(text, highlightRange), [text, highlightRange])

  const createQuoteMutation = useCreateQuoteMutation()

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
      const nextPhase = computeSelectionPhase(phaseRef.current, container, selection, text)
      updatePhase(nextPhase)
      if (resumeDraft && nextPhase.kind === 'selected'
        && (nextPhase.start + sourceOffset !== resumeDraft.start || nextPhase.end + sourceOffset !== resumeDraft.end)) clearDraft()
    }

    document.addEventListener('selectionchange', handleSelectionChange)
    return () => document.removeEventListener('selectionchange', handleSelectionChange)
  }, [text, sourceOffset, resumeDraft, clearDraft])

  useEffect(() => {
    if (!resumeDraft || resumeDraft.paragraphId !== paragraphId || !containerRef.current) return
    const range = createRangeForOffsets(
      containerRef.current,
      resumeDraft.start - sourceOffset,
      resumeDraft.end - sourceOffset,
    )
    if (!range || range.toString() !== resumeDraft.selectedText) return
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
    document.dispatchEvent(new Event('selectionchange'))
    if (resumeDraft.scrollY > 0) window.scrollTo({ top: resumeDraft.scrollY })
  }, [paragraphId, resumeDraft, sourceOffset, text])

  function handleTextClick() {
    if (!onOpenDetail) return
    const selection = window.getSelection()
    const range = selection?.rangeCount ? selection.getRangeAt(0) : null
    if (!selection?.isCollapsed && range && containerRef.current && range.intersectsNode(containerRef.current)) return
    onOpenDetail()
  }

  function handleTextKeyDown(event: KeyboardEvent<HTMLParagraphElement>) {
    if (!onOpenDetail || (event.key !== 'Enter' && event.key !== ' ')) return
    event.preventDefault()
    onOpenDetail()
  }

  function handleSaveClick() {
    if (phase.kind !== 'selected') return
    updatePhase({ kind: 'tagPanel', start: phase.start, end: phase.end })
  }

  // The native selection is deliberately left intact while the tag panel is open (see the
  // "Sauvegarder" button's onMouseDown below) — leaving idle without clearing it would strand a
  // visible highlight with no menu to act on it.
  function resetToIdle() {
    if (isMountedRef.current) window.getSelection()?.removeAllRanges()
    updatePhase({ kind: 'idle' })
    setSaveError(null)
  }

  function handleSave(tagNames: string[], newTagName?: string) {
    if (phase.kind !== 'tagPanel' || saveInFlightRef.current) return
    const { start, end } = phase
    if (!isConnected) {
      if (newTagName === undefined || !newTagName.trim()) return
      setDraft({
        paragraphId,
        start: start + sourceOffset,
        end: end + sourceOffset,
        selectedText: text.slice(start, end),
        listName: newTagName.trim(),
        query: searchContext.query, page: searchContext.page, volumeId: searchContext.volumeId, scrollY: window.scrollY,
      })
      updatePhase({ kind: 'authPrompt', start, end })
      return
    }

    setSaveError(null)
    saveInFlightRef.current = true
    createQuoteMutation.mutate(
      {
        paragraphId,
        startOffset: start + sourceOffset,
        endOffset: end + sourceOffset,
        selectedText: text.slice(start, end),
        tagNames,
        ...(newTagName === undefined ? {} : { newTagName: newTagName.trim() }),
      },
      {
        onSuccess: () => {
          saveInFlightRef.current = false
          showToast(t('quoteSelection.savedToast'))
          clearDraft()
          resetToIdle()
        },
        onError: error => {
          saveInFlightRef.current = false
          if (newTagName !== undefined && error instanceof ApiError && error.status === 409) {
            setSaveError(t('quoteSelection.duplicateListNameError'))
            return
          }
          showToast(t('quoteSelection.saveErrorToast'))
          updatePhase({ kind: 'selected', start, end })
        },
      },
    )
  }

  function handleCancelPanel() {
    if (phase.kind !== 'tagPanel') return
    clearDraft()
    resetToIdle()
  }

  function handleCancelAuthPrompt() {
    if (phase.kind !== 'authPrompt') return
    clearDraft()
    updatePhase({ kind: 'selected', start: phase.start, end: phase.end })
  }

  function continueToAuthentication(path: '/login' | '/register') {
    navigate(path)
  }

  return (
    <div className={styles.root}>
      <p
        className={styles.text}
        role={onOpenDetail ? 'button' : undefined}
        tabIndex={onOpenDetail ? 0 : undefined}
        onClick={onOpenDetail ? handleTextClick : undefined}
        onKeyDown={onOpenDetail ? handleTextKeyDown : undefined}
      >
        {hasLeadingEllipsis && <span className={styles.ellipsis} aria-hidden="true">… </span>}
        <span ref={containerRef}>
          {segments.map((segment, index) =>
            segment.highlighted ? (
              <mark key={index} className={styles.mark}>{segment.text}</mark>
            ) : (
              <span key={index}>{segment.text}</span>
            ),
          )}
        </span>
        {hasTrailingEllipsis && <span className={styles.ellipsis} aria-hidden="true"> …</span>}
      </p>

      {isAuthResolved && phase.kind === 'selected' && (
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
            {t('quoteSelection.saveButton')}
          </button>
        </div>
      )}

      {phase.kind === 'tagPanel' && (
        <TagPickerPopup
          onSave={handleSave}
          onCancel={handleCancelPanel}
          isSaving={createQuoteMutation.isPending}
          initialNewListName={isConnected ? resumeDraft?.listName : ''}
          errorMessage={saveError}
        />
      )}
      {phase.kind === 'authPrompt' && (
        <AuthenticationPrompt
          onRegister={() => continueToAuthentication('/register')}
          onLogin={() => continueToAuthentication('/login')}
          onCancel={handleCancelAuthPrompt}
        />
      )}
    </div>
  )
}
