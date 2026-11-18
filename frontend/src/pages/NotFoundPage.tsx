import { Link } from 'react-router-dom'
import StatusMessage from '../components/StatusMessage'
import { usePageTitle } from '../usePageTitle'

export default function NotFoundPage() {
  usePageTitle('Page not found')
  return (
    <main className="content-width page-state">
      <StatusMessage
        kind="missing"
        heading="h1"
        code="404"
        title="Page not found"
        message="The page you requested does not exist, or it may have moved."
      >
        <Link className="button button-primary" to="/">Back to the catalogue</Link>
      </StatusMessage>
    </main>
  )
}
