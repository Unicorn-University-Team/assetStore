import { useEffect, type RefObject } from 'react'

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

// The elements Tab stops at, in order. A radio group is one stop: its checked radio, or the first one when none is.
function tabStops(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((element) => {
    if (!(element instanceof HTMLInputElement) || element.type !== 'radio' || element.checked) return true
    const group = [...container.querySelectorAll<HTMLInputElement>('input[type="radio"]')].filter((radio) => radio.name === element.name)
    return !group.some((radio) => radio.checked) && group[0] === element
  })
}

// A modal dialog: Tab stays inside it, the page behind does not scroll, and after it closes the focus goes back
// to the element that opened it (when that is still on the page).
export function useModal(dialog: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function keepTabInside(event: KeyboardEvent) {
      const container = dialog.current
      if (event.key !== 'Tab' || !container) return
      const stops = tabStops(container)
      if (!stops.length) {
        event.preventDefault()
        return
      }
      const first = stops[0]
      const last = stops[stops.length - 1]
      const active = document.activeElement
      const inside = active instanceof Node && container.contains(active)
      if (event.shiftKey && (!inside || active === first)) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (!inside || active === last)) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', keepTabInside)
    return () => {
      document.removeEventListener('keydown', keepTabInside)
      document.body.style.overflow = overflow
      if (opener?.isConnected) opener.focus()
    }
  }, [dialog])
}
