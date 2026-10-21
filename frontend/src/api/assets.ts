import { API_URL, apiDelete, apiGet, apiPostForm } from './client'

export const ASSET_TYPES = ['2d', '3d', 'map', 'sound', 'environment'] as const
export type AssetType = (typeof ASSET_TYPES)[number]

// Mirrors AssetView in backend/src/views/asset.view.ts
export type Asset = {
  id: string
  name: string
  description: string
  type: string
  fileName: string
  fileSize: number
  downloadCount: number
  createdAt: string
  updatedAt: string
}

export type AssetPage = { items: Asset[]; page: number; pageSize: number; total: number }

export type NewAsset = { name: string; description: string; type: AssetType; file: File }

export function listAssets(search = '', page = 1, signal?: AbortSignal): Promise<AssetPage> {
  const query = new URLSearchParams({ search, page: String(page) })
  return apiGet<AssetPage>(`/assets?${query}`, signal)
}

// Until there are user accounts, upload, edit and delete need the team's write key (README, Ochrana zápisu).
function writeHeaders(writeKey: string): HeadersInit {
  return writeKey ? { 'X-Write-Key': writeKey } : {}
}

export function uploadAsset(asset: NewAsset, writeKey: string): Promise<Asset> {
  const form = new FormData()
  // Text fields first, the file last.
  form.append('name', asset.name)
  form.append('description', asset.description)
  form.append('type', asset.type)
  form.append('file', asset.file)
  return apiPostForm<Asset>('/assets', form, writeHeaders(writeKey))
}

export function deleteAsset(id: string, writeKey: string): Promise<void> {
  return apiDelete(`/assets/${id}`, writeHeaders(writeKey))
}

// A plain link is enough: the backend counts the download and sends the file as an attachment.
export function downloadUrl(id: string): string {
  return `${API_URL}/assets/${id}/download`
}
