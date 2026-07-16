/** Segments kept in a click selector — enough to re-find the element without huge paths. */
const CSS_PATH_MAX_SEGMENTS = 6

/**
 * Short CSS path for a clicked element (transcript display + Mode B fallback
 * targeting when coordinates drift). Called by the click listener in the agent.
 * @param element - event target, or null for non-element targets
 * @returns
 * - element: "#app > main > button:nth-of-type(2)" style path (id anchors early-exit)
 * - null: ""
 * @example cssPath(document.querySelector('#save')) // => "#save"
 */
export function cssPath(element: Element | null): string {
  if (!element) return ''
  const segments: string[] = []
  let current: Element | null = element
  while (current && segments.length < CSS_PATH_MAX_SEGMENTS) {
    // An id is a stable anchor — no need to walk further up.
    if (current.id) {
      segments.unshift(`#${CSS.escape(current.id)}`)
      break
    }
    const currentElement: Element = current
    const tag = currentElement.tagName.toLowerCase()
    const parent: Element | null = currentElement.parentElement
    if (!parent) {
      segments.unshift(tag)
      break
    }
    const sameTagSiblings = [...parent.children].filter(
      (child) => child.tagName === currentElement.tagName,
    )
    segments.unshift(
      sameTagSiblings.length > 1
        ? `${tag}:nth-of-type(${sameTagSiblings.indexOf(currentElement) + 1})`
        : tag,
    )
    current = parent
  }
  return segments.join(' > ')
}
