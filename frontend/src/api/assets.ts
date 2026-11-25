import { API_URL, apiDelete, apiGet, apiPostForm, apiPut, apiPutForm } from './client'

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
// AM asset limits: the preview image (allowedPreviewExtensions, maxPreviewSizeMb).
export const PREVIEW_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp'] as const
export const MAX_PREVIEW_BYTES = 2 * 1024 * 1024

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

// The same preview rules as the catalogue, so a wrong image never leaves the browser.
export function previewProblem(file: File): string | undefined {
  if (!isAllowedPreviewExtension(fileExtension(file.name))) return 'The preview must be a png, jpg, jpeg or webp image.'
  if (file.size > MAX_PREVIEW_BYTES) return 'The preview is larger than 2 MB.'
  return undefined
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

export type NewAsset = { name: string; description: string; type: AssetType; file: File; preview: File; tags?: string[] }

// The catalog API refuses a longer name search (400).
export const SEARCH_MAX_LENGTH = 100

// tags: only assets that carry all of them (US-9); sent as repeated tagList parameters.
export async function listAssets(search = '', page = 1, signal?: AbortSignal, tags: string[] = []): Promise<AssetPage> {
  const pageSize = 20
  const query = new URLSearchParams({ name: search, pageIndex: String(Math.max(0, page - 1)), pageSize: String(pageSize) })
  for (const tag of tags) query.append('tagList', tag)
  const response = await apiGet<AssetListResponse>(`/assets?${query}`, signal)
  return {
    items: response.itemList,
    page: response.pageInfo.pageIndex + 1,
    pageSize: response.pageInfo.pageSize,
    total: response.pageInfo.total,
  }
}

export async function listMyAssets(ownerId: string, page = 1, signal?: AbortSignal): Promise<AssetPage> {
  const pageSize = 20
  // AM asset/list with ownerId (route myAssets): the total and the pages count only this user's assets.
  const query = new URLSearchParams({ ownerId, pageIndex: String(Math.max(0, page - 1)), pageSize: String(pageSize) })
  const response = await apiGet<AssetListResponse>(`/assets?${query}`, signal)
  return {
    items: response.itemList,
    page: response.pageInfo.pageIndex + 1,
    pageSize: response.pageInfo.pageSize,
    total: response.pageInfo.total,
  }
}

// Upload and delete need a logged-in user (the session cookie goes with every request).
// tagList: one field per tag; every tag must exist (TagInput creates a new one first, US-1.1).
export function uploadAsset(asset: NewAsset): Promise<Asset> {
  const form = new FormData()
  // Text fields first, the file last.
  form.append('name', asset.name)
  form.append('description', asset.description)
  form.append('type', asset.type)
  for (const tag of asset.tags ?? []) form.append('tagList', tag)
  form.append('preview', asset.preview)
  form.append('file', asset.file)
  return apiPostForm<Asset>('/assets', form)
}

export function getAsset(id: string, signal?: AbortSignal): Promise<Asset> {
  return apiGet<Asset>(`/assets/${encodeURIComponent(id)}`, signal)
}

// US-2: name, description and tags; the type and the file stay. The tags replace the old ones; a new tag the user
// confirmed was created by TagInput before (US-1.1).
export type AssetChanges = { name: string; description: string; tagList: string[] }

// With a new preview image the same fields go as multipart/form-data (AM asset/update preview); tagList is then one
// field with a JSON array, so an empty list still clears the tags.
export function updateAsset(id: string, changes: AssetChanges, preview: File | null = null): Promise<Asset> {
  const path = `/assets/${encodeURIComponent(id)}`
  if (!preview) return apiPut<Asset>(path, changes)
  const form = new FormData()
  form.append('name', changes.name)
  form.append('description', changes.description)
  form.append('tagList', JSON.stringify(changes.tagList))
  form.append('preview', preview)
  return apiPutForm<Asset>(path, form)
}

export function deleteAsset(id: string): Promise<void> {
  return apiDelete(`/assets/${id}`)
}

// A plain link is enough: the backend counts the download and sends the file as an attachment.
export function downloadUrl(id: string): string {
  return `${API_URL}/assets/${id}/download`
}
