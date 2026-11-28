import type { CollectionSummary } from '../api/collections'

function formatAssetCount(count: number): string {
  return `${count} ${count === 1 ? 'asset' : 'assets'}`
}

// The logged-in user's collections: name, description and number of assets.
// The name becomes a link to /my/collections/:id once the collection detail page exists.
export default function CollectionList({ collections }: { collections: CollectionSummary[] }) {
  return (
    <ul className="collection-list">
      {collections.map((collection) => (
        <li key={collection.id}>
          <div className="collection-main">
            <strong>{collection.name}</strong>
            {collection.description && <p className="collection-description">{collection.description}</p>}
          </div>
          {collection.assetCount !== undefined && (
            <span className="collection-count">{formatAssetCount(collection.assetCount)}</span>
          )}
        </li>
      ))}
    </ul>
  )
}
