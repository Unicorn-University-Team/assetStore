import { ApiError, apiGet, apiPost } from './client'

export type Tag = { id: string; name: string }

type TagListResponse = { itemList: Tag[] }

export async function listTags(prefix: string, signal?: AbortSignal): Promise<Tag[]> {
  const query = new URLSearchParams({ prefix })
  const response = await apiGet<TagListResponse>(`/tags?${query}`, signal)
  return response.itemList
}

// US-1.1, AM tag/create: creates a missing tag before it goes on an asset (create and update take only existing
// tags). A tag someone else created in the meantime (409) is fine: it exists now.
export async function createTag(name: string): Promise<void> {
  try {
    await apiPost<Tag>('/tags', { name })
  } catch (cause) {
    if (cause instanceof ApiError && cause.status === 409) return
    throw cause
  }
}
