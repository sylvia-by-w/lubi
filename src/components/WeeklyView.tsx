import { useEffect, useMemo, useRef, useState } from 'react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import type { TaskBlock, Category, Project } from '../types'
import { getWeekDays, formatDate, formatDayLabel, timeToMinutes } from '../utils/time'
import DayColumn from './DayColumn'
import './WeeklyView.css'

interface Props {
  weekStart: Date
  tasks: TaskBlock[]
  categories: Category[]
  projects: Project[]
  onCreateSelection: (selection: {
    date: string
    type: 'plan' | 'actual'
    startTime: string
    endTime: string
  }) => void
  onClickTask: (task: TaskBlock) => void
}

interface DailyReview {
  wentWell: string
  wentWrong: string
  deviationReason: string
  tomorrowAdjustment: string
}

const SLOT_HEIGHT = 20
const TOTAL_HEIGHT = 96 * SLOT_HEIGHT
const DAILY_REVIEWS_KEY = 'lyubishchev_daily_reviews'
const WEEKLY_FINDINGS_KEY = 'lyubishchev_weekly_findings'

const emptyReview: DailyReview = {
  wentWell: '',
  wentWrong: '',
  deviationReason: '',
  tomorrowAdjustment: '',
}

function loadRecord<T>(key: string): Record<string, T> {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function saveRecord<T>(key: string, value: Record<string, T>) {
  localStorage.setItem(key, JSON.stringify(value))
}

function calcMinutes(tasks: TaskBlock[]) {
  return tasks.reduce((sum, t) => sum + timeToMinutes(t.endTime) - timeToMinutes(t.startTime), 0)
}

function fmtHours(min: number) {
  const h = Math.floor(Math.abs(min) / 60)
  const m = Math.abs(min) % 60
  const sign = min < 0 ? '-' : '+'
  return m === 0 ? `${sign}${h}h` : `${sign}${h}h${m}m`
}

function fmtHoursAbs(min: number) {
  const h = Math.floor(min / 60)
  const m = min % 60
  return m === 0 ? `${h}h` : `${h}h${m}m`
}

function useDailyReview(date: string) {
  const [reviews, setReviews] = useState<Record<string, DailyReview>>(() =>
    loadRecord<DailyReview>(DAILY_REVIEWS_KEY)
  )

  const review = reviews[date] ?? emptyReview

  const updateReview = (field: keyof DailyReview, value: string) => {
    setReviews(prev => {
      const next = {
        ...prev,
        [date]: { ...(prev[date] ?? emptyReview), [field]: value },
      }
      saveRecord(DAILY_REVIEWS_KEY, next)
      return next
    })
  }

  return { review, updateReview }
}

function useWeeklyFinding(weekKey: string) {
  const [findings, setFindings] = useState<Record<string, string>>(() =>
    loadRecord<string>(WEEKLY_FINDINGS_KEY)
  )

  const updateFinding = (value: string) => {
    setFindings(prev => {
      const next = { ...prev, [weekKey]: value }
      saveRecord(WEEKLY_FINDINGS_KEY, next)
      return next
    })
  }

  return { finding: findings[weekKey] ?? '', updateFinding }
}

export default function WeeklyView({
  weekStart,
  tasks,
  categories,
  projects,
  onCreateSelection,
  onClickTask,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const days = getWeekDays(weekStart)
  const weekKey = formatDate(weekStart)
  const today = formatDate(new Date())
  const defaultSelectedDate = days.some(d => formatDate(d) === today) ? today : weekKey
  const [selectedDate, setSelectedDate] = useState(defaultSelectedDate)
  const { review, updateReview } = useDailyReview(selectedDate)
  const { finding, updateFinding } = useWeeklyFinding(weekKey)

  useEffect(() => {
    setSelectedDate(defaultSelectedDate)
  }, [defaultSelectedDate])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = (6 / 24) * TOTAL_HEIGHT
    }
  }, [])

  const weekTasks = useMemo(() => {
    const weekDates = new Set(days.map(formatDate))
    return tasks.filter(t => weekDates.has(t.date))
  }, [days, tasks])

  const allocation = categories
    .map(cat => ({
      name: cat.name,
      value: calcMinutes(weekTasks.filter(t => t.type === 'actual' && t.categoryId === cat.id)),
      color: cat.color,
    }))
    .filter(item => item.value > 0)

  const projectStats = projects
    .map(project => {
      const category = categories.find(c => c.id === project.categoryId)
      const planned = calcMinutes(weekTasks.filter(t => t.projectId === project.id && t.type === 'plan'))
      const actual = calcMinutes(weekTasks.filter(t => t.projectId === project.id && t.type === 'actual'))
      return { project, category, planned, actual, diff: actual - planned }
    })
    .filter(item => item.planned > 0 || item.actual > 0)

  const topProjects = [...projectStats].sort((a, b) => b.actual - a.actual).slice(0, 5)
  const maxProjectActual = Math.max(...topProjects.map(p => p.actual), 1)

  const categoryDeviationStats = categories
    .map(cat => {
      const planned = calcMinutes(weekTasks.filter(t => t.categoryId === cat.id && t.type === 'plan'))
      const actual = calcMinutes(weekTasks.filter(t => t.categoryId === cat.id && t.type === 'actual'))
      return { label: cat.name, color: cat.color, planned, actual, diff: actual - planned }
    })
    .filter(item => item.planned > 0 || item.actual > 0)

  const deviationStats = (projectStats.length > 0
    ? projectStats.map(item => ({
        label: item.project.name,
        color: item.category?.color ?? '#9ca3af',
        planned: item.planned,
        actual: item.actual,
        diff: item.diff,
      }))
    : categoryDeviationStats
  ).sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff)).slice(0, 5)

  const handleCreateSelection = (selection: {
    date: string
    type: 'plan' | 'actual'
    startTime: string
    endTime: string
  }) => {
    setSelectedDate(selection.date)
    onCreateSelection(selection)
  }

  return (
    <div className="weekly-dashboard">
      <aside className="weekly-sidebar weekly-sidebar-left">
        <section className="dashboard-card">
          <h2>Selected Day Review</h2>
          <div className="selected-date">{selectedDate}</div>
          <ReviewField label="What went well" value={review.wentWell} onChange={v => updateReview('wentWell', v)} />
          <ReviewField label="What went wrong" value={review.wentWrong} onChange={v => updateReview('wentWrong', v)} />
          <ReviewField label="Deviation reason" value={review.deviationReason} onChange={v => updateReview('deviationReason', v)} />
          <ReviewField label="Tomorrow adjustment" value={review.tomorrowAdjustment} onChange={v => updateReview('tomorrowAdjustment', v)} />
        </section>

        <section className="dashboard-card">
          <h2>Key Findings</h2>
          <textarea
            className="review-textarea tall"
            value={finding}
            onChange={e => updateFinding(e.target.value)}
            placeholder="Weekly patterns, recurring interruptions, useful corrections..."
          />
        </section>

        <section className="dashboard-card">
          <h2>AI Review</h2>
          <button className="ghost-button">Generate Daily Review</button>
          <button className="ghost-button">Generate Weekly Review</button>
        </section>
      </aside>

      <main className="calendar-panel">
        <div className="calendar-header-row">
          <div className="time-gutter" />
          {days.map(d => {
            const dateStr = formatDate(d)
            const isToday = dateStr === today
            const isSelected = dateStr === selectedDate
            return (
              <button
                key={dateStr}
                className={`day-header ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}`}
                onClick={() => setSelectedDate(dateStr)}
              >
                {formatDayLabel(dateStr)}
              </button>
            )
          })}
        </div>

        <div ref={scrollRef} className="calendar-scroll">
          <div className="calendar-grid" style={{ height: TOTAL_HEIGHT }}>
            <div className="time-axis">
              {Array.from({ length: 24 }, (_, h) => (
                <div key={h} className="time-label" style={{ top: h * 4 * SLOT_HEIGHT - 8 }}>
                  {String(h).padStart(2, '0')}:00
                </div>
              ))}
            </div>

            <div className="grid-lines">
              {Array.from({ length: 97 }, (_, i) => (
                <div
                  key={i}
                  className={i % 4 === 0 ? 'hour-line' : 'slot-line'}
                  style={{ top: i * SLOT_HEIGHT }}
                />
              ))}
            </div>

            {days.map(d => {
              const dateStr = formatDate(d)
              const dayTasks = tasks.filter(t => t.date === dateStr)
              return (
                <DayColumn
                  key={dateStr}
                  dateStr={dateStr}
                  tasks={dayTasks}
                  categories={categories}
                  onCreateSelection={handleCreateSelection}
                  onClickTask={onClickTask}
                />
              )
            })}
          </div>
        </div>
      </main>

      <aside className="weekly-sidebar weekly-sidebar-right">
        <section className="dashboard-card">
          <h2>Time Allocation</h2>
          {allocation.length === 0 ? (
            <p className="empty-state">No actual time recorded this week</p>
          ) : (
            <div className="chart-box">
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={allocation} dataKey="value" nameKey="name" innerRadius={48} outerRadius={72} paddingAngle={2}>
                    {allocation.map(item => (
                      <Cell key={item.name} fill={item.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={value => fmtHoursAbs(Number(value ?? 0))} />
                </PieChart>
              </ResponsiveContainer>
              <div className="legend-list">
                {allocation.map(item => (
                  <div key={item.name} className="legend-item">
                    <span className="color-dot" style={{ background: item.color }} />
                    <span>{item.name}</span>
                    <strong>{fmtHoursAbs(item.value)}</strong>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="dashboard-card">
          <h2>Main Projects</h2>
          {topProjects.length === 0 ? (
            <p className="empty-state">No project time recorded this week</p>
          ) : (
            <div className="metric-list">
              {topProjects.map(({ project, category, actual }) => (
                <div key={project.id} className="project-row">
                  <div className="metric-heading">
                    <span className="color-dot" style={{ background: category?.color ?? '#9ca3af' }} />
                    <span>{project.name}</span>
                    <strong>{fmtHoursAbs(actual)}</strong>
                  </div>
                  <div className="progress-track">
                    <div
                      className="progress-fill"
                      style={{
                        width: `${Math.max(4, (actual / maxProjectActual) * 100)}%`,
                        background: category?.color ?? '#6366f1',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="dashboard-card">
          <h2>Biggest Deviations</h2>
          {deviationStats.length === 0 ? (
            <p className="empty-state">No plan and actual comparison yet</p>
          ) : (
            <div className="metric-list">
              {deviationStats.map(item => (
                <div key={item.label} className="deviation-row">
                  <div className="metric-heading">
                    <span className="color-dot" style={{ background: item.color }} />
                    <span>{item.label}</span>
                    <strong className={item.diff >= 0 ? 'positive' : 'negative'}>{fmtHours(item.diff)}</strong>
                  </div>
                  <div className="mini-stats">
                    <span>Planned {fmtHoursAbs(item.planned)}</span>
                    <span>Actual {fmtHoursAbs(item.actual)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </aside>
    </div>
  )
}

function ReviewField({ label, value, onChange }: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label className="review-field">
      <span>{label}</span>
      <textarea
        className="review-textarea"
        value={value}
        onChange={e => onChange(e.target.value)}
      />
    </label>
  )
}
