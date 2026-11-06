import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listAssets, type Asset } from '../api/assets'
import AssetGrid from '../components/AssetGrid'
import InlineError from '../components/InlineError'

const TYPES = [
  { id: '2d', name: '2D', icon: '▧', tint: 'lavender' },
  { id: '3d', name: '3D', icon: '◇', tint: 'blue' },
  { id: 'map', name: 'Maps', icon: '⌖', tint: 'green' },
  { id: 'sound', name: 'Sounds', icon: '♫', tint: 'orange' },
  { id: 'environment', name: 'Environments', icon: '◌', tint: 'pink' },
]

export default function HomePage() {
  const [assets, setAssets] = useState<Asset[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const controller = new AbortController()
    listAssets('', 1, controller.signal)
      .then((page) => setAssets(page.items.slice(0, 4)))
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Could not load assets.')
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [])

  return (
    <main>
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow"><span className="eyebrow-dot" /> Made by game developers</p>
          <h1>Free assets<br />for your next game<span className="period">.</span></h1>
          <p className="hero-lede">2D and 3D models, maps, sounds and environments, published by game developers and rated by the people who used them.</p>
          <div className="hero-actions"><Link className="button button-primary" to="/catalog">Browse the catalog <span>↗</span></Link><Link className="button button-secondary" to="/login">Publish yours</Link></div>
          <div className="hero-proof"><span>✳ Free to download, no account needed</span><span>✳ Ratings from real users</span></div>
        </div>
        <div className="hero-art" aria-hidden="true"><div className="art-sun" /><div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" /><div className="art-cube"><i /><i /><i /></div><span className="art-label label-one">3D · MODEL</span><span className="art-label label-two">READY TO PLAY</span><span className="art-star">✳</span></div>
      </section>
      <section className="trust-strip"><div><strong>Free</strong><span>to download</span></div><div><strong>Rated</strong><span>by developers who used them</span></div><div><strong>Organized</strong><span>into collections per game</span></div><div><strong>Reviewed</strong><span>reports checked by admins</span></div></section>
      <section className="section content-width">
        <div className="section-heading"><div><p className="eyebrow">Find your next building block</p><h2>Browse by type</h2></div><Link className="text-link" to="/catalog">All assets <span>↗</span></Link></div>
        <div className="type-grid">{TYPES.map((type, index) => <Link className={`type-card tint-${type.tint}`} key={type.id} to={`/catalog?type=${type.id}`}><span className="type-count">0{index + 1}</span><span className="type-symbol">{type.icon}</span><strong>{type.name}</strong><span className="type-arrow">↗</span></Link>)}</div>
      </section>
      <section className="section content-width latest-section">
        <div className="section-heading"><div><p className="eyebrow">Fresh from the community</p><h2>Recently added</h2></div><Link className="text-link" to="/catalog">Explore the catalog <span>↗</span></Link></div>
        {error ? <InlineError message={error} /> : loading ? <div className="state-box">Loading assets…</div> : assets.length ? <AssetGrid assets={assets} /> : <div className="empty-home"><span>✳</span><p>New assets are on their way.</p><Link className="text-link" to="/catalog">Browse all assets ↗</Link></div>}
      </section>
      <section className="cta-band"><div><p className="eyebrow">Made something useful?</p><h2>Your next player<br />is looking for it.</h2></div><Link className="button button-light" to="/login">Share an asset <span>↗</span></Link><span className="cta-flower" aria-hidden="true">✳</span></section>
    </main>
  )
}
