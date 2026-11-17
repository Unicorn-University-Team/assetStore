import { useEffect, useState, type FormEvent } from 'react'
import { SEARCH_MAX_LENGTH } from '../api/assets'

// Pause after the last key before a live search starts, so typing a word sends one request, not one per letter.
const LIVE_DELAY_MS = 300

type SearchBarProps = {
  value: string
  onSearch: (value: string) => void
  id?: string
  placeholder?: string
  // Search while typing (the catalogue). Without it the search starts on Enter or the button (the header).
  live?: boolean
}

export default function SearchBar({
  value,
  onSearch,
  id = 'site-search',
  placeholder = 'Search for assets',
  live = false,
}: SearchBarProps) {
  const [draft, setDraft] = useState(value)
  // The last value this field handed over. When `value` changes to something else (Clear search, browser back), the
  // change came from outside and the field shows it; an answer to our own search never overwrites newer typing.
  const [sent, setSent] = useState(value)
  if (value !== sent) {
    setSent(value)
    setDraft(value)
  }

  function send(next: string) {
    const trimmed = next.trim()
    if (trimmed === sent) return
    setSent(trimmed)
    onSearch(trimmed)
  }

  useEffect(() => {
    if (!live || draft.trim() === sent) return
    const timer = window.setTimeout(() => send(draft), LIVE_DELAY_MS)
    return () => window.clearTimeout(timer)
  })

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    // Enter always searches, also the same text again (the header leaves the page for the catalogue).
    const trimmed = draft.trim()
    setSent(trimmed)
    onSearch(trimmed)
  }

  return (
    <form className="header-search" role="search" onSubmit={submit}>
      <label className="sr-only" htmlFor={id}>Search assets by name</label>
      <input
        id={id}
        type="search"
        placeholder={placeholder}
        value={draft}
        maxLength={SEARCH_MAX_LENGTH}
        onChange={(event) => setDraft(event.target.value)}
      />
      {draft && (
        <button
          type="button"
          className="search-clear"
          aria-label="Clear search"
          onClick={() => {
            setDraft('')
            send('')
          }}
        >
          ×
        </button>
      )}
      <button className="search-button" type="submit" aria-label="Search">⌕</button>
    </form>
  )
}
