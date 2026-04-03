import { formatDistanceToNow } from 'date-fns'
import styles from './TicketCard.module.css'

const sevBadge = { High: 'badge-high', Medium: 'badge-medium', Low: 'badge-low' }
const statBadge = { open: 'badge-open', 'in-progress': 'badge-in-progress', resolved: 'badge-resolved', closed: 'badge-closed' }
const sevClass  = { High: styles.sevHigh, Medium: styles.sevMed, Low: styles.sevLow }

export default function TicketCard({ ticket, agentName, onView, onClaim }) {
  const timeAgo = ticket.createdAt
    ? formatDistanceToNow(new Date(ticket.createdAt), { addSuffix: true })
    : ''

  const cardClass = [
    styles.card,
    sevClass[ticket.severity] || '',
    ticket.securityFlag ? styles.flagged : '',
  ].join(' ')

  return (
    <div className={cardClass}>
      {ticket.securityFlag && (
        <div className={styles.secBanner}>⚠ Security Flag</div>
      )}

      <div className={styles.top}>
        <span className={styles.ticketId}>{ticket.ticketId}</span>
        <div className={styles.badges}>
          <span className={`badge ${sevBadge[ticket.severity]}`}>{ticket.severity}</span>
          <span className={`badge ${statBadge[ticket.status]}`}>{ticket.status}</span>
        </div>
      </div>

      <div className={styles.category}>{ticket.category}</div>
      <p className={styles.summary}>{ticket.summary}</p>

      <div className={styles.meta}>
        <span>{ticket.userEmail}</span>
        <span>{timeAgo}</span>
      </div>

      {ticket.assignedAgent && (
        <div className={styles.assigned}>Assigned to {ticket.assignedAgent}</div>
      )}

      <div className={styles.actions}>
        <button className={styles.viewBtn} onClick={onView}>View details</button>
        {ticket.status === 'open' && (
          <button className={styles.claimBtn} onClick={onClaim}>Claim</button>
        )}
      </div>
    </div>
  )
}
