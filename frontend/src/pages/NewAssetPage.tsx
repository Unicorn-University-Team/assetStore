import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { getCurrentUser } from '../api/auth'
import {
  ASSET_FILE_EXTENSIONS,
  ASSET_TYPES,
  MAX_UPLOAD_BYTES,
  PREVIEW_EXTENSIONS,
  fileExtension,
  isAllowedAssetExtension,
  isAllowedPreviewExtension,
  uploadAsset,
  type AssetType,
} from '../api/assets'
import { missingTag } from '../api/tags'
import { useAuth } from '../auth/auth-context'
import FormField from '../components/FormField'
import InlineError from '../components/InlineError'
import TagInput, { type TagInputHandle } from '../components/TagInput'

const TYPE_LABELS: Record<AssetType, string> = {
  '2d': '2D',
  '3d': '3D',
  map: 'Map',
  sound: 'Sound',
  environment: 'Environment',
}

const ASSET_ACCEPT = ASSET_FILE_EXTENSIONS.map((extension) => `.${extension}`).join(',')
const PREVIEW_ACCEPT = PREVIEW_EXTENSIONS.map((extension) => `.${extension}`).join(',')

type FormErrors = {
  name?: string
  description?: string
  type?: string
  file?: string
  preview?: string
  tags?: string
}

function fileProblem(file: File): string | undefined {
  const extension = fileExtension(file.name)
  if (!isAllowedAssetExtension(extension)) {
    return extension ? `Files of type ".${extension}" are not allowed.` : 'The file type is not allowed.'
  }
  if (file.size > MAX_UPLOAD_BYTES) return 'The file is larger than 100 MB.'
  return undefined
}

function previewProblem(file: File): string | undefined {
  const extension = fileExtension(file.name)
  if (!isAllowedPreviewExtension(extension)) return 'The preview must be a png, jpg, jpeg, webp or gif image.'
  if (file.size > MAX_UPLOAD_BYTES) return 'The preview is larger than 100 MB.'
  return undefined
}

function useObjectUrl(file: File | null): string | null {
  const url = useMemo(() => (file ? URL.createObjectURL(file) : null), [file])
  useEffect(() => {
    if (!url) return
    return () => URL.revokeObjectURL(url)
  }, [url])
  return url
}

function PreviewPlaceholder() {
  return (
    <span className="preview-frame" aria-hidden="true">
      <svg viewBox="0 0 80 70" width="72" height="62">
        <polygon points="40,6 70,22 40,38 10,22" fill="#f4f7ff" />
        <polygon points="10,22 40,38 40,62 10,46" fill="#8ea4f2" />
        <polygon points="70,22 40,38 40,62 70,46" fill="#3355e0" />
      </svg>
    </span>
  )
}

function summary(errors: FormErrors): string {
  const messages = Object.values(errors).filter((message): message is string => Boolean(message))
  if (messages.length === 1) return messages[0]
  if (messages.length > 1) return 'The input is not valid.'
  return ''
}

export default function NewAssetPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const tagsRef = useRef<TagInputHandle>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState<AssetType | ''>('')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<File | null>(null)
  const [tags, setTags] = useState<string[]>([])
  const [errors, setErrors] = useState<FormErrors>({})
  const [formError, setFormError] = useState('')
  const [busy, setBusy] = useState(false)
  const suspended = user?.status === 'SUSPENDED'
  const previewIsImage = preview ? isAllowedPreviewExtension(fileExtension(preview.name)) : false
  const previewUrl = useObjectUrl(previewIsImage ? preview : null)
  const locked = busy || suspended
  // Required fields: name, type, file and preview. The button stays off until each one has a value.
  const canPublish = name.trim() !== '' && type !== '' && file !== null && preview !== null

  function clearField(field: keyof FormErrors) {
    setFormError('')
    setErrors((current) => ({ ...current, [field]: undefined }))
  }

  function onFile(event: ChangeEvent<HTMLInputElement>) {
    const next = event.target.files?.[0] ?? null
    event.target.value = ''
    setFile(next)
    setFormError('')
    setErrors((current) => ({ ...current, file: next ? fileProblem(next) : undefined }))
  }

  function onPreview(event: ChangeEvent<HTMLInputElement>) {
    const next = event.target.files?.[0] ?? null
    event.target.value = ''
    setPreview(next)
    setFormError('')
    setErrors((current) => ({ ...current, preview: next ? previewProblem(next) : undefined }))
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy || !canPublish) return
    setBusy(true)
    setFormError('')
    try {
      let accountError = ''
      try {
        const current = await getCurrentUser()
        if (current.status === 'SUSPENDED') accountError = 'This account cannot publish assets.'
      } catch (cause) {
        accountError = cause instanceof Error ? cause.message : 'Could not check your account.'
      }
      // A suspended account is refused before the form is judged, and nothing is saved.
      if (accountError === 'This account cannot publish assets.') {
        setFormError(accountError)
        return
      }

      const next: FormErrors = {}
      const cleanName = name.trim()
      if (!cleanName) next.name = 'Enter a name.'
      else if (cleanName.length > 100) next.name = 'Name must be 100 characters or fewer.'
      if (description.length > 2000) next.description = 'Description must be 2000 characters or fewer.'
      if (!type) next.type = 'Select a type.'
      if (!file) next.file = 'Attach the asset file.'
      else next.file = fileProblem(file)
      if (!preview) next.preview = 'Add a preview image.'
      else next.preview = previewProblem(preview)

      const committed = (await tagsRef.current?.commit()) ?? { tags, error: '' }
      if (committed.error) next.tags = committed.error
      else if (committed.tags.length > 10) next.tags = 'You can add at most 10 tags.'
      else {
        try {
          const missing = await missingTag(committed.tags)
          if (missing) next.tags = `The tag “${missing}” does not exist.`
        } catch (cause) {
          next.tags = cause instanceof Error ? cause.message : 'Could not look up tags.'
        }
      }

      setErrors(next)
      const problem = summary(next)
      if (problem || !file || !preview || !type) {
        setFormError(problem || 'The input is not valid.')
        return
      }
      if (accountError) {
        setFormError(accountError)
        return
      }

      const asset = await uploadAsset({
        name: cleanName,
        description: description.trim(),
        type,
        file,
        preview,
        tags: committed.tags,
      })
      navigate(`/assets/${encodeURIComponent(asset.id)}`)
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : 'The asset could not be saved.')
    } finally {
      setBusy(false)
    }
  }

  const banner = formError || (suspended ? 'This account cannot publish assets.' : '')

  return (
    <main className="content-width workspace-page">
      <h1>New asset</h1>
      <form className="asset-form" onSubmit={(event) => { void submit(event) }} noValidate>
        {banner && <InlineError message={banner} />}
        <FormField
          id="asset-name"
          label="Name"
          requiredMark
          required
          value={name}
          maxLength={100}
          disabled={locked}
          error={errors.name}
          onChange={(event) => {
            setName(event.target.value)
            clearField('name')
          }}
        />
        <FormField id="asset-description" label="Description" error={errors.description}>
          <textarea
            id="asset-description"
            value={description}
            maxLength={2000}
            rows={2}
            disabled={locked}
            aria-invalid={Boolean(errors.description)}
            aria-describedby={errors.description ? 'asset-description-error' : undefined}
            onChange={(event) => {
              setDescription(event.target.value)
              clearField('description')
            }}
          />
        </FormField>
        <FormField id="asset-type" label="Type" requiredMark error={errors.type}>
          <select
            id="asset-type"
            value={type}
            required
            disabled={locked}
            aria-invalid={Boolean(errors.type)}
            aria-describedby={errors.type ? 'asset-type-error' : undefined}
            onChange={(event) => {
              setType(event.target.value as AssetType | '')
              clearField('type')
            }}
          >
            <option value="">Select a type</option>
            {ASSET_TYPES.map((item) => <option key={item} value={item}>{TYPE_LABELS[item]}</option>)}
          </select>
        </FormField>
        <FormField id="asset-file" label="File" requiredMark error={errors.file}>
          <div className={`file-picker${file ? '' : ' is-empty'}${errors.file ? ' invalid' : ''}`}>
            <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true">
              <path d="M4 1.5 H9.5 L13 5 V14.5 H4 Z" />
              <path d="M9.5 1.5 V5 H13" />
            </svg>
            <span>{file ? file.name : 'Choose a file'}</span>
            <input
              id="asset-file"
              type="file"
              accept={ASSET_ACCEPT}
              disabled={locked}
              aria-invalid={Boolean(errors.file)}
              aria-describedby={errors.file ? 'asset-file-error' : undefined}
              onChange={onFile}
            />
          </div>
        </FormField>
        <FormField id="asset-preview" label="Preview" requiredMark error={errors.preview}>
          <div className="preview-row">
            {previewUrl
              ? <span className="preview-frame"><img src={previewUrl} alt="" /></span>
              : <PreviewPlaceholder />}
            <div className="preview-side">
              <div className="add-preview">
                + Add preview
                <input
                  id="asset-preview"
                  type="file"
                  accept={PREVIEW_ACCEPT}
                  disabled={locked}
                  aria-invalid={Boolean(errors.preview)}
                  aria-describedby={errors.preview ? 'asset-preview-error' : undefined}
                  onChange={onPreview}
                />
              </div>
              {!errors.preview && <p className="field-hint">{preview ? preview.name : 'Image required'}</p>}
            </div>
          </div>
        </FormField>
        <FormField id="asset-tags" label="Tags" error={errors.tags}>
          <TagInput
            ref={tagsRef}
            id="asset-tags"
            tags={tags}
            disabled={locked}
            error={errors.tags}
            onChange={setTags}
            onError={(message) => {
              setFormError('')
              setErrors((current) => ({ ...current, tags: message || undefined }))
            }}
          />
        </FormField>
        <div className="form-actions">
          <button type="submit" className={`button button-primary publish-button${busy ? ' is-busy' : ''}`} disabled={locked || !canPublish}>
            {busy ? 'Publishing…' : 'Publish'}
          </button>
        </div>
      </form>
    </main>
  )
}
