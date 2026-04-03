import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { io } from 'socket.io-client'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import api from '../api/axios'
import PageShell from '../components/PageShell'
import Logo from '../components/Logo'
import ThemeToggle from '../components/ThemeToggle'
import TicketCard from '../components/TicketCard'
import TicketModal from '../components/TicketModal'
import StatsPanel from '../components/StatsPanel'
import styles from './Dashboard.module.css'

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'
const SEV_ORDER = { Critical: 0, High: 1, Medium: 2, Low: 3 }

const CHART_COLORS = {
  Billing: '#00d9ff', Technical: '#ff6b6b', Account: '#ffd60a',
  General: '#8b5cf6', Security: '#ff3b5c',
  Critical: '#ff2d55', High: '#ff6b6b', Medium: '#ff9f0a', Low: '#34c759',
}

export default function Dashboard() {
  const navigate = useNavigate()
  const agentName = localStorage.getItem('agentName') || 'Agent'

  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedTicket, setSelectedTicket] = useState(null)
  const [showCharts, setShowCharts] = useState(false)

  const [filterStatus, setFilterStatus] = useState('all')
  const [filterSeverity, setFilterSeverity] = useState('all')

  const socketRef = useRef(null)

  const fetchTickets = async () => {
    try {
      const { data } = await api.get('/api/tickets')
      setTickets(data.tickets || data)
    } catch (err) {
      console.warn('Backend not available')
      setTickets([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTickets()
    let socket
    try {
      socket = io(SOCKET_URL, { timeout: 3000, reconnectionAttempts: 3 })
      socketRef.current = socket
      socket.emit('agent_join')

      socket.on('new_ticket', (ticket) => {
        setTickets((prev) => {
          if (prev.find((t) => t._id === ticket._id || t.ticketId === ticket.ticketId)) return prev
          return [ticket, ...prev]
        })
      })

      socket.on('ticket_updated', (updated) => {
        setTickets((prev) =>
          prev.map((t) => (t._id === updated._id ? { ...t, ...updated } : t))
        )
        setSelectedTicket((prev) => (prev?._id === updated._id ? { ...prev, ...updated } : prev))
      })
    } catch (err) {
      console.warn('Socket connection failed', err)
    }
    return () => socket?.disconnect()
  }, [])

  const logout = () => {
    localStorage.removeItem('agentToken')
    localStorage.removeItem('agentName')
    navigate('/agent/login', { replace: true })
  }

  const handleClaim = async (ticketId) => {
    try {
      const { data } = await api.put(`/api/tickets/${ticketId}`, {
        status: 'in-progress',
        assignedAgent: agentName,
      })
      const updated = data.ticket || data
      setTickets((prev) => prev.map((t) => (t._id === ticketId ? { ...t, ...updated } : t)))
    } catch {
      setTickets((prev) => prev.map((t) =>
        t._id === ticketId ? { ...t, status: 'in-progress', assignedAgent: agentName } : t
      ))
    }
  }

  const handleUpdate = async (ticketId, updates) => {
    try {
      const { data } = await api.put(`/api/tickets/${ticketId}`, updates)
      const updated = data.ticket || data
      setTickets((prev) => prev.map((t) => (t._id === ticketId ? { ...t, ...updated } : t)))
      setSelectedTicket((prev) => (prev?._id === ticketId ? { ...prev, ...updated } : prev))
    } catch {
      setTickets((prev) => prev.map((t) => (t._id === ticketId ? { ...t, ...updates } : t)))
      setSelectedTicket((prev) => (prev?._id === ticketId ? { ...prev, ...updates } : prev))
    }
  }

  // CSV export — properly quote every field
  const exportCSV = () => {
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const headers = ['Ticket ID', 'User', 'Email', 'Category', 'Severity', 'Emotion', 'Urgency', 'Status', 'Assigned To', 'Security Flag', 'Summary', 'Created Date', 'Created Time']
    const rows = tickets.map(t => {
      const d = t.createdAt ? new Date(t.createdAt) : null
      return [
        esc(t.ticketId),
        esc(t.userName),
        esc(t.userEmail),
        esc(t.category),
        esc(t.severity),
        esc(t.emotion || 'N/A'),
        esc(t.urgency || 'N/A'),
        esc(t.status),
        esc(t.assignedAgent || 'Unassigned'),
        esc(t.securityFlag ? 'YES' : 'No'),
        esc(t.summary),
        esc(d ? d.toLocaleDateString() : ''),
        esc(d ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '')
      ].join(',')
    })
    const csv = '\uFEFF' + [headers.map(h => esc(h)).join(','), ...rows].join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `smartdesk-tickets-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // PDF export
  const exportPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape' })
    doc.setFontSize(18)
    doc.text('SmartDesk — Ticket Report', 14, 18)
    doc.setFontSize(10)
    doc.setTextColor(100)
    doc.text(`Generated: ${new Date().toLocaleString()} | Total: ${tickets.length} tickets`, 14, 26)

    autoTable(doc, {
      startY: 32,
      head: [['Ticket ID', 'User', 'Category', 'Severity', 'Emotion', 'Status', 'Agent', 'Summary', 'Created']],
      body: tickets.map(t => [
        t.ticketId,
        t.userName,
        t.category,
        t.severity,
        t.emotion || 'N/A',
        t.status,
        t.assignedAgent || 'Unassigned',
        (t.summary || '').substring(0, 60) + ((t.summary || '').length > 60 ? '…' : ''),
        t.createdAt ? new Date(t.createdAt).toLocaleDateString() : ''
      ]),
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [0, 113, 227], textColor: 255 },
      alternateRowStyles: { fillColor: [245, 247, 255] },
    })

    doc.save(`smartdesk-tickets-${new Date().toISOString().slice(0, 10)}.pdf`)
  }

  // Excel export
  const exportExcel = () => {
    const data = tickets.map(t => ({
      'Ticket ID': t.ticketId,
      'User': t.userName,
      'Email': t.userEmail,
      'Category': t.category,
      'Severity': t.severity,
      'Emotion': t.emotion || 'N/A',
      'Urgency': t.urgency || 'N/A',
      'Status': t.status,
      'Assigned Agent': t.assignedAgent || 'Unassigned',
      'Security Flag': t.securityFlag ? 'YES' : 'No',
      'Summary': t.summary,
      'Agent Briefing': t.agentBriefing || '',
      'Resolution Notes': t.resolutionNotes || '',
      'Created': t.createdAt ? new Date(t.createdAt).toLocaleString() : '',
      'Updated': t.updatedAt ? new Date(t.updatedAt).toLocaleString() : '',
    }))
    const ws = XLSX.utils.json_to_sheet(data)
    ws['!cols'] = Object.keys(data[0] || {}).map(() => ({ wch: 20 }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Tickets')
    XLSX.writeFile(wb, `smartdesk-tickets-${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  // Chart data
  const categoryData = Object.entries(
    tickets.reduce((acc, t) => { acc[t.category] = (acc[t.category] || 0) + 1; return acc }, {})
  ).map(([name, value]) => ({ name, value }))

  const severityData = ['Critical', 'High', 'Medium', 'Low']
    .map(name => ({ name, count: tickets.filter(t => t.severity === name).length }))
    .filter(d => d.count > 0)

  // Filter + sort
  const filtered = tickets
    .filter((t) => filterStatus === 'all' || t.status === filterStatus)
    .filter((t) => filterSeverity === 'all' || t.severity === filterSeverity)
    .sort((a, b) => {
      if (a.securityFlag && !b.securityFlag) return -1
      if (!a.securityFlag && b.securityFlag) return 1
      const sevDiff = (SEV_ORDER[a.severity] ?? 3) - (SEV_ORDER[b.severity] ?? 3)
      if (sevDiff !== 0) return sevDiff
      return new Date(b.createdAt) - new Date(a.createdAt)
    })

  const stats = {
    total: tickets.length,
    open: tickets.filter((t) => t.status === 'open').length,
    inProgress: tickets.filter((t) => t.status === 'in-progress').length,
    resolved: tickets.filter((t) => t.status === 'resolved').length,
    high: tickets.filter((t) => ['High', 'Critical'].includes(t.severity)).length,
    flagged: tickets.filter((t) => t.securityFlag).length,
  }

  const statusFilters = [
    { value: 'all', label: 'All' },
    { value: 'open', label: 'Open' },
    { value: 'in-progress', label: 'In Progress' },
    { value: 'resolved', label: 'Resolved' },
  ]

  const severityFilters = [
    { value: 'all', label: 'Any Severity' },
    { value: 'Critical', label: '🔴 Critical' },
    { value: 'High', label: '🟠 High' },
    { value: 'Medium', label: '🟡 Medium' },
    { value: 'Low', label: '🟢 Low' },
  ]

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload?.length) {
      return (
        <div className={styles.chartTooltip}>
          <span>{payload[0].name || payload[0].payload?.name}: <strong>{payload[0].value || payload[0].payload?.count}</strong></span>
        </div>
      )
    }
    return null
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
            <div className={styles.agentPill}>
              <div className={styles.avatar}>{agentName[0]}</div>
              {agentName}
            </div>
            <ThemeToggle />
            <button className={styles.signOutBtn} onClick={logout}>Sign out</button>
          </div>
        </nav>

        <div className={styles.body}>
          <StatsPanel stats={stats} />

          {/* Analytics toggle + charts */}
          {tickets.length > 0 && (
            <>
              <button className={styles.analyticsToggle} onClick={() => setShowCharts(!showCharts)}>
                {showCharts ? '▼ Hide Analytics' : '▶ Show Analytics'}
              </button>

              {showCharts && (
                <div className={styles.chartsRow}>
                  <div className={styles.chartCard}>
                    <div className={styles.chartTitle}>Tickets by Category</div>
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie data={categoryData} dataKey="value" nameKey="name" cx="50%" cy="50%"
                          outerRadius={70} innerRadius={35} paddingAngle={3} strokeWidth={0}>
                          {categoryData.map((entry) => (
                            <Cell key={entry.name} fill={CHART_COLORS[entry.name] || '#666'} />
                          ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className={styles.chartLegend}>
                      {categoryData.map(d => (
                        <span key={d.name} className={styles.legendItem}>
                          <span className={styles.legendDot} style={{ background: CHART_COLORS[d.name] }} />
                          {d.name} ({d.value})
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className={styles.chartCard}>
                    <div className={styles.chartTitle}>Tickets by Severity</div>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={severityData} barSize={32}>
                        <XAxis dataKey="name" tick={{ fill: '#8a94a6', fontSize: 12 }} axisLine={false} tickLine={false} />
                        <YAxis allowDecimals={false} tick={{ fill: '#8a94a6', fontSize: 12 }} axisLine={false} tickLine={false} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                          {severityData.map((entry) => (
                            <Cell key={entry.name} fill={CHART_COLORS[entry.name] || '#666'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Filter bar */}
          <div className={styles.filterBar}>
            <div className={styles.filterGroup}>
              {statusFilters.map((f) => (
                <button
                  key={f.value}
                  className={`${styles.filterChip} ${filterStatus === f.value ? styles.filterActive : ''}`}
                  onClick={() => setFilterStatus(f.value)}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className={styles.filterGroup}>
              {severityFilters.map((f) => (
                <button
                  key={f.value}
                  className={`${styles.filterChip} ${filterSeverity === f.value ? styles.filterActive : ''}`}
                  onClick={() => setFilterSeverity(f.value)}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <button className={styles.exportBtn} onClick={exportCSV} title="Export CSV">
              📥 CSV
            </button>
            <button className={styles.exportBtn} onClick={exportPDF} title="Export PDF">
              📄 PDF
            </button>
            <button className={styles.exportBtn} onClick={exportExcel} title="Export Excel">
              📊 Excel
            </button>
            <span className={styles.ticketCount}>{filtered.length} ticket{filtered.length !== 1 ? 's' : ''}</span>
          </div>

          {loading ? (
            <div className={styles.loadingWrap}><div className={styles.loadingSpinner} /></div>
          ) : filtered.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>🎉</div>
              <div className={styles.emptyTitle}>All clear</div>
              <div className={styles.emptyText}>No tickets match your current filters.</div>
            </div>
          ) : (
            <div className={styles.grid}>
              {filtered.map((ticket) => (
                <TicketCard
                  key={ticket._id}
                  ticket={ticket}
                  agentName={agentName}
                  onView={() => setSelectedTicket(ticket)}
                  onClaim={() => handleClaim(ticket._id)}
                />
              ))}
            </div>
          )}
        </div>

        {selectedTicket && (
          <TicketModal
            ticket={selectedTicket}
            onClose={() => setSelectedTicket(null)}
            onUpdate={handleUpdate}
            socket={socketRef.current}
          />
        )}
      </div>
    </PageShell>
  )
}
