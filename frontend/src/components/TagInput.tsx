import { useCallback, useEffect, useId, useImperativeHandle, useRef, useState, type KeyboardEvent, type Ref } from 'react'
import { createTag, listTags, type Tag } from '../api/tags'

const TAG_NAME = /^[a-z0-9-]{1,50}$/
const MAX_TAGS = 10
const INVALID_NAME = 'A tag has 1 to 50 Latin letters, digits or hyphens.'

// The last row of the list when the typed tag does not exist yet: US-1.1, the system offers to create it.
type CreateOption = { id: string; name: string; create: true }
type Option = Tag | CreateOption

function isCreate(option: Option | undefined): option is CreateOption {
  return option !== undefined && 'create' in option
}

export type TagInputHandle = {
  // Confirms whatever is still typed, then returns the tags to save.
  commit: () => Promise<{ tags: string[]; error: string }>
}

type TagInputProps = {
  ref?: Ref<TagInputHandle>
  id: string
  tags: string[]
  onChange: (tags: string[]) => void
  onError: (message: string) => void
  error?: string
  disabled?: boolean
}

function normalizeTag(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
}

function isAbort(error: unknown): boolean {
  return error instanceof DOMException
    ? error.name === 'AbortError'
    : error instanceof Error && error.name === 'AbortError'
}

export default function TagInput({ ref, id, tags, onChange, onError, error, disabled }: TagInputProps) {
  const listId = useId()
  const fieldRef = useRef<HTMLDivElement>(null)
  const [draft, setDraft] = useState('')
  const [suggestions, setSuggestions] = useState<Tag[]>([])
  const [active, setActive] = useState(0)
  const [open, setOpen] = useState(false)

  const visible = suggestions.filter((tag) => !tags.includes(tag.name))
  // A valid typed name that is not in the catalogue yet (and not on the asset) can be created after a confirmation.
  const typed = normalizeTag(draft)
  const offerCreate = TAG_NAME.test(typed) && !tags.includes(typed) && !suggestions.some((tag) => tag.name === typed)
  const options: Option[] = offerCreate ? [...visible, { id: 'create', name: typed, create: true }] : visible
  const highlighted = options[Math.min(active, Math.max(options.length - 1, 0))]

  // confirmed = the user chose "Create tag": the tag is created right away (AM tag/create), then goes on the asset.
  // Without it, a tag that does not exist is not added (US-1.1, the user did not confirm).
  const addName = useCallback(async (raw: string, current: string[], confirmed = false) => {
    const name = normalizeTag(raw)
    if (!name) return { tags: current, error: '' }
    if (!TAG_NAME.test(name)) {
      onError(INVALID_NAME)
      return { tags: current, error: INVALID_NAME }
    }
    if (current.includes(name)) {
      setDraft('')
      onError('')
      return { tags: current, error: '' }
    }
    if (current.length >= MAX_TAGS) {
      const message = 'You can add at most 10 tags.'
      onError(message)
      return { tags: current, error: message }
    }
    try {
      if (confirmed) await createTag(name)
      const found = confirmed ? [] : await listTags(name)
      if (!confirmed && !found.some((tag) => tag.name === name)) {
        const message = `The tag “${name}” does not exist yet. Choose “Create tag” to add it.`
        onError(message)
        setOpen(true)
        return { tags: current, error: message }
      }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : confirmed ? 'Could not create the tag.' : 'Could not look up tags.'
      onError(message)
      return { tags: current, error: message }
    }
    const next = [...current, name]
    onChange(next)
    setDraft('')
    setOpen(true)
    onError('')
    return { tags: next, error: '' }
  }, [onChange, onError])

  useImperativeHandle(ref, () => ({
    commit() {
      if (!normalizeTag(draft)) return Promise.resolve({ tags, error: '' })
      return addName(draft, tags)
    },
  }), [addName, draft, tags])

  useEffect(() => {
    if (!open) return
    const prefix = normalizeTag(draft)
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      listTags(prefix, controller.signal)
        .then((items) => { if (!controller.signal.aborted) setSuggestions(items) })
        .catch((cause: unknown) => { if (!controller.signal.aborted && !isAbort(cause)) setSuggestions([]) })
    }, prefix ? 150 : 0)
    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [draft, open, tags])

  useEffect(() => {
    if (!open) return
    function onPointer(event: MouseEvent) {
      if (!fieldRef.current?.contains(event.target as Node)) setOpen(false)
    }
    // On click, not mousedown: closing the list moves the form up, and on mousedown that would move a button
    // (e.g. Publish) away before the click ends, so the click would be lost. Wait until the click that opened
    // the list has finished, or that same click closes it.
    const timer = window.setTimeout(() => document.addEventListener('click', onPointer), 0)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('click', onPointer)
    }
  }, [open])

  function choose(option: Option) {
    void addName(option.name, tags, isCreate(option))
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown' && options.length) {
      event.preventDefault()
      setActive((index) => Math.min(index + 1, options.length - 1))
    } else if (event.key === 'ArrowUp' && options.length) {
      event.preventDefault()
      setActive((index) => Math.max(index - 1, 0))
    } else if (event.key === 'Enter' && open && highlighted) {
      event.preventDefault()
      choose(highlighted)
    } else if (event.key === 'Enter' && !normalizeTag(draft)) {
      // Empty field with the list closed: let the form submit.
    } else if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault()
      // A comma adds an existing tag only; a new one still needs "Create tag".
      if (normalizeTag(draft)) void addName(draft, tags)
    } else if (event.key === 'Escape' || event.key === 'Tab') {
      setOpen(false)
    } else if (event.key === 'Backspace' && !draft && tags.length) {
      onChange(tags.slice(0, -1))
    }
  }

  const showList = open && !disabled

  return (
    <div className="tag-field" ref={fieldRef}>
      <div
        className={`tag-box${showList ? ' open' : ''}${error ? ' invalid' : ''}`}
        onMouseDown={(event) => {
          if (disabled || (event.target as HTMLElement).closest('button')) return
          setOpen(true)
        }}
      >
        {tags.map((tag) => (
          <span className="tag-chip" key={tag}>
            {tag}
            <button
              type="button"
              aria-label={`Remove ${tag}`}
              disabled={disabled}
              onClick={() => {
                onChange(tags.filter((item) => item !== tag))
                onError('')
              }}
            >
              ×
            </button>
          </span>
        ))}
        <input
          id={id}
          role="combobox"
          value={draft}
          disabled={disabled}
          placeholder={tags.length ? '' : 'Select tags'}
          autoComplete="off"
          aria-invalid={Boolean(error)}
          aria-autocomplete="list"
          aria-expanded={showList}
          aria-controls={listId}
          aria-activedescendant={showList && highlighted ? `${listId}-${highlighted.id}` : undefined}
          maxLength={50}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setDraft(event.target.value)
            setActive(0)
            setOpen(true)
            onError('')
          }}
          onKeyDown={onKeyDown}
        />
        <button
          type="button"
          className="tag-chevron"
          aria-label={showList ? 'Close tags' : 'Show tags'}
          disabled={disabled}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => setOpen((current) => !current)}
        >
          <svg viewBox="0 0 12 8" width="12" height="8" aria-hidden="true"><path d="M1 1.5 L6 6.5 L11 1.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      </div>
      {showList && (
        <div className="tag-suggestions" id={listId} role="listbox">
          {options.map((option) => (
            <button
              type="button"
              key={option.id}
              id={`${listId}-${option.id}`}
              role="option"
              aria-selected={option.id === highlighted?.id}
              className={`tag-suggestion${option.id === highlighted?.id ? ' active' : ''}${isCreate(option) ? ' tag-create' : ''}`}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(option)}
            >
              {isCreate(option) ? <>+ Create tag “<strong>{option.name}</strong>”</> : option.name}
            </button>
          ))}
          {options.length === 0 && <p className="tag-empty">{draft.trim() ? 'No matching tags' : 'No tags yet'}</p>}
        </div>
      )}
    </div>
  )
}
