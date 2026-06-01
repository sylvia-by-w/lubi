import { useEffect, useMemo, useRef, useState } from 'react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import type { AIReview, Deadline, ProjectTask, TaskBlock, Category, Project } from '../types'
import { getWeekDays, formatDate, formatDayLabel, timeToMinutes } from '../utils/time'
import {
  generateDailyReview,
  generateWeeklyReview,
  type AIReviewResult,
  type DailyReviewData,
  type ReviewTask,
  type ReviewTotal,
  type WeeklyReviewData,
} from '../services/aiReviewService'
import DayColumn from './DayColumn'
import './WeeklyView.css'

interface Props {
  weekStart: Date
  tasks: TaskBlock[]
  categories: Category[]
  projects: Project[]
  projectTasks: ProjectTask[]
  deadlines: Deadline[]
  onCreateSelection: (selection: {
    date: string
    type: 'plan' | 'actual'
    startTime: string
    endTime: string
  }) => void
  onClickTask: (task: TaskBlock) => void
}

interface LegacyDailyReview {
  wentWell: string
  wentWrong: string
  deviationReason: string
  tomorrowAdjustment: string
}

const SLOT_HEIGHT = 20
const TOTAL_HEIGHT = 96 * SLOT_HEIGHT
const DAILY_REVIEWS_KEY = 'lyubishchev_daily_reviews'
const WEEKLY_FINDINGS_KEY = 'lyubishchev_weekly_findings'
const AI_DAILY_REVIEWS_KEY = 'lubi_ai_daily_reviews'
const AI_WEEKLY_REVIEWS_KEY = 'lubi_ai_weekly_reviews'

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

function formatWeekRange(start: Date, end: Date) {
  const month = new Intl.DateTimeFormat('en-US', { month: 'short' })
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()
  const startLabel = sameMonth
    ? `${month.format(start)} ${start.getDate()}`
    : `${month.format(start)} ${start.getDate()}`
  const endLabel = `${sameMonth ? '' : `${month.format(end)} `}${end.getDate()}`
  return `${startLabel} - ${endLabel}`
}

function projectStatusLabel(todayPlanned: number, todayActual: number) {
  if (todayPlanned > 0 && todayActual === 0) return 'Not started'
  if (todayActual > 0 && todayPlanned > 0 && todayActual >= todayPlanned) return 'Done today'
  if (todayActual > 0) return 'In progress'
  return ''
}

function taskMinutes(task: TaskBlock) {
  return timeToMinutes(task.endTime) - timeToMinutes(task.startTime)
}

function taskToReviewTask(task: TaskBlock, categories: Category[], projects: Project[]): ReviewTask {
  const category = categories.find(c => c.id === task.categoryId)
  const project = task.projectId ? projects.find(p => p.id === task.projectId) : undefined
  return {
    name: task.name,
    category: category?.name ?? 'Unknown',
    project: project?.name,
    startTime: task.startTime,
    endTime: task.endTime,
    durationMinutes: taskMinutes(task),
  }
}

function buildTotals(items: Array<{ id: string; name: string }>, tasks: TaskBlock[], getId: (task: TaskBlock) => string | undefined): ReviewTotal[] {
  return items
    .map(item => {
      const itemTasks = tasks.filter(t => getId(t) === item.id)
      const planned = calcMinutes(itemTasks.filter(t => t.type === 'plan'))
      const actual = calcMinutes(itemTasks.filter(t => t.type === 'actual'))
      return { name: item.name, planned, actual, diff: actual - planned }
    })
    .filter(item => item.planned > 0 || item.actual > 0)
}

function sortByDeviation(totals: ReviewTotal[]) {
  return [...totals].sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
}

function legacyDailyNoteToText(review?: LegacyDailyReview) {
  if (!review) return ''
  return [
    review.wentWell && `Went well: ${review.wentWell}`,
    review.wentWrong && `Went wrong: ${review.wentWrong}`,
    review.deviationReason && `Deviation reason: ${review.deviationReason}`,
    review.tomorrowAdjustment && `Tomorrow adjustment: ${review.tomorrowAdjustment}`,
  ].filter(Boolean).join('\n')
}

function reviewFromResult(
  scope: 'daily',
  key: string,
  result: AIReviewResult | AIReview,
  userNote?: string
): AIReview
function reviewFromResult(
  scope: 'weekly',
  key: string,
  result: AIReviewResult | AIReview,
  userNote: string | undefined,
  weekEnd?: string
): AIReview
function reviewFromResult(
  scope: 'daily' | 'weekly',
  key: string,
  result: AIReviewResult | AIReview,
  userNote = '',
  weekEnd?: string
): AIReview {
  if ('aiContent' in result) {
    return {
      ...result,
      userNote: result.userNote ?? (userNote || undefined),
    }
  }

  const createdAt = result.generatedAt
  return {
    id: `${scope}-${key}`,
    scope,
    date: scope === 'daily' ? key : undefined,
    weekStart: scope === 'weekly' ? key : undefined,
    weekEnd: scope === 'weekly' ? weekEnd : undefined,
    aiContent: result.output,
    userNote: userNote || undefined,
    createdAt,
  }
}

function useAIReviews() {
  const [dailyReviews, setDailyReviews] = useState<Record<string, AIReview>>(() => {
    const legacyNotes = loadRecord<LegacyDailyReview>(DAILY_REVIEWS_KEY)
    const rawReviews = loadRecord<AIReviewResult | AIReview>(AI_DAILY_REVIEWS_KEY)
    const next: Record<string, AIReview> = {}
    Object.entries(rawReviews).forEach(([date, result]) => {
      next[date] = reviewFromResult('daily', date, result, legacyDailyNoteToText(legacyNotes[date]))
    })
    return next
  })
  const [weeklyReviews, setWeeklyReviews] = useState<Record<string, AIReview>>(() => {
    const legacyFindings = loadRecord<string>(WEEKLY_FINDINGS_KEY)
    const rawReviews = loadRecord<AIReviewResult | AIReview>(AI_WEEKLY_REVIEWS_KEY)
    const next: Record<string, AIReview> = {}
    Object.entries(rawReviews).forEach(([weekKey, result]) => {
      next[weekKey] = reviewFromResult('weekly', weekKey, result, legacyFindings[weekKey])
    })
    return next
  })

  const saveDailyReview = (date: string, result: AIReviewResult) => {
    setDailyReviews(prev => {
      const now = new Date().toISOString()
      const existing = prev[date]
      const next = {
        ...prev,
        [date]: {
          id: existing?.id ?? `daily-${date}`,
          scope: 'daily' as const,
          date,
          aiContent: result.output,
          userNote: existing?.userNote,
          createdAt: existing?.createdAt ?? result.generatedAt,
          updatedAt: now,
        },
      }
      saveRecord(AI_DAILY_REVIEWS_KEY, next)
      return next
    })
  }

  const saveWeeklyReview = (weekKey: string, weekEnd: string, result: AIReviewResult) => {
    setWeeklyReviews(prev => {
      const now = new Date().toISOString()
      const existing = prev[weekKey]
      const next = {
        ...prev,
        [weekKey]: {
          id: existing?.id ?? `weekly-${weekKey}`,
          scope: 'weekly' as const,
          weekStart: weekKey,
          weekEnd,
          aiContent: result.output,
          userNote: existing?.userNote,
          createdAt: existing?.createdAt ?? result.generatedAt,
          updatedAt: now,
        },
      }
      saveRecord(AI_WEEKLY_REVIEWS_KEY, next)
      return next
    })
  }

  const saveReviewNote = (review: AIReview, userNote: string) => {
    const key = review.scope === 'daily' ? review.date : review.weekStart
    if (!key) return

    const updater = review.scope === 'daily' ? setDailyReviews : setWeeklyReviews
    const storageKey = review.scope === 'daily' ? AI_DAILY_REVIEWS_KEY : AI_WEEKLY_REVIEWS_KEY
    updater(prev => {
      const next = {
        ...prev,
        [key]: {
          ...review,
          userNote: userNote.trim() || undefined,
          updatedAt: new Date().toISOString(),
        },
      }
      saveRecord(storageKey, next)
      return next
    })
  }

  return { dailyReviews, weeklyReviews, saveDailyReview, saveWeeklyReview, saveReviewNote }
}

export default function WeeklyView({
  weekStart,
  tasks,
  categories,
  projects,
  projectTasks,
  deadlines,
  onCreateSelection,
  onClickTask,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const days = useMemo(() => getWeekDays(weekStart), [weekStart])
  const weekKey = formatDate(weekStart)
  const today = formatDate(new Date())
  const defaultSelectedDate = days.some(d => formatDate(d) === today) ? today : weekKey
  const [selectedDateState, setSelectedDate] = useState(defaultSelectedDate)
  const selectedDate = days.some(d => formatDate(d) === selectedDateState)
    ? selectedDateState
    : defaultSelectedDate
  const weekEnd = formatDate(days[days.length - 1])
  const { dailyReviews, weeklyReviews, saveDailyReview, saveWeeklyReview, saveReviewNote } = useAIReviews()
  const [aiLoading, setAiLoading] = useState<'daily' | 'weekly' | null>(null)
  const [aiError, setAiError] = useState('')

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = (6 / 24) * TOTAL_HEIGHT
    }
  }, [])

  const weekTasks = useMemo(() => {
    const weekDates = new Set(days.map(formatDate))
    return tasks.filter(t => weekDates.has(t.date))
  }, [days, tasks])
  const selectedDateTasks = tasks.filter(t => t.date === selectedDate)

  const projectStats = projects
    .map(project => {
      const category = categories.find(c => c.id === project.categoryId)
      const planned = calcMinutes(weekTasks.filter(t => t.projectId === project.id && t.type === 'plan'))
      const actual = calcMinutes(weekTasks.filter(t => t.projectId === project.id && t.type === 'actual'))
      return { project, category, planned, actual, diff: actual - planned }
    })
    .filter(item => item.planned > 0 || item.actual > 0)

  const pinnedProjects = projects
    .filter(project => project.pinnedToHome)
    .sort((a, b) => {
      const aOrder = a.homeOrder ?? Number.MAX_SAFE_INTEGER
      const bOrder = b.homeOrder ?? Number.MAX_SAFE_INTEGER
      if (aOrder !== bOrder) return aOrder - bOrder
      return (b.updatedAt ?? b.createdAt ?? '').localeCompare(a.updatedAt ?? a.createdAt ?? '')
    })
    .slice(0, 3)

  const activeProjectFocus = pinnedProjects
    .map(project => {
      const category = categories.find(c => c.id === project.categoryId)
      const weekPlanned = calcMinutes(weekTasks.filter(t => t.projectId === project.id && t.type === 'plan'))
      const weekActual = calcMinutes(weekTasks.filter(t => t.projectId === project.id && t.type === 'actual'))
      const todayPlanned = calcMinutes(selectedDateTasks.filter(t => t.projectId === project.id && t.type === 'plan'))
      const todayActual = calcMinutes(selectedDateTasks.filter(t => t.projectId === project.id && t.type === 'actual'))
      const linkedProjectTasks = projectTasks.filter(task => task.projectId === project.id)
      const doneProjectTasks = linkedProjectTasks.filter(task => task.status === 'done').length
      const activeTasks = linkedProjectTasks.filter(task => task.status !== 'done').length
      const linkedDeadline = project.deadlineId
        ? deadlines.find(deadline => deadline.id === project.deadlineId && deadline.date >= selectedDate)
        : deadlines.find(deadline => deadline.projectId === project.id && deadline.date >= selectedDate)
      const statusLabel = projectStatusLabel(todayPlanned, todayActual)
      const progressBase = todayPlanned > 0
        ? todayPlanned
        : linkedProjectTasks.length > 0
          ? linkedProjectTasks.length
          : Math.max(weekActual, 1)
      const progressValue = todayPlanned > 0
        ? Math.min(todayActual / progressBase, 1)
        : linkedProjectTasks.length > 0
          ? doneProjectTasks / progressBase
          : weekActual > 0 ? 1 : 0
      return {
        project,
        category,
        weekPlanned,
        weekActual,
        todayPlanned,
        todayActual,
        linkedProjectTasks,
        doneProjectTasks,
        activeTasks,
        linkedDeadline,
        statusLabel,
        progressValue,
      }
    })

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

  const selectedDayCategoryTotals = buildTotals(categories, selectedDateTasks, task => task.categoryId)
  const selectedDayProjectTotals = buildTotals(projects, selectedDateTasks, task => task.projectId)
  const selectedDayDeviations = sortByDeviation(
    selectedDayProjectTotals.length > 0 ? selectedDayProjectTotals : selectedDayCategoryTotals
  ).slice(0, 5)
  const selectedActualTasks = selectedDateTasks.filter(t => t.type === 'actual')
  const selectedActualMinutes = calcMinutes(selectedActualTasks)
  const todayCategoryAllocation = categories
    .map(cat => ({
      name: cat.name,
      value: calcMinutes(selectedActualTasks.filter(t => t.categoryId === cat.id)),
      color: cat.color,
      total: selectedActualMinutes,
      ring: 'Category',
    }))
    .filter(item => item.value > 0)
  const highValueMinutes = calcMinutes(selectedActualTasks.filter(t => t.valueLevel === 'high'))
  const mediumValueMinutes = calcMinutes(selectedActualTasks.filter(t => t.valueLevel === 'medium'))
  const lowValueMinutes = calcMinutes(selectedActualTasks.filter(t => t.valueLevel === 'low'))
  const unratedValueMinutes = calcMinutes(selectedActualTasks.filter(t => !t.valueLevel))
  const hasValueData = selectedActualTasks.some(t => t.valueLevel)
  const valueAllocation = [
    { name: 'High value', value: highValueMinutes, color: '#f59e0b', total: selectedActualMinutes, ring: 'Value' },
    { name: 'Medium value', value: mediumValueMinutes, color: '#6366f1', total: selectedActualMinutes, ring: 'Value' },
    { name: 'Low value', value: lowValueMinutes, color: '#9ca3af', total: selectedActualMinutes, ring: 'Value' },
    { name: 'Unrated', value: unratedValueMinutes, color: '#e5e7eb', total: selectedActualMinutes, ring: 'Value' },
  ].filter(item => item.value > 0)
  const hasEnergyData = selectedActualTasks.some(t => t.energyLevel)
  const goldenMinutes = calcMinutes(selectedActualTasks.filter(t => t.energyLevel === 'high' && t.valueLevel === 'high'))
  const primeWasteMinutes = calcMinutes(selectedActualTasks.filter(t => t.energyLevel === 'high' && t.valueLevel === 'low'))

  const dailyAIResult = dailyReviews[selectedDate]
  const weeklyAIResult = weeklyReviews[weekKey]
  const weekDailyNotes = days
    .map(d => {
      const date = formatDate(d)
      return { date, userNote: dailyReviews[date]?.userNote ?? '' }
    })
    .filter(item => item.userNote)

  const buildDailyData = (): DailyReviewData => ({
    date: selectedDate,
    plannedTasks: selectedDateTasks
      .filter(t => t.type === 'plan')
      .map(t => taskToReviewTask(t, categories, projects)),
    actualTasks: selectedDateTasks
      .filter(t => t.type === 'actual')
      .map(t => taskToReviewTask(t, categories, projects)),
    categoryTotals: selectedDayCategoryTotals,
    projectTotals: selectedDayProjectTotals,
    biggestDeviations: selectedDayDeviations,
    userNote: dailyAIResult?.userNote,
  })

  const buildWeeklyData = (): WeeklyReviewData => {
    return {
      weekStart: weekKey,
      weekEnd,
      tasks: weekTasks.map(t => taskToReviewTask(t, categories, projects)),
      categoryAllocation: categoryDeviationStats.map(item => ({
        name: item.label,
        planned: item.planned,
        actual: item.actual,
        diff: item.diff,
      })),
      topProjects: projectStats
        .map(item => ({ name: item.project.name, planned: item.planned, actual: item.actual, diff: item.diff }))
        .sort((a, b) => b.actual - a.actual)
        .slice(0, 5),
      biggestDeviations: deviationStats.map(item => ({
        name: item.label,
        planned: item.planned,
        actual: item.actual,
        diff: item.diff,
      })),
      dailyNotes: weekDailyNotes,
      userNote: weeklyAIResult?.userNote,
    }
  }

  const handleGenerateDailyReview = async () => {
    setAiLoading('daily')
    setAiError('')
    try {
      const result = await generateDailyReview(buildDailyData())
      saveDailyReview(selectedDate, result)
    } catch {
      setAiError('Daily review generation failed.')
    } finally {
      setAiLoading(null)
    }
  }

  const handleGenerateWeeklyReview = async () => {
    setAiLoading('weekly')
    setAiError('')
    try {
      const result = await generateWeeklyReview(buildWeeklyData())
      saveWeeklyReview(weekKey, weekEnd, result)
    } catch {
      setAiError('Weekly review generation failed.')
    } finally {
      setAiLoading(null)
    }
  }

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
        <section className="dashboard-card ai-review-module">
          <h2>AI Review</h2>
          <div className="ai-action-row">
            <button
              className="ghost-button"
              onClick={handleGenerateDailyReview}
              disabled={aiLoading !== null}
            >
              {aiLoading === 'daily' ? 'Generating...' : 'Generate Daily Review'}
            </button>
            <button
              className="ghost-button"
              onClick={handleGenerateWeeklyReview}
              disabled={aiLoading !== null}
            >
              {aiLoading === 'weekly' ? 'Generating...' : 'Generate Weekly Review'}
            </button>
          </div>
          {aiError && <p className="ai-error">{aiError}</p>}
          <div className="ai-review-list">
            <AIReviewCard
              title={`Daily Review (${selectedDate})`}
              review={dailyAIResult}
              emptyText="Generate a daily review for the selected date."
              onSaveNote={saveReviewNote}
            />
            <AIReviewCard
              title={`Weekly Review (${formatWeekRange(weekStart, days[days.length - 1])})`}
              review={weeklyAIResult}
              emptyText="Generate a weekly review for this week."
              onSaveNote={saveReviewNote}
            />
          </div>
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
          <div className="analytics-title-row">
            <h2>Today Analytics</h2>
            <span
              className="analytics-info"
              title="Outer ring: category allocation. Inner ring: value distribution. Golden: high energy + high value. Prime Waste: high energy + low value."
            >
              i
            </span>
          </div>
          {todayCategoryAllocation.length === 0 ? (
            <p className="empty-state">No actual time recorded for this day</p>
          ) : (
            <div className="today-analytics">
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={todayCategoryAllocation}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={hasValueData ? 64 : 48}
                    outerRadius={78}
                    paddingAngle={2}
                    stroke="#fff"
                    strokeWidth={2}
                  >
                    {todayCategoryAllocation.map(item => (
                      <Cell key={item.name} fill={item.color} />
                    ))}
                  </Pie>
                  {hasValueData && (
                    <Pie
                      data={valueAllocation}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={39}
                      outerRadius={55}
                      paddingAngle={2}
                      stroke="#fff"
                      strokeWidth={2}
                    >
                      {valueAllocation.map(item => (
                        <Cell key={item.name} fill={item.color} />
                      ))}
                    </Pie>
                  )}
                  <Tooltip content={<TodayAnalyticsTooltip />} />
                  <text x="50%" y="48%" textAnchor="middle" className="donut-center-value">
                    {hasValueData ? fmtHoursAbs(highValueMinutes) : 'No'}
                  </text>
                  <text x="50%" y="59%" textAnchor="middle" className="donut-center-label">
                    {hasValueData ? 'High-value' : 'value data'}
                  </text>
                </PieChart>
              </ResponsiveContainer>
              {hasEnergyData && (
                <div className="analytics-chip-row quality-only">
                  <span className="analytics-chip golden-chip" title="High energy + high value">
                    <span aria-hidden="true">&#9889;</span>Golden: {fmtHoursAbs(goldenMinutes)}
                  </span>
                  <span className="analytics-chip waste-chip" title="High energy + low value">
                    <span aria-hidden="true">&#128293;</span>Prime Waste: {fmtHoursAbs(primeWasteMinutes)}
                  </span>
                </div>
              )}
            </div>
          )}
        </section>

        <section className="dashboard-card">
          <h2>Project Focus</h2>
          {activeProjectFocus.length === 0 ? (
            <p className="empty-state">No project focus yet. Pin up to 3 projects from the Projects page.</p>
          ) : (
            <div className="project-focus-list">
              {activeProjectFocus.map(item => (
                <div key={item.project.id} className="project-focus-row">
                  <div className="project-focus-top">
                    <div className="project-focus-name">
                      <span className="color-dot" style={{ background: item.category?.color ?? '#9ca3af' }} />
                      <span>{item.project.name}</span>
                    </div>
                    <strong>{fmtHoursAbs(item.weekActual)}</strong>
                  </div>
                  <div className="project-focus-meta">
                    {item.todayPlanned > 0 && (
                      <span>Today {fmtHoursAbs(item.todayActual)} / {fmtHoursAbs(item.todayPlanned)}</span>
                    )}
                    <span>Tasks {item.doneProjectTasks}/{item.linkedProjectTasks.length}</span>
                    {item.linkedDeadline && <span>Due {item.linkedDeadline.date}</span>}
                  </div>
                  <div className="project-focus-bottom">
                    <div
                      className="progress-track project-focus-track"
                      title="Today progress, or project task progress when no time is planned today"
                    >
                      <div
                        className="progress-fill"
                        style={{
                          width: `${Math.max(item.progressValue * 100, item.progressValue > 0 ? 4 : 0)}%`,
                          background: item.category?.color ?? '#6366f1',
                        }}
                      />
                    </div>
                    {item.statusLabel && (
                      <span className={`project-focus-status ${item.statusLabel === 'Not started' ? 'idle' : 'active'}`}>
                        {item.statusLabel}
                      </span>
                    )}
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

function AIReviewCard({
  title,
  review,
  emptyText,
  onSaveNote,
}: {
  title: string
  review?: AIReview
  emptyText: string
  onSaveNote: (review: AIReview, userNote: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [editingNote, setEditingNote] = useState(false)
  const [draftNote, setDraftNote] = useState('')
  const hasLongContent = Boolean(review && review.aiContent.length > 360)
  const displayedContent = review && !expanded && hasLongContent
    ? `${review.aiContent.slice(0, 360).trim()}...`
    : review?.aiContent

  const startEditing = () => {
    setDraftNote(review?.userNote ?? '')
    setEditingNote(true)
  }

  const cancelEditing = () => {
    setDraftNote(review?.userNote ?? '')
    setEditingNote(false)
  }

  const saveNote = () => {
    if (!review) return
    onSaveNote(review, draftNote)
    setEditingNote(false)
  }

  return (
    <article className="ai-review-card">
      <div className="ai-review-card-header">
        <div>
          <h3>{title}</h3>
          {review && <small>{new Date(review.updatedAt ?? review.createdAt).toLocaleString()}</small>}
        </div>
        {review && (
          <button className="text-button" onClick={startEditing}>
            {review.userNote ? 'Edit Note' : 'Add Note'}
          </button>
        )}
      </div>

      {review ? (
        <>
          <pre className="ai-review-content">{displayedContent}</pre>
          {hasLongContent && (
            <button className="text-button inline" onClick={() => setExpanded(prev => !prev)}>
              {expanded ? 'Collapse' : 'Expand'}
            </button>
          )}

          {editingNote ? (
            <div className="ai-note-editor">
              <textarea
                className="review-textarea tall"
                value={draftNote}
                onChange={e => setDraftNote(e.target.value)}
                placeholder="Add context, correction, or next adjustment..."
              />
              <div className="note-action-row">
                <button className="ghost-button compact" onClick={cancelEditing}>Cancel</button>
                <button className="primary-button compact" onClick={saveNote}>Save</button>
              </div>
            </div>
          ) : review.userNote ? (
            <div className="ai-note-preview">
              {review.userNote.length > 120 ? `${review.userNote.slice(0, 120).trim()}...` : review.userNote}
            </div>
          ) : null}
        </>
      ) : (
        <p className="empty-state">{emptyText}</p>
      )}
    </article>
  )
}

function TodayAnalyticsTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{
    payload?: {
      name: string
      value: number
      total: number
      ring: string
    }
  }>
}) {
  const item = payload?.[0]?.payload
  if (!active || !item) return null

  const percent = item.total > 0 ? Math.round((item.value / item.total) * 100) : 0
  return (
    <div className="analytics-tooltip">
      <strong>{item.name}</strong>
      <span>{item.ring}</span>
      <span>{fmtHoursAbs(item.value)} · {percent}%</span>
    </div>
  )
}
