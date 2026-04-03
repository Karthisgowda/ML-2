import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PageShell from '../components/PageShell'
import Logo from '../components/Logo'
import ThemeToggle from '../components/ThemeToggle'
import styles from './MyTickets.module.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'
const TICKET_CACHE_PREFIX = 'smartdesk_tickets_'

const STATUS_META = {
  open: { label: 'Open', emoji: 'Open', cls: 'statusOpen' },
  'in-progress': { label: 'In Progress', emoji: 'In progress', cls: 'statusProgress' },
  resolved: { label: 'Resolved', emoji: 'Resolved', cls: 'statusResolved' },
  closed: { label: 'Closed', emoji: 'Closed', cls: 'statusClosed' },
}

const SEV_CLS = {
  Critical: 'sevCritical',
  High: 'sevHigh',
  Medium: 'sevMedium',
  Low: 'sevLow',
}

const getTicketCacheKey = (email) => `${TICKET_CACHE_PREFIX}${email || 'guest'}`

function mergeTickets(primary = [], secondary = []) {
  const merged = new Map()
  for (const ticket of [...secondary, ...primary]) {
    const key = ticket.ticketId || ticket._id
    if (key) merged.set(key, { ...merged.get(key), ...ticket })
  }
  return Array.from(merged.values()).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
}

export default function MyTickets() {
  const navigate = useNavigate()
  const email = sessionStorage.getItem('userEmail')
  const name = sessionStorage.getItem('userName')
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [cancelling, setCancelling] = useState(null)

  useEffect(() => {
    if (!email) {
      navigate('/')
      return
    }

    const cacheKey = getTicketCacheKey(email)
    const cachedTickets = JSON.parse(localStorage.getItem(cacheKey) || '[]')
    if (cachedTickets.length > 0) {
      setTickets(cachedTickets)
      setLoading(false)
    }

    const fetchTickets = () => {
      fetch(`${API_URL}/api/tickets/user/${encodeURIComponent(email)}`)
        .then((r) => r.json())
        .then((data) => {
          const apiTickets = Array.isArray(data) ? data : []
          const nextTickets = mergeTickets(apiTickets, JSON.parse(localStorage.getItem(cacheKey) || '[]'))
          setTickets(nextTickets)
          localStorage.setItem(cacheKey, JSON.stringify(nextTickets))
          setLoading(false)
        })
        .catch(() => setLoading(false))
    }

    fetchTickets()
    const intervalId = setInterval(fetchTickets, 15000)
    return () => clearInterval(intervalId)
  }, [email, navigate])

  const handleCancel = async (ticket) => {
    if (!confirm(`Cancel ticket ${ticket.ticketId}? This cannot be undone.`)) return
    setCancelling(ticket.ticketId)
    try {
      const id = ticket._id || ticket.ticketId
      const res = await fetch(`${API_URL}/api/tickets/user/${id}/cancel`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      })
      const data = await res.json()
      if (res.ok) {
        setTickets((prev) => {
          const updated = prev.map((t) => t.ticketId === ticket.ticketId ? { ...t, status: 'closed' } : t)
          localStorage.setItem(getTicketCacheKey(email), JSON.stringify(updated))
          return updated
        })
      } else {
        alert(data.error || 'Failed to cancel ticket')
      }
    } catch {
      alert('Network error, try again')
    } finally {
      setCancelling(null)
    }
  }

  const handleLogout = () => {
    sessionStorage.removeItem('userName')
    sessionStorage.removeItem('userEmail')
    sessionStorage.removeItem('token')
    sessionStorage.removeItem('userAvatar')
    navigate('/', { replace: true })
  }

  const filtered = filter === 'all' ? tickets : tickets.filter((t) => t.status === filter)

  const counts = {
    all: tickets.length,
    open: tickets.filter((t) => t.status === 'open').length,
    'in-progress': tickets.filter((t) => t.status === 'in-progress').length,
    resolved: tickets.filter((t) => t.status === 'resolved').length,
  }

  const ago = (date) => {
    if (!date) return ''
    const diff = Date.now() - new Date(date).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    return `${days}d ago`
  }

  return (
    <PageShell>
      <div className={styles.page}>
        <nav className={styles.nav}>
          <div className={styles.navLeft}>
            <Logo size={20} />
            SmartDesk
          </div>
          <div className={styles.navRight}>
            <span className={styles.userName}>{name || email}</span>
            <button className={styles.chatBtn} onClick={() => navigate('/chat')}>
              New Chat
            </button>
            <ThemeToggle />
            <button className={styles.logoutBtn} onClick={handleLogout}>
              Sign Out
            </button>
          </div>
        </nav>

        <div className={styles.body}>
          <div className={styles.header}>
            <h1 className={styles.title}>My Tickets</h1>
            <p className={styles.subtitle}>{tickets.length} total ticket{tickets.length !== 1 ? 's' : ''}</p>
          </div>

          <div className={styles.filterBar}>
            {[
              { value: 'all', label: `All (${counts.all})` },
              { value: 'open', label: `Open (${counts.open})` },
              { value: 'in-progress', label: `In Progress (${counts['in-progress']})` },
              { value: 'resolved', label: `Resolved (${counts.resolved})` },
            ].map((f) => (
              <button
                key={f.value}
                className={`${styles.filterChip} ${filter === f.value ? styles.filterActive : ''}`}
                onClick={() => setFilter(f.value)}
              >
                {f.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className={styles.loadingWrap}><div className={styles.spinner} /></div>
          ) : filtered.length === 0 ? (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}>Tickets</div>
              <div className={styles.emptyTitle}>
                {tickets.length === 0 ? 'No tickets yet' : 'No tickets match this filter'}
              </div>
              <div className={styles.emptyText}>
                {tickets.length === 0
                  ? 'Start a conversation with SmartDesk AI to create your first support ticket.'
                  : 'Try a different filter to see your tickets.'}
              </div>
              {tickets.length === 0 && (
                <button className={styles.startBtn} onClick={() => navigate('/chat')}>
                  Start a Chat
                </button>
              )}
            </div>
          ) : (
            <div className={styles.grid}>
              {filtered.map((ticket) => {
                const sm = STATUS_META[ticket.status] || STATUS_META.open
                const sc = SEV_CLS[ticket.severity] || 'sevMedium'
                const canAct = !['closed', 'resolved'].includes(ticket.status)
                return (
                  <div key={ticket.ticketId} className={styles.card}>
                    <div className={styles.cardTop}>
                      <span className={styles.ticketId}>{ticket.ticketId}</span>
                      <span className={`${styles.statusPill} ${styles[sm.cls]}`}>
                        {sm.label}
                      </span>
                    </div>

                    <p className={styles.summary}>
                      {ticket.summary || 'No summary available'}
                    </p>

                    <div className={styles.badges}>
                      <span className={`${styles.badge} ${styles[sc]}`}>{ticket.severity}</span>
                      <span className={styles.categoryBadge}>{ticket.category}</span>
                      {ticket.emotion && ticket.emotion !== 'Calm' && (
                        <span className={styles.emotionBadge}>{ticket.emotion}</span>
                      )}
                    </div>

                    <div className={styles.cardBottom}>
                      <span className={styles.meta}>
                        {ticket.assignedAgent ? ticket.assignedAgent : 'Awaiting agent'}
                      </span>
                      <span className={styles.meta}>{ago(ticket.createdAt)}</span>
                    </div>

                    {canAct && (
                      <div className={styles.cardActions}>
                        <button className={styles.talkBtn} onClick={() => navigate('/chat')}>
                          Open Chat
                        </button>
                        <button
                          className={styles.cancelBtn}
                          disabled={cancelling === ticket.ticketId}
                          onClick={() => handleCancel(ticket)}
                        >
                          {cancelling === ticket.ticketId ? 'Cancelling...' : 'Cancel'}
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </PageShell>
  )
}
