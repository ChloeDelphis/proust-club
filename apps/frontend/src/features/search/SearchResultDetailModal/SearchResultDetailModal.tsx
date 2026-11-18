import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { useCreateQuoteMutation } from '../useCreateQuoteMutation'
import { useGuestQuoteSave } from '../useGuestQuoteSave'
import { useCurrentUser } from '../../auth/useCurrentUser'
import { useToast } from '../../../components/Toast/useToast'
import DetailModal from '../../../components/DetailModal/DetailModal'
import TagPickerContent from '../TagPickerPopup/TagPickerContent'
import AuthenticationPrompt from '../TagPickerPopup/AuthenticationPrompt'
import { buildSelectionSegments } from '../selectionSegments'
import { getSelectionOffsets, createRangeForOffsets } from '../selectionRangeOffset'
import { snapSelectionOutward, trimSelection } from '../selectionOffsets'
import type { SearchResultDetailModalProps } from './SearchResultDetailModal.types'
import styles from './SearchResultDetailModal.module.css'

type Selection = { paragraphId: number; start: number; end: number }
type SelectionFlowState =
  | { kind: 'idle'; paragraphId: number | null }
  | ({ kind: 'selected' | 'tagPanel' | 'authPrompt' } & Selection)

type SelectionFlowAction =
  | { type: 'selectionChanged'; paragraphId: number; selection: Selection | null }
  | { type: 'openAction'; paragraphId: number; kind: 'tagPanel' | 'authPrompt' }
  | { type: 'restoreSelection'; selection: Selection }
  | { type: 'close'; paragraphId: number | null }

function selectionFlowReducer(state: SelectionFlowState, action: SelectionFlowAction): SelectionFlowState {
  switch (action.type) {
    case 'selectionChanged':
      if (state.paragraphId === action.paragraphId && (state.kind === 'tagPanel' || state.kind === 'authPrompt')) {
        return state
      }
      if (action.selection && state.kind === 'selected'
        && state.paragraphId === action.selection.paragraphId
        && state.start === action.selection.start
        && state.end === action.selection.end) {
        return state
      }
      if (!action.selection && state.kind === 'idle' && state.paragraphId === action.paragraphId) return state
      return action.selection
        ? { kind: 'selected', ...action.selection }
        : { kind: 'idle', paragraphId: action.paragraphId }
    case 'openAction':
      if (state.kind !== 'selected' || state.paragraphId !== action.paragraphId) return state
      return { ...state, kind: action.kind }
    case 'restoreSelection':
      return { kind: 'selected', ...action.selection }
    case 'close':
      if (state.kind === 'idle' && state.paragraphId === action.paragraphId) return state
      return { kind: 'idle', paragraphId: action.paragraphId }
    default: {
      const exhaustiveAction: never = action
      return exhaustiveAction
    }
  }
}

export default function SearchResultDetailModal({
  hit,
  onClose,
  resumeDraft = null,
  searchContext = { query: '', page: 0, volumeId: null, partId: null },
}: SearchResultDetailModalProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { data: currentUser } = useCurrentUser()
  const isConnected = currentUser !== null && currentUser !== undefined
  const showToast = useToast()
  const createQuoteMutation = useCreateQuoteMutation()
  const { setDraft, clearDraft } = useGuestQuoteSave()
  const textRef = useRef<HTMLParagraphElement>(null)
  const retainSelectionAfterCancelRef = useRef(false)
  const [flowState, dispatchFlow] = useReducer(selectionFlowReducer, { kind: 'idle', paragraphId: null })
  const [preserveSelectionHighlight, setPreserveSelectionHighlight] = useState(false)
  const flowRef = useRef<SelectionFlowState>(flowState)
  const transitionFlow = useCallback((action: SelectionFlowAction) => {
    // Keep the document-level selection listener's guard current immediately, before React
    // commits the reducer update and re-renders this component.
    flowRef.current = selectionFlowReducer(flowRef.current, action)
    dispatchFlow(action)
  }, [])
  const currentFlow = flowState.paragraphId === hit?.paragraphId
    ? flowState
    : { kind: 'idle' as const, paragraphId: hit?.paragraphId ?? null }
  const phase = currentFlow.kind
  const activeSelection = currentFlow.kind === 'idle' ? null : currentFlow

  useEffect(() => {
    function handleSelectionChange() {
      const latestFlow = flowRef.current
      const currentPhase = latestFlow.paragraphId === hit?.paragraphId ? latestFlow.kind : 'idle'
      if (currentPhase === 'tagPanel' || currentPhase === 'authPrompt') return
      const container = textRef.current
      const nativeSelection = window.getSelection()
      if (currentPhase === 'selected' && (!nativeSelection || nativeSelection.isCollapsed)) return
      if (retainSelectionAfterCancelRef.current && nativeSelection?.isCollapsed) return
      if (!container || !hit || !nativeSelection || nativeSelection.isCollapsed || nativeSelection.rangeCount === 0) {
        transitionFlow({ type: 'close', paragraphId: hit?.paragraphId ?? null })
        return
      }

      const offsets = getSelectionOffsets(container, nativeSelection.getRangeAt(0))
      if (!offsets) {
        transitionFlow({ type: 'selectionChanged', paragraphId: hit.paragraphId, selection: null })
        return
      }

      const extended = snapSelectionOutward(hit.text, offsets.start, offsets.end)
      const trimmed = trimSelection(hit.text, extended.start, extended.end)
      if (trimmed.start >= trimmed.end) {
        transitionFlow({ type: 'selectionChanged', paragraphId: hit.paragraphId, selection: null })
        return
      }

      transitionFlow({
        type: 'selectionChanged',
        paragraphId: hit.paragraphId,
        selection: { paragraphId: hit.paragraphId, ...trimmed },
      })
      if (resumeDraft?.resumeInDetail
        && (trimmed.start !== resumeDraft.start || trimmed.end !== resumeDraft.end)) clearDraft()
    }

    function handlePointerDown(event: PointerEvent) {
      const latestFlow = flowRef.current
      const currentPhase = latestFlow.paragraphId === hit?.paragraphId ? latestFlow.kind : 'idle'
      if (currentPhase !== 'selected') return
      if (event.target instanceof Element && event.target.closest('[data-selection-save-action]')) return
      transitionFlow({ type: 'close', paragraphId: hit?.paragraphId ?? null })
    }

    document.addEventListener('selectionchange', handleSelectionChange)
    document.addEventListener('pointerdown', handlePointerDown)
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange)
      document.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [hit, resumeDraft, clearDraft, transitionFlow])

  useEffect(() => {
    if (!hit || !resumeDraft?.resumeInDetail || resumeDraft.paragraphId !== hit.paragraphId) return
    const frame = window.requestAnimationFrame(() => {
      const container = textRef.current
      if (!container) return
      const range = createRangeForOffsets(container, resumeDraft.start, resumeDraft.end)
      if (!range || range.toString() !== resumeDraft.selectedText) return
      const nativeSelection = window.getSelection()
      if (!nativeSelection) return
      nativeSelection.removeAllRanges()
      nativeSelection.addRange(range)
      transitionFlow({
        type: 'restoreSelection',
        selection: { paragraphId: hit.paragraphId, start: resumeDraft.start, end: resumeDraft.end },
      })
      document.dispatchEvent(new Event('selectionchange'))
    })
    return () => window.cancelAnimationFrame(frame)
  }, [hit, resumeDraft, transitionFlow])

  function handleActionClick() {
    if (!activeSelection || !hit) return
    transitionFlow({ type: 'openAction', paragraphId: hit.paragraphId, kind: isConnected ? 'tagPanel' : 'authPrompt' })
  }

  function continueToAuthentication(path: '/login' | '/register') {
    if (!hit || !activeSelection) return
    setDraft({
      paragraphId: hit.paragraphId,
      start: activeSelection.start,
      end: activeSelection.end,
      selectedText: hit.text.slice(activeSelection.start, activeSelection.end),
      listName: '',
      resumeInDetail: true,
      ...searchContext,
      scrollY: window.scrollY,
    })
    navigate(path)
  }

  function handleSave(tagNames: string[]) {
    if (!hit || !activeSelection) return
    createQuoteMutation.mutate(
      {
        paragraphId: hit.paragraphId,
        startOffset: activeSelection.start,
        endOffset: activeSelection.end,
        selectedText: hit.text.slice(activeSelection.start, activeSelection.end),
        tagNames,
      },
      {
        onSuccess: () => {
          showToast(t('quoteSelection.savedToast'))
          clearDraft()
          handleClose()
        },
        onError: () => {
          showToast(t('quoteSelection.saveErrorToast'))
          transitionFlow({ type: 'restoreSelection', selection: activeSelection })
        },
      },
    )
  }

  function handleClose() {
    retainSelectionAfterCancelRef.current = false
    setPreserveSelectionHighlight(false)
    if (resumeDraft?.resumeInDetail) clearDraft()
    transitionFlow({ type: 'close', paragraphId: hit?.paragraphId ?? null })
    window.getSelection()?.removeAllRanges()
    onClose()
  }

  function returnToTextSelection() {
    if (!hit || !activeSelection) return
    retainSelectionAfterCancelRef.current = true
    setPreserveSelectionHighlight(true)
    const container = textRef.current
    const range = container && createRangeForOffsets(container, activeSelection.start, activeSelection.end)
    if (range) {
      const nativeSelection = window.getSelection()
      nativeSelection?.removeAllRanges()
      nativeSelection?.addRange(range)
    }
    transitionFlow({
      type: 'restoreSelection',
      selection: {
        paragraphId: activeSelection.paragraphId,
        start: activeSelection.start,
        end: activeSelection.end,
      },
    })
  }

  const segments = hit
    ? buildSelectionSegments(
      hit.text,
      { start: hit.startOffset, end: hit.endOffset },
      activeSelection && (phase === 'tagPanel' || phase === 'authPrompt' || preserveSelectionHighlight)
        ? { start: activeSelection.start, end: activeSelection.end }
        : null,
    )
    : []

  return (
    <DetailModal
      paragraphId={hit?.paragraphId ?? null}
      ariaLabel={t('searchResultDetailModal.ariaLabel')}
      contextTextClassName={styles.text}
      closeDisabled={createQuoteMutation.isPending}
      isDimmed={phase === 'authPrompt'}
      onOpenChange={open => {
        if (open || createQuoteMutation.isPending) return
        if (phase === 'authPrompt') {
          returnToTextSelection()
          return
        }
        handleClose()
      }}
      centerContent={hit && (
        <p ref={textRef} className={styles.text}>
          {segments.map((segment, index) => {
            const className = segment.selected ? styles.selectedText : undefined
            if (segment.highlighted) {
              return <mark key={index} className={className ? `${styles.mark} ${className}` : styles.mark}>{segment.text}</mark>
            }
            return <span key={index} className={className}>{segment.text}</span>
          })}
        </p>
      )}
      sideContent={hit && (
        <>
          <p className={styles.meta}>
            <span>{hit.volume}</span>
            <span>{hit.part}</span>
          </p>
          {phase === 'tagPanel' ? (
            <TagPickerContent onSave={handleSave} onCancel={returnToTextSelection} isSaving={createQuoteMutation.isPending} />
          ) : phase === 'idle' || phase === 'selected' ? (
            <div className={styles.selectionAction}>
              <span className={styles.selectionDivider} aria-hidden="true" />
              {phase === 'idle' ? (
                <p className={styles.selectionHint}>{t('searchResultDetailModal.selectionHint')}</p>
              ) : (
                <button
                  type="button"
                  className={styles.saveButton}
                  data-selection-save-action
                  onPointerDown={handleActionClick}
                  onMouseDown={event => event.preventDefault()}
                  onClick={handleActionClick}
                >
                  {t('searchResultDetailModal.savePassageButton')}
                </button>
              )}
            </div>
          ) : null}
          {phase === 'authPrompt' && (
            <AuthenticationPrompt
                title={t('searchResultDetailModal.authenticationTitle')}
              message={t('searchResultDetailModal.authenticationMessage')}
                registerLabel={t('searchResultDetailModal.registerButton')}
                dimBackground={false}
              onRegister={() => continueToAuthentication('/register')}
              onLogin={() => continueToAuthentication('/login')}
              onCancel={returnToTextSelection}
            />
          )}
        </>
      )}
    />
  )
}
