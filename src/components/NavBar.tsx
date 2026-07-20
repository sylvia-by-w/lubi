import type { Deadline, Project } from '../types'
import { getWeekDays } from '../utils/time'

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
  currentPage: 'weekly' | 'board' | 'projects' | 'statistics'
  onChangePage: (page: 'weekly' | 'board' | 'projects' | 'statistics') => void
}

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function daysUntil(date: string) {
  const today = new Date(todayStr())
  const target = new Date(date)
  return Math.ceil((target.getTime() - today.getTime()) / 86400000)
}

function deadlineLabel(days: number) {
  if (days === 0) return '今天'
  if (days === 1) return '还剩1天'
  return `还剩${days}天`
}

export default function NavBar({
  weekStart,
  onPrevWeek,
  onNextWeek,
  onAddTask,
  onExportWeeklyExcel,
  onOpenSettings,
  onOpenDeadlines,
  deadlines,
  projects,
  currentPage,
  onChangePage,
}: Props) {
  const days = getWeekDays(weekStart)
  const startLabel = days[0].toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
  const endLabel = days[6].toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
  const nearestDeadline = [...deadlines]
    .filter(deadline => deadline.date >= todayStr())
    .sort((a, b) => `${a.date}T${a.time ?? '00:00'}`.localeCompare(`${b.date}T${b.time ?? '00:00'}`))[0]
  const nearestProject = nearestDeadline?.projectId
    ? projects.find(project => project.id === nearestDeadline.projectId)
    : undefined

  return (
    <div style={styles.nav}>
      <span style={styles.logo}>Lubi</span>

      <div style={styles.tabs}>
        <button
          style={{ ...styles.tab, ...(currentPage === 'weekly' ? styles.tabActive : {}) }}
          onClick={() => onChangePage('weekly')}
        >周视图</button>
        <button
          style={{ ...styles.tab, ...(currentPage === 'board' ? styles.tabActive : {}) }}
          onClick={() => onChangePage('board')}
        >看板</button>
        <button
          style={{ ...styles.tab, ...(currentPage === 'projects' ? styles.tabActive : {}) }}
          onClick={() => onChangePage('projects')}
        >项目</button>
        <button
          style={{ ...styles.tab, ...(currentPage === 'statistics' ? styles.tabActive : {}) }}
          onClick={() => onChangePage('statistics')}
        >统计</button>
      </div>

      <div style={styles.right}>
        <button style={styles.deadlineBlock} onClick={onOpenDeadlines}>
          {nearestDeadline ? (
            <>
              <span style={styles.deadlineKicker}>截止日期</span>
              <span style={styles.deadlineTitle}>{nearestDeadline.title}</span>
              <span style={styles.deadlineMeta}>
                {deadlineLabel(daysUntil(nearestDeadline.date))}
                {nearestProject ? ` - ${nearestProject.name}` : ''}
              </span>
            </>
          ) : (
            <>
              <span style={styles.deadlineKicker}>截止日期</span>
              <span style={styles.deadlineTitle}>暂无即将到来的截止日期</span>
              <span style={styles.deadlineMeta}>+ 添加</span>
            </>
          )}
        </button>
        <button style={styles.weekBtn} onClick={onPrevWeek}>&#8249;</button>
        <span style={styles.weekLabel}>{startLabel} - {endLabel}</span>
        <button style={styles.weekBtn} onClick={onNextWeek}>&#8250;</button>
        <button style={styles.settingsBtn} onClick={onExportWeeklyExcel}>导出</button>
        <button style={styles.settingsBtn} onClick={onOpenSettings}>设置</button>
        <button style={styles.addBtn} onClick={onAddTask}>+ 添加任务</button>
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
