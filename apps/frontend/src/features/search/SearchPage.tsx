import { useState } from 'react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { SearchHit } from '../../api/search'
import type { QuoteSelectionResponse } from '../../api/quote'
import { useCurrentUser } from '../auth/useCurrentUser'
import SearchForm from './SearchForm/SearchForm'
import ResultList from './ResultList/ResultList'
import ParagraphCard from './ParagraphCard/ParagraphCard'
import TimelineBar from '../quotes/TimelineBar/TimelineBar'
import VolumeList from '../quotes/VolumeList/VolumeList'
import TagFilterBar from '../quotes/TagFilterBar/TagFilterBar'
import QuoteCard from '../quotes/QuoteCard/QuoteCard'
import QuoteDetailModal from '../quotes/QuoteDetailModal/QuoteDetailModal'
import type { QuoteDetailModalQuote } from '../quotes/QuoteDetailModal/QuoteDetailModal.types'
import SearchResultDetailModal from './SearchResultDetailModal/SearchResultDetailModal'
import { useTimeline } from '../quotes/useTimeline'
import Spinner from '../../components/Spinner/Spinner'
import ErrorMessage from '../../components/ErrorMessage/ErrorMessage'
import EmptyState from '../../components/EmptyState/EmptyState'
import styles from './SearchPage.module.css'
import { useCorpusSearchQuery } from './useCorpusSearchQuery'
import { useSavedQuotesQuery } from './useSavedQuotesQuery'
import { useGuestQuoteSave } from './useGuestQuoteSave'

// The text filter takes priority over "no tag selected" in the message: a query present means the
// empty result is about the search, not about the (lack of a) tag filter.
function savedScopeEmptyStateKey(tagId: string | null, query: string): string {
  if (query) return 'searchPage.emptyStateNoTextMatch'
  if (tagId === null) return 'searchPage.emptyStateNoQuotes'
  return 'searchPage.emptyStateNoTagMatch'
}

// Searches either the corpus or the connected user's own saved citations — scope follows
// whichever entry is active in TagFilterBar (a real tag, or the special "saved citations" one),
// defaulting to corpus search. Not route-split: this is one page, matching the reference mockup.
export default function SearchPage() {
  const { t } = useTranslation()
  const { draft } = useGuestQuoteSave()
  const { data: currentUser } = useCurrentUser()
  const isConnected = currentUser !== null && currentUser !== undefined
  const [query, setQuery] = useState(() => draft?.query ?? '')
  const [scope, setScope] = useState<'corpus' | 'saved'>('corpus')
  const [tagId, setTagId] = useState<string | null>(null)
  const [page, setPage] = useState(() => draft?.page ?? 0)
  const [selectedVolumeId, setSelectedVolumeId] = useState<number | null>(() => draft?.volumeId ?? null)
  // The selected quote is a snapshot owned by the modal, not a pointer into a filtered query.
  // It must remain available if removing a tag makes the quote disappear from the frieze/list, or
  // if the frieze request fails after a quote was opened from the saved-citations list.
  const [selectedDetailQuote, setSelectedDetailQuote] = useState<{ userId: string; quote: QuoteDetailModalQuote } | null>(null)
  const timelineQuery = useTimeline(tagId, isConnected)
  const [detailHit, setDetailHit] = useState<SearchHit | null>(null)

  function handleSearch(q: string) {
    setQuery(q)
    setPage(0)
  }

  function selectScope(nextScope: 'corpus' | 'saved', nextTagId: string | null = null) {
    setScope(nextScope)
    setTagId(nextTagId)
    setPage(0)
  }

  // Selecting the already-selected volume again zooms back out — the frieze zone and the sidebar
  // entry both call this, there's no separate "Tous les tomes" control.
  function handleSelectVolume(id: number) {
    setSelectedVolumeId(current => (current === id ? null : id))
    setPage(0)
  }

  function handleOpenQuote(quoteId: string) {
    const quote = timelineQuery.data?.quotes.find(item => item.id === quoteId)
    if (quote && currentUser) setSelectedDetailQuote({ userId: currentUser.uuid, quote })
  }

  function handleOpenSavedQuote(quote: QuoteSelectionResponse) {
    if (!currentUser) return
    setSelectedDetailQuote({
      userId: currentUser.uuid,
      quote: timelineQuery.data?.quotes.find(item => item.id === quote.id) ?? quote,
    })
  }

  function handleDetailTagsChange(tags: QuoteDetailModalQuote['tags']) {
    if (!currentUser) return
    setSelectedDetailQuote(current => current?.userId === currentUser.uuid
      ? { ...current, quote: { ...current.quote, tags } }
      : current)
  }

  const isQueryValid = query.trim().length >= 2

  const corpusQuery = useCorpusSearchQuery({
    query,
    volumeId: selectedVolumeId,
    page,
    enabled: scope === 'corpus' && isQueryValid,
  })

  const savedQuery = useSavedQuotesQuery({
    tagId,
    query,
    volumeId: selectedVolumeId,
    page,
    enabled: scope === 'saved' && isConnected,
  })

  const activeSelectedQuote = selectedDetailQuote && selectedDetailQuote.userId === currentUser?.uuid
    ? selectedDetailQuote.quote
    : null
  const detailQuote = activeSelectedQuote
  const detailVolumeTitle = detailQuote && 'volumeId' in detailQuote
    ? timelineQuery.data?.volumes.find(v => v.id === detailQuote.volumeId)?.title
    : undefined

  let content: ReactNode = null

  if (scope === 'corpus') {
    if (!isQueryValid) {
      content = <EmptyState message={t('searchPage.typeToSearch')} />
    } else if (corpusQuery.isPending) {
      content = <Spinner />
    } else if (corpusQuery.isError) {
      content = <ErrorMessage message={t('common.genericError')} />
    } else if (corpusQuery.data.results.length === 0) {
      content = <EmptyState message={t('searchPage.emptyState', { query })} />
    } else {
      content = (
        <ResultList
          results={corpusQuery.data.results}
          getKey={hit => hit.paragraphId}
          renderItem={hit => (
            <ParagraphCard
              hit={hit}
              onOpenDetail={setDetailHit}
              resumeDraft={draft?.paragraphId === hit.paragraphId ? draft : null}
              searchContext={{ query, page, volumeId: selectedVolumeId }}
            />
          )}
          total={corpusQuery.data.total}
          page={corpusQuery.data.page}
          size={corpusQuery.data.size}
          isFetching={corpusQuery.isFetching}
          onPageChange={setPage}
        />
      )
    }
  } else if (savedQuery.isPending) {
    content = <Spinner />
  } else if (savedQuery.isError) {
    content = <ErrorMessage message={t('common.genericError')} />
  } else if (savedQuery.data.results.length === 0) {
    content = <EmptyState message={t(savedScopeEmptyStateKey(tagId, query))} />
  } else {
    content = (
      <ResultList
        results={savedQuery.data.results}
        getKey={quote => quote.id}
        renderItem={quote => <QuoteCard quote={quote} onOpenDetail={handleOpenSavedQuote} />}
        total={savedQuery.data.total}
        page={savedQuery.data.page}
        size={savedQuery.data.size}
        isFetching={savedQuery.isFetching}
        onPageChange={setPage}
      />
    )
  }

  return (
    <main className={styles.root}>
      <h1 className={styles.title}>{t('searchPage.title')}</h1>
      <TimelineBar
        isConnected={isConnected}
        activeTagId={tagId}
        selectedVolumeId={selectedVolumeId}
        onSelectVolume={handleSelectVolume}
        onOpenQuote={handleOpenQuote}
      />
      <div className={styles.layout}>
        <aside>
          <VolumeList selectedVolumeId={selectedVolumeId} onSelectVolume={handleSelectVolume} />
        </aside>
        <div>
          <SearchForm key={query} initialValue={query} onSubmit={handleSearch} />
          {isConnected && (
            <TagFilterBar
              scope={scope}
              activeTagId={tagId}
              onSelectSavedScope={() => selectScope('saved')}
              onSelectTag={id => selectScope('saved', id)}
              onSelectCorpusScope={() => selectScope('corpus')}
            />
          )}
          {content}
        </div>
      </div>
      {isConnected && (
        <QuoteDetailModal
          quote={detailQuote}
          volumeTitle={detailVolumeTitle}
          onTagsChange={handleDetailTagsChange}
          onClose={() => setSelectedDetailQuote(null)}
        />
      )}
      <SearchResultDetailModal hit={detailHit} onClose={() => setDetailHit(null)} />
    </main>
  )
}
