import { Fragment, useState, type CSSProperties } from 'react'
import type { Category, HabitItem, HabitLog, MonthlyNote } from '../types'
import { formatDate } from '../utils/time'
import HabitDragToggle from '../components/HabitDragToggle'

interface Props {
  habits: HabitItem[]
  habitLogs: HabitLog[]
  categories: Category[]
  monthlyNotes: MonthlyNote[]
  onToggleHabitLog: (habitId: string, date: string) => void
  onUpsertMonthlyNote: (month: string, updates: Partial<Omit<MonthlyNote, 'id' | 'month'>>) => void
}

interface DayCell {
  date: Date
  inMonth: boolean
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}
function daysInMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
}
function startOfToday() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}
function monthKeyOf(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
function monthLabelOf(d: Date) {
  return `${d.getFullYear()}年${d.getMonth() + 1}月`
}
function mondayIndex(d: Date) {
  const day = d.getDay()
  return day === 0 ? 6 : day - 1
}

function buildWeeks(monthStart: Date): DayCell[][] {
  const total = daysInMonth(monthStart)
  const lead = mondayIndex(monthStart)
  const cells: DayCell[] = []
  for (let i = lead; i > 0; i--) {
    const d = new Date(monthStart)
    d.setDate(d.getDate() - i)
    cells.push({ date: d, inMonth: false })
  }
  for (let day = 1; day <= total; day++) {
    cells.push({ date: new Date(monthStart.getFullYear(), monthStart.getMonth(), day), inMonth: true })
  }
  while (cells.length % 7 !== 0) {
    const last = cells[cells.length - 1].date
    const d = new Date(last)
    d.setDate(d.getDate() + 1)
    cells.push({ date: d, inMonth: false })
  }
  const weeks: DayCell[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
  return weeks
}

const WEEKDAY_LABELS = ['一', '二', '三', '四', '五', '六', '日']

export default function MonthPlan({
  habits, habitLogs, categories, monthlyNotes,
  onToggleHabitLog, onUpsertMonthlyNote,
}: Props) {
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()))
  const monthStart = startOfMonth(cursor)
  const monthKey = monthKeyOf(monthStart)
  const monthLabel = monthLabelOf(monthStart)
  const today = startOfToday()
  const todayStr = formatDate(today)

  const activeHabits = habits.filter(h => !h.archived)
  const weeks = buildWeeks(monthStart)
  const note = monthlyNotes.find(n => n.month === monthKey)

  const isCountable = (c: DayCell) => c.inMonth && formatDate(c.date) <= todayStr
  const isDone = (habitId: string, ds: string) => habitLogs.some(l => l.habitId === habitId && l.date === ds)

  const weekPct = (week: DayCell[]) => {
    const countableDays = week.filter(isCountable)
    if (activeHabits.length === 0 || countableDays.length === 0) return null
    let done = 0
    countableDays.forEach(c => {
      const ds = formatDate(c.date)
      activeHabits.forEach(h => { if (isDone(h.id, ds)) done++ })
    })
    return done / (countableDays.length * activeHabits.length)
  }

  const monthStats = (() => {
    if (activeHabits.length === 0) return null
    let done = 0, total = 0
    weeks.forEach(week => week.forEach(c => {
      if (!isCountable(c)) return
      const ds = formatDate(c.date)
      activeHabits.forEach(h => { total++; if (isDone(h.id, ds)) done++ })
    }))
    return { done, total, pct: total ? done / total : 0 }
  })()

  const dailyTrend: { day: number; pct: number }[] = []
  weeks.forEach(week => week.forEach(c => {
    if (!isCountable(c)) return
    const ds = formatDate(c.date)
    const doneCount = activeHabits.filter(h => isDone(h.id, ds)).length
    dailyTrend.push({ day: c.date.getDate(), pct: activeHabits.length ? doneCount / activeHabits.length : 0 })
  }))

  const handlePrevMonth = () => {
    const d = new Date(cursor)
    d.setMonth(d.getMonth() - 1)
    setCursor(startOfMonth(d))
  }
  const handleNextMonth = () => {
    const d = new Date(cursor)
    d.setMonth(d.getMonth() + 1)
    setCursor(startOfMonth(d))
  }
  const handleThisMonth = () => setCursor(startOfMonth(new Date()))

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <h1 style={styles.title}>月计划</h1>
          <input
            style={styles.quoteInput}
            placeholder="这个月想对自己说的话…"
            value={note?.quote ?? ''}
            onChange={e => onUpsertMonthlyNote(monthKey, { quote: e.target.value })}
          />
        </div>

        <div style={styles.monthNav}>
          <button style={styles.navBtn} onClick={handlePrevMonth}>&#8249;</button>
          <button style={styles.navBtn} onClick={handleThisMonth}>{monthLabel}</button>
          <button style={styles.navBtn} onClick={handleNextMonth}>&#8250;</button>
        </div>

        <div style={styles.headerRight}>
          {monthStats && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <MonthDonut pct={monthStats.pct} size={56} />
              <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700 }}>{monthStats.done}/{monthStats.total}</span>
            </div>
          )}
          <div style={styles.reminderBox}>
            <p style={styles.reminderLabel}>备注</p>
            <input
              style={styles.reminderInput}
              placeholder="比如：禁止熬夜"
              value={note?.reminder ?? ''}
              onChange={e => onUpsertMonthlyNote(monthKey, { reminder: e.target.value })}
            />
          </div>
        </div>
      </div>

      {activeHabits.length === 0 ? (
        <p style={styles.emptyText}>还没有习惯。先去"看板"页左侧的"习惯"面板里加几个，比如早睡、运动、阅读，这里就会按周显示打卡情况。</p>
      ) : (
        <>
          <div style={styles.weekGrid}>
            {weeks.map((week, wi) => {
              const pct = weekPct(week)
              return (
                <div key={wi} style={styles.weekPanel}>
                  <div style={styles.weekPanelHead}>
                    <span style={styles.weekLabel}>第 {wi + 1} 周</span>
                    {pct !== null && <MonthDonut pct={pct} size={26} />}
                  </div>
                  <div style={{ ...styles.weekTable, gridTemplateColumns: `70px repeat(7, 1fr)` }}>
                    <div style={{ ...styles.weekCell, ...styles.weekHeadCell }} />
                    {week.map((c, ci) => (
                      <div
                        key={ci}
                        style={{
                          ...styles.weekCell, ...styles.weekHeadCell,
                          ...(formatDate(c.date) === todayStr ? styles.weekTodayCell : {}),
                          ...(c.inMonth ? {} : styles.weekOutCell),
                        }}
                      >
                        {WEEKDAY_LABELS[ci]}<br />{c.date.getDate()}
                      </div>
                    ))}
                    {activeHabits.map(h => {
                      const cat = h.categoryId ? categories.find(cc => cc.id === h.categoryId) : undefined
                      return (
                        <Fragment key={h.id}>
                          <div style={{ ...styles.weekCell, ...styles.weekRowLabel }} title={h.name}>{h.name}</div>
                          {week.map((c, ci) => {
                            const ds = formatDate(c.date)
                            const done = c.inMonth && isDone(h.id, ds)
                            return (
                              <div
                                key={ci}
                                style={{
                                  ...styles.weekCell,
                                  ...(formatDate(c.date) === todayStr ? styles.weekTodayCell : {}),
                                  ...(c.inMonth ? {} : styles.weekOutCell),
                                }}
                              >
                                {c.inMonth && (
                                  <HabitDragToggle
                                    done={done}
                                    color={cat?.color ?? 'var(--primary)'}
                                    onToggle={() => onToggleHabitLog(h.id, ds)}
                                    title={done ? '已打卡，拖动或点击取消' : '拖动或点击打卡'}
                                  />
                                )}
                              </div>
                            )
                          })}
                        </Fragment>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>

          <section style={styles.panel}>
            <h3 style={styles.panelTitle}>每日完成率趋势</h3>
            <TrendChart points={dailyTrend} />
          </section>
        </>
      )}
    </div>
  )
}

function MonthDonut({ pct, size }: { pct: number; size: number }) {
  const r = size / 2 - size * 0.13
  const c = 2 * Math.PI * r
  const clamped = Math.max(0, Math.min(1, pct))
  const strokeWidth = Math.max(3, size * 0.13)
  const cx = size / 2
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cx} r={r} fill="none" stroke="var(--border-soft)" strokeWidth={strokeWidth} />
      <circle
        cx={cx} cy={cx} r={r} fill="none" stroke="var(--primary)" strokeWidth={strokeWidth}
        strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c - c * clamped}
        transform={`rotate(-90 ${cx} ${cx})`}
      />
      {size >= 40 && (
        <text x={cx} y={cx + 4} textAnchor="middle" fontSize={size * 0.24} fontWeight={700} fill="var(--text-primary)">
          {Math.round(clamped * 100)}%
        </text>
      )}
    </svg>
  )
}

function TrendChart({ points }: { points: { day: number; pct: number }[] }) {
  const W = 900, H = 160, padL = 34, padB = 22, padT = 10
  if (points.length === 0) {
    return <div style={{ ...styles.chartBox, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 12 }}>本月还没有打卡记录</div>
  }
  const innerW = W - padL - 10
  const innerH = H - padT - padB
  const maxDay = Math.max(...points.map(p => p.day), 1)
  const linePoints = points
    .map(p => {
      const x = padL + (maxDay <= 1 ? innerW / 2 : ((p.day - 1) / (maxDay - 1)) * innerW)
      const y = padT + innerH - p.pct * innerH
      return `${x},${y}`
    })
    .join(' ')

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={styles.chartBox}>
      <line x1={padL} y1={padT} x2={padL} y2={H - padB} stroke="var(--border)" />
      <line x1={padL} y1={H - padB} x2={W - 6} y2={H - padB} stroke="var(--border)" />
      <text x={4} y={padT + 6} fontSize="10" fill="var(--text-muted)">100%</text>
      <text x={4} y={padT + innerH / 2 + 4} fontSize="10" fill="var(--text-muted)">50%</text>
      <text x={10} y={H - padB + 4} fontSize="10" fill="var(--text-muted)">0%</text>
      <polyline points={linePoints} fill="none" stroke="var(--danger)" strokeWidth={2} />
      {points.map((p, i) => {
        const x = padL + (maxDay <= 1 ? innerW / 2 : ((p.day - 1) / (maxDay - 1)) * innerW)
        const y = padT + innerH - p.pct * innerH
        return <circle key={i} cx={x} cy={y} r={2.5} fill="var(--danger)" />
      })}
    </svg>
  )
}

const styles: Record<string, CSSProperties> = {
  page: { flex: 1, overflow: 'auto', padding: 28, background: 'var(--app-bg)' },
  header: { display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 18, flexWrap: 'wrap' },
  title: { margin: '0 0 8px', fontSize: 28, lineHeight: 1.15, fontWeight: 800, color: 'var(--text-primary)' },
  quoteInput: { border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '8px 10px', font: 'inherit', fontSize: 13, width: '100%', maxWidth: 360, color: 'var(--text-primary)', background: 'var(--surface)' },
  monthNav: { display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 },
  navBtn: { border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'var(--surface)', color: 'var(--text-secondary)', padding: '7px 12px', cursor: 'pointer', fontSize: 13, fontWeight: 700 },
  headerRight: { display: 'flex', alignItems: 'center', gap: 12 },
  reminderBox: { background: 'var(--warning-soft)', borderRadius: 'var(--radius-sm)', padding: '6px 10px', minWidth: 160 },
  reminderLabel: { margin: 0, fontSize: 10, fontWeight: 700, color: '#92400e' },
  reminderInput: { border: 'none', background: 'transparent', font: 'inherit', fontSize: 12, color: '#92400e', width: '100%', padding: '2px 0 0' },
  emptyText: { color: 'var(--text-muted)', fontSize: 13, maxWidth: 480 },
  weekGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14, marginBottom: 18 },
  weekPanel: { border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'var(--surface)', padding: 12, boxShadow: 'var(--shadow-card)' },
  weekPanelHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  weekLabel: { fontSize: 13, fontWeight: 800, color: 'var(--text-primary)' },
  weekTable: { display: 'grid', border: '1px solid var(--border-soft)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' },
  weekCell: { borderRight: '1px solid var(--border-soft)', borderBottom: '1px solid var(--border-soft)', minHeight: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: 'var(--text-muted)' },
  weekHeadCell: { background: 'var(--surface-muted)', fontWeight: 700, fontSize: 9, textAlign: 'center', lineHeight: 1.3 },
  weekRowLabel: { justifyContent: 'flex-start', paddingLeft: 6, fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', background: 'var(--surface-soft)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  weekTodayCell: { background: '#fffbe6' },
  weekOutCell: { background: 'var(--surface-muted)', opacity: 0.4 },
  weekDot: { width: 13, height: 13, borderRadius: '50%', boxSizing: 'border-box', display: 'inline-block' },
  panel: { border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'var(--surface)', padding: 14, boxShadow: 'var(--shadow-card)' },
  panelTitle: { margin: '0 0 8px', fontSize: 14, color: 'var(--text-primary)', fontWeight: 800 },
  chartBox: { width: '100%', height: 160, display: 'block' },
}
