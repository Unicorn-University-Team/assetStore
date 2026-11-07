import { useState, type FormEvent } from 'react'

export default function SearchBar({ value, onSearch }: { value: string; onSearch: (value: string) => void }) {
  const [draft, setDraft] = useState(value)

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onSearch(draft.trim())
  }

  return (
    <form className="header-search" role="search" onSubmit={submit}>
      <label className="sr-only" htmlFor="site-search">Search assets by name</label>
      <input id="site-search" type="search" placeholder="Search for assets" value={draft} onChange={(event) => setDraft(event.target.value)} />
      {draft && <button type="button" className="search-clear" aria-label="Clear search" onClick={() => { setDraft(''); onSearch('') }}>×</button>}
      <button className="search-button" type="submit" aria-label="Search">⌕</button>
    </form>
  )
}
