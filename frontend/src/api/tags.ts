import { apiGet } from './client'

export type Tag = { id: string; name: string }

type TagListResponse = { itemList: Tag[] }

export async function listTags(prefix: string, signal?: AbortSignal): Promise<Tag[]> {
  const query = new URLSearchParams({ prefix })
  const response = await apiGet<TagListResponse>(`/tags?${query}`, signal)
  return response.itemList
}

// A tag can only be added when the catalogue already has it (a missing tag is created on its own page).
export async function missingTag(names: string[], signal?: AbortSignal): Promise<string | null> {
  for (const name of names) {
    const found = await listTags(name, signal)
    if (!found.some((tag) => tag.name === name)) return name
  }
  return null
}
