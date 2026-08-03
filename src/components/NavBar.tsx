import type { ActiveTimer, Deadline, PriorityLevel, Project } from '../types'
import { getWeekDays } from '../utils/time'
import { useLanguage } from '../i18n/LanguageContext'
import { useTicker } from '../hooks/useTicker'

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
  activeTimer: ActiveTimer | null
  onOpenQuickStartTimer: () => void
  onStopTimer: () => void
  onDiscardTimer: () => void
}

function formatElapsed(startedAt: string) {
  const elapsedMs = Math.max(0, Date.now() - new Date(startedAt).getTime())
  const totalSeconds = Math.floor(elapsedMs / 1000)
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`
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
  activeTimer,
  onOpenQuickStartTimer,
  onStopTimer,
  onDiscardTimer,
}: Props) {
  const { t, lang } = useLanguage()
  useTicker(!!activeTimer, 1000)
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

      {activeTimer ? (
        <div style={styles.timerPill} title={activeTimer.name}>
          <span style={styles.timerDot} />
          <span style={styles.timerName}>{activeTimer.name}</span>
          <span style={styles.timerElapsed}>{formatElapsed(activeTimer.startedAt)}</span>
          <button style={styles.timerStopBtn} onClick={onStopTimer} title={t('timer.stop')}>
            {t('timer.stop')}
          </button>
          <button
            style={styles.timerDiscardBtn}
            onClick={() => { if (confirm(t('timer.confirmDiscard'))) onDiscardTimer() }}
            title={t('timer.discard')}
            aria-label={t('timer.discard')}
          >
            &#10005;
          </button>
        </div>
      ) : (
        <button style={styles.quickStartBtn} onClick={onOpenQuickStartTimer}>
          &#9654; {t('timer.quickStart')}
        </button>
      )}

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
  quickStartBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 14px',
    borderRadius: 999,
    border: '1px solid rgba(220, 38, 38, 0.4)',
    background: 'rgba(220, 38, 38, 0.12)',
    color: '#f87171',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    flexShrink: 0,
  },
  timerPill: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 8px 6px 12px',
    borderRadius: 999,
    border: '1px solid rgba(220, 38, 38, 0.45)',
    background: 'rgba(220, 38, 38, 0.14)',
    flexShrink: 0,
    maxWidth: 280,
  },
  timerDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: '#dc2626',
    flexShrink: 0,
    animation: 'lubi-timer-pulse 1.4s ease-in-out infinite',
  },
  timerName: {
    fontSize: 12,
    fontWeight: 700,
    color: '#fff',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: 110,
  },
  timerElapsed: {
    fontSize: 12,
    fontWeight: 800,
    color: '#fca5a5',
    fontVariantNumeric: 'tabular-nums',
    flexShrink: 0,
  },
  timerStopBtn: {
    padding: '5px 10px',
    borderRadius: 999,
    border: 'none',
    background: '#dc2626',
    color: '#fff',
    fontSize: 11,
    fontWeight: 800,
    cursor: 'pointer',
    flexShrink: 0,
  },
  timerDiscardBtn: {
    width: 20,
    height: 20,
    borderRadius: '50%',
    border: 'none',
    background: 'transparent',
    color: 'rgba(255, 255, 255, 0.55)',
    fontSize: 10,
    cursor: 'pointer',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
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
