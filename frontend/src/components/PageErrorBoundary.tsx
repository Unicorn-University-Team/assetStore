import { Component, type ReactNode } from 'react'
import StatusMessage from './StatusMessage'

type Props = { children: ReactNode }
type State = { failed: boolean }

// A page that throws still keeps the header and footer. The layout remounts this on navigation, which clears it.
export default class PageErrorBoundary extends Component<Props, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch() {
    document.title = 'Something went wrong · assetStore'
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <main className="content-width page-state">
        <StatusMessage
          kind="error"
          heading="h1"
          title="Something went wrong"
          message="This page could not be shown. Reloading it usually fixes that."
        >
          <button type="button" className="button button-primary" onClick={() => window.location.reload()}>Reload the page</button>
        </StatusMessage>
      </main>
    )
  }
}
