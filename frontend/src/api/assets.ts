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

export type NewAsset = {
  name: string
  description: string
  type: AssetType
  file: File
  tags?: string[]
  preview?: File | null
}

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

export async function listMyAssets(ownerId: string, page = 1, signal?: AbortSignal): Promise<AssetPage> {
  const pageSize = 20
  const query = new URLSearchParams({
    ownerId,
    pageIndex: String(Math.max(0, page - 1)),
    pageSize: String(pageSize),
  })
  const response = await apiGet<AssetListResponse>(`/assets?${query}`, signal)
  // The list endpoint does not store owners yet, so drop anything that is not this user's.
  const items = response.itemList.filter((asset) => asset.ownerId === ownerId)
  const filteredByServer = items.length === response.itemList.length
  return {
    items,
    page: response.pageInfo.pageIndex + 1,
    pageSize: response.pageInfo.pageSize,
    total: filteredByServer ? response.pageInfo.total : items.length,
  }
}

// Until there are user accounts, upload, edit and delete need the team's write key (README, Ochrana zápisu).
function writeHeaders(writeKey: string): HeadersInit {
  return writeKey ? { 'X-Write-Key': writeKey } : {}
}

export function uploadAsset(asset: NewAsset, writeKey = ''): Promise<Asset> {
  const form = new FormData()
  // Text fields first. The asset file must be the first file part: the catalogue keeps a single file
  // and ignores any file after it, so the preview has to follow the asset file.
  form.append('name', asset.name)
  form.append('description', asset.description)
  form.append('type', asset.type)
  if (asset.tags?.length) form.append('tags', asset.tags.join(','))
  form.append('file', asset.file)
  if (asset.preview) form.append('preview', asset.preview)
  return apiPostForm<Asset>('/assets', form, writeHeaders(writeKey))
}

export function deleteAsset(id: string, writeKey: string): Promise<void> {
  return apiDelete(`/assets/${id}`, writeHeaders(writeKey))
}

// A plain link is enough: the backend counts the download and sends the file as an attachment.
export function downloadUrl(id: string): string {
  return `${API_URL}/assets/${id}/download`
}
