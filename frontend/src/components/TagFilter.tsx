import { useEffect, useId, useState, type KeyboardEvent } from 'react'
import { listTags, type Tag } from '../api/tags'

type TagFilterProps = {
  selected: string[]
  onChange: (tags: string[]) => void
}

// US-9 (AM route home, TagFilter): only assets with all the selected tags are shown. Only existing tags can be
// chosen (suggestions from GET /api/tags?prefix=); the filter is not displayed while no tag exists yet.
export default function TagFilter({ selected, onChange }: TagFilterProps) {
  const listId = useId()
  const [anyTag, setAnyTag] = useState<boolean | null>(null)
  const [draft, setDraft] = useState('')
  const [suggestions, setSuggestions] = useState<Tag[]>([])
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    listTags('', controller.signal).then((tags) => setAnyTag(tags.length > 0)).catch(() => setAnyTag(false))
    return () => controller.abort()
  }, [])

  const prefix = draft.trim().toLowerCase()
  useEffect(() => {
    if (!open) return
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      listTags(prefix, controller.signal).then(setSuggestions).catch(() => setSuggestions([]))
    }, 150)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [prefix, open])

  const options = suggestions.filter((tag) => !selected.includes(tag.name))
  const highlighted = options[Math.min(active, Math.max(options.length - 1, 0))]

  function add(name: string) {
    if (!selected.includes(name)) onChange([...selected, name])
    setDraft('')
    setActive(0)
  }

  function remove(name: string) {
    onChange(selected.filter((tag) => tag !== name))
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setOpen(true)
      setActive((value) => Math.min(value + 1, Math.max(options.length - 1, 0)))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive((value) => Math.max(value - 1, 0))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      if (highlighted) add(highlighted.name)
    } else if (event.key === 'Escape') {
      setOpen(false)
    } else if (event.key === 'Backspace' && !draft && selected.length) {
      remove(selected[selected.length - 1])
    }
  }

  if (!anyTag && selected.length === 0) return null

  return (
    <div className="tag-field catalog-tag-filter">
      <div className={`tag-box${open && options.length ? ' open' : ''}`}>
        {selected.map((tag) => (
          <span className="tag-chip" key={tag}>
            {tag}
            <button type="button" aria-label={`Remove tag ${tag}`} onClick={() => remove(tag)}>×</button>
          </span>
        ))}
        <input
          type="text"
          value={draft}
          placeholder={selected.length ? '' : 'Filter by tags…'}
          aria-label="Filter by tags"
          role="combobox"
          aria-expanded={open && options.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          maxLength={50}
          onChange={(event) => {
            setDraft(event.target.value)
            setOpen(true)
            setActive(0)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 150)}
          onKeyDown={onKeyDown}
        />
      </div>
      {open && (
        <div className="tag-suggestions" id={listId} role="listbox">
          {options.map((tag) => (
            <button
              type="button"
              role="option"
              aria-selected={tag.id === highlighted?.id}
              key={tag.id}
              className={`tag-suggestion${tag.id === highlighted?.id ? ' active' : ''}`}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => add(tag.name)}
            >
              {tag.name}
            </button>
          ))}
          {options.length === 0 && <p className="tag-empty">{prefix ? 'No matching tags' : 'No more tags'}</p>}
        </div>
      )}
    </div>
  )
}
