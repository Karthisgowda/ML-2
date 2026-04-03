import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import PageShell from '../components/PageShell'
import Logo from '../components/Logo'
import ThemeToggle from '../components/ThemeToggle'
import styles from './LandingPage.module.css'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '976868274490-d5gnh56ar5em43bvuu7ecmncf9dscdsj.apps.googleusercontent.com'
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

export default function LandingPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const navigate = useNavigate()

  // Guest login
  const handleStart = (e) => {
    e.preventDefault()
    if (!name.trim() || !email.trim()) return
    sessionStorage.setItem('userName', name.trim())
    sessionStorage.setItem('userEmail', email.trim())
    navigate('/my-tickets')
  }

  // Google redirect login: step 1 — redirect to Google
  const handleGoogleLogin = () => {
    const redirectUri = window.location.origin + '/'
    const scope = 'openid email profile'
    const url =
      `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${encodeURIComponent(GOOGLE_CLIENT_ID)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_type=token` +
      `&scope=${encodeURIComponent(scope)}` +
      `&prompt=select_account`
    window.location.href = url
  }

  // Google redirect login: step 2 — handle the redirect back
  useEffect(() => {
    const hash = window.location.hash
    if (!hash || !hash.includes('access_token')) return

    const params = new URLSearchParams(hash.substring(1))
    const accessToken = params.get('access_token')
    if (!accessToken) return

    // Clear hash from URL
    window.history.replaceState(null, '', window.location.pathname)

      ; (async () => {
        try {
          // Fetch profile from Google
          const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${accessToken}` }
          })
          const profile = await userInfoRes.json()

          // Send to our backend
          const res = await fetch(`${API_URL}/api/auth/google`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: accessToken, profile })
          })
          const data = await res.json()

          if (data.token) {
            sessionStorage.setItem('token', data.token)
            sessionStorage.setItem('userName', data.user.name)
            sessionStorage.setItem('userEmail', data.user.email)
            sessionStorage.setItem('userAvatar', data.user.avatar || '')
            navigate('/my-tickets')
          } else {
            alert('Login failed: ' + (data.error || 'Unknown error'))
          }
        } catch (err) {
          console.error('Google login failed:', err)
          alert('Network error during Google login.')
        }
      })()
  }, [])

  return (
    <PageShell>
      <nav className={styles.nav}>
        <span className={styles.navLogo}>
          <Logo size={22} />
          SmartDesk
        </span>
        <div className={styles.navRight}>
          <a href="/agent/login" className={styles.navLink}>Agent Sign In</a>
          <ThemeToggle />
        </div>
      </nav>

      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <span className={styles.eyebrow}>AI-Powered Support</span>

          <h1 className={styles.heroTitle}>
            Support that<br /><span>actually helps.</span>
          </h1>

          <p className={styles.heroSub}>
            Get instant answers from our AI. Complex issues are escalated to a human agent automatically — no hold music, no waiting.
          </p>

          <div className={styles.card}>
            <p className={styles.cardTitle}>Get started</p>
            <p className={styles.cardSub}>Sign in with Google or continue as a guest.</p>

            <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'center' }}>
              <button
                type="button"
                onClick={handleGoogleLogin}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '12px 24px', border: '1px solid #dadce0',
                  borderRadius: '8px', background: '#fff', cursor: 'pointer',
                  fontSize: '15px', fontWeight: 500, color: '#3c4043',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                  width: '100%', justifyContent: 'center',
                }}
              >
                <svg width="20" height="20" viewBox="0 0 48 48">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                </svg>
                Sign in with Google
              </button>
            </div>

            <div className={styles.divider}>or continue manually</div>

            <form onSubmit={handleStart} className={styles.form}>
              <div>
                <label className={styles.fieldLabel} htmlFor="name">Full name</label>
                <input
                  id="name"
                  type="text"
                  placeholder="Your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className={styles.fieldLabel} htmlFor="email">Email address</label>
                <input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <button type="submit" className={styles.submitBtn}>Start Guest Chat</button>
            </form>

            <div className={styles.divider}>or</div>
            <p className={styles.agentLink}>
              Support agent? <a href="/agent/login">Sign in here</a>
            </p>
          </div>
        </div>
      </section>

    </PageShell>
  )
}
