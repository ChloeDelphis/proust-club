type CaretCapableDocument = Document & {
  caretRangeFromPoint?: (x: number, y: number) => Range | null
  caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null
}

function getCharacterOffset(container: Node, node: Node, nodeOffset: number): number | null {
  if (node.nodeType !== Node.TEXT_NODE) return null

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

/**
 * Character offset (within `container`'s full text content) under screen point (x, y), or null if
 * the point falls outside `container` or the browser can't resolve a caret position there.
 * Relies on `caretRangeFromPoint` (WebKit/Blink) or `caretPositionFromPoint` (standard) — neither
 * is meaningfully testable under jsdom, so callers should treat this as a thin, mockable boundary.
 */
export function getOffsetFromPoint(container: HTMLElement, x: number, y: number): number | null {
  const doc = container.ownerDocument as CaretCapableDocument

  let node: Node | null = null
  let nodeOffset = 0

  if (doc.caretRangeFromPoint) {
    const range = doc.caretRangeFromPoint(x, y)
    if (!range) return null
    node = range.startContainer
    nodeOffset = range.startOffset
  } else if (doc.caretPositionFromPoint) {
    const position = doc.caretPositionFromPoint(x, y)
    if (!position) return null
    node = position.offsetNode
    nodeOffset = position.offset
  } else {
    return null
  }

  if (!container.contains(node)) return null

  return getCharacterOffset(container, node, nodeOffset)
}
