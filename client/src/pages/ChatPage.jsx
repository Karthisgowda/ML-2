import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PageShell from '../components/PageShell'
import Logo from '../components/Logo'
import ThemeToggle from '../components/ThemeToggle'
import styles from './ChatPage.module.css'

const API_BASE_URL = import.meta.env.VITE_API_URL || ''
const sevBadge = { Critical: 'badge-high', High: 'badge-high', Medium: 'badge-medium', Low: 'badge-low' }
const TICKET_CACHE_PREFIX = 'smartdesk_tickets_'

const EMOTION_MAP = {
  Calm: { emoji: ':)', label: 'Calm' },
  Frustrated: { emoji: ':|', label: 'Frustrated' },
  Angry: { emoji: '!!', label: 'Angry' },
  Desperate: { emoji: '?!', label: 'Desperate' },
  Threatening: { emoji: '!!', label: 'Threatening' },
}

const apiUrl = (path) => `${API_BASE_URL}${path}`
const getTicketCacheKey = (email) => `${TICKET_CACHE_PREFIX}${email || 'guest'}`

function cacheTicket(email, ticket) {
  if (!email || !ticket) return
  const cacheKey = getTicketCacheKey(email)
  const current = JSON.parse(localStorage.getItem(cacheKey) || '[]')
  if (current.some((item) => item.ticketId === ticket.ticketId)) return
  localStorage.setItem(cacheKey, JSON.stringify([ticket, ...current]))
}

export default function ChatPage() {
  const navigate = useNavigate()
  const name = sessionStorage.getItem('userName')
  const email = sessionStorage.getItem('userEmail')

  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [connected, setConnected] = useState(false)
  const [typing, setTyping] = useState(false)
  const [currentSeverity, setCurrentSeverity] = useState(null)
  const [currentCategory, setCurrentCategory] = useState(null)
  const [currentEmotion, setCurrentEmotion] = useState(null)
  const [sentimentScore, setSentimentScore] = useState(0.6)
  const [suggestions, setSuggestions] = useState([])
  const [ticket, setTicket] = useState(null)
  const [rating, setRating] = useState(null)
  const bottomRef = useRef(null)
  const lastSentRef = useRef(0)
  const sendingRef = useRef(false)

  useEffect(() => {
    if (!name || !email) {
      navigate('/')
      return
    }

    const loadSession = async () => {
      try {
        const response = await fetch(apiUrl(`/api/chat/session?email=${encodeURIComponent(email)}`))
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Failed to load chat')

        setConnected(true)

        if (data.messages?.length > 0) {
          setMessages(data.messages.map((m) => ({
            role: m.role === 'bot' ? 'bot' : m.role === 'agent' ? 'agent' : 'user',
            text: m.message || m.content,
            time: new Date(m.timestamp),
          })))
          setSuggestions([])
          return
        }

        setMessages([{ role: 'bot', text: `Hi ${name}! I'm the SmartDesk AI assistant. How can I help you today?`, time: new Date() }])
        setSuggestions(data.suggestions || ['I have a billing issue', 'Technical problem', 'Account help'])
      } catch {
        setConnected(false)
        setMessages([{ role: 'bot', text: "I couldn't reach the support API. Please try again in a moment.", time: new Date() }])
        setSuggestions([])
      }
    }

    loadSession()
  }, [email, name, navigate])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, typing])

  const applyAssistantState = (data) => {
    if (data.severity) setCurrentSeverity(data.severity)
    if (data.category) setCurrentCategory(data.category)
    if (data.emotion) setCurrentEmotion(data.emotion)
    if (data.sentimentScore !== undefined) setSentimentScore(data.sentimentScore)
    if (data.suggestedReplies?.length > 0) setSuggestions(data.suggestedReplies)
    else setSuggestions([])
  }

  const submitMessage = async ({ message, forceEscalate = false, renderUserMessage = true }) => {
    if (sendingRef.current || !connected) return

    const trimmedMessage = message.trim()
    if (!trimmedMessage) return

    if (renderUserMessage) {
      setMessages((prev) => [...prev, { role: 'user', text: trimmedMessage, time: new Date() }])
    }

    setTyping(true)
    setSuggestions([])
    sendingRef.current = true

    try {
      const response = await fetch(apiUrl('/api/chat/message'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, message: trimmedMessage, forceEscalate }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Request failed')

      setConnected(true)
      applyAssistantState(data)
      setMessages((prev) => [...prev, {
        role: 'bot',
        text: data.message,
        severity: data.severity,
        category: data.category,
        time: new Date(),
      }])

      if (data.ticket) {
        cacheTicket(email, data.ticket)
        setTicket(data.ticket)
        setSuggestions([])
        setMessages((prev) => [...prev, { role: 'system', ticket: data.ticket, time: new Date() }])
      }
    } catch {
      setConnected(false)
      setMessages((prev) => [...prev, {
        role: 'bot',
        text: "I'm having trouble right now. Please try again in a moment.",
        time: new Date(),
      }])
    } finally {
      setTyping(false)
      sendingRef.current = false
    }
  }

  const send = (text) => {
    const msg = (text || input).trim()
    if (!msg || !connected) return
    const now = Date.now()
    if (now - lastSentRef.current < 2000) return
    lastSentRef.current = now
    setInput('')
    submitMessage({ message: msg })
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  const escalate = () => {
    submitMessage({ message: 'I want to talk to a human agent', forceEscalate: true })
  }

  const resetChat = () => {
    fetch(apiUrl('/api/chat/session/clear'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    }).catch(() => {})

    setMessages([{ role: 'bot', text: `Hi ${name}! I'm the SmartDesk AI assistant. How can I help you today?`, time: new Date() }])
    setTicket(null)
    setCurrentSeverity(null)
    setCurrentCategory(null)
    setCurrentEmotion(null)
    setSuggestions(['I have a billing issue', 'Technical problem', 'Account help'])
  }

  const sentimentPct = Math.round(sentimentScore * 100)
  const sentimentColor = sentimentScore > 0.6 ? '#34c759' : sentimentScore > 0.35 ? '#ff9500' : '#ff3b30'
  const emotionInfo = EMOTION_MAP[currentEmotion] || EMOTION_MAP.Calm

  return (
    <PageShell>
      <div className={styles.pageWrap}>
        <div className={styles.page}>
          <nav className={styles.nav}>
            <span className={styles.navLogo}>
              <Logo size={20} />
              SmartDesk
            </span>
            <div className={styles.navMeta}>
              {currentEmotion && (
                <div className={styles.sentimentMeter}>
                  <span className={styles.sentimentEmoji}>{emotionInfo.emoji}</span>
                  <div className={styles.sentimentTrack}>
                    <div className={styles.sentimentFill} style={{ width: `${sentimentPct}%`, background: sentimentColor }} />
                  </div>
                  <span className={styles.sentimentLabel}>{emotionInfo.label}</span>
                </div>
              )}
              {currentSeverity && <span className={`badge ${sevBadge[currentSeverity]}`}>{currentSeverity}</span>}
              {currentCategory && <span className={styles.categoryPill}>{currentCategory}</span>}
              <span className={`${styles.statusDot} ${connected ? styles.online : styles.offline}`}>
                {connected ? 'Live' : 'Reconnecting'}
              </span>
              <ThemeToggle />
              <a href="/my-tickets" className={styles.navLink} style={{
                fontSize: '0.8125rem', fontWeight: 500, color: 'var(--blue)',
                textDecoration: 'none', opacity: 0.9
              }}>My Tickets</a>
            </div>
          </nav>

          <div className={styles.messages}>
            {messages.map((msg, i) => {
              if (msg.role === 'system') return (
                <div key={i} className={styles.ticketCard}>
                  <div className={styles.ticketCardHeader}>
                    <TicketIcon />
                    <span className={styles.ticketCardTitle}>Ticket Created</span>
                  </div>
                  <div className={styles.ticketCardRow}>
                    <span className={styles.ticketCardLabel}>ID</span>
                    <span className={styles.ticketCardVal}>{msg.ticket.ticketId}</span>
                  </div>
                  <div className={styles.ticketCardRow}>
                    <span className={styles.ticketCardLabel}>Category</span>
                    <span className={styles.ticketCardVal}>{msg.ticket.category}</span>
                  </div>
                  <div className={styles.ticketCardRow}>
                    <span className={styles.ticketCardLabel}>Severity</span>
                    <span className={`badge ${sevBadge[msg.ticket.severity]}`}>{msg.ticket.severity}</span>
                  </div>
                  <div className={styles.ticketCardNote}>This ticket is now visible in My Tickets.</div>

                  {!rating && (
                    <div className={styles.ratingSection}>
                      <span className={styles.ratingLabel}>How was your experience?</span>
                      <div className={styles.ratingBtns}>
                        <button className={styles.ratingBtn} onClick={() => setRating('up')}>Good</button>
                        <button className={styles.ratingBtn} onClick={() => setRating('down')}>Bad</button>
                      </div>
                    </div>
                  )}
                  {rating && (
                    <div className={styles.ratingDone}>
                      {rating === 'up' ? 'Good' : 'Bad'} feedback saved.
                    </div>
                  )}
                </div>
              )

              return (
                <div key={i} className={`${styles.bubble} ${msg.role === 'user' ? styles.userBubble : styles.botBubble}`}>
                  {msg.role === 'agent' && <div style={{ fontSize: '0.8rem', opacity: 0.9, marginBottom: '6px', fontWeight: 600 }}>Agent Reply</div>}
                  {msg.text}
                  <div className={styles.bubbleMeta}>
                    {msg.severity && <span className={`badge ${sevBadge[msg.severity]}`}>{msg.severity}</span>}
                    {msg.category && msg.role === 'bot' && <span className={styles.categoryPill}>{msg.category}</span>}
                    <span className={styles.msgTime}>
                      {msg.time?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              )
            })}

            {suggestions.length > 0 && !typing && !ticket && (
              <div className={styles.suggestionsRow}>
                {suggestions.map((s, i) => (
                  <button key={i} className={styles.suggestionPill} onClick={() => send(s)}>
                    {s}
                  </button>
                ))}
              </div>
            )}

            {typing && (
              <div className={styles.typingBubble}>
                <div className={styles.typingDots}><span /><span /><span /></div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className={styles.actionBar}>
            <button className={styles.humanBtn} onClick={escalate} disabled={!!ticket || !connected}>
              Talk to Human
            </button>
            <button className={styles.newChatBtn} onClick={resetChat}>New Chat</button>
          </div>

          <div className={styles.inputBar}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder={ticket ? 'Chat ended - ticket created' : 'Message SmartDesk...'}
              disabled={!connected || !!ticket}
            />
            <button
              className={styles.sendBtn}
              onClick={() => send()}
              disabled={!connected || !input.trim() || !!ticket}
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </PageShell>
  )
}

function TicketIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect x="1" y="3" width="12" height="9" rx="2" stroke="#60a5fa" strokeWidth="1.4" fill="none" />
      <path d="M4 7h6M4 9.5h4" stroke="#60a5fa" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}
