import { useState, type CSSProperties } from 'react'
import type { Category, HabitItem, HabitLog, MonthlyNote, MonthlyPlanItem, Project, ProjectTask } from '../types'
import { formatDate } from '../utils/time'

interface Props {
  habits: HabitItem[]
  habitLogs: HabitLog[]
  categories: Category[]
  monthlyNotes: MonthlyNote[]
  projectTasks: ProjectTask[]
  projects: Project[]
  onToggleHabitLog: (habitId: string, date: string) => void
  onUpsertMonthlyNote: (month: string, updates: Partial<Omit<MonthlyNote, 'id' | 'month'>>) => void
}

function resolveTaskCategory(task: ProjectTask, categories: Category[], projects: Project[]): Category | undefined {
  if (task.categoryId) return categories.find(c => c.id === task.categoryId)
  const project = task.projectId ? projects.find(p => p.id === task.projectId) : undefined
  return project ? categories.find(c => c.id === project.categoryId) : undefined
}
function isOverdueTask(task: ProjectTask, todayStr: string) {
  return !!task.dueDate && task.dueDate < todayStr && task.status !== 'done' && task.status !== 'abandoned'
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
  habits, habitLogs, categories, monthlyNotes, projectTasks, projects,
  onToggleHabitLog, onUpsertMonthlyNote,
}: Props) {
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()))
  const [newItemTitle, setNewItemTitle] = useState('')
  const [newItemCategoryId, setNewItemCategoryId] = useState('')
  const monthStart = startOfMonth(cursor)
  const monthKey = monthKeyOf(monthStart)
  const monthLabel = monthLabelOf(monthStart)
  const today = startOfToday()
  const todayStr = formatDate(today)

  const activeHabits = habits.filter(h => !h.archived)
  const weeks = buildWeeks(monthStart)
  const note = monthlyNotes.find(n => n.month === monthKey)

  const groupedHabits = (() => {
    const byCat = new Map<string, HabitItem[]>()
    activeHabits.forEach(h => {
      const key = h.categoryId ?? '__none__'
      if (!byCat.has(key)) byCat.set(key, [])
      byCat.get(key)!.push(h)
    })
    const groups: { label: string; habits: HabitItem[] }[] = []
    categories.forEach(c => {
      const list = byCat.get(c.id)
      if (list && list.length) groups.push({ label: c.name, habits: list })
    })
    const none = byCat.get('__none__')
    if (none && none.length) groups.push({ label: '未分类', habits: none })
    return groups
  })()

  const planItems = note?.planItems ?? []
  const groupedPlanItems = (() => {
    const byCat = new Map<string, MonthlyPlanItem[]>()
    planItems.forEach(item => {
      const key = item.categoryId ?? '__none__'
      if (!byCat.has(key)) byCat.set(key, [])
      byCat.get(key)!.push(item)
    })
    const groups: { key: string; label: string; color: string; items: MonthlyPlanItem[] }[] = []
    categories.forEach(c => {
      const list = byCat.get(c.id)
      if (list && list.length) groups.push({ key: c.id, label: c.name, color: c.color, items: list })
    })
    const none = byCat.get('__none__')
    if (none && none.length) groups.push({ key: '__none__', label: '未分类', color: 'var(--text-muted)', items: none })
    return groups
  })()
  const planDoneCount = planItems.filter(i => i.done).length

  const monthlyTasks = projectTasks.filter(t => t.dueDate && t.dueDate.startsWith(monthKey))
  const monthDoneCount = monthlyTasks.filter(t => t.status === 'done').length
  const monthAbandonedCount = monthlyTasks.filter(t => t.status === 'abandoned').length
  const monthOverdueCount = monthlyTasks.filter(t => isOverdueTask(t, todayStr)).length
  const monthPendingCount = monthlyTasks.length - monthDoneCount - monthAbandonedCount - monthOverdueCount
  const monthCompletionPct = monthlyTasks.length ? monthDoneCount / monthlyTasks.length : 0

  const taskCategoryBreakdown = (() => {
    const byCat = new Map<string, ProjectTask[]>()
    monthlyTasks.forEach(t => {
      const cat = resolveTaskCategory(t, categories, projects)
      const key = cat?.id ?? '__none__'
      if (!byCat.has(key)) byCat.set(key, [])
      byCat.get(key)!.push(t)
    })
    const rows: { key: string; label: string; color: string; done: number; pending: number; overdue: number; abandoned: number; total: number }[] = []
    const buildRow = (key: string, label: string, color: string, list: ProjectTask[]) => {
      const done = list.filter(t => t.status === 'done').length
      const abandoned = list.filter(t => t.status === 'abandoned').length
      const overdue = list.filter(t => isOverdueTask(t, todayStr)).length
      rows.push({ key, label, color, done, pending: list.length - done - abandoned - overdue, overdue, abandoned, total: list.length })
    }
    categories.forEach(c => {
      const list = byCat.get(c.id)
      if (list && list.length) buildRow(c.id, c.name, c.color, list)
    })
    const none = byCat.get('__none__')
    if (none && none.length) buildRow('__none__', '未分类', 'var(--text-muted)', none)
    return rows
  })()

  const handleAddPlanItem = () => {
    if (!newItemTitle.trim()) return
    const item: MonthlyPlanItem = {
      id: crypto.randomUUID(),
      title: newItemTitle.trim(),
      categoryId: newItemCategoryId || undefined,
      done: false,
    }
    onUpsertMonthlyNote(monthKey, { planItems: [...planItems, item] })
    setNewItemTitle('')
  }
  const handleTogglePlanItem = (id: string) => {
    onUpsertMonthlyNote(monthKey, { planItems: planItems.map(i => i.id === id ? { ...i, done: !i.done } : i) })
  }
  const handleDeletePlanItem = (id: string) => {
    onUpsertMonthlyNote(monthKey, { planItems: planItems.filter(i => i.id !== id) })
  }

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

  const taskTrend: { day: number; totalDue: number; totalDone: number }[] = []
  {
    let runningDue = 0
    let runningDone = 0
    const totalDaysThisMonth = daysInMonth(monthStart)
    for (let day = 1; day <= totalDaysThisMonth; day++) {
      const ds = formatDate(new Date(monthStart.getFullYear(), monthStart.getMonth(), day))
      if (ds > todayStr) break
      runningDue += monthlyTasks.filter(t => t.dueDate === ds).length
      runningDone += monthlyTasks.filter(t => t.completedAt && t.completedAt.slice(0, 10) === ds).length
      taskTrend.push({ day, totalDue: runningDue, totalDone: runningDone })
    }
  }

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
          <h1 style={styles.title}>月度计划</h1>
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

      <section style={{ ...styles.panel, marginBottom: 18 }}>
        <div style={styles.planHeader}>
          <h3 style={styles.panelTitle}>本月计划</h3>
          {planItems.length > 0 && (
            <div style={styles.planProgress}>
              <MonthDonut pct={planItems.length ? planDoneCount / planItems.length : 0} size={36} />
              <span style={styles.planProgressLabel}>{planDoneCount}/{planItems.length} 已完成</span>
            </div>
          )}
        </div>

        <div style={styles.planAddRow}>
          <input
            style={{ ...styles.input, flex: 1, marginBottom: 0 }}
            placeholder="添加一条计划事项…"
            value={newItemTitle}
            onChange={e => setNewItemTitle(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAddPlanItem()}
          />
          <select
            style={{ ...styles.input, width: 100, marginBottom: 0 }}
            value={newItemCategoryId}
            onChange={e => setNewItemCategoryId(e.target.value)}
          >
            <option value="">分类</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button style={styles.planAddBtn} onClick={handleAddPlanItem}>添加</button>
        </div>

        {groupedPlanItems.length === 0 ? (
          <p style={styles.emptyText}>还没有计划事项，添加一条吧。</p>
        ) : (
          <div style={styles.planCardGrid}>
            {groupedPlanItems.map(group => {
              const groupDone = group.items.filter(i => i.done).length
              const groupPct = group.items.length ? Math.round((groupDone / group.items.length) * 100) : 0
              return (
                <div key={group.key} style={styles.planCard}>
                  <div style={styles.planCardHead}>
                    <div style={styles.planCardHeadLeft}>
                      <span style={{ ...styles.dot, background: group.color }} />
                      <span style={styles.planCardLabel}>{group.label}</span>
                    </div>
                    <span style={styles.planCardMeta}>{groupDone}/{group.items.length} · {groupPct}%</span>
                  </div>
                  <div style={styles.planCardBarTrack}>
                    <div style={{ ...styles.planCardBarFill, width: `${groupPct}%`, background: group.color }} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {group.items.map(item => (
                      <div key={item.id} style={styles.planItemRow}>
                        <label style={styles.planItemLabel}>
                          <input type="checkbox" checked={item.done} onChange={() => handleTogglePlanItem(item.id)} />
                          <span style={{ ...styles.planItemTitle, ...(item.done ? styles.taskNameDone : {}) }}>{item.title}</span>
                        </label>
                        <button style={styles.deleteBtn} onClick={() => handleDeletePlanItem(item.id)} aria-label="删除">x</button>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {monthlyTasks.length > 0 && (
        <section style={{ marginBottom: 18 }}>
          <h3 style={styles.panelTitle}>本月任务完成情况</h3>
          <p style={styles.hint}>自动统计任务看板里截止日期落在这个月的任务，不用在这里手动维护。</p>

          <div style={styles.statRow}>
            <div style={styles.statCard}>
              <div style={styles.statCardLabel}>完成率</div>
              <div style={styles.statCardValue}>{Math.round(monthCompletionPct * 100)}%</div>
            </div>
            <div style={styles.statCard}>
              <div style={styles.statCardLabel}>已完成</div>
              <div style={{ ...styles.statCardValue, color: 'var(--success)' }}>{monthDoneCount}</div>
            </div>
            <div style={styles.statCard}>
              <div style={styles.statCardLabel}>待办中</div>
              <div style={styles.statCardValue}>{monthPendingCount}</div>
            </div>
            <div style={{ ...styles.statCard, ...styles.statCardDanger }}>
              <div style={{ ...styles.statCardLabel, color: '#b91c1c' }}>逾期</div>
              <div style={{ ...styles.statCardValue, color: '#b91c1c' }}>{monthOverdueCount}</div>
            </div>
            <div style={{ ...styles.statCard, ...styles.statCardMuted }}>
              <div style={styles.statCardLabel}>已放弃</div>
              <div style={{ ...styles.statCardValue, color: 'var(--text-muted)' }}>{monthAbandonedCount}</div>
            </div>
          </div>

          <div style={styles.categoryBarPanel}>
            <p style={styles.hint}>按分类：已完成 / 待办中 / 逾期 / 已放弃</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {taskCategoryBreakdown.map(row => (
                <div key={row.key} style={styles.categoryBarRow}>
                  <span style={styles.categoryBarLabel}>{row.label}</span>
                  <div style={styles.categoryBarTrack}>
                    {row.done > 0 && <div style={{ width: `${(row.done / row.total) * 100}%`, background: 'var(--success)' }} />}
                    {row.pending > 0 && <div style={{ width: `${(row.pending / row.total) * 100}%`, background: 'var(--border)' }} />}
                    {row.overdue > 0 && <div style={{ width: `${(row.overdue / row.total) * 100}%`, background: 'var(--danger)' }} />}
                    {row.abandoned > 0 && <div style={{ width: `${(row.abandoned / row.total) * 100}%`, background: 'var(--text-muted)' }} />}
                  </div>
                  <span style={styles.categoryBarMeta}>{row.done}/{row.total}</span>
                </div>
              ))}
            </div>
            <div style={styles.categoryBarLegend}>
              <span style={styles.categoryBarLegendItem}><span style={{ ...styles.dot, borderRadius: 2, background: 'var(--success)' }} />已完成</span>
              <span style={styles.categoryBarLegendItem}><span style={{ ...styles.dot, borderRadius: 2, background: 'var(--border)' }} />待办中</span>
              <span style={styles.categoryBarLegendItem}><span style={{ ...styles.dot, borderRadius: 2, background: 'var(--danger)' }} />逾期</span>
              <span style={styles.categoryBarLegendItem}><span style={{ ...styles.dot, borderRadius: 2, background: 'var(--text-muted)' }} />已放弃</span>
            </div>
          </div>
        </section>
      )}

      {activeHabits.length === 0 ? (
        <p style={styles.emptyText}>还没有习惯。先去"看板"页左侧的"习惯"面板里加几个，比如早睡、运动、阅读，这里就会按周显示打卡情况。</p>
      ) : (
          <div style={styles.weekGrid}>
            {weeks.map((week, wi) => {
              const pct = weekPct(week)
              return (
                <div key={wi} style={styles.weekPanel}>
                  <div style={styles.weekPanelHead}>
                    <span style={styles.weekLabel}>第 {wi + 1} 周</span>
                    {pct !== null && <MonthDonut pct={pct} size={26} />}
                  </div>
                  <table style={styles.habitTable}>
                    <thead>
                      <tr>
                        <th style={{ ...styles.habitTh, ...styles.habitThCat }}>类别</th>
                        <th style={{ ...styles.habitTh, ...styles.habitThItem }}>事项</th>
                        {week.map((c, ci) => (
                          <th
                            key={ci}
                            style={{
                              ...styles.habitTh,
                              ...(formatDate(c.date) === todayStr ? styles.weekTodayCell : {}),
                              ...(c.inMonth ? {} : styles.weekOutCell),
                            }}
                          >
                            {WEEKDAY_LABELS[ci]}<br />{c.date.getDate()}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {groupedHabits.map(group => group.habits.map((h, hi) => (
                        <tr key={h.id}>
                          {hi === 0 && (
                            <td style={styles.habitTdCat} rowSpan={group.habits.length}>{group.label}</td>
                          )}
                          <td style={styles.habitTdItem} title={h.name}>{h.name}</td>
                          {week.map((c, ci) => {
                            const ds = formatDate(c.date)
                            const done = c.inMonth && isDone(h.id, ds)
                            return (
                              <td
                                key={ci}
                                style={{
                                  ...styles.habitTdCheck,
                                  ...(formatDate(c.date) === todayStr ? styles.weekTodayCell : {}),
                                  ...(c.inMonth ? {} : styles.weekOutCell),
                                }}
                              >
                                {c.inMonth && (
                                  <input type="checkbox" checked={done} onChange={() => onToggleHabitLog(h.id, ds)} />
                                )}
                              </td>
                            )
                          })}
                        </tr>
                      )))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={2} style={styles.habitTfLabel}>每日完成率</td>
                        {week.map((c, ci) => {
                          const ds = formatDate(c.date)
                          const countable = c.inMonth && ds <= todayStr
                          const doneCount = countable ? activeHabits.filter(h => isDone(h.id, ds)).length : 0
                          const pctDay = countable && activeHabits.length ? doneCount / activeHabits.length : null
                          return (
                            <td key={ci} style={{ ...styles.habitTfCell, ...(c.inMonth ? {} : styles.weekOutCell) }}>
                              {pctDay !== null ? `${Math.round(pctDay * 100)}%` : '-'}
                            </td>
                          )
                        })}
                      </tr>
                      <tr>
                        <td colSpan={2} style={styles.habitTfLabel}>已完成/未完成</td>
                        {week.map((c, ci) => {
                          const ds = formatDate(c.date)
                          const countable = c.inMonth && ds <= todayStr
                          const doneCount = countable ? activeHabits.filter(h => isDone(h.id, ds)).length : 0
                          return (
                            <td key={ci} style={{ ...styles.habitTfCell, ...(c.inMonth ? {} : styles.weekOutCell) }}>
                              {countable ? `${doneCount}/${activeHabits.length - doneCount}` : '-'}
                            </td>
                          )
                        })}
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )
            })}
          </div>
      )}

      {(activeHabits.length > 0 || monthlyTasks.length > 0) && (
        <section style={styles.panel}>
          <h3 style={styles.panelTitle}>本月趋势</h3>
          {activeHabits.length > 0 && (
            <div style={styles.trendPanel}>
              <p style={styles.hint}>每日习惯完成率</p>
              <TrendChart points={dailyTrend} />
            </div>
          )}
          {monthlyTasks.length > 0 && (
            <div style={{ ...styles.trendPanel, marginBottom: 0 }}>
              <p style={styles.hint}>任务累计完成</p>
              <BurnupChart points={taskTrend} />
              <div style={styles.categoryBarLegend}>
                <span style={styles.categoryBarLegendItem}><span style={{ width: 14, height: 2, background: 'var(--text-muted)', display: 'inline-block' }} />累计应完成任务</span>
                <span style={styles.categoryBarLegendItem}><span style={{ width: 14, height: 2, background: 'var(--success)', display: 'inline-block' }} />累计已完成任务</span>
              </div>
            </div>
          )}
        </section>
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

function BurnupChart({ points }: { points: { day: number; totalDue: number; totalDone: number }[] }) {
  const W = 900, H = 160, padL = 34, padB = 22, padT = 10
  if (points.length === 0) {
    return <div style={{ ...styles.chartBox, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 12 }}>本月还没有任务数据</div>
  }
  const innerW = W - padL - 10
  const innerH = H - padT - padB
  const maxDay = Math.max(...points.map(p => p.day), 1)
  const maxValue = Math.max(1, ...points.map(p => p.totalDue), ...points.map(p => p.totalDone))
  const xOf = (day: number) => padL + (maxDay <= 1 ? innerW / 2 : ((day - 1) / (maxDay - 1)) * innerW)
  const yOf = (value: number) => padT + innerH - (value / maxValue) * innerH
  const dueLine = points.map(p => `${xOf(p.day)},${yOf(p.totalDue)}`).join(' ')
  const doneLine = points.map(p => `${xOf(p.day)},${yOf(p.totalDone)}`).join(' ')

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={styles.chartBox}>
      <line x1={padL} y1={padT} x2={padL} y2={H - padB} stroke="var(--border)" />
      <line x1={padL} y1={H - padB} x2={W - 6} y2={H - padB} stroke="var(--border)" />
      <text x={4} y={padT + 6} fontSize="10" fill="var(--text-muted)">{maxValue}</text>
      <text x={4} y={padT + innerH / 2 + 4} fontSize="10" fill="var(--text-muted)">{Math.round(maxValue / 2)}</text>
      <text x={10} y={H - padB + 4} fontSize="10" fill="var(--text-muted)">0</text>
      <polyline points={dueLine} fill="none" stroke="var(--text-muted)" strokeWidth={2} />
      <polyline points={doneLine} fill="none" stroke="var(--success)" strokeWidth={2.5} />
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
  planTextarea: { border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '10px 12px', font: 'inherit', fontSize: 13, width: '100%', minHeight: 90, resize: 'vertical', color: 'var(--text-primary)', background: 'var(--surface)', boxSizing: 'border-box' },
  habitTable: { width: '100%', borderCollapse: 'collapse', fontSize: 11 },
  habitTh: { border: '1px solid var(--border-soft)', background: 'var(--surface-muted)', padding: '5px 4px', fontWeight: 700, fontSize: 9, textAlign: 'center', lineHeight: 1.3, color: 'var(--text-secondary)' },
  habitThCat: { width: 44 },
  habitThItem: { width: 76, textAlign: 'left', paddingLeft: 6 },
  habitTdCat: { border: '1px solid var(--border-soft)', padding: '5px 4px', fontWeight: 700, fontSize: 10, color: 'var(--text-primary)', background: 'var(--surface-soft)', verticalAlign: 'top', textAlign: 'left' },
  habitTdItem: { border: '1px solid var(--border-soft)', padding: '5px 6px', fontSize: 11, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 90 },
  habitTdCheck: { border: '1px solid var(--border-soft)', padding: '4px', textAlign: 'center' },
  habitTfLabel: { border: '1px solid var(--border-soft)', background: 'var(--surface-muted)', padding: '5px 6px', fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textAlign: 'left' },
  habitTfCell: { border: '1px solid var(--border-soft)', background: 'var(--surface-muted)', padding: '5px 4px', fontSize: 10, textAlign: 'center', color: 'var(--text-secondary)' },
  input: { border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '8px 9px', font: 'inherit', fontSize: 13, boxSizing: 'border-box', width: '100%', color: 'var(--text-primary)', background: 'var(--surface)', marginBottom: 8 },
  deleteBtn: { border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13, padding: '0 2px' },
  taskNameDone: { textDecoration: 'line-through', color: 'var(--text-secondary)' },
  planHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10 },
  planProgress: { display: 'flex', alignItems: 'center', gap: 8 },
  planProgressLabel: { fontSize: 11, color: 'var(--text-secondary)', fontWeight: 700, whiteSpace: 'nowrap' },
  planAddRow: { display: 'flex', gap: 8, marginBottom: 12 },
  planAddBtn: { border: 'none', borderRadius: 'var(--radius-sm)', background: 'var(--primary)', color: '#fff', padding: '0 14px', cursor: 'pointer', fontWeight: 800, fontSize: 13 },
  planGroupLabel: { fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', margin: '0 0 5px' },
  planItemRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, border: '1px solid var(--border-soft)', borderRadius: 'var(--radius-sm)', padding: '6px 9px', background: 'var(--surface-soft)' },
  planItemLabel: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', flex: 1, minWidth: 0 },
  planItemTitle: { color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  dot: { width: 8, height: 8, borderRadius: '50%', display: 'inline-block', flexShrink: 0 },
  planCardGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 },
  planCard: { border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'var(--surface)', padding: 12, boxShadow: 'var(--shadow-card)' },
  planCardHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 },
  planCardHeadLeft: { display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 },
  planCardLabel: { fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  planCardMeta: { fontSize: 10, color: 'var(--text-secondary)', fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 },
  planCardBarTrack: { height: 5, background: 'var(--surface-muted)', borderRadius: 3, overflow: 'hidden', marginBottom: 8 },
  planCardBarFill: { height: '100%', borderRadius: 3 },
  statRow: { display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 },
  statCard: { border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'var(--surface)', padding: '10px 16px', minWidth: 96, boxShadow: 'var(--shadow-card)' },
  statCardDanger: { border: '1px solid #fecaca', background: 'var(--danger-soft)' },
  statCardMuted: { background: 'var(--surface-soft)' },
  statCardLabel: { fontSize: 11, color: 'var(--text-secondary)' },
  statCardValue: { fontSize: 20, fontWeight: 800, color: 'var(--text-primary)' },
  categoryBarPanel: { border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'var(--surface)', padding: '14px 16px', marginBottom: 18 },
  categoryBarRow: { display: 'grid', gridTemplateColumns: '110px 1fr 64px', alignItems: 'center', gap: 8 },
  categoryBarLabel: { fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  categoryBarTrack: { height: 10, borderRadius: 5, overflow: 'hidden', display: 'flex', background: 'var(--surface-muted)' },
  categoryBarMeta: { fontSize: 11, color: 'var(--text-secondary)', textAlign: 'right' },
  categoryBarLegend: { display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 12 },
  categoryBarLegendItem: { fontSize: 10, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 },
  trendPanel: { border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'var(--surface)', padding: '14px 16px', marginBottom: 10 },
  hint: { fontSize: 11, color: 'var(--text-muted)', margin: '0 0 8px' },
}
