import { useCallback, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { apiPost } from '../api/client'
import { useAuth } from '../auth/auth-context'
import ConfirmDialog from '../components/ConfirmDialog'
import FormField from '../components/FormField'
import InlineError from '../components/InlineError'

type AuthMode = 'login' | 'register'

export default function AuthPage({ mode }: { mode: AuthMode }) {
  const navigate = useNavigate()
  const { refreshUser } = useAuth()
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [discardPath, setDiscardPath] = useState<string | null>(null)
  const isRegister = mode === 'register'

  function leave(path: string) {
    if (username || email || password) setDiscardPath(path)
    else navigate(path)
  }

  const cancelLeave = useCallback(() => setDiscardPath(null), [])
  function discardAndLeave() {
    if (discardPath) navigate(discardPath)
    setDiscardPath(null)
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    const cleanEmail = email.trim()
    if (isRegister && !username.trim()) { setError('Enter a username.'); return }
    if (isRegister && username.trim().length > 50) { setError('Username must be 50 characters or fewer.'); return }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) { setError('Enter a valid e-mail address.'); return }
    if (isRegister && password.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (!isRegister && !password) { setError('Enter your password.'); return }

    setBusy(true)
    try {
      if (isRegister) {
        await apiPost('/auth/register', { username: username.trim(), email: cleanEmail, password })
        await apiPost('/auth/login', { email: cleanEmail, password })
      } else {
        await apiPost('/auth/login', { email: cleanEmail, password })
      }
      await refreshUser()
      navigate('/catalog')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-top"><Link className="brand dark-brand" to="/" onClick={(event) => { event.preventDefault(); leave('/') }}><span className="brand-mark" aria-hidden="true"><i /><i /><i /></span><span>assetStore</span></Link><button className="back-link" type="button" onClick={() => leave('/catalog')}>← Back to the catalog</button></div>
      <div className="auth-layout">
        <section className="auth-pitch"><p className="eyebrow">A home for game makers</p><h1>Share your<br />assets with<br /><span>the world.</span></h1><p>Downloading needs no account. With one you can publish your own models, maps and sounds, rate and review what you used, and keep collections for each game.</p><div className="auth-pitch-art" aria-hidden="true"><span>✳</span><i /><i /><i /></div></section>
        <section className="auth-form-wrap">
          <div className="auth-switch"><span>Welcome to assetStore</span><div><button type="button" className={!isRegister ? 'active' : ''} onClick={() => leave('/login')}>Log in</button><button type="button" className={isRegister ? 'active' : ''} onClick={() => leave('/register')}>Create account</button></div></div>
          <p className="eyebrow">{isRegister ? 'Join the community' : 'Good to see you again'}</p><h2>{isRegister ? 'Create your account' : 'Welcome back'}</h2><p className="auth-subtitle">{isRegister ? 'New accounts get the user role.' : 'Log in to share and review game assets.'}</p>
          <form className="auth-form" onSubmit={submit} noValidate>
            {isRegister && <FormField id="username" label="Username" autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Your username" maxLength={50} required />}
            <FormField id="email" label="E-mail" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" maxLength={254} required />
            <FormField id="password" label="Password" type="password" autoComplete={isRegister ? 'new-password' : 'current-password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={isRegister ? 'At least 8 characters' : 'Your password'} minLength={isRegister ? 8 : 1} required />
            {error && <InlineError message={error} />}
            <button type="submit" className="button button-primary auth-submit" disabled={busy}>{busy ? 'Please wait…' : isRegister ? 'Create account' : 'Log in'} <span>↗</span></button>
          </form>
          <p className="auth-switch-note">{isRegister ? 'Already have an account?' : 'New here?'} <button type="button" onClick={() => leave(isRegister ? '/login' : '/register')}>{isRegister ? 'Log in' : 'Create an account'}</button></p>
        </section>
      </div>
      {discardPath && <ConfirmDialog title="Discard your changes?" message="The information you entered will be cleared if you leave this page." confirmLabel="Discard changes" cancelLabel="Keep editing" onCancel={cancelLeave} onConfirm={discardAndLeave} />}
    </main>
  )
}
