import { useEffect } from 'react'

// Browser tab title: "<page> · assetStore", or just "assetStore" while there is nothing better (loading).
export function usePageTitle(title?: string) {
  useEffect(() => {
    document.title = title ? `${title} · assetStore` : 'assetStore'
  }, [title])
}
