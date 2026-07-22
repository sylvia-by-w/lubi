import type { Deadline, PriorityLevel, Project } from '../types'
import { getWeekDays } from '../utils/time'
import { useLanguage } from '../i18n/LanguageContext'

interface Props {
  weekStart: Date
  onPrevWeek: () => void
  onNextWeek: () => void
  onAddTask: () => void
  onExportWeeklyExcel: () => void
  onOpenSettings: () => void
  onOpenDeadlines: () => void
  deadlines: Deadline[]
  projects: Project[]
  currentPage: 'weekly' | 'board' | 'month' | 'projects' | 'statistics'
  onChangePage: (page: 'weekly' | 'board' | 'month' | 'projects' | 'statistics') => void
}

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function daysUntil(date: string) {
  const today = new Date(todayStr())
  const target = new Date(date)
  return Math.ceil((target.getTime() - today.getTime()) / 86400000)
}

function deadlineLabel(days: number, t: (path: string, vars?: Record<string, string | number>) => string) {
  if (days === 0) return t('nav.today')
  if (days === 1) return t('nav.daysLeftOne')
  return t('nav.daysLeft', { days })
}

function priorityBarColor(priority?: PriorityLevel) {
  if (priority === 'high') return '#dc2626'
  if (priority === 'medium') return '#d97706'
  if (priority === 'low') return '#0284c7'
  return '#d1d5db'
}

const DEADLINE_SHOW_COUNT = 3

export default function NavBar({
  weekStart,
  onPrevWeek,
  onNextWeek,
  onAddTask,
  onExportWeeklyExcel,
  onOpenSettings,
  onOpenDeadlines,
  deadlines,
  currentPage,
  onChangePage,
}: Props) {
  const { t, lang } = useLanguage()
  const days = getWeekDays(weekStart)
  const locale = lang === 'en' ? 'en-US' : 'zh-CN'
  const startLabel = days[0].toLocaleDateString(locale, { month: 'short', day: 'numeric' })
  const endLabel = days[6].toLocaleDateString(locale, { month: 'short', day: 'numeric' })
  const upcomingDeadlines = [...deadlines]
    .filter(deadline => deadline.date >= todayStr())
    .sort((a, b) => `${a.date}T${a.time ?? '00:00'}`.localeCompare(`${b.date}T${b.time ?? '00:00'}`))
  const visibleDeadlines = upcomingDeadlines.slice(0, DEADLINE_SHOW_COUNT)
  const overflowCount = Math.max(0, upcomingDeadlines.length - DEADLINE_SHOW_COUNT)

  return (
    <div style={styles.nav}>
      <span style={styles.logo}>Lubi</span>

      <div style={styles.tabs}>
        <button
          style={{ ...styles.tab, ...(currentPage === 'weekly' ? styles.tabActive : {}) }}
          onClick={() => onChangePage('weekly')}
        >{t('nav.timeLog')}</button>
        <button
          style={{ ...styles.tab, ...(currentPage === 'board' ? styles.tabActive : {}) }}
          onClick={() => onChangePage('board')}
        >{t('nav.taskBoard')}</button>
        <button
          style={{ ...styles.tab, ...(currentPage === 'month' ? styles.tabActive : {}) }}
          onClick={() => onChangePage('month')}
        >{t('nav.monthPlan')}</button>
        <button
          style={{ ...styles.tab, ...(currentPage === 'projects' ? styles.tabActive : {}) }}
          onClick={() => onChangePage('projects')}
        >{t('nav.projects')}</button>
        <button
          style={{ ...styles.tab, ...(currentPage === 'statistics' ? styles.tabActive : {}) }}
          onClick={() => onChangePage('statistics')}
        >{t('nav.statistics')}</button>
      </div>

      <div style={styles.right}>
        {visibleDeadlines.length === 0 ? (
          <button style={styles.deadlineBlock} onClick={onOpenDeadlines}>
            <span style={styles.deadlineKicker}>{t('nav.deadlineKicker')}</span>
            <span style={styles.deadlineTitle}>{t('nav.noUpcomingDeadline')}</span>
            <span style={styles.deadlineMeta}>{t('nav.addDeadline')}</span>
          </button>
        ) : (
          <div style={styles.deadlineRow}>
            {visibleDeadlines.map(deadline => (
              <button key={deadline.id} style={styles.deadlineCard} onClick={onOpenDeadlines}>
                <span style={{ ...styles.deadlineCardBar, background: priorityBarColor(deadline.priority) }} />
                <span style={styles.deadlineCardBody}>
                  <span style={styles.deadlineDays}>{deadlineLabel(daysUntil(deadline.date), t)}</span>
                  <span style={styles.deadlineCardTitle}>{deadline.title}</span>
                </span>
              </button>
            ))}
            {overflowCount > 0 && (
              <button style={styles.deadlineOverflowBtn} onClick={onOpenDeadlines}>+{overflowCount}</button>
            )}
          </div>
        )}
        <button style={styles.weekBtn} onClick={onPrevWeek}>&#8249;</button>
        <span style={styles.weekLabel}>{startLabel} - {endLabel}</span>
        <button style={styles.weekBtn} onClick={onNextWeek}>&#8250;</button>
        <button style={styles.settingsBtn} onClick={onExportWeeklyExcel}>{t('nav.export')}</button>
        <button style={styles.settingsBtn} onClick={onOpenSettings}>{t('nav.settings')}</button>
        <button style={styles.addBtn} onClick={onAddTask}>{t('nav.addTask')}</button>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  nav: {
    display: 'flex',
    alignItems: 'center',
    padding: '0 22px',
    minHeight: 64,
    borderBottom: '1px solid #000',
    background: '#181818',
    gap: 22,
    flexShrink: 0,
    overflowX: 'auto',
  },
  logo: {
    fontWeight: 800,
    fontSize: 19,
    color: '#fff',
    letterSpacing: 0,
  },
  tabs: {
    display: 'flex',
    padding: 3,
    gap: 4,
    border: '1px solid rgba(255, 255, 255, 0.12)',
    borderRadius: 999,
    background: 'rgba(255, 255, 255, 0.06)',
  },
  tab: {
    padding: '7px 14px',
    borderRadius: 999,
    border: 'none',
    background: 'transparent',
    fontSize: 13,
    cursor: 'pointer',
    color: 'rgba(255, 255, 255, 0.62)',
    fontWeight: 700,
  },
  tabActive: {
    background: '#fff',
    color: '#181818',
    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.2)',
  },
  right: {
    marginLeft: 'auto',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
  },
  deadlineBlock: {
    width: 190,
    minHeight: 42,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: 1,
    padding: '6px 10px',
    borderRadius: 'var(--radius-md)',
    border: '1px solid rgba(255, 255, 255, 0.14)',
    background: 'rgba(255, 255, 255, 0.06)',
    cursor: 'pointer',
    textAlign: 'left',
  },
  deadlineKicker: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.45)',
    fontWeight: 700,
    textTransform: 'uppercase',
  },
  deadlineTitle: {
    maxWidth: '100%',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    color: '#fff',
    fontSize: 12,
    fontWeight: 700,
  },
  deadlineMeta: {
    maxWidth: '100%',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    color: 'rgba(255, 255, 255, 0.55)',
    fontSize: 11,
    fontWeight: 600,
  },
  deadlineRow: {
    display: 'flex',
    alignItems: 'stretch',
    gap: 6,
    maxWidth: 360,
    overflowX: 'auto',
  },
  deadlineCard: {
    display: 'flex',
    alignItems: 'stretch',
    flexShrink: 0,
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    background: '#fff',
    overflow: 'hidden',
    cursor: 'pointer',
    padding: 0,
    textAlign: 'left',
  },
  deadlineCardBar: {
    width: 4,
    flexShrink: 0,
  },
  deadlineCardBody: {
    display: 'flex',
    flexDirection: 'column',
    gap: 0,
    padding: '5px 11px',
    minWidth: 0,
  },
  deadlineDays: {
    fontSize: 16,
    fontWeight: 800,
    color: '#181818',
    lineHeight: 1.25,
    whiteSpace: 'nowrap',
  },
  deadlineCardTitle: {
    fontSize: 11,
    fontWeight: 600,
    color: '#6b7280',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: 120,
  },
  deadlineOverflowBtn: {
    flexShrink: 0,
    border: '1px solid rgba(255, 255, 255, 0.16)',
    borderRadius: 'var(--radius-sm)',
    background: 'rgba(255, 255, 255, 0.08)',
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: 11,
    fontWeight: 700,
    cursor: 'pointer',
    padding: '0 12px',
  },
  weekBtn: {
    width: 32,
    height: 32,
    borderRadius: 'var(--radius-sm)',
    border: '1px solid rgba(255, 255, 255, 0.14)',
    background: 'rgba(255, 255, 255, 0.06)',
    fontSize: 18,
    cursor: 'pointer',
    lineHeight: 1,
    color: '#fff',
  },
  weekLabel: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.62)',
    fontWeight: 700,
    minWidth: 140,
    textAlign: 'center',
  },
  settingsBtn: {
    padding: '8px 13px',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid rgba(255, 255, 255, 0.14)',
    background: 'rgba(255, 255, 255, 0.06)',
    fontSize: 13,
    cursor: 'pointer',
    color: 'rgba(255, 255, 255, 0.75)',
    fontWeight: 700,
  },
  addBtn: {
    padding: '8px 16px',
    borderRadius: 'var(--radius-sm)',
    border: 'none',
    background: '#fff',
    color: '#181818',
    fontSize: 13,
    fontWeight: 800,
    cursor: 'pointer',
  },
}
