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

function firstTextNode(root: Node): Text | null {
  return document.createTreeWalker(root, NodeFilter.SHOW_TEXT).nextNode() as Text | null
}

function lastTextNode(root: Node): Text | null {
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
 * `childNodes` instead — resolved here by descending into the child at that index (start of its
 * first text node) or, past the last child, the end of the element's last text node.
 */
export function characterOffsetForRangeBoundary(container: Node, node: Node, nodeOffset: number): number | null {
  if (node.nodeType === Node.TEXT_NODE) {
    return characterOffsetForTextNode(container, node, nodeOffset)
  }

  const child = node.childNodes[nodeOffset]
  const text = child ? firstTextNode(child) : null
  if (text) return characterOffsetForTextNode(container, text, 0)

  const fallback = lastTextNode(node)
  if (fallback) return characterOffsetForTextNode(container, fallback, fallback.textContent?.length ?? 0)

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
