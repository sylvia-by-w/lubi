import { getWeekDays } from '../utils/time'

interface Props {
  weekStart: Date
  onPrevWeek: () => void
  onNextWeek: () => void
  onAddTask: () => void
  onOpenSettings: () => void
  currentPage: 'weekly' | 'statistics'
  onChangePage: (page: 'weekly' | 'statistics') => void
}

export default function NavBar({ weekStart, onPrevWeek, onNextWeek, onAddTask, onOpenSettings, currentPage, onChangePage }: Props) {
  const days = getWeekDays(weekStart)
  const startLabel = days[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const endLabel = days[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  return (
    <div style={styles.nav}>
      <span style={styles.logo}>Lubi</span>

      <div style={styles.tabs}>
        <button
          style={{ ...styles.tab, ...(currentPage === 'weekly' ? styles.tabActive : {}) }}
          onClick={() => onChangePage('weekly')}
        >Weekly View</button>
        <button
          style={{ ...styles.tab, ...(currentPage === 'statistics' ? styles.tabActive : {}) }}
          onClick={() => onChangePage('statistics')}
        >Statistics</button>
      </div>

      <div style={styles.right}>
        <button style={styles.weekBtn} onClick={onPrevWeek}>‹</button>
        <span style={styles.weekLabel}>{startLabel} – {endLabel}</span>
        <button style={styles.weekBtn} onClick={onNextWeek}>›</button>
        <button style={styles.settingsBtn} onClick={onOpenSettings}>⚙ Settings</button>
        <button style={styles.addBtn} onClick={onAddTask}>+ Add Task</button>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  nav: {
    display: 'flex',
    alignItems: 'center',
    padding: '0 20px',
    height: 56,
    borderBottom: '1px solid #e5e7eb',
    background: '#fff',
    gap: 24,
    flexShrink: 0,
  },
  logo: {
    fontWeight: 700,
    fontSize: 18,
    color: '#111827',
    letterSpacing: '-0.5px',
  },
  tabs: {
    display: 'flex',
    gap: 4,
  },
  tab: {
    padding: '6px 16px',
    borderRadius: 6,
    border: 'none',
    background: 'transparent',
    fontSize: 14,
    cursor: 'pointer',
    color: '#6b7280',
    fontWeight: 500,
  },
  tabActive: {
    background: '#f3f4f6',
    color: '#111827',
  },
  right: {
    marginLeft: 'auto',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  weekBtn: {
    width: 32,
    height: 32,
    borderRadius: 6,
    border: '1px solid #e5e7eb',
    background: '#fff',
    fontSize: 18,
    cursor: 'pointer',
    lineHeight: 1,
  },
  weekLabel: {
    fontSize: 14,
    color: '#374151',
    fontWeight: 500,
    minWidth: 140,
    textAlign: 'center',
  },
  settingsBtn: {
    padding: '8px 14px',
    borderRadius: 6,
    border: '1px solid #e5e7eb',
    background: '#fff',
    fontSize: 14,
    cursor: 'pointer',
    color: '#6b7280',
  },
  addBtn: {
    padding: '8px 16px',
    borderRadius: 6,
    border: 'none',
    background: '#111827',
    color: '#fff',
    fontSize: 14,
    fontWeight: 500,
    cursor: 'pointer',
  },
}
