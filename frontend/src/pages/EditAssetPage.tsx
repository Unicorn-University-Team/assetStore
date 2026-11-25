import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { describeFailure } from '../api/client'
import { getAsset, previewProblem, updateAsset, type Asset } from '../api/assets'
import { useAuth } from '../auth/auth-context'
import FormField from '../components/FormField'
import InlineError from '../components/InlineError'
import PreviewUpload from '../components/PreviewUpload'
import StatusMessage from '../components/StatusMessage'
import TagInput, { type TagInputHandle } from '../components/TagInput'
import { usePageTitle } from '../usePageTitle'

type FormErrors = { name?: string; description?: string; preview?: string; tags?: string }

function sameTags(a: string[], b: string[]): boolean {
  return a.length === b.length && [...a].sort().join(',') === [...b].sort().join(',')
}

// US-2 (AM route editAsset): the owner changes the name, description, tags and optionally the preview image of an
// asset. The type and the file cannot be changed and are not shown; reviews and the download count stay as they are.
export default function EditAssetPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const tagsRef = useRef<TagInputHandle>(null)
  const [loaded, setLoaded] = useState<{ id: string; asset: Asset | null; error: string; status: number } | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [preview, setPreview] = useState<File | null>(null)
  const [errors, setErrors] = useState<FormErrors>({})
  const [formError, setFormError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    getAsset(id, controller.signal)
      .then((asset) => {
        setName(asset.name)
        setDescription(asset.description)
        setTags(asset.tagList)
        setLoaded({ id, asset, error: '', status: 200 })
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return
        const failure = describeFailure(cause, 'Could not load the asset.')
        setLoaded({ id, asset: null, error: failure.message, status: failure.status })
      })
    return () => controller.abort()
  }, [id])

  const asset = loaded?.id === id ? loaded.asset : null
  const notOwner = asset !== null && asset.ownerId !== user?.id
  usePageTitle(notOwner ? 'Access denied' : asset ? `Edit: ${asset.name}` : 'Edit asset')

  const changed = asset !== null && (
    name.trim() !== asset.name || description.trim() !== asset.description || !sameTags(tags, asset.tagList) ||
    preview !== null
  )
  // AM editAsset SaveButton: disabled if the name is empty, if nothing has changed and while saving.
  const canSave = name.trim() !== '' && changed && !busy

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!asset || busy) return
    setBusy(true)
    setFormError('')
    try {
      const next: FormErrors = {}
      const cleanName = name.trim()
      if (!cleanName) next.name = 'Enter a name.'
      else if (cleanName.length > 100) next.name = 'Name must be 100 characters or fewer.'
      if (description.length > 2000) next.description = 'Description must be 2000 characters or fewer.'
      if (preview) next.preview = previewProblem(preview)
      // A tag still typed but not confirmed stops the saving, like when publishing (US-1.1).
      const committed = (await tagsRef.current?.commit()) ?? { tags, error: '' }
      if (committed.error) next.tags = committed.error
      else if (committed.tags.length > 10) next.tags = 'You can add at most 10 tags.'
      setErrors(next)
      const problem = Object.values(next).find(Boolean)
      if (problem) {
        setFormError(problem)
        return
      }

      const saved = await updateAsset(
        asset.id,
        { name: cleanName, description: description.trim(), tagList: committed.tags },
        preview,
      )
      navigate(`/assets/${encodeURIComponent(saved.id)}`)
    } catch (cause) {
      setFormError(describeFailure(cause, 'The changes could not be saved.').message)
    } finally {
      setBusy(false)
    }
  }

  if (loaded?.id !== id) {
    return <main className="content-width workspace-page"><StatusMessage kind="loading" title="Loading the asset" /></main>
  }
  if (!asset) {
    return (
      <main className="content-width workspace-page">
        <StatusMessage
          kind={loaded.status === 404 ? 'missing' : 'error'}
          title={loaded.status === 404 ? 'Asset not found' : 'Could not load the asset'}
          message={loaded.error}
        >
          <Link className="button button-secondary" to="/my/assets">Back to my assets</Link>
        </StatusMessage>
      </main>
    )
  }
  if (notOwner) {
    return (
      <main className="content-width workspace-page">
        <StatusMessage kind="error" title="Access denied" message="Only the owner of the asset can edit it.">
          <Link className="button button-secondary" to="/my/assets">Back to my assets</Link>
        </StatusMessage>
      </main>
    )
  }

  return (
    <main className="content-width workspace-page">
      <h1>Edit asset</h1>
      <form className="asset-form" onSubmit={(event) => { void submit(event) }} noValidate>
        {formError && <InlineError message={formError} />}
        <FormField
          id="asset-name"
          label="Name"
          requiredMark
          required
          value={name}
          maxLength={100}
          disabled={busy}
          error={errors.name}
          onChange={(event) => {
            setName(event.target.value)
            setFormError('')
            setErrors((current) => ({ ...current, name: undefined }))
          }}
        />
        <FormField id="asset-description" label="Description" error={errors.description}>
          <textarea
            id="asset-description"
            value={description}
            maxLength={2000}
            rows={2}
            disabled={busy}
            aria-invalid={Boolean(errors.description)}
            aria-describedby={errors.description ? 'asset-description-error' : undefined}
            onChange={(event) => {
              setDescription(event.target.value)
              setFormError('')
              setErrors((current) => ({ ...current, description: undefined }))
            }}
          />
        </FormField>
        <FormField id="asset-preview" label="Preview" error={errors.preview}>
          <PreviewUpload
            id="asset-preview"
            value={preview}
            currentUrl={asset.previewUrl}
            disabled={busy}
            error={errors.preview}
            onChange={(next, problem) => {
              setPreview(next)
              setFormError('')
              setErrors((current) => ({ ...current, preview: problem }))
            }}
          />
        </FormField>
        <FormField id="asset-tags" label="Tags" error={errors.tags}>
          <TagInput
            ref={tagsRef}
            id="asset-tags"
            tags={tags}
            disabled={busy}
            error={errors.tags}
            onChange={setTags}
            onError={(message) => {
              setFormError('')
              setErrors((current) => ({ ...current, tags: message || undefined }))
            }}
          />
        </FormField>
        <div className="form-actions">
          <Link className="button button-secondary" to="/my/assets">Cancel</Link>
          <button type="submit" className={`button button-primary publish-button${busy ? ' is-busy' : ''}`} disabled={!canSave}>
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </main>
  )
}
