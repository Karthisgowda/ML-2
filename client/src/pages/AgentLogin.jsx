import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/axios'
import PageShell from '../components/PageShell'
import Logo from '../components/Logo'
import ThemeToggle from '../components/ThemeToggle'
import styles from './AgentLogin.module.css'

export default function AgentLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    if (localStorage.getItem('agentToken')) {
      navigate('/agent/dashboard', { replace: true })
    }
  }, [navigate])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const { data } = await api.post('/api/agents/login', { email, password })
      localStorage.setItem('agentToken', data.token)
      localStorage.setItem('agentName', data.agent?.name || 'Agent')
      navigate('/agent/dashboard', { replace: true })
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid email or password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <PageShell>
      <div className={styles.topBar}><ThemeToggle /></div>
      <div className={styles.page}>
        <div className={styles.card}>
          <div className={styles.logoMark}>
            <Logo size={26} />
          </div>
          <h1 className={styles.title}>Welcome back</h1>
          <p className={styles.sub}>Sign in to your agent dashboard</p>

          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.fieldWrap}>
              <label className={styles.fieldLabel} htmlFor="email">Email address</label>
              <input
                id="email"
                type="email"
                placeholder="agent@smartdesk.dev"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div className={styles.fieldWrap}>
              <label className={styles.fieldLabel} htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
            {error && <p className={styles.error}>{error}</p>}
            <button type="submit" className={styles.submitBtn} disabled={loading}>
              {loading ? <span className="spinner" /> : 'Sign In'}
            </button>
          </form>

          <div className={styles.hint}>
            <strong>Demo credentials</strong>
            <code>rakesh@smartdesk.dev</code> · <code>agent123</code><br />
            <code>ujjwal@smartdesk.dev</code> · <code>agent123</code><br />
            <code>adi@smartdesk.dev</code> · <code>agent123</code>
          </div>

          <p className={styles.back}><a href="/">Back to home</a></p>
        </div>
      </div>
    </PageShell>
  )
}
