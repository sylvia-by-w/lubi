import ExcelJS from 'exceljs'
import type { Category, Project, TaskBlock } from '../types'
import { formatDate, getWeekDays, minutesToTime, timeToMinutes } from './time'

const SLOT_MINUTES = 15
const DAY_MINUTES = 24 * 60
const SLOT_COUNT = DAY_MINUTES / SLOT_MINUTES

function calcMinutes(tasks: TaskBlock[]) {
  return tasks.reduce((sum, task) => sum + timeToMinutes(task.endTime) - timeToMinutes(task.startTime), 0)
}

function fmtMinutes(minutes: number) {
  const sign = minutes < 0 ? '-' : ''
  const abs = Math.abs(minutes)
  const h = Math.floor(abs / 60)
  const m = abs % 60
  if (h === 0) return `${sign}${m}m`
  if (m === 0) return `${sign}${h}h`
  return `${sign}${h}h${m}m`
}

function argb(hex: string, opacity = 1) {
  const clean = hex.replace('#', '')
  const alpha = Math.round(opacity * 255).toString(16).padStart(2, '0').toUpperCase()
  return `${alpha}${clean.toUpperCase()}`
}

function readableTextColor(hex: string) {
  const clean = hex.replace('#', '')
  const r = parseInt(clean.slice(0, 2), 16)
  const g = parseInt(clean.slice(2, 4), 16)
  const b = parseInt(clean.slice(4, 6), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.62 ? '111827' : 'FFFFFF'
}

function border(): Partial<ExcelJS.Borders> {
  return {
    top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
    left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
    bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
    right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
  }
}

function taskDuration(task: TaskBlock) {
  return timeToMinutes(task.endTime) - timeToMinutes(task.startTime)
}

function taskText(task: TaskBlock, projects: Project[]) {
  const project = task.projectId ? projects.find(item => item.id === task.projectId) : undefined
  return [
    task.name,
    project?.name,
    `${task.startTime}-${task.endTime}`,
    fmtMinutes(taskDuration(task)),
  ].filter(Boolean).join('\n')
}

function addTitleRow(sheet: ExcelJS.Worksheet, title: string, lastColumn: number) {
  sheet.mergeCells(1, 1, 1, lastColumn)
  const cell = sheet.getCell(1, 1)
  cell.value = title
  cell.font = { bold: true, size: 16, color: { argb: 'FF111827' } }
  cell.alignment = { horizontal: 'center', vertical: 'middle' }
  sheet.getRow(1).height = 24
}

function styleHeader(row: ExcelJS.Row) {
  row.eachCell(cell => {
    cell.font = { bold: true, color: { argb: 'FF111827' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } }
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
    cell.border = border()
  })
}

function addWeeklyCalendarSheet(
  workbook: ExcelJS.Workbook,
  weekStart: Date,
  tasks: TaskBlock[],
  categories: Category[],
  projects: Project[],
) {
  const days = getWeekDays(weekStart)
  const dayKeys = days.map(formatDate)
  const weekTasks = tasks.filter(task => dayKeys.includes(task.date))
  const sheet = workbook.addWorksheet('Weekly Calendar', {
    views: [{ state: 'frozen', xSplit: 1, ySplit: 2 }],
  })

  const columnCount = 1 + days.length * 2
  addTitleRow(sheet, `Lubi Weekly Calendar ${dayKeys[0]} to ${dayKeys[6]}`, columnCount)

  const header = ['Time']
  days.forEach(day => {
    const dayLabel = day.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    header.push(`${dayLabel} Actual`, `${dayLabel} Plan`)
  })
  sheet.addRow(header)
  styleHeader(sheet.getRow(2))

  for (let slot = 0; slot < SLOT_COUNT; slot += 1) {
    const start = slot * SLOT_MINUTES
    const end = start + SLOT_MINUTES
    const row = sheet.addRow([`${minutesToTime(start)}-${minutesToTime(end)}`])
    row.height = 18
    row.eachCell(cell => {
      cell.border = border()
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
    })
  }

  sheet.getColumn(1).width = 13
  for (let col = 2; col <= columnCount; col += 1) {
    sheet.getColumn(col).width = 18
  }

  weekTasks.forEach(task => {
    const dayIndex = dayKeys.indexOf(task.date)
    if (dayIndex < 0) return
    const startSlot = Math.max(0, Math.floor(timeToMinutes(task.startTime) / SLOT_MINUTES))
    const endSlot = Math.min(SLOT_COUNT, Math.ceil(timeToMinutes(task.endTime) / SLOT_MINUTES))
    if (endSlot <= startSlot) return

    const col = 2 + dayIndex * 2 + (task.type === 'actual' ? 0 : 1)
    const startRow = 3 + startSlot
    const endRow = 3 + endSlot - 1
    if (endRow > startRow) sheet.mergeCells(startRow, col, endRow, col)

    const category = categories.find(item => item.id === task.categoryId)
    const color = category?.color ?? '#6366f1'
    const cell = sheet.getCell(startRow, col)
    cell.value = taskText(task, projects)
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: task.type === 'actual' ? argb(color, 1) : argb(color, 0.35) },
    }
    cell.font = {
      bold: true,
      size: 10,
      color: { argb: task.type === 'actual' ? `FF${readableTextColor(color)}` : 'FF111827' },
    }
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
    cell.border = border()
  })

  return weekTasks
}

function addSummarySheet(
  workbook: ExcelJS.Workbook,
  weekTasks: TaskBlock[],
  categories: Category[],
  projects: Project[],
) {
  const sheet = workbook.addWorksheet('Summary')
  sheet.columns = [
    { width: 28 },
    { width: 16 },
    { width: 16 },
    { width: 16 },
  ]

  const planned = calcMinutes(weekTasks.filter(task => task.type === 'plan'))
  const actual = calcMinutes(weekTasks.filter(task => task.type === 'actual'))
  const highValue = calcMinutes(weekTasks.filter(task => task.type === 'actual' && task.valueLevel === 'high'))
  const golden = calcMinutes(weekTasks.filter(task => task.type === 'actual' && task.valueLevel === 'high' && task.energyLevel === 'high'))

  sheet.addRow(['Weekly Summary'])
  sheet.getCell('A1').font = { bold: true, size: 16 }
  sheet.addRow([])
  ;[
    ['Total planned time', fmtMinutes(planned)],
    ['Total actual time', fmtMinutes(actual)],
    ['Diff', fmtMinutes(actual - planned)],
    ['High-value time', highValue > 0 ? fmtMinutes(highValue) : ''],
    ['Golden time', golden > 0 ? fmtMinutes(golden) : ''],
  ].forEach(row => sheet.addRow(row))

  sheet.addRow([])
  sheet.addRow(['Time by Category', 'Planned', 'Actual', 'Diff'])
  styleHeader(sheet.getRow(sheet.lastRow?.number ?? 1))
  categories
    .map(category => {
      const categoryTasks = weekTasks.filter(task => task.categoryId === category.id)
      const categoryPlanned = calcMinutes(categoryTasks.filter(task => task.type === 'plan'))
      const categoryActual = calcMinutes(categoryTasks.filter(task => task.type === 'actual'))
      return { name: category.name, planned: categoryPlanned, actual: categoryActual }
    })
    .filter(row => row.planned > 0 || row.actual > 0)
    .forEach(row => sheet.addRow([row.name, fmtMinutes(row.planned), fmtMinutes(row.actual), fmtMinutes(row.actual - row.planned)]))

  sheet.addRow([])
  sheet.addRow(['Time by Project', 'Planned', 'Actual', 'Diff'])
  styleHeader(sheet.getRow(sheet.lastRow?.number ?? 1))
  const projectRows = projects
    .map(project => {
      const projectTasks = weekTasks.filter(task => task.projectId === project.id)
      const projectPlanned = calcMinutes(projectTasks.filter(task => task.type === 'plan'))
      const projectActual = calcMinutes(projectTasks.filter(task => task.type === 'actual'))
      return { name: project.name, planned: projectPlanned, actual: projectActual, diff: projectActual - projectPlanned }
    })
    .filter(row => row.planned > 0 || row.actual > 0)
  projectRows.forEach(row => sheet.addRow([row.name, fmtMinutes(row.planned), fmtMinutes(row.actual), fmtMinutes(row.diff)]))

  sheet.addRow([])
  sheet.addRow(['Biggest Deviations', 'Planned', 'Actual', 'Diff'])
  styleHeader(sheet.getRow(sheet.lastRow?.number ?? 1))
  projectRows
    .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
    .slice(0, 8)
    .forEach(row => sheet.addRow([row.name, fmtMinutes(row.planned), fmtMinutes(row.actual), fmtMinutes(row.diff)]))

  sheet.eachRow(row => {
    row.eachCell(cell => {
      cell.border = border()
      cell.alignment = { vertical: 'middle' }
    })
  })
}

function addRawDataSheet(
  workbook: ExcelJS.Workbook,
  weekTasks: TaskBlock[],
  categories: Category[],
  projects: Project[],
) {
  const sheet = workbook.addWorksheet('Raw Data', {
    views: [{ state: 'frozen', ySplit: 1 }],
  })
  const headers = [
    'date',
    'day',
    'startTime',
    'endTime',
    'durationMinutes',
    'type',
    'title',
    'category',
    'project',
    'valueLevel',
    'energyLevel',
    'note',
  ]
  sheet.addRow(headers)
  styleHeader(sheet.getRow(1))

  weekTasks
    .sort((a, b) => `${a.date}T${a.startTime}`.localeCompare(`${b.date}T${b.startTime}`))
    .forEach(task => {
      const category = categories.find(item => item.id === task.categoryId)
      const project = task.projectId ? projects.find(item => item.id === task.projectId) : undefined
      const date = new Date(`${task.date}T00:00:00`)
      sheet.addRow([
        task.date,
        date.toLocaleDateString('en-US', { weekday: 'long' }),
        task.startTime,
        task.endTime,
        taskDuration(task),
        task.type,
        task.name,
        category?.name ?? '',
        project?.name ?? '',
        task.valueLevel ?? '',
        task.energyLevel ?? '',
        '',
      ])
    })

  sheet.columns.forEach(column => {
    column.width = 16
  })
  sheet.getColumn(7).width = 28
  sheet.eachRow(row => {
    row.eachCell(cell => {
      cell.border = border()
      cell.alignment = { vertical: 'middle', wrapText: true }
    })
  })
}

export async function exportWeeklyExcel({
  weekStart,
  tasks,
  categories,
  projects,
}: {
  weekStart: Date
  tasks: TaskBlock[]
  categories: Category[]
  projects: Project[]
}) {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Lubi'
  workbook.created = new Date()

  const weekTasks = addWeeklyCalendarSheet(workbook, weekStart, tasks, categories, projects)
  addSummarySheet(workbook, weekTasks, categories, projects)
  addRawDataSheet(workbook, weekTasks, categories, projects)

  const days = getWeekDays(weekStart).map(formatDate)
  const filename = `Lubi_Weekly_${days[0]}_to_${days[6]}.xlsx`
  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
