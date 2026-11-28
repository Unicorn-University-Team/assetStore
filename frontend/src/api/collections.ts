import { apiGet } from './client'

export type CollectionSummary = {
  id: string
  ownerId: string
  name: string
  description: string
  assetCount?: number
}

type CollectionListResponse = { itemList: CollectionSummary[] }

export function listMyCollections(signal?: AbortSignal): Promise<CollectionSummary[]> {
  return apiGet<CollectionListResponse>('/collections', signal).then((response) => response.itemList)
}
