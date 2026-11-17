import { useState, type ChangeEvent, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { getCurrentUser } from '../api/auth'
import {
  ASSET_FILE_EXTENSIONS,
  ASSET_TYPES,
  MAX_UPLOAD_BYTES,
  fileExtension,
  isAllowedAssetExtension,
  uploadAsset,
  type AssetType,
} from '../api/assets'
import { useAuth } from '../auth/auth-context'
import FormField from '../components/FormField'
import InlineError from '../components/InlineError'

const TYPE_LABELS: Record<AssetType, string> = {
  '2d': '2D',
  '3d': '3D',
  map: 'Map',
  sound: 'Sound',
  environment: 'Environment',
}

const ASSET_ACCEPT = ASSET_FILE_EXTENSIONS.map((extension) => `.${extension}`).join(',')

type FormErrors = {
  name?: string
  description?: string
  type?: string
  file?: string
}

function fileProblem(file: File): string | undefined {
  const extension = fileExtension(file.name)
  if (!isAllowedAssetExtension(extension)) {
    return extension ? `Files of type ".${extension}" are not allowed.` : 'The file type is not allowed.'
  }
  if (file.size > MAX_UPLOAD_BYTES) return 'The file is larger than 100 MB.'
  return undefined
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
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState<AssetType | ''>('')
  const [file, setFile] = useState<File | null>(null)
  const [errors, setErrors] = useState<FormErrors>({})
  const [formError, setFormError] = useState('')
  const [busy, setBusy] = useState(false)
  const suspended = user?.status === 'SUSPENDED'
  const locked = busy || suspended

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

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
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

      setErrors(next)
      const problem = summary(next)
      if (problem || !file || !type) {
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
        {/* Preview and tags (TagInput) come back once the catalog stores them. */}
        <div className="form-actions">
          <button type="submit" className="button button-primary publish-button" disabled={locked}>
            {busy ? 'Publishing…' : 'Publish'}
          </button>
        </div>
      </form>
    </main>
  )
}
