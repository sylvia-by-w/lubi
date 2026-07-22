import { useMemo, useState } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { TaskBlock, Category, Project, Deadline } from '../types'
import { formatDate, timeToMinutes } from '../utils/time'
import { useLanguage } from '../i18n/LanguageContext'

type TFunc = (path: string, vars?: Record<string, string | number>) => string

interface Props {
  tasks: TaskBlock[]
  categories: Category[]
  projects: Project[]
  deadlines: Deadline[]
}

type Range = 'today' | 'thisWeek' | 'lastWeek' | 'thisMonth' | 'custom'
type DataType = 'actual' | 'plan' | 'both'
type GroupBy = 'category' | 'project' | 'valueLevel' | 'energyLevel'
type AllocationChartType = 'donut' | 'pie' | 'bar'
type TrendChartType = 'line' | 'bar' | 'area'
type HeatmapMetric = 'highValue' | 'golden' | 'waste' | 'productiveRatio' | 'actual'
type LongTermGroupBy = 'category' | 'project' | 'valueLevel' | 'energyValue'
type LongTermGranularity = 'day' | 'week' | 'month'
type ChartRow = Record<string, string | number>

const valueColors: Record<string, string> = {
  high: '#f59e0b',
  medium: '#6366f1',
  low: '#9ca3af',
  unrated: '#e5e7eb',
}

const energyColors: Record<string, string> = {
  high: '#ef4444',
  medium: '#3b82f6',
  low: '#9ca3af',
  unrated: '#e5e7eb',
}

function levelName(level: string, t: TFunc): string {
  if (level === 'high') return t('common.high')
  if (level === 'medium') return t('common.medium')
  if (level === 'low') return t('common.low')
  return t('weeklyView.unrated')
}

function weekdayName(index: number, lang: string): string {
  if (lang === 'en') return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][index]
  return ['周一', '周二', '周三', '周四', '周五', '周六', '周日'][index]
}

function heatmapMetricLabel(metric: HeatmapMetric, t: TFunc): string {
  if (metric === 'highValue') return t('statistics.metricHighValue')
  if (metric === 'golden') return t('statistics.metricGolden')
  if (metric === 'waste') return t('statistics.metricWaste')
  if (metric === 'productiveRatio') return t('statistics.metricProductiveRatio')
  return t('statistics.metricActual')
}

const heatmapScales: Record<HeatmapMetric, string[]> = {
  highValue: ['#f3f4f6', '#dcfce7', '#86efac', '#22c55e', '#166534'],
  golden: ['#f3f4f6', '#dcfce7', '#86efac', '#22c55e', '#166534'],
  actual: ['#f3f4f6', '#dcfce7', '#86efac', '#22c55e', '#166534'],
  waste: ['#f3f4f6', '#ffedd5', '#fdba74', '#f97316', '#c2410c'],
  productiveRatio: ['#f3f4f6', '#e0e7ff', '#a5b4fc', '#6366f1', '#4338ca'],
}

function monthLabel(index: number, lang: string): string {
  if (lang === 'en') return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][index]
  return `${index + 1}月`
}

function energyValueGroups(t: TFunc) {
  return [
    { id: 'goldenTime', name: t('statistics.metricGolden'), color: '#f59e0b' },
    { id: 'otherHighValue', name: t('statistics.otherHighValue'), color: '#60a5fa' },
    { id: 'primeWaste', name: t('statistics.primeWaste'), color: '#ef4444' },
    { id: 'otherLowValue', name: t('statistics.otherLowValue'), color: '#9ca3af' },
    { id: 'neutralUnrated', name: t('statistics.neutralUnrated'), color: '#e5e7eb' },
  ]
}

function fmt(d: Date) {
  return formatDate(d)
}

function getRange(range: Range, customStart: string, customEnd: string): { start: string; end: string } {
  const now = new Date()
  const day = now.getDay()
  const diff = day === 0 ? -6 : 1 - day

  if (range === 'today') return { start: fmt(now), end: fmt(now) }
  if (range === 'custom') return { start: customStart || fmt(now), end: customEnd || customStart || fmt(now) }

  if (range === 'thisWeek') {
    const start = new Date(now)
    start.setDate(now.getDate() + diff)
    const end = new Date(start)
    end.setDate(start.getDate() + 6)
    return { start: fmt(start), end: fmt(end) }
  }

  if (range === 'lastWeek') {
    const start = new Date(now)
    start.setDate(now.getDate() + diff - 7)
    const end = new Date(start)
    end.setDate(start.getDate() + 6)
    return { start: fmt(start), end: fmt(end) }
  }

  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return { start: fmt(start), end: fmt(end) }
}

function dateRange(start: string, end: string) {
  const dates: string[] = []
  const current = new Date(`${start}T00:00:00`)
  const last = new Date(`${end}T00:00:00`)
  while (current <= last) {
    dates.push(fmt(current))
    current.setDate(current.getDate() + 1)
  }
  return dates
}

function calcMinutes(tasks: TaskBlock[]) {
  return tasks.reduce((sum, task) => sum + timeToMinutes(task.endTime) - timeToMinutes(task.startTime), 0)
}

function fmtHours(min: number, t: TFunc) {
  const h = Math.floor(Math.abs(min) / 60)
  const m = Math.abs(min) % 60
  const sign = min < 0 ? '-' : '+'
  return m === 0 ? `${sign}${t('common.durationHours', { h })}` : `${sign}${t('common.hoursMinutesShort', { h, m })}`
}

function fmtHoursAbs(min: number, t: TFunc) {
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h === 0) return t('common.minutesShort', { m })
  return m === 0 ? t('common.durationHours', { h }) : t('common.hoursMinutesShort', { h, m })
}

function chartValue(min: number) {
  return Math.round((min / 60) * 100) / 100
}

function downloadCsv(filename: string, rows: Array<Record<string, string | number>>) {
  if (rows.length === 0) return
  const headers = Object.keys(rows[0])
  const escape = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`
  const csv = [headers.join(','), ...rows.map(row => headers.map(header => escape(row[header])).join(','))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function groupKey(task: TaskBlock, groupBy: GroupBy, categories: Category[], projects: Project[], t: TFunc) {
  if (groupBy === 'category') {
    const category = categories.find(item => item.id === task.categoryId)
    return { id: task.categoryId, name: category?.name ?? t('statistics.unknown'), color: category?.color ?? '#9ca3af' }
  }
  if (groupBy === 'project') {
    const project = task.projectId ? projects.find(item => item.id === task.projectId) : undefined
    const category = project ? categories.find(item => item.id === project.categoryId) : undefined
    return { id: task.projectId ?? 'none', name: project?.name ?? t('board.noProjectRow'), color: category?.color ?? '#9ca3af' }
  }
  if (groupBy === 'valueLevel') {
    const level = task.valueLevel ?? 'unrated'
    return { id: level, name: levelName(level, t), color: valueColors[level] }
  }
  const level = task.energyLevel ?? 'unrated'
  return { id: level, name: levelName(level, t), color: energyColors[level] }
}

function isWasteCategory(task: TaskBlock, categories: Category[]) {
  const category = categories.find(item => item.id === task.categoryId)
  return category?.name.toLowerCase() === 'waste'
}

function mondayWeekdayIndex(date: string) {
  const day = new Date(`${date}T00:00:00`).getDay()
  return (day + 6) % 7
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(date.getDate() + days)
  return next
}

function sameYear(date: Date, year: number) {
  return date.getFullYear() === year
}

function metricLevel(metric: HeatmapMetric, minutes: number, ratio: number) {
  if (metric === 'productiveRatio') {
    if (ratio <= 0) return 0
    if (ratio < 0.25) return 1
    if (ratio < 0.5) return 2
    if (ratio < 0.75) return 3
    return 4
  }
  if (minutes <= 0) return 0
  if (minutes < 60) return 1
  if (minutes < 180) return 2
  if (minutes < 360) return 3
  return 4
}

function heatmapValueText(metric: HeatmapMetric, minutes: number, ratio: number, t: TFunc) {
  if (metric === 'productiveRatio') return `${Math.round(ratio * 100)}%`
  return fmtHoursAbs(minutes, t)
}

function periodStart(date: string, granularity: LongTermGranularity) {
  const source = new Date(`${date}T00:00:00`)
  if (granularity === 'day') return source
  if (granularity === 'week') return addDays(source, -mondayWeekdayIndex(date))
  return new Date(source.getFullYear(), source.getMonth(), 1)
}

function periodEnd(date: Date, granularity: LongTermGranularity) {
  if (granularity === 'day') return date
  if (granularity === 'week') return addDays(date, 6)
  return new Date(date.getFullYear(), date.getMonth() + 1, 0)
}

function nextPeriod(date: Date, granularity: LongTermGranularity) {
  if (granularity === 'day') return addDays(date, 1)
  if (granularity === 'week') return addDays(date, 7)
  return new Date(date.getFullYear(), date.getMonth() + 1, 1)
}

function periodLabel(date: Date, granularity: LongTermGranularity) {
  if (granularity === 'month') return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
  return fmt(date)
}

function stableColor(id: string) {
  const colors = ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#14b8a6', '#f97316']
  const hash = [...id].reduce((sum, char) => sum + char.charCodeAt(0), 0)
  return colors[hash % colors.length]
}

function longTermGroupKey(task: TaskBlock, groupBy: LongTermGroupBy, categories: Category[], projects: Project[], t: TFunc) {
  if (groupBy === 'category') {
    const category = categories.find(item => item.id === task.categoryId)
    return { id: task.categoryId, name: category?.name ?? t('statistics.unknown'), color: category?.color ?? stableColor(task.categoryId) }
  }

  if (groupBy === 'project') {
    const project = task.projectId ? projects.find(item => item.id === task.projectId) : undefined
    const category = project ? categories.find(item => item.id === project.categoryId) : undefined
    const id = task.projectId ?? 'noProject'
    return { id, name: project?.name ?? t('board.noProjectRow'), color: category?.color ?? stableColor(id) }
  }

  if (groupBy === 'valueLevel') {
    const level = task.valueLevel ?? 'unrated'
    const names: Record<string, string> = {
      high: t('weeklyView.highValue'),
      medium: t('weeklyView.mediumValue'),
      low: t('weeklyView.lowValue'),
      unrated: t('weeklyView.unrated'),
    }
    return { id: level, name: names[level], color: valueColors[level] }
  }

  const groups = energyValueGroups(t)
  if (task.energyLevel === 'high' && task.valueLevel === 'high') return groups[0]
  if (task.valueLevel === 'high') return groups[1]
  if (task.energyLevel === 'high' && task.valueLevel === 'low') return groups[2]
  if (task.valueLevel === 'low') return groups[3]
  return groups[4]
}

export default function Statistics({ tasks, categories, projects, deadlines }: Props) {
  const { t, lang } = useLanguage()
  const tooltipHoursFormatter = (value: unknown) => fmtHoursAbs(Math.round(Number(value ?? 0) * 60), t)
  const today = fmt(new Date())
  const [range, setRange] = useState<Range>('thisWeek')
  const [customStart, setCustomStart] = useState(today)
  const [customEnd, setCustomEnd] = useState(today)
  const [dataType, setDataType] = useState<DataType>('actual')
  const [groupBy, setGroupBy] = useState<GroupBy>('category')
  const [projectFilter, setProjectFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [allocationType, setAllocationType] = useState<AllocationChartType>('donut')
  const [trendType, setTrendType] = useState<TrendChartType>('line')
  const [heatmapMetric, setHeatmapMetric] = useState<HeatmapMetric>('highValue')
  const [heatmapYear, setHeatmapYear] = useState(new Date().getFullYear())
  const [longTermGroupBy, setLongTermGroupBy] = useState<LongTermGroupBy>('valueLevel')
  const [longTermGranularity, setLongTermGranularity] = useState<LongTermGranularity>('week')
  const [longTermDataType, setLongTermDataType] = useState<DataType>('actual')
  const [showDeadlines, setShowDeadlines] = useState(true)
  const { start, end } = getRange(range, customStart, customEnd)

  const scoped = useMemo(() => tasks.filter(task => {
    if (task.date < start || task.date > end) return false
    if (projectFilter && task.projectId !== projectFilter) return false
    if (categoryFilter && task.categoryId !== categoryFilter) return false
    if (dataType !== 'both' && task.type !== dataType) return false
    return true
  }), [categoryFilter, dataType, end, projectFilter, start, tasks])

  const periodTasks = tasks.filter(task => task.date >= start && task.date <= end)
  const filteredBase = periodTasks.filter(task =>
    (!projectFilter || task.projectId === projectFilter) &&
    (!categoryFilter || task.categoryId === categoryFilter)
  )

  const actualMinutes = calcMinutes(filteredBase.filter(task => task.type === 'actual'))
  const plannedMinutes = calcMinutes(filteredBase.filter(task => task.type === 'plan'))
  const highValueMinutes = calcMinutes(filteredBase.filter(task => task.type === 'actual' && task.valueLevel === 'high'))
  const goldenMinutes = calcMinutes(filteredBase.filter(task => task.type === 'actual' && task.valueLevel === 'high' && task.energyLevel === 'high'))
  const wasteMinutes = calcMinutes(filteredBase.filter(task => task.type === 'actual' && task.valueLevel === 'low'))

  const allocationData = Array.from(scoped.reduce((map, task) => {
    const key = groupKey(task, groupBy, categories, projects, t)
    const existing = map.get(key.id) ?? { id: key.id, name: key.name, value: 0, color: key.color }
    existing.value += timeToMinutes(task.endTime) - timeToMinutes(task.startTime)
    map.set(key.id, existing)
    return map
  }, new Map<string, { id: string; name: string; value: number; color: string }>()).values())
    .filter(item => item.value > 0)
    .map(item => ({ ...item, hours: chartValue(item.value) }))
    .sort((a, b) => b.value - a.value)

  const dates = dateRange(start, end)
  const trendData = dates.map(date => {
    const dayTasks = filteredBase.filter(task => task.date === date)
    return {
      date,
      actual: chartValue(calcMinutes(dayTasks.filter(task => task.type === 'actual'))),
      planned: chartValue(calcMinutes(dayTasks.filter(task => task.type === 'plan'))),
      highValue: chartValue(calcMinutes(dayTasks.filter(task => task.type === 'actual' && task.valueLevel === 'high'))),
      waste: chartValue(calcMinutes(dayTasks.filter(task => task.type === 'actual' && task.valueLevel === 'low'))),
    }
  })

  const byCat = categories.map(cat => {
    const relevant = filteredBase.filter(task => task.categoryId === cat.id)
    const planned = calcMinutes(relevant.filter(task => task.type === 'plan'))
    const actual = calcMinutes(relevant.filter(task => task.type === 'actual'))
    return { cat, planned, actual, diff: actual - planned }
  }).filter(row => row.planned > 0 || row.actual > 0)

  const byProj = projects.map(proj => {
    const relevant = filteredBase.filter(task => task.projectId === proj.id)
    const planned = calcMinutes(relevant.filter(task => task.type === 'plan'))
    const actual = calcMinutes(relevant.filter(task => task.type === 'actual'))
    const cat = categories.find(item => item.id === proj.categoryId)
    return { proj, cat, planned, actual, diff: actual - planned }
  }).filter(row => row.planned > 0 || row.actual > 0)

  const plannedVsActual = (groupBy === 'project' ? byProj : byCat).map(row => ({
    name: 'proj' in row ? row.proj.name : row.cat.name,
    planned: chartValue(row.planned),
    actual: chartValue(row.actual),
  })).slice(0, 12)

  const projectRanking = byProj
    .map(row => ({ name: row.proj.name, actual: chartValue(row.actual), color: row.cat?.color ?? '#9ca3af' }))
    .sort((a, b) => b.actual - a.actual)
    .slice(0, 8)

  const availableYears = Array.from(new Set([
    new Date().getFullYear(),
    ...tasks.map(task => Number(task.date.slice(0, 4))).filter(Boolean),
  ])).sort((a, b) => b - a)

  const yearHeatmap = (() => {
    const yearStart = new Date(heatmapYear, 0, 1)
    const yearEnd = new Date(heatmapYear, 11, 31)
    const firstGridDate = addDays(yearStart, -mondayWeekdayIndex(fmt(yearStart)))
    const lastGridDate = addDays(yearEnd, 6 - mondayWeekdayIndex(fmt(yearEnd)))
    const weekCount = Math.round((lastGridDate.getTime() - firstGridDate.getTime()) / 604800000) + 1
    const todayDate = new Date(`${today}T00:00:00`)

    const byDate = new Map<string, { actual: number; highValue: number; golden: number; waste: number }>()
    tasks
      .filter(task => task.type === 'actual' && Number(task.date.slice(0, 4)) === heatmapYear)
      .forEach(task => {
        const minutes = timeToMinutes(task.endTime) - timeToMinutes(task.startTime)
        const entry = byDate.get(task.date) ?? { actual: 0, highValue: 0, golden: 0, waste: 0 }
        entry.actual += minutes
        if (task.valueLevel === 'high') entry.highValue += minutes
        if (task.valueLevel === 'high' && task.energyLevel === 'high') entry.golden += minutes
        if (task.valueLevel === 'low' || isWasteCategory(task, categories)) entry.waste += minutes
        byDate.set(task.date, entry)
      })

    const cells = Array.from({ length: weekCount }, (_, week) => (
      Array.from({ length: 7 }, (_, day) => {
        const date = addDays(firstGridDate, week * 7 + day)
        const dateStr = fmt(date)
        const stats = byDate.get(dateStr) ?? { actual: 0, highValue: 0, golden: 0, waste: 0 }
        const isInYear = sameYear(date, heatmapYear)
        const isFuture = heatmapYear === todayDate.getFullYear() && date > todayDate
        const ratio = stats.actual > 0 ? stats.highValue / stats.actual : 0
        const minutes = heatmapMetric === 'productiveRatio' ? stats.actual : stats[heatmapMetric]
        const level = isInYear && !isFuture ? metricLevel(heatmapMetric, minutes, ratio) : 0
        return { date, dateStr, stats, ratio, level, isInYear, isFuture }
      })
    ))

    const monthMarkers = Array.from({ length: 12 }, (_, month) => {
      const first = new Date(heatmapYear, month, 1)
      const column = Math.floor((first.getTime() - firstGridDate.getTime()) / 604800000) + 2
      return { month, column }
    })

    return { cells, monthMarkers, weekCount }
  })()

  const heatmapHasData = yearHeatmap.cells.some(week => week.some(cell => cell.isInYear && cell.stats.actual > 0))
  const heatmapCsv = yearHeatmap.cells.flatMap(week => week)
    .filter(cell => cell.isInYear)
    .map(cell => ({
      [t('statistics.csvDate')]: cell.dateStr,
      [t('statistics.csvWeekday')]: weekdayName(mondayWeekdayIndex(cell.dateStr), lang),
      [t('statistics.csvMetric')]: heatmapMetricLabel(heatmapMetric, t),
      [t('statistics.csvMetricValue')]: heatmapValueText(
        heatmapMetric,
        heatmapMetric === 'productiveRatio' ? cell.stats.actual : cell.stats[heatmapMetric],
        cell.ratio,
        t
      ),
      [t('statistics.csvActualMinutes')]: cell.stats.actual,
      [t('statistics.csvHighValueMinutes')]: cell.stats.highValue,
      [t('statistics.csvGoldenMinutes')]: cell.stats.golden,
      [t('statistics.csvWasteMinutes')]: cell.stats.waste,
      [t('statistics.csvProductiveRatio')]: Math.round(cell.ratio * 100),
    }))

  const longTerm = (() => {
    const groupMap = new Map<string, { id: string; name: string; color: string }>()
    const firstPeriod = periodStart(start, longTermGranularity)
    const lastPeriod = periodStart(end, longTermGranularity)
    const rows: ChartRow[] = []

    for (let cursor = firstPeriod; cursor <= lastPeriod; cursor = nextPeriod(cursor, longTermGranularity)) {
      const label = periodLabel(cursor, longTermGranularity)
      rows.push({
        period: label,
        periodStart: fmt(cursor),
        periodEnd: fmt(periodEnd(cursor, longTermGranularity)),
        totalMinutes: 0,
      })
    }

    const rowByPeriod = new Map(rows.map(row => [row.period, row]))

    filteredBase
      .filter(task => longTermDataType === 'both' || task.type === longTermDataType)
      .forEach(task => {
        const group = longTermGroupKey(task, longTermGroupBy, categories, projects, t)
        groupMap.set(group.id, group)
        const key = periodLabel(periodStart(task.date, longTermGranularity), longTermGranularity)
        const row = rowByPeriod.get(key)
        if (!row) return
        const minutes = timeToMinutes(task.endTime) - timeToMinutes(task.startTime)
        row[group.id] = Number(row[group.id] ?? 0) + chartValue(minutes)
        row.totalMinutes = Number(row.totalMinutes) + minutes
      })

    const groups = Array.from(groupMap.values())
    const chartRows: ChartRow[] = rows.map(row => {
      const nextRow: ChartRow = { ...row, totalHours: chartValue(Number(row.totalMinutes)) }
      groups.forEach(group => {
        nextRow[group.id] = Number(nextRow[group.id] ?? 0)
      })
      return nextRow
    })
    return { rows: chartRows, groups }
  })()

  const longTermHasData = longTerm.rows.some(row => Number(row.totalMinutes) > 0)
  const longTermDeadlines = showDeadlines
    ? deadlines
      .filter(deadline => deadline.date >= start && deadline.date <= end)
      .map(deadline => {
        const project = deadline.projectId ? projects.find(item => item.id === deadline.projectId) : undefined
        return {
          ...deadline,
          period: periodLabel(periodStart(deadline.date, longTermGranularity), longTermGranularity),
          label: project ? `${deadline.title} - ${project.name}` : deadline.title,
        }
      })
    : []
  const longTermCsv = longTerm.rows.flatMap(row => {
    const totalMinutes = Number(row.totalMinutes)
    return longTerm.groups.map(group => {
      const hours = Number(row[group.id] ?? 0)
      const minutes = Math.round(hours * 60)
      return {
        [t('statistics.csvPeriod')]: String(row.period),
        [t('statistics.csvStartDate')]: String(row.periodStart),
        [t('statistics.csvEndDate')]: String(row.periodEnd),
        [t('statistics.csvGroup')]: group.name,
        [t('statistics.csvMinutes')]: minutes,
        [t('statistics.csvHours')]: hours,
        [t('statistics.csvPercentage')]: totalMinutes > 0 ? Math.round((minutes / totalMinutes) * 100) : 0,
      }
    })
  })

  const rangeOptions: { value: Range; label: string }[] = [
    { value: 'today', label: t('statistics.rangeToday') },
    { value: 'thisWeek', label: t('statistics.rangeThisWeek') },
    { value: 'lastWeek', label: t('statistics.rangeLastWeek') },
    { value: 'thisMonth', label: t('statistics.rangeThisMonth') },
    { value: 'custom', label: t('statistics.rangeCustom') },
  ]

  const allocationCsv = allocationData.map(row => ({ [t('statistics.csvName')]: row.name, [t('statistics.csvMinutes')]: row.value, [t('statistics.csvHours')]: row.hours }))
  const trendCsv = trendData.map(row => ({ [t('statistics.csvDate')]: row.date, [t('statistics.actual')]: row.actual, [t('taskModal.plan')]: row.planned, [t('weeklyView.highValue')]: row.highValue, [t('statistics.wasteLabel')]: row.waste }))
  const plannedActualCsv = plannedVsActual.map(row => ({ [t('statistics.csvName')]: row.name, [t('taskModal.plan')]: row.planned, [t('statistics.actual')]: row.actual }))
  const rankingCsv = projectRanking.map(row => ({ [t('statistics.csvName')]: row.name, [t('statistics.actual')]: row.actual }))

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>{t('nav.statistics')}</h1>
          <p style={styles.subtitle}>{start} - {end}</p>
        </div>
      </div>

      <div style={styles.panel}>
        <div style={styles.filterBlock}>
          <span style={styles.filterLabel}>{t('statistics.timeRangeLabel')}</span>
          <div style={styles.rangeRow}>
            {rangeOptions.map(option => (
              <button
                key={option.value}
                style={{ ...styles.rangeBtn, ...(range === option.value ? styles.rangeBtnActive : {}) }}
                onClick={() => setRange(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {range === 'custom' && (
          <div style={styles.filterGrid}>
            <label style={styles.label}>{t('statistics.startLabel')}<input style={styles.input} type="date" value={customStart} onChange={event => setCustomStart(event.target.value)} /></label>
            <label style={styles.label}>{t('statistics.endLabel')}<input style={styles.input} type="date" value={customEnd} onChange={event => setCustomEnd(event.target.value)} /></label>
          </div>
        )}

        <div style={styles.filterGrid}>
          <label style={styles.label}>{t('statistics.dataTypeLabel')}
            <select style={styles.input} value={dataType} onChange={event => setDataType(event.target.value as DataType)}>
              <option value="actual">{t('statistics.actual')}</option>
              <option value="plan">{t('taskModal.plan')}</option>
              <option value="both">{t('statistics.both')}</option>
            </select>
          </label>
          <label style={styles.label}>{t('statistics.groupByLabel')}
            <select style={styles.input} value={groupBy} onChange={event => setGroupBy(event.target.value as GroupBy)}>
              <option value="category">{t('deadlineModal.category')}</option>
              <option value="project">{t('board.projectColumn')}</option>
              <option value="valueLevel">{t('statistics.groupValueLevel')}</option>
              <option value="energyLevel">{t('statistics.groupEnergyLevel')}</option>
            </select>
          </label>
          <label style={styles.label}>{t('board.projectColumn')}
            <select style={styles.input} value={projectFilter} onChange={event => setProjectFilter(event.target.value)}>
              <option value="">{t('statistics.allProjects')}</option>
              {projects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}
            </select>
          </label>
          <label style={styles.label}>{t('deadlineModal.category')}
            <select style={styles.input} value={categoryFilter} onChange={event => setCategoryFilter(event.target.value)}>
              <option value="">{t('statistics.allCategories')}</option>
              {categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
          </label>
        </div>
      </div>

      <section style={styles.yearHeatmapCard}>
        <div style={styles.chartHeader}>
          <div>
            <h2 style={styles.chartTitle}>{t('statistics.yearHeatmapTitle')}</h2>
            <p style={styles.heatmapSubtitle}>{t('statistics.yearHeatmapSubtitle', { year: heatmapYear })}</p>
          </div>
          <div style={styles.chartActions}>
            <select style={styles.smallSelect} value={heatmapYear} onChange={event => setHeatmapYear(Number(event.target.value))}>
              {availableYears.map(year => <option key={year} value={year}>{year}</option>)}
            </select>
            <select style={styles.smallSelect} value={heatmapMetric} onChange={event => setHeatmapMetric(event.target.value as HeatmapMetric)}>
              <option value="highValue">{t('statistics.metricHighValue')}</option>
              <option value="golden">{t('statistics.metricGolden')}</option>
              <option value="waste">{t('statistics.metricWaste')}</option>
              <option value="productiveRatio">{t('statistics.metricProductiveRatio')}</option>
              <option value="actual">{t('statistics.metricActual')}</option>
            </select>
            <button style={styles.exportBtn} onClick={() => downloadCsv('year-heatmap.csv', heatmapCsv)}>CSV</button>
            <button style={{ ...styles.exportBtn, opacity: 0.45, cursor: 'not-allowed' }} title={t('statistics.pngExportTitle')} disabled>PNG</button>
          </div>
        </div>

        {!heatmapHasData ? (
          <div style={styles.yearHeatmapEmpty}>{t('statistics.noDataThisYear')}</div>
        ) : (
          <div style={styles.yearHeatmapScroll}>
            <div
              style={{
                ...styles.yearHeatmapMonths,
                gridTemplateColumns: `40px repeat(${yearHeatmap.weekCount}, 12px)`,
              }}
            >
              <div />
              {yearHeatmap.monthMarkers.map(marker => (
                <span key={marker.month} style={{ gridColumn: marker.column }}>{monthLabel(marker.month, lang)}</span>
              ))}
            </div>
            <div style={styles.yearHeatmapBody}>
              <div style={styles.yearHeatmapWeekdays}>
                {[0, 1, 2, 3, 4, 5, 6].map(index => (
                  <span key={index}>{index === 0 || index === 2 || index === 4 ? weekdayName(index, lang) : ''}</span>
                ))}
              </div>
              <div
                style={{
                  ...styles.yearHeatmapGrid,
                  gridTemplateColumns: `repeat(${yearHeatmap.weekCount}, 12px)`,
                }}
              >
                {yearHeatmap.cells.map((week, weekIndex) => (
                  <div key={`week-${weekIndex}`} style={styles.yearHeatmapWeek}>
                    {week.map(cell => {
                      const metricMinutes = heatmapMetric === 'productiveRatio' ? cell.stats.actual : cell.stats[heatmapMetric]
                      const tooltip = [
                        `${cell.dateStr} ${weekdayName(mondayWeekdayIndex(cell.dateStr), lang)}`,
                        `${heatmapMetricLabel(heatmapMetric, t)}: ${heatmapValueText(heatmapMetric, metricMinutes, cell.ratio, t)}`,
                        `${t('statistics.metricHighValue')}: ${fmtHoursAbs(cell.stats.highValue, t)}`,
                        `${t('statistics.metricGolden')}: ${fmtHoursAbs(cell.stats.golden, t)}`,
                        `${t('statistics.metricWaste')}: ${fmtHoursAbs(cell.stats.waste, t)}`,
                      ].join('\n')
                      return (
                        <span
                          key={cell.dateStr}
                          style={{
                            ...styles.yearHeatmapCell,
                            background: cell.isInYear ? heatmapScales[heatmapMetric][cell.level] : 'transparent',
                            borderColor: cell.isInYear ? 'var(--border)' : 'transparent',
                            opacity: cell.isFuture ? 0.42 : 1,
                          }}
                          title={cell.isInYear ? tooltip : undefined}
                        />
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>
            <div style={styles.yearHeatmapLegend}>
              <span>{t('statistics.less')}</span>
              {heatmapScales[heatmapMetric].map((color, index) => (
                <span key={color} style={{ ...styles.yearHeatmapLegendCell, background: color }} title={t('statistics.levelTooltip', { n: index })} />
              ))}
              <span>{t('statistics.more')}</span>
            </div>
          </div>
        )}
      </section>

      <div style={styles.kpiGrid}>
        <Kpi label={t('statistics.kpiTotalActual')} value={fmtHoursAbs(actualMinutes, t)} />
        <Kpi label={t('statistics.kpiTotalPlanned')} value={fmtHoursAbs(plannedMinutes, t)} />
        <Kpi label={t('statistics.kpiDiff')} value={fmtHours(actualMinutes - plannedMinutes, t)} tone={actualMinutes - plannedMinutes >= 0 ? 'good' : 'bad'} />
        <Kpi label={t('statistics.metricHighValue')} value={fmtHoursAbs(highValueMinutes, t)} />
        <Kpi label={t('statistics.metricGolden')} value={fmtHoursAbs(goldenMinutes, t)} />
        <Kpi label={t('statistics.metricWaste')} value={fmtHoursAbs(wasteMinutes, t)} tone="bad" />
      </div>

      <div style={styles.longTermWrap}>
        <ChartCard
          title={t('statistics.longTermTrend')}
          controls={
            <>
              <select style={styles.smallSelect} value={longTermGroupBy} onChange={event => setLongTermGroupBy(event.target.value as LongTermGroupBy)}>
                <option value="category">{t('deadlineModal.category')}</option>
                <option value="project">{t('board.projectColumn')}</option>
                <option value="valueLevel">{t('statistics.groupValueLevel')}</option>
                <option value="energyValue">{t('statistics.groupEnergyValue')}</option>
              </select>
              <select style={styles.smallSelect} value={longTermGranularity} onChange={event => setLongTermGranularity(event.target.value as LongTermGranularity)}>
                <option value="day">{t('statistics.granularityDay')}</option>
                <option value="week">{t('statistics.granularityWeek')}</option>
                <option value="month">{t('statistics.granularityMonth')}</option>
              </select>
              <select style={styles.smallSelect} value={longTermDataType} onChange={event => setLongTermDataType(event.target.value as DataType)}>
                <option value="actual">{t('statistics.actual')}</option>
                <option value="plan">{t('taskModal.plan')}</option>
                <option value="both">{t('statistics.both')}</option>
              </select>
              <button
                style={{ ...styles.segmentBtn, ...(showDeadlines ? styles.segmentBtnActive : {}) }}
                onClick={() => setShowDeadlines(value => !value)}
              >
                {t('statistics.deadlinesToggle', { state: showDeadlines ? t('statistics.on') : t('statistics.off') })}
              </button>
            </>
          }
          onCsv={() => downloadCsv('long-term-trend.csv', longTermCsv)}
        >
          {!longTermHasData ? (
            <div style={styles.longTermEmpty}>{t('statistics.noDataInRange')}</div>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart data={longTerm.rows} margin={{ top: 18, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef0f3" />
                <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={value => t('common.durationHours', { h: value })} />
                <Tooltip content={<LongTermTooltip groups={longTerm.groups} />} />
                <Legend />
                {longTerm.groups.map(group => (
                  <Area
                    key={group.id}
                    type="monotone"
                    dataKey={group.id}
                    name={group.name}
                    stackId="time"
                    stroke={group.color}
                    fill={group.color}
                    fillOpacity={0.72}
                    strokeWidth={1.5}
                  />
                ))}
                {longTermDeadlines.map((deadline, index) => (
                  <ReferenceLine
                    key={`${deadline.id}-${index}`}
                    x={deadline.period}
                    stroke="#9ca3af"
                    strokeDasharray="3 3"
                    label={{ value: deadline.label, angle: -90, position: 'insideTop', fill: '#6b7280', fontSize: 10 }}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      <div style={styles.chartGrid}>
        <ChartCard
          title={t('statistics.timeAllocation')}
          controls={
            <select style={styles.smallSelect} value={allocationType} onChange={event => setAllocationType(event.target.value as AllocationChartType)}>
              <option value="donut">{t('statistics.donutChart')}</option>
              <option value="pie">{t('statistics.pieChart')}</option>
              <option value="bar">{t('statistics.barChart')}</option>
            </select>
          }
          onCsv={() => downloadCsv('time-allocation.csv', allocationCsv)}
        >
          {allocationData.length === 0 ? <EmptyChart text={t('statistics.noChartData')} /> : allocationType === 'bar' ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={allocationData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef0f3" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={value => t('common.durationHours', { h: value })} />
                <Tooltip formatter={tooltipHoursFormatter} />
                <Bar dataKey="hours" name={t('statistics.duration')}>
                  {allocationData.map(row => <Cell key={row.id} fill={row.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={allocationData}
                  dataKey="hours"
                  nameKey="name"
                  innerRadius={allocationType === 'donut' ? 64 : 0}
                  outerRadius={92}
                  paddingAngle={2}
                >
                  {allocationData.map(row => <Cell key={row.id} fill={row.color} />)}
                </Pie>
                <Tooltip formatter={tooltipHoursFormatter} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard
          title={t('statistics.trend')}
          controls={
            <select style={styles.smallSelect} value={trendType} onChange={event => setTrendType(event.target.value as TrendChartType)}>
              <option value="line">{t('statistics.lineChart')}</option>
              <option value="bar">{t('statistics.barChart')}</option>
              <option value="area">{t('statistics.areaChart')}</option>
            </select>
          }
          onCsv={() => downloadCsv('trend.csv', trendCsv)}
        >
          <ResponsiveContainer width="100%" height={260}>
            {trendType === 'bar' ? (
              <BarChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef0f3" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={value => t('common.durationHours', { h: value })} />
                <Tooltip formatter={tooltipHoursFormatter} />
                <Legend />
                <Bar dataKey="actual" name={t('statistics.actual')} fill="var(--primary)" />
                <Bar dataKey="planned" name={t('taskModal.plan')} fill="#93c5fd" />
                <Bar dataKey="highValue" name={t('weeklyView.highValue')} fill="var(--golden)" />
                <Bar dataKey="waste" name={t('statistics.wasteLabel')} fill="var(--waste)" />
              </BarChart>
            ) : trendType === 'area' ? (
              <AreaChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef0f3" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={value => t('common.durationHours', { h: value })} />
                <Tooltip formatter={tooltipHoursFormatter} />
                <Legend />
                <Area type="monotone" dataKey="actual" name={t('statistics.actual')} stroke="var(--primary)" fill="var(--primary)" fillOpacity={0.14} />
                <Area type="monotone" dataKey="planned" name={t('taskModal.plan')} stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.12} />
                <Area type="monotone" dataKey="highValue" name={t('weeklyView.highValue')} stroke="var(--golden)" fill="var(--golden)" fillOpacity={0.14} />
                <Area type="monotone" dataKey="waste" name={t('statistics.wasteLabel')} stroke="var(--waste)" fill="var(--waste)" fillOpacity={0.14} />
              </AreaChart>
            ) : (
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef0f3" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={value => t('common.durationHours', { h: value })} />
                <Tooltip formatter={tooltipHoursFormatter} />
                <Legend />
                <Line type="monotone" dataKey="actual" name={t('statistics.actual')} stroke="var(--primary)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="planned" name={t('taskModal.plan')} stroke="#3b82f6" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="highValue" name={t('weeklyView.highValue')} stroke="var(--golden)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="waste" name={t('statistics.wasteLabel')} stroke="var(--waste)" strokeWidth={2} dot={false} />
              </LineChart>
            )}
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title={t('statistics.plannedVsActual')} onCsv={() => downloadCsv('planned-vs-actual.csv', plannedActualCsv)}>
          {plannedVsActual.length === 0 ? <EmptyChart text={t('statistics.noChartData')} /> : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={plannedVsActual}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef0f3" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={value => t('common.durationHours', { h: value })} />
                <Tooltip formatter={tooltipHoursFormatter} />
                <Legend />
                <Bar dataKey="planned" name={t('taskModal.plan')} fill="#93c5fd" />
                <Bar dataKey="actual" name={t('statistics.actual')} fill="var(--primary)" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title={t('statistics.projectRanking')} onCsv={() => downloadCsv('project-ranking.csv', rankingCsv)}>
          {projectRanking.length === 0 ? <EmptyChart text={t('statistics.noChartData')} /> : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={projectRanking} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef0f3" />
                <XAxis type="number" tickFormatter={value => t('common.durationHours', { h: value })} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={90} />
                <Tooltip formatter={tooltipHoursFormatter} />
                <Bar dataKey="actual" name={t('statistics.actual')}>
                  {projectRanking.map(row => <Cell key={row.name} fill={row.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      <div style={styles.tablesGrid}>
        <DetailTable title={t('statistics.byCategoryTable')}>
          {byCat.length === 0 ? <p style={styles.empty}>{t('statistics.noDataThisPeriod')}</p> : (
            <table style={styles.table}>
              <thead><tr><th style={styles.th}>{t('deadlineModal.category')}</th><th style={styles.th}>{t('taskModal.plan')}</th><th style={styles.th}>{t('statistics.actual')}</th><th style={styles.th}>{t('statistics.kpiDiff')}</th></tr></thead>
              <tbody>
                {byCat.map(({ cat, planned, actual, diff }) => (
                  <tr key={cat.id}>
                    <td style={styles.td}><Dot color={cat.color} />{cat.name}</td>
                    <td style={styles.td}>{fmtHoursAbs(planned, t)}</td>
                    <td style={styles.td}>{fmtHoursAbs(actual, t)}</td>
                    <td style={{ ...styles.td, color: diff >= 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 700 }}>{fmtHours(diff, t)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </DetailTable>

        <DetailTable title={t('statistics.byProjectTable')}>
          {byProj.length === 0 ? <p style={styles.empty}>{t('statistics.noDataThisPeriod')}</p> : (
            <table style={styles.table}>
              <thead><tr><th style={styles.th}>{t('board.projectColumn')}</th><th style={styles.th}>{t('deadlineModal.category')}</th><th style={styles.th}>{t('taskModal.plan')}</th><th style={styles.th}>{t('statistics.actual')}</th><th style={styles.th}>{t('statistics.kpiDiff')}</th></tr></thead>
              <tbody>
                {byProj.map(({ proj, cat, planned, actual, diff }) => (
                  <tr key={proj.id}>
                    <td style={styles.td}>{proj.name}</td>
                    <td style={styles.td}>{cat ? <><Dot color={cat.color} />{cat.name}</> : t('statistics.unknown')}</td>
                    <td style={styles.td}>{fmtHoursAbs(planned, t)}</td>
                    <td style={styles.td}>{fmtHoursAbs(actual, t)}</td>
                    <td style={{ ...styles.td, color: diff >= 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 700 }}>{fmtHours(diff, t)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </DetailTable>
      </div>
    </div>
  )
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'bad' }) {
  return (
    <div style={styles.kpi}>
      <span style={styles.kpiLabel}>{label}</span>
      <strong style={{ ...styles.kpiValue, color: tone === 'good' ? 'var(--success)' : tone === 'bad' ? 'var(--danger)' : 'var(--text-primary)' }}>{value}</strong>
    </div>
  )
}

function ChartCard({ title, children, controls, onCsv }: { title: string; children: React.ReactNode; controls?: React.ReactNode; onCsv: () => void }) {
  const { t } = useLanguage()
  return (
    <section style={styles.chartCard}>
      <div style={styles.chartHeader}>
        <h2 style={styles.chartTitle}>{title}</h2>
        <div style={styles.chartActions}>
          {controls}
          <button style={styles.exportBtn} onClick={onCsv}>CSV</button>
          <button style={{ ...styles.exportBtn, opacity: 0.45, cursor: 'not-allowed' }} title={t('statistics.pngExportTitle')} disabled>PNG</button>
        </div>
      </div>
      {children}
    </section>
  )
}

function DetailTable({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={styles.chartCard}>
      <h2 style={styles.chartTitle}>{title}</h2>
      {children}
    </section>
  )
}

function Dot({ color }: { color: string }) {
  return <span style={{ width: 10, height: 10, borderRadius: '50%', background: color, display: 'inline-block', marginRight: 6 }} />
}

function EmptyChart({ text }: { text: string }) {
  return <div style={styles.emptyChart}>{text}</div>
}

function LongTermTooltip({
  active,
  payload,
  label,
  groups,
}: {
  active?: boolean
  payload?: Array<{ value?: number; payload?: Record<string, string | number> }>
  label?: string
  groups: Array<{ id: string; name: string; color: string }>
}) {
  const { t } = useLanguage()
  if (!active || !payload?.length) return null
  const row = payload[0].payload
  if (!row) return null
  const totalMinutes = Number(row.totalMinutes ?? 0)

  return (
    <div style={styles.longTermTooltip}>
      <strong>{label}</strong>
      <span style={styles.tooltipMuted}>{t('statistics.totalLabel', { val: fmtHoursAbs(totalMinutes, t) })}</span>
      {groups.map(group => {
        const hours = Number(row[group.id] ?? 0)
        const minutes = Math.round(hours * 60)
        const percentage = totalMinutes > 0 ? Math.round((minutes / totalMinutes) * 100) : 0
        return (
          <div key={group.id} style={styles.tooltipRow}>
            <span style={{ ...styles.tooltipDot, background: group.color }} />
            <span>{group.name}</span>
            <strong>{fmtHoursAbs(minutes, t)}, {percentage}%</strong>
          </div>
        )
      })}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: { flex: 1, overflow: 'auto', padding: 28, background: 'var(--app-bg)' },
  header: { display: 'flex', justifyContent: 'space-between', marginBottom: 20 },
  title: { margin: 0, fontSize: 28, lineHeight: 1.15, fontWeight: 800, color: 'var(--text-primary)' },
  subtitle: { margin: '5px 0 0', color: 'var(--text-secondary)', fontSize: 14 },
  panel: { border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'var(--surface)', padding: 16, marginBottom: 16, boxShadow: 'var(--shadow-card)' },
  filterBlock: { display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 },
  filterLabel: { fontSize: 12, color: 'var(--text-secondary)', fontWeight: 800 },
  rangeRow: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  rangeBtn: { padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--surface)', fontSize: 13, cursor: 'pointer', color: 'var(--text-secondary)', fontWeight: 700 },
  rangeBtnActive: { background: 'var(--primary-soft)', color: 'var(--primary)', borderColor: 'var(--border)' },
  filterGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginTop: 10 },
  label: { display: 'flex', flexDirection: 'column', gap: 4, color: 'var(--text-secondary)', fontSize: 12, fontWeight: 700 },
  input: { border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '8px 10px', fontSize: 13, color: 'var(--text-primary)', background: 'var(--surface)' },
  smallSelect: { border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '6px 8px', fontSize: 12, background: 'var(--surface)', color: 'var(--text-primary)', fontWeight: 650 },
  yearHeatmapCard: { border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'var(--surface)', padding: 16, marginBottom: 16, minWidth: 0, boxShadow: 'var(--shadow-card)' },
  heatmapSubtitle: { margin: '4px 0 0', color: 'var(--text-muted)', fontSize: 12 },
  yearHeatmapScroll: { overflowX: 'auto', padding: '2px 0 0' },
  yearHeatmapMonths: { display: 'grid', gap: 3, alignItems: 'end', minWidth: 'fit-content', color: 'var(--text-secondary)', fontSize: 11, fontWeight: 700, marginBottom: 5 },
  yearHeatmapBody: { display: 'flex', gap: 6, minWidth: 'fit-content' },
  yearHeatmapWeekdays: { display: 'grid', gridTemplateRows: 'repeat(7, 12px)', gap: 3, width: 34, color: 'var(--text-muted)', fontSize: 10, lineHeight: '12px' },
  yearHeatmapGrid: { display: 'grid', gap: 3, minWidth: 'fit-content' },
  yearHeatmapWeek: { display: 'grid', gridTemplateRows: 'repeat(7, 12px)', gap: 3 },
  yearHeatmapCell: { width: 12, height: 12, borderRadius: 3, border: '1px solid var(--border)', display: 'block' },
  yearHeatmapLegend: { display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 5, marginTop: 10, color: 'var(--text-muted)', fontSize: 11 },
  yearHeatmapLegendCell: { width: 12, height: 12, borderRadius: 3, border: '1px solid var(--border)' },
  yearHeatmapEmpty: { height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 },
  kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 14 },
  kpi: { border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'var(--surface)', padding: 15, boxShadow: 'var(--shadow-card)' },
  kpiLabel: { display: 'block', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 700, marginBottom: 8 },
  kpiValue: { fontSize: 22 },
  longTermWrap: { marginBottom: 14 },
  segmentBtn: { border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'var(--surface)', color: 'var(--text-secondary)', padding: '6px 8px', fontSize: 12, fontWeight: 700, cursor: 'pointer' },
  segmentBtnActive: { background: 'var(--primary-soft)', color: 'var(--primary)', borderColor: 'var(--border)' },
  longTermEmpty: { height: 320, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 },
  longTermTooltip: { display: 'flex', flexDirection: 'column', gap: 6, minWidth: 220, border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: 10, background: 'var(--surface)', boxShadow: 'var(--shadow-card)', color: 'var(--text-primary)', fontSize: 12 },
  tooltipMuted: { color: 'var(--text-secondary)', fontWeight: 700 },
  tooltipRow: { display: 'grid', gridTemplateColumns: '10px 1fr auto', alignItems: 'center', gap: 7, color: 'var(--text-secondary)' },
  tooltipDot: { width: 8, height: 8, borderRadius: 999 },
  chartGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 14 },
  chartCard: { border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'var(--surface)', padding: 16, minWidth: 0, boxShadow: 'var(--shadow-card)' },
  chartHeader: { display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', marginBottom: 8 },
  chartTitle: { margin: 0, fontSize: 15, color: 'var(--text-primary)', fontWeight: 750 },
  chartActions: { display: 'flex', alignItems: 'center', gap: 6 },
  exportBtn: { border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'var(--surface)', color: 'var(--text-secondary)', padding: '6px 8px', fontSize: 12, fontWeight: 700, cursor: 'pointer' },
  tablesGrid: { display: 'grid', gridTemplateColumns: '1fr', gap: 14, marginTop: 14 },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { textAlign: 'left', padding: '10px 12px', borderBottom: '2px solid var(--border)', fontSize: 12, color: 'var(--text-secondary)', fontWeight: 800 },
  td: { padding: '10px 12px', borderBottom: '1px solid var(--surface-muted)', fontSize: 13, color: 'var(--text-primary)' },
  empty: { color: 'var(--text-muted)', fontSize: 13 },
  emptyChart: { height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 },
}
