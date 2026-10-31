import { useNavigate } from 'react-router-dom'

export default function MockupAssetPage() {
  const navigate = useNavigate()

  return (
    <main className="page">
      <h1>Mockup Asset Page</h1>
      <p>This is a simple mockup asset detail page without custom CSS.</p>

      <button type="button" onClick={() => navigate('/')}>
        Back to Main Page
      </button>
    </main>
  )
}