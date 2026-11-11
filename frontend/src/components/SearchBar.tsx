import { useState, type FormEvent } from 'react'

type SearchBarProps = {
  value: string
  onSearch: (value: string) => void
  id?: string
  placeholder?: string
}

export default function SearchBar({
  value,
  onSearch,
  id = 'site-search',
  placeholder = 'Search for assets',
}: SearchBarProps) {
  const [draft, setDraft] = useState(value)

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onSearch(draft.trim())
  }

  return (
    <form className="header-search" role="search" onSubmit={submit}>
      <label className="sr-only" htmlFor={id}>Search assets by name</label>
      <input
        id={id}
        type="search"
        placeholder={placeholder}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
      />
      {draft && (
        <button
          type="button"
          className="search-clear"
          aria-label="Clear search"
          onClick={() => {
            setDraft('')
            onSearch('')
          }}
        >
          ×
        </button>
      )}
      <button className="search-button" type="submit" aria-label="Search">⌕</button>
    </form>
  )
}