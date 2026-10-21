import { useEffect, useState, type FormEvent } from 'react'
import {
  ASSET_TYPES,
  deleteAsset,
  downloadUrl,
  listAssets,
  uploadAsset,
  type AssetPage,
  type AssetType,
} from '../api/assets'

// Test page for the Postgres + S3 backend: upload, list, download, delete. Not the final UI.

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function AssetsDemo() {
  const [assets, setAssets] = useState<AssetPage | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState<AssetType>('3d')
  const [file, setFile] = useState<File | null>(null)
  const [fileInputKey, setFileInputKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    listAssets('', 1, controller.signal)
      .then(setAssets)
      .catch((e: unknown) => {
        if (!controller.signal.aborted) setError(e instanceof Error ? e.message : String(e))
      })
    return () => controller.abort()
  }, [])

  async function reload() {
    try {
      setAssets(await listAssets())
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  async function handleUpload(event: FormEvent) {
    event.preventDefault()
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      await uploadAsset({ name, description, type, file })
      setName('')
      setDescription('')
      setFile(null)
      setFileInputKey((key) => key + 1)
      await reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete(id: string) {
    setError(null)
    try {
      await deleteAsset(id)
      await reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <section className="card">
      <h2>Assets (test)</h2>

      <form className="upload" onSubmit={handleUpload}>
        <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} />
        <select value={type} onChange={(e) => setType(e.target.value as AssetType)}>
          {ASSET_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <textarea
          placeholder="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={2000}
        />
        <input key={fileInputKey} type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} required />
        <button type="submit" disabled={busy || !file}>
          {busy ? 'Uploading…' : 'Upload'}
        </button>
      </form>

      {error && <p className="error">{error}</p>}

      {assets && (
        <>
          <p className="muted small">{assets.total} asset(s)</p>
          <table className="assets">
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Size</th>
                <th>Downloads</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {assets.items.map((asset) => (
                <tr key={asset.id}>
                  <td title={asset.description}>{asset.name}</td>
                  <td>{asset.type}</td>
                  <td>{formatSize(asset.fileSize)}</td>
                  <td>{asset.downloadCount}</td>
                  <td className="actions">
                    <a href={downloadUrl(asset.id)} onClick={() => setTimeout(() => void reload(), 1000)}>
                      Download
                    </a>
                    <button type="button" onClick={() => void handleDelete(asset.id)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  )
}

export default AssetsDemo
