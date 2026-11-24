import { useState } from 'react'

// A number that briefly lights up when it changes on an open page (a new download), so the change is noticed. Not on
// the first render: a page that just loaded does not flash all its numbers.
export default function LiveCount({ value }: { value: number }) {
  const [shown, setShown] = useState(value)
  const [changes, setChanges] = useState(0)
  if (value !== shown) {
    setShown(value)
    setChanges(changes + 1)
  }
  // A new key for each change draws a new element, which starts the CSS animation again.
  return <span key={changes} className={changes ? 'live-count changed' : 'live-count'}>{value.toLocaleString('en-US')}</span>
}
