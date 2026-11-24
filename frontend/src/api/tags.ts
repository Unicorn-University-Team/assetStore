import { apiGet } from './client'

export type Tag = { id: string; name: string }

type TagListResponse = { itemList: Tag[] }

export async function listTags(prefix: string, signal?: AbortSignal): Promise<Tag[]> {
  const query = new URLSearchParams({ prefix })
  const response = await apiGet<TagListResponse>(`/tags?${query}`, signal)
  return response.itemList
}
