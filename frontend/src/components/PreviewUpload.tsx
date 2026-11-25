import { useEffect, useMemo, type ChangeEvent } from 'react'
import { PREVIEW_EXTENSIONS, previewProblem } from '../api/assets'

const PREVIEW_ACCEPT = PREVIEW_EXTENSIONS.map((extension) => `.${extension}`).join(',')

// AM component PreviewUpload: the preview image of an asset (png, jpg, jpeg, webp, at most 2 MB).
type PreviewUploadProps = {
  id: string
  value: File | null
  // editAsset: the current preview (previewUrl) until a new one is chosen.
  currentUrl?: string | null
  disabled?: boolean
  error?: string
  onChange: (file: File | null, problem: string | undefined) => void
}

export default function PreviewUpload({ id, value, currentUrl = null, disabled, error, onChange }: PreviewUploadProps) {
  // The chosen image shown before it is saved; the object URL is freed when another one is chosen.
  const chosenUrl = useMemo(() => (value && !previewProblem(value) ? URL.createObjectURL(value) : null), [value])
  useEffect(() => () => {
    if (chosenUrl) URL.revokeObjectURL(chosenUrl)
  }, [chosenUrl])

  function onFile(event: ChangeEvent<HTMLInputElement>) {
    const next = event.target.files?.[0] ?? null
    event.target.value = ''
    onChange(next, next ? previewProblem(next) : undefined)
  }

  const shown = chosenUrl ?? currentUrl
  return (
    <div className="preview-upload">
      {shown && <img className="preview-upload-image" src={shown} alt="" />}
      <div className={`file-picker${value ? '' : ' is-empty'}${error ? ' invalid' : ''}`}>
        <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true">
          <rect x="1.5" y="2.5" width="13" height="11" rx="1" />
          <path d="M1.5 11 L6 7 L9.5 10 L11.5 8.5 L14.5 11" />
        </svg>
        <span>{value ? value.name : currentUrl ? 'Choose a new preview' : 'Add preview'}</span>
        <input
          id={id}
          type="file"
          accept={PREVIEW_ACCEPT}
          disabled={disabled}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={onFile}
        />
      </div>
    </div>
  )
}
