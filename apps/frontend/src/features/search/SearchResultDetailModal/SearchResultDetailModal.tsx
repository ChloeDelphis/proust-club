import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { useCreateQuoteMutation } from '../useCreateQuoteMutation'
import { useGuestQuoteSave } from '../useGuestQuoteSave'
import { useCurrentUser } from '../../auth/useCurrentUser'
import { useToast } from '../../../components/Toast/useToast'
import DetailModal from '../../../components/DetailModal/DetailModal'
import TagPickerContent from '../TagPickerPopup/TagPickerContent'
import AuthenticationPrompt from '../TagPickerPopup/AuthenticationPrompt'
import { buildHighlightSegments } from '../paragraphSegments'
import { getSelectionOffsets, createRangeForOffsets } from '../selectionRangeOffset'
import { snapSelectionOutward, trimSelection } from '../selectionOffsets'
import type { SearchResultDetailModalProps } from './SearchResultDetailModal.types'
import styles from './SearchResultDetailModal.module.css'

type Selection = { paragraphId: number; start: number; end: number }
type ActionPhase = 'idle' | 'selected' | 'tagPanel' | 'authPrompt'
type PhaseState = { paragraphId: number; phase: ActionPhase }

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
  const [selection, setSelection] = useState<Selection | null>(null)
  const [phaseState, setPhaseState] = useState<PhaseState | null>(null)
  const phaseRef = useRef<PhaseState | null>(null)
  const phase = phaseState && phaseState.paragraphId === hit?.paragraphId ? phaseState.phase : 'idle'

  const updatePhase = useCallback((next: ActionPhase, paragraphId: number) => {
    const nextState = { paragraphId, phase: next }
    phaseRef.current = nextState
    setPhaseState(nextState)
  }, [])

  const activeSelection = selection?.paragraphId === hit?.paragraphId ? selection : null

  useEffect(() => {
    function handleSelectionChange() {
      const currentPhase = phaseRef.current && phaseRef.current.paragraphId === hit?.paragraphId
        ? phaseRef.current.phase
        : 'idle'
      if (currentPhase === 'tagPanel' || currentPhase === 'authPrompt') return
      const container = textRef.current
      const nativeSelection = window.getSelection()
      if (!container || !hit || !nativeSelection || nativeSelection.isCollapsed || nativeSelection.rangeCount === 0) {
        setSelection(null)
        if (hit) updatePhase('idle', hit.paragraphId)
        return
      }

      const offsets = getSelectionOffsets(container, nativeSelection.getRangeAt(0))
      if (!offsets) {
        setSelection(null)
        updatePhase('idle', hit.paragraphId)
        return
      }

      const extended = snapSelectionOutward(hit.text, offsets.start, offsets.end)
      const trimmed = trimSelection(hit.text, extended.start, extended.end)
      if (trimmed.start >= trimmed.end) {
        setSelection(null)
        updatePhase('idle', hit.paragraphId)
        return
      }

      setSelection({ paragraphId: hit.paragraphId, ...trimmed })
      updatePhase('selected', hit.paragraphId)
      if (resumeDraft?.resumeInDetail
        && (trimmed.start !== resumeDraft.start || trimmed.end !== resumeDraft.end)) clearDraft()
    }

    document.addEventListener('selectionchange', handleSelectionChange)
    return () => document.removeEventListener('selectionchange', handleSelectionChange)
  }, [hit, resumeDraft, clearDraft, updatePhase])

  useEffect(() => {
    const container = textRef.current
    if (!hit || !resumeDraft?.resumeInDetail || resumeDraft.paragraphId !== hit.paragraphId || !container) return
    const range = createRangeForOffsets(container, resumeDraft.start, resumeDraft.end)
    if (!range || range.toString() !== resumeDraft.selectedText) return
    const nativeSelection = window.getSelection()
    nativeSelection?.removeAllRanges()
    nativeSelection?.addRange(range)
    document.dispatchEvent(new Event('selectionchange'))
  }, [hit, resumeDraft])

  function handleActionClick() {
    if (!activeSelection || !hit) return
    updatePhase(isConnected ? 'tagPanel' : 'authPrompt', hit.paragraphId)
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
          updatePhase('selected', hit.paragraphId)
        },
      },
    )
  }

  function handleClose() {
    if (resumeDraft?.resumeInDetail) clearDraft()
    setSelection(null)
    if (hit) updatePhase('idle', hit.paragraphId)
    window.getSelection()?.removeAllRanges()
    onClose()
  }

  function returnToTextSelection() {
    if (!hit || !activeSelection) return
    const container = textRef.current
    const range = container && createRangeForOffsets(container, activeSelection.start, activeSelection.end)
    if (range) {
      const nativeSelection = window.getSelection()
      nativeSelection?.removeAllRanges()
      nativeSelection?.addRange(range)
    }
    updatePhase('selected', hit.paragraphId)
  }

  const segments = hit ? buildHighlightSegments(hit.text, { start: hit.startOffset, end: hit.endOffset }) : []

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
          {segments.map((segment, index) =>
            segment.highlighted ? (
              <mark key={index} className={styles.mark}>{segment.text}</mark>
            ) : (
              <span key={index}>{segment.text}</span>
            ),
          )}
        </p>
      )}
      sideContent={hit && (
        <>
          <p className={styles.meta}>
            {t('searchPage.resultLocation', { volume: hit.volume, part: hit.part })}
          </p>
          {phase === 'tagPanel' ? (
            <TagPickerContent onSave={handleSave} isSaving={createQuoteMutation.isPending} />
          ) : phase === 'selected' ? (
            <button
              type="button"
              className={styles.saveButton}
              onMouseDown={event => event.preventDefault()}
              onClick={handleActionClick}
            >
              {t('searchResultDetailModal.savePassageButton')}
            </button>
          ) : phase === 'idle' ? (
            <p className={styles.selectionHint}>{t('searchResultDetailModal.selectionHint')}</p>
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
