import { useEffect, useState } from 'react'
import { describeFailure } from '../api/client'
import { listMyCollections, type CollectionSummary } from '../api/collections'
import CollectionList from '../components/CollectionList'
import StatusMessage from '../components/StatusMessage'
import { usePageTitle } from '../usePageTitle'

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; collections: CollectionSummary[] }

// US-10: the logged-in user's private collections. The form for a new collection has its own ticket.
export default function MyCollectionsPage() {
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [retryKey, setRetryKey] = useState(0)
  usePageTitle('My collections')

  useEffect(() => {
    const controller = new AbortController()
    listMyCollections(controller.signal)
      .then((collections) => setState({ status: 'ready', collections }))
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return
        setState({ status: 'error', message: describeFailure(cause, 'Could not load your collections.').message })
      })
    return () => controller.abort()
  }, [retryKey])

  function retry() {
    setState({ status: 'loading' })
    setRetryKey((value) => value + 1)
  }

  return (
    <main className="content-width workspace-page">
      <div className="workspace-heading">
        <div>
          <h1>My collections</h1>
          {state.status === 'ready' && (
            <p className="workspace-count">{state.collections.length} {state.collections.length === 1 ? 'collection' : 'collections'}</p>
          )}
        </div>
      </div>
      {state.status === 'loading' && <StatusMessage kind="loading" title="Loading your collections" />}
      {state.status === 'error' && (
        <StatusMessage kind="error" title="Could not load your collections" message={state.message}>
          <button type="button" className="button button-primary" onClick={retry}>Try again</button>
        </StatusMessage>
      )}
      {state.status === 'ready' && state.collections.length === 0 && (
        <StatusMessage kind="empty" title="You have no collections yet" message="Collections you create show up here." />
      )}
      {state.status === 'ready' && state.collections.length > 0 && <CollectionList collections={state.collections} />}
    </main>
  )
}
