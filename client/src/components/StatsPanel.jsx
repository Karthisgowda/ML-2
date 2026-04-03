import styles from './StatsPanel.module.css'

export default function StatsPanel({ stats }) {
  const items = [
    { label: 'Total Tickets',  value: stats.total,      color: 'var(--text)' },
    { label: 'Open',           value: stats.open,        color: 'var(--primary)' },
    { label: 'In Progress',    value: stats.inProgress,  color: 'var(--warning)' },
    { label: 'Resolved',       value: stats.resolved,    color: 'var(--success)' },
    { label: 'High Priority',  value: stats.high,        color: 'var(--danger)' },
    { label: 'Security Flags', value: stats.flagged,     color: 'var(--danger)' },
  ]

  return (
    <div className={styles.panel}>
      {items.map((item) => (
        <div key={item.label} className={styles.stat}>
          <span className={styles.value} style={{ color: item.color }}>{item.value}</span>
          <span className={styles.label}>{item.label}</span>
        </div>
      ))}
    </div>
  )
}
