// Shared by TimelineBar.test.tsx and positionTimelineQuotes.test.ts (same folder, same fake
// quote id scheme) — not promoted further since the rest of the frontend test suite already
// keeps fixtures local per file/folder rather than in a global test-utils module.
export function quoteId(n: number): string {
  return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
}
