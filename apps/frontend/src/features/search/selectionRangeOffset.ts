function characterOffsetForTextNode(container: Node, node: Node, nodeOffset: number): number | null {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT)
  let total = 0
  let current = walker.nextNode()
  while (current) {
    if (current === node) return total + nodeOffset
    total += current.textContent?.length ?? 0
    current = walker.nextNode()
  }
  return null
}

// TreeWalker.nextNode() only ever returns descendants of its root, never the root itself — so
// these need an explicit check for `root` already being the text node we're looking for. That's
// not a rare case here: every segment QuoteSelection renders is a <span>/<mark> wrapping exactly
// one bare Text child, so `root` (a child pulled from `node.childNodes` by the caller) is that
// Text node itself whenever a Range boundary lands right at a segment's edge (e.g. a double-click
// word selection, or a drag starting exactly on a highlight boundary).
function firstTextNode(root: Node): Text | null {
  if (root.nodeType === Node.TEXT_NODE) return root as Text
  return document.createTreeWalker(root, NodeFilter.SHOW_TEXT).nextNode() as Text | null
}

function lastTextNode(root: Node): Text | null {
  if (root.nodeType === Node.TEXT_NODE) return root as Text
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let last: Text | null = null
  let current = walker.nextNode()
  while (current) {
    last = current as Text
    current = walker.nextNode()
  }
  return last
}

/**
 * Character offset (within `container`'s full text content) for a `Range` boundary
 * (`startContainer`/`startOffset` or `endContainer`/`endOffset`). Usually `node` is a text node
 * directly, but a boundary right at the edge of an element (e.g. the very start of the paragraph,
 * or right after a `<mark>`) can report the parent element with `nodeOffset` indexing into its
 * `childNodes` instead. Resolved by searching outward from that child index for the nearest text:
 * forward first (the child at `nodeOffset` itself, or the next sibling with text — the common
 * case), then backward (the end of the nearest preceding sibling's text) if nothing follows. An
 * empty/childless element at the boundary (e.g. a decorative icon span) contributes zero
 * characters either way, so either direction lands on the same, correct offset.
 */
export function characterOffsetForRangeBoundary(container: Node, node: Node, nodeOffset: number): number | null {
  if (node.nodeType === Node.TEXT_NODE) {
    return characterOffsetForTextNode(container, node, nodeOffset)
  }

  for (let i = nodeOffset; i < node.childNodes.length; i++) {
    const text = firstTextNode(node.childNodes[i])
    if (text) return characterOffsetForTextNode(container, text, 0)
  }

  for (let i = nodeOffset - 1; i >= 0; i--) {
    const text = lastTextNode(node.childNodes[i])
    if (text) return characterOffsetForTextNode(container, text, text.textContent?.length ?? 0)
  }

  return null
}

/**
 * Converts a native selection `Range` into `[start, end)` character offsets within `container`'s
 * text, or `null` if the range isn't fully contained in `container` (e.g. it spans into a
 * different paragraph) or the start boundary can't be resolved to a text position.
 *
 * Only the start boundary is walked through the DOM; `end` is derived as `start + range.toString()
 * .length` instead of a second independent walk from the container's beginning. This runs on
 * every `selectionchange` event (continuously while a drag gesture is in progress), so avoiding a
 * second full traversal matters — `range.toString()` is exactly the selected text (the rendered
 * `<mark>` wrapping around the search-match run adds no characters of its own).
 */
export function getSelectionOffsets(container: HTMLElement, range: Range): { start: number; end: number } | null {
  if (!container.contains(range.startContainer) || !container.contains(range.endContainer)) return null

  const start = characterOffsetForRangeBoundary(container, range.startContainer, range.startOffset)
  if (start === null) return null

  return { start, end: start + range.toString().length }
}
