import { useState } from 'react'
import type { ReactNode } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { searchParagraphs } from '../../api/search'
import { listQuotes } from '../../api/quote'
import { useCurrentUser } from '../auth/useCurrentUser'
import SearchForm from './SearchForm/SearchForm'
import ResultList from './ResultList/ResultList'
import ParagraphCard from './ParagraphCard/ParagraphCard'
import TimelineBar from '../quotes/TimelineBar/TimelineBar'
import VolumeList from '../quotes/VolumeList/VolumeList'
import TagFilterBar from '../quotes/TagFilterBar/TagFilterBar'
import QuoteCard from '../quotes/QuoteCard/QuoteCard'
import Spinner from '../../components/Spinner/Spinner'
import ErrorMessage from '../../components/ErrorMessage/ErrorMessage'
import EmptyState from '../../components/EmptyState/EmptyState'
import styles from './SearchPage.module.css'

const PAGE_SIZE = 10

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
  const { isSuccess: isConnected } = useCurrentUser()
  const [query, setQuery] = useState('')
  const [scope, setScope] = useState<'corpus' | 'saved'>('corpus')
  const [tagId, setTagId] = useState<string | null>(null)
  const [page, setPage] = useState(0)
  const [selectedVolumeId, setSelectedVolumeId] = useState<number | null>(null)

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
  }

  const isQueryValid = query.trim().length >= 2

  const corpusQuery = useQuery({
    queryKey: ['search', query, page],
    queryFn: ({ signal }) => searchParagraphs({ q: query, page, size: PAGE_SIZE }, signal),
    enabled: scope === 'corpus' && isQueryValid,
    placeholderData: keepPreviousData,
  })

  const savedQuery = useQuery({
    queryKey: ['quotes', tagId, query, page],
    queryFn: ({ signal }) => listQuotes({ tagId: tagId ?? undefined, q: query || undefined, page, size: PAGE_SIZE }, signal),
    enabled: scope === 'saved' && isConnected,
    placeholderData: keepPreviousData,
  })

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
          renderItem={hit => <ParagraphCard {...hit} />}
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
        renderItem={quote => <QuoteCard quote={quote} />}
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
      {isConnected && <TimelineBar activeTagId={tagId} selectedVolumeId={selectedVolumeId} onSelectVolume={handleSelectVolume} />}
      <div className={isConnected ? styles.layout : undefined}>
        {isConnected && (
          <aside>
            <VolumeList activeTagId={tagId} selectedVolumeId={selectedVolumeId} onSelectVolume={handleSelectVolume} />
          </aside>
        )}
        <div>
          <SearchForm onSubmit={handleSearch} />
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
    </main>
  )
}
