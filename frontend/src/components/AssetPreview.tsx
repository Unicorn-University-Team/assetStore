import { useEffect, useRef, useState, type ReactNode } from 'react'
import { API_URL } from '../api/client'
import type { Asset } from '../api/assets'

type PreviewKind = 'image' | 'model' | 'audio' | 'none'

// The same file types as the catalog's GET /api/assets/:id/file (services/catalog/src/utils/preview.ts).
const KINDS: Record<string, PreviewKind> = {
  png: 'image', jpg: 'image', jpeg: 'image', webp: 'image', gif: 'image',
  glb: 'model', gltf: 'model',
  wav: 'audio', mp3: 'audio', ogg: 'audio', flac: 'audio',
}

// Bigger models wait for a click, so opening the page on a phone never downloads 100 MB by itself.
const AUTO_LOAD_MODEL_BYTES = 20 * 1024 ** 2

function previewKind(fileName: string): PreviewKind {
  const dot = fileName.lastIndexOf('.')
  return KINDS[dot >= 0 ? fileName.slice(dot + 1).toLowerCase() : ''] ?? 'none'
}

function megabytes(bytes: number) {
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`
}

// The file for viewing (not a download: it does not raise the download count).
function fileUrl(asset: Asset) {
  return `${API_URL}/assets/${encodeURIComponent(asset.id)}/file`
}

function ModelPreview({ asset, fallback }: { asset: Asset; fallback: ReactNode }) {
  const [wanted, setWanted] = useState(asset.fileSize <= AUTO_LOAD_MODEL_BYTES)
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading')
  const [libraryReady, setLibraryReady] = useState(false)
  const viewer = useRef<HTMLElement>(null)

  // The viewer (three.js inside) is a separate chunk: only 3D asset pages download it.
  useEffect(() => {
    if (!wanted) return
    let active = true
    import('@google/model-viewer')
      .then(() => { if (active) setLibraryReady(true) })
      .catch(() => { if (active) setState('failed') })
    return () => { active = false }
  }, [wanted])

  useEffect(() => {
    const element = viewer.current
    if (!element) return
    const onLoad = () => setState('ready')
    const onError = () => setState('failed')
    element.addEventListener('load', onLoad)
    element.addEventListener('error', onError)
    return () => {
      element.removeEventListener('load', onLoad)
      element.removeEventListener('error', onError)
    }
  }, [libraryReady])

  if (!wanted) {
    return <>{fallback}<button type="button" className="button button-primary preview-load" onClick={() => setWanted(true)}>Load 3D preview ({megabytes(asset.fileSize)})</button></>
  }
  if (state === 'failed') return <>{fallback}<p className="preview-note">The 3D preview could not be loaded.</p></>
  return (
    <>
      {state === 'loading' && <p className="preview-note" role="status">Loading 3D model…</p>}
      {libraryReady && (
        <model-viewer
          ref={viewer}
          className="detail-model"
          src={fileUrl(asset)}
          alt={`3D model of ${asset.name}`}
          camera-controls=""
          auto-rotate=""
          touch-action="pan-y"
          shadow-intensity="0.8"
          interaction-prompt="none"
        />
      )}
    </>
  )
}

// The cover on the asset page: the picture, a 3D model to turn with the mouse, or a sound player.
// Other file types (and any file that fails to load) keep the drawn cover.
export default function AssetPreview({ asset, fallback }: { asset: Asset; fallback: ReactNode }) {
  const [failed, setFailed] = useState(false)
  const kind = previewKind(asset.fileName)

  // AM AssetPreviewImage: the preview image (previewUrl). 3D models and sounds keep their viewer and player.
  if (kind !== 'model' && kind !== 'audio' && asset.previewUrl && !failed) {
    return <img className="detail-preview" src={asset.previewUrl} alt={`${asset.name} preview`} onError={() => setFailed(true)} />
  }
  if (kind === 'image' && !failed) {
    return <img className="detail-preview" src={fileUrl(asset)} alt={`${asset.name} preview`} onError={() => setFailed(true)} />
  }
  if (kind === 'model') return <ModelPreview key={asset.id} asset={asset} fallback={fallback} />
  if (kind === 'audio') {
    return (
      <>
        {fallback}
        {failed
          ? <p className="preview-note">The sound could not be loaded.</p>
          : <audio className="detail-audio" controls preload="metadata" src={fileUrl(asset)} aria-label={`Play ${asset.name}`} onError={() => setFailed(true)} />}
      </>
    )
  }
  return <>{fallback}<p className="preview-note">{failed ? 'The preview could not be loaded.' : 'No preview for this file type yet.'}</p></>
}
