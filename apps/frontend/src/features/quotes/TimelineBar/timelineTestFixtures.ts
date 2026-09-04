// Shared by every features/quotes/ test file that needs a deterministic fake quote id
// (TimelineBar, positionTimelineQuotes, MyQuotesPage, QuoteCard, QuoteDetailModal,
// QuoteTagEditor) — not promoted to a global test-utils module since the rest of the
// frontend test suite keeps fixtures feature-local.
export function quoteId(n: number): string {
  return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
}
