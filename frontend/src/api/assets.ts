import { API_URL, apiDelete, apiGet, apiPostForm } from './client'

export const ASSET_TYPES = ['2d', '3d', 'map', 'sound', 'environment'] as const
export type AssetType = (typeof ASSET_TYPES)[number]

// Same whitelist as the catalogue service. Checked again before upload so a rejected file never leaves the browser.
export const MAX_UPLOAD_BYTES = 100 * 1024 * 1024
export const ASSET_FILE_EXTENSIONS = [
  'png', 'jpg', 'jpeg', 'webp', 'gif', 'psd',
  'fbx', 'obj', 'mtl', 'gltf', 'glb', 'blend', 'stl', 'dae', '3ds',
  'wav', 'mp3', 'ogg', 'flac',
  'zip', '7z', 'unitypackage', 'tmx',
] as const
export const PREVIEW_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'gif'] as const

export function fileExtension(fileName: string): string {
  const dot = fileName.lastIndexOf('.')
  return dot >= 0 ? fileName.slice(dot + 1).toLowerCase() : ''
}

export function isAllowedAssetExtension(extension: string): boolean {
  return (ASSET_FILE_EXTENSIONS as readonly string[]).includes(extension)
}

export function isAllowedPreviewExtension(extension: string): boolean {
  return (PREVIEW_EXTENSIONS as readonly string[]).includes(extension)
}

// Mirrors AssetView in backend/src/views/asset.view.ts
export type Asset = {
  id: string
  ownerId: string | null
  ownerName: string | null
  name: string
  description: string
  type: string
  tagList: string[]
  previewUrl: string | null
  fileName: string
  fileSize: number
  downloadCount: number
  averageRating: number | null
  reviewCount: number
  createdAt: string
  updatedAt: string
}

type AssetListResponse = {
  itemList: Asset[]
  pageInfo: { pageIndex: number; pageSize: number; total: number }
}

// Keep the UI's one-based page model while translating the backend's zero-based API.
export type AssetPage = { items: Asset[]; page: number; pageSize: number; total: number }

export type NewAsset = { name: string; description: string; type: AssetType; file: File }

// The catalog API refuses a longer name search (400).
export const SEARCH_MAX_LENGTH = 100

export async function listAssets(search = '', page = 1, signal?: AbortSignal): Promise<AssetPage> {
  const pageSize = 20
  const query = new URLSearchParams({ name: search, pageIndex: String(Math.max(0, page - 1)), pageSize: String(pageSize) })
  const response = await apiGet<AssetListResponse>(`/assets?${query}`, signal)
  return {
    items: response.itemList,
    page: response.pageInfo.pageIndex + 1,
    pageSize: response.pageInfo.pageSize,
    total: response.pageInfo.total,
  }
}

export async function listMyAssets(page = 1, signal?: AbortSignal): Promise<AssetPage> {
  const pageSize = 20
  const query = new URLSearchParams({ pageIndex: String(Math.max(0, page - 1)), pageSize: String(pageSize) })
  // GET /api/assets/my: the catalog takes the owner from the session, so the total and the pages count only the
  // logged-in user's assets.
  const response = await apiGet<AssetListResponse>(`/assets/my?${query}`, signal)
  return {
    items: response.itemList,
    page: response.pageInfo.pageIndex + 1,
    pageSize: response.pageInfo.pageSize,
    total: response.pageInfo.total,
  }
}

// Upload and delete need a logged-in user (the session cookie goes with every request).
// The catalog does not store a preview or tags yet, so the form sends neither.
export function uploadAsset(asset: NewAsset): Promise<Asset> {
  const form = new FormData()
  // Text fields first, the file last.
  form.append('name', asset.name)
  form.append('description', asset.description)
  form.append('type', asset.type)
  form.append('file', asset.file)
  return apiPostForm<Asset>('/assets', form)
}

export function deleteAsset(id: string): Promise<void> {
  return apiDelete(`/assets/${id}`)
}

// A plain link is enough: the backend counts the download and sends the file as an attachment.
export function downloadUrl(id: string): string {
  return `${API_URL}/assets/${id}/download`
}
