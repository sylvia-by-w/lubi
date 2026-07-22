import { useState, type CSSProperties } from 'react'
import type { Category, HabitItem, Project, ProjectTask, ProjectTaskStatus, PriorityLevel, TaskBlock } from '../types'
import { formatDate, timeToMinutes, minutesToTime } from '../utils/time'
import { useLanguage } from '../i18n/LanguageContext'

type TFunc = (path: string, vars?: Record<string, string | number>) => string

interface Props {
  projectTasks: ProjectTask[]
  categories: Category[]
  projects: Project[]
  tasks: TaskBlock[]
  habits: HabitItem[]
  onAddProjectTask: (task: Omit<ProjectTask, 'id' | 'createdAt' | 'completedAt'>, options?: { skipCompletedAt?: boolean }) => string
  onUpdateProjectTask: (id: string, updates: Partial<Omit<ProjectTask, 'id' | 'createdAt'>>) => void
  onDeleteProjectTask: (id: string) => void
  onUpdateProject: (id: string, updates: Partial<Omit<Project, 'id' | 'createdAt'>>) => void
  onLogTime: (task: ProjectTask, date: string, existingBlock?: TaskBlock) => void
  onAddTask: (task: Omit<TaskBlock, 'id'>) => void
  onUpdateTask: (id: string, updates: Partial<TaskBlock>) => void
  onDeleteTask: (id: string) => void
  onAddHabit: (habit: Omit<HabitItem, 'id' | 'createdAt'>) => void
  onDeleteHabit: (id: string) => void
  onArchiveHabit: (id: string) => void
  onUnarchiveHabit: (id: string) => void
  onToggleHabitLog: (habitId: string, date: string) => void
  habitLogs: { id: string; habitId: string; date: string }[]
}

const STATUS_ORDER: ProjectTaskStatus[] = ['todo', 'in_progress', 'done']
function statusLabel(status: ProjectTaskStatus, t: TFunc): string {
  if (status === 'todo') return t('projects.todo')
  if (status === 'in_progress') return t('projects.active')
  if (status === 'done') return t('projects.completed')
  return t('monthPlan.abandoned')
}
function weekdayLabel(i: number, lang: string): string {
  if (lang === 'en') return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i]
  return '周' + ['一', '二', '三', '四', '五', '六', '日'][i]
}
type RowSortMode = 'default' | 'category' | 'priority'
function rowSortLabel(mode: RowSortMode, t: TFunc): string {
  if (mode === 'category') return t('board.sortByCategory')
  if (mode === 'priority') return t('board.sortByPriority')
  return t('board.sortDefault')
}
const ROW_SORT_MODES: RowSortMode[] = ['default', 'category', 'priority']

function addDays(d: Date, n: number) {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}
function startOfToday() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}
function nextStatus(status: ProjectTaskStatus): ProjectTaskStatus {
  const idx = STATUS_ORDER.indexOf(status)
  return STATUS_ORDER[(idx + 1) % STATUS_ORDER.length]
}
function priorityColor(priority?: PriorityLevel) {
  if (priority === 'high') return 'var(--danger)'
  if (priority === 'medium') return 'var(--warning)'
  if (priority === 'low') return 'var(--success)'
  return 'var(--text-muted)'
}
function priorityLabel(priority: PriorityLevel | undefined, t: TFunc) {
  if (priority === 'high') return t('common.high')
  if (priority === 'medium') return t('common.medium')
  if (priority === 'low') return t('common.low')
  return t('board.noPriority')
}
function taskCategory(task: ProjectTask, categories: Category[], projects: Project[]): Category | undefined {
  if (task.categoryId) return categories.find(c => c.id === task.categoryId)
  const project = task.projectId ? projects.find(p => p.id === task.projectId) : undefined
  return project ? categories.find(c => c.id === project.categoryId) : undefined
}
function isActiveProject(p: Project) {
  return !p.status || p.status === 'active'
}
function isOverdueTask(task: ProjectTask, todayStr: string) {
  return !!task.dueDate && task.dueDate < todayStr && task.status !== 'done' && task.status !== 'abandoned'
}
function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}
function daysElapsedInMonth(d: Date) {
  const today = startOfToday()
  if (today.getFullYear() !== d.getFullYear() || today.getMonth() !== d.getMonth()) {
    // viewing a month that isn't the current one: treat whole month as elapsed
    return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  }
  return today.getDate()
}
function startOfWeek(d: Date) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  const day = x.getDay()
  const diff = day === 0 ? -6 : 1 - day
  x.setDate(x.getDate() + diff)
  return x
}
function cycleTimeDays(task: ProjectTask): number | null {
  if (task.status !== 'done' || !task.completedAt) return null
  const start = new Date(task.createdAt).getTime()
  const end = new Date(task.completedAt).getTime()
  return Math.max(0, Math.round((end - start) / 86400000))
}

interface NewTaskForm {
  title: string
  categoryId: string
  projectId: string
  dueDate: string
  priority: PriorityLevel | ''
  startTime: string
  endTime: string
}

const emptyForm: NewTaskForm = { title: '', categoryId: '', projectId: '', dueDate: '', priority: 'medium', startTime: '', endTime: '' }

export default function Board({
  projectTasks, categories, projects, habits, habitLogs, tasks,
  onAddProjectTask, onUpdateProjectTask, onDeleteProjectTask, onUpdateProject,
  onAddTask, onUpdateTask, onDeleteTask,
  onAddHabit, onDeleteHabit, onArchiveHabit, onUnarchiveHabit,
}: Props) {
  const { t, lang } = useLanguage()
  const [weekStart, setWeekStart] = useState(() => startOfWeek(startOfToday()))
  const [form, setForm] = useState<NewTaskForm>({ ...emptyForm, categoryId: categories[0]?.id ?? '' })
  const [hideDone, setHideDone] = useState(false)
  const [habitName, setHabitName] = useState('')
  const [habitCategoryId, setHabitCategoryId] = useState('')
  const [showArchivedHabits, setShowArchivedHabits] = useState(false)
  const [quickAddCell, setQuickAddCell] = useState<{ projectId: string | undefined; ds: string } | null>(null)
  const [quickAddText, setQuickAddText] = useState('')
  const [dragTaskId, setDragTaskId] = useState<string | null>(null)
  const [dragProjectId, setDragProjectId] = useState<string | null>(null)
  const [rowSortMode, setRowSortMode] = useState<RowSortMode>('default')
  const [showHiddenProjects, setShowHiddenProjects] = useState(false)
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [postponingTaskId, setPostponingTaskId] = useState<string | null>(null)

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const todayStr = formatDate(startOfToday())

  const visibleTasks = [...projectTasks]
    .filter(t => t.status !== 'abandoned')
    .filter(t => !hideDone || t.status !== 'done')
    .sort((a, b) => (a.dueDate ?? '9999-12-31').localeCompare(b.dueDate ?? '9999-12-31'))

  const activeHabits = habits.filter(h => !h.archived)
  const archivedHabits = habits.filter(h => h.archived)

  const monthStart = startOfMonth(startOfToday())
  const elapsedDays = daysElapsedInMonth(monthStart)
  const habitMonthStats = (habitId: string) => {
    let done = 0
    for (let day = 1; day <= elapsedDays; day++) {
      const ds = formatDate(new Date(monthStart.getFullYear(), monthStart.getMonth(), day))
      if (habitLogs.some(l => l.habitId === habitId && l.date === ds)) done++
    }
    return { done, total: elapsedDays, pct: elapsedDays ? done / elapsedDays : 0 }
  }
  const overallHabitStats = (() => {
    if (activeHabits.length === 0) return null
    let done = 0
    const total = activeHabits.length * elapsedDays
    activeHabits.forEach(h => { done += habitMonthStats(h.id).done })
    return { done, total, pct: total ? done / total : 0 }
  })()

  const handleAddTask = () => {
    if (!form.title.trim() || !form.categoryId) return
    const newId = onAddProjectTask({
      title: form.title.trim(),
      status: 'todo',
      categoryId: form.categoryId,
      projectId: form.projectId || undefined,
      dueDate: form.dueDate || undefined,
      priority: form.priority || undefined,
    })
    if (form.dueDate && form.startTime) {
      const endTime = form.endTime || minutesToTime(timeToMinutes(form.startTime) + 60)
      onAddTask({
        name: form.title.trim(),
        categoryId: form.categoryId,
        projectId: form.projectId || undefined,
        projectTaskId: newId,
        date: form.dueDate,
        startTime: form.startTime,
        endTime,
        type: 'plan',
      })
    }
    setForm({ ...emptyForm, categoryId: form.categoryId })
  }

  const handleAddHabit = () => {
    if (!habitName.trim()) return
    onAddHabit({ name: habitName.trim(), categoryId: habitCategoryId || undefined })
    setHabitName('')
  }

  const toggleStatus = (task: ProjectTask) => {
    const next = nextStatus(task.status)
    onUpdateProjectTask(task.id, {
      status: next,
      completedAt: next === 'done' ? new Date().toISOString() : undefined,
    })
  }

  const handleAbandonTask = (task: ProjectTask) => {
    onUpdateProjectTask(task.id, { status: 'abandoned' })
  }
  const handlePostponeTask = (task: ProjectTask, newDate: string) => {
    if (!newDate) return
    onUpdateProjectTask(task.id, { dueDate: newDate, postponed: true })
    setPostponingTaskId(null)
  }

  const editingTask = editingTaskId ? projectTasks.find(t => t.id === editingTaskId) : undefined
  const linkedPlanBlock = (taskId: string) => tasks.find(t => t.projectTaskId === taskId && t.type === 'plan')
  const editingPlanBlock = editingTask ? linkedPlanBlock(editingTask.id) : undefined

  const updateEditingTask = (updates: Partial<Omit<ProjectTask, 'id' | 'createdAt'>>) => {
    if (!editingTask) return
    onUpdateProjectTask(editingTask.id, updates)
    const block = linkedPlanBlock(editingTask.id)
    if (block) {
      const blockUpdates: Partial<TaskBlock> = {}
      if (updates.title !== undefined) blockUpdates.name = updates.title
      if (updates.categoryId !== undefined) blockUpdates.categoryId = updates.categoryId || categories[0]?.id || ''
      if (updates.projectId !== undefined) blockUpdates.projectId = updates.projectId
      if (updates.dueDate) blockUpdates.date = updates.dueDate
      if (Object.keys(blockUpdates).length) onUpdateTask(block.id, blockUpdates)
    }
  }

  const setEditingPlanTime = (field: 'start' | 'end', value: string) => {
    if (!editingTask) return
    const existing = linkedPlanBlock(editingTask.id)
    if (field === 'start' && !value) {
      if (existing) onDeleteTask(existing.id)
      return
    }
    const nextStart = field === 'start' ? value : (existing?.startTime ?? '09:00')
    const nextEnd = field === 'end' && value ? value : (existing?.endTime ?? minutesToTime(timeToMinutes(nextStart) + 60))
    const resolvedCategoryId = editingTask.categoryId || taskCategory(editingTask, categories, projects)?.id || categories[0]?.id || ''
    const payload = {
      name: editingTask.title,
      categoryId: resolvedCategoryId,
      projectId: editingTask.projectId,
      projectTaskId: editingTask.id,
      date: editingTask.dueDate || todayStr,
      startTime: nextStart,
      endTime: nextEnd,
      type: 'plan' as const,
    }
    if (existing) onUpdateTask(existing.id, payload)
    else onAddTask(payload)
  }

  const doneCount = projectTasks.filter(t => t.status === 'done').length
  const inProgressCount = projectTasks.filter(t => t.status === 'in_progress').length
  const todoCount = projectTasks.filter(t => t.status === 'todo').length

  const priorityWeight: Record<string, number> = { high: 0, medium: 1, low: 2 }
  const tasksForDay = (ds: string) =>
    [...projectTasks]
      .filter(t => t.dueDate === ds && t.status !== 'abandoned')
      .sort((a, b) => {
        if ((a.status === 'done') !== (b.status === 'done')) return a.status === 'done' ? 1 : -1
        if (a.order != null && b.order != null) return a.order - b.order
        if (a.order != null) return -1
        if (b.order != null) return 1
        const pw = (priorityWeight[a.priority ?? ''] ?? 3) - (priorityWeight[b.priority ?? ''] ?? 3)
        if (pw !== 0) return pw
        return a.createdAt.localeCompare(b.createdAt)
      })

  const toggleDayTaskDone = (task: ProjectTask) => {
    const done = task.status === 'done'
    onUpdateProjectTask(task.id, {
      status: done ? 'todo' : 'done',
      completedAt: done ? undefined : new Date().toISOString(),
    })
  }

  const dayTasksMap = weekDays.map(d => { const ds = formatDate(d); return { ds, list: tasksForDay(ds) } })

  const tasksForCell = (projectId: string | undefined, ds: string) =>
    tasksForDay(ds).filter(t => (projectId ? t.projectId === projectId : !t.projectId))

  const weekDateStrs = weekDays.map(d => formatDate(d))
  const weekTasksAll = projectTasks.filter(t => t.dueDate && weekDateStrs.includes(t.dueDate))
  const projectIdsWithWeekTasks = new Set(weekTasksAll.filter(t => t.projectId).map(t => t.projectId as string))
  const hasUnassignedWeekTasks = weekTasksAll.some(t => !t.projectId)

  const activeProjects = projects.filter(isActiveProject)
  const hiddenWithTasks = projects.filter(p => !isActiveProject(p) && projectIdsWithWeekTasks.has(p.id))
  const hiddenWithoutTasks = projects.filter(p => !isActiveProject(p) && !projectIdsWithWeekTasks.has(p.id))
  const baseRowProjects = [...activeProjects, ...hiddenWithTasks, ...(showHiddenProjects ? hiddenWithoutTasks : [])]

  const bestPriorityWeight = (p: Project) => {
    const weights = weekTasksAll
      .filter(t => t.projectId === p.id && t.status !== 'done')
      .map(t => priorityWeight[t.priority ?? ''] ?? 3)
    return weights.length ? Math.min(...weights) : 9
  }
  const categoryName = (p: Project) => categories.find(c => c.id === p.categoryId)?.name ?? ''

  const rowProjects = [...baseRowProjects].sort((a, b) => {
    if (a.boardOrder != null && b.boardOrder != null) return a.boardOrder - b.boardOrder
    if (a.boardOrder != null) return -1
    if (b.boardOrder != null) return 1
    if (rowSortMode === 'category') {
      const cmp = categoryName(a).localeCompare(categoryName(b))
      return cmp !== 0 ? cmp : a.name.localeCompare(b.name)
    }
    if (rowSortMode === 'priority') {
      const cmp = bestPriorityWeight(a) - bestPriorityWeight(b)
      return cmp !== 0 ? cmp : a.name.localeCompare(b.name)
    }
    return 0
  })

  const submitQuickAdd = () => {
    if (!quickAddCell) return
    const { projectId, ds } = quickAddCell
    const title = quickAddText.trim()
    if (title) {
      const project = projectId ? projects.find(p => p.id === projectId) : undefined
      onAddProjectTask({ title, status: 'todo', dueDate: ds, projectId, categoryId: project?.categoryId })
    }
    setQuickAddCell(null)
    setQuickAddText('')
  }
  const cancelQuickAdd = () => { setQuickAddCell(null); setQuickAddText('') }

  const handleDropOnCell = (projectId: string | undefined, ds: string, targetTask: ProjectTask | undefined) => {
    if (!dragTaskId) return
    const list = tasksForCell(projectId, ds)
    const dragIdx = list.findIndex(t => t.id === dragTaskId)
    if (dragIdx === -1) { setDragTaskId(null); return }
    const targetIdx = targetTask ? list.findIndex(t => t.id === targetTask.id) : list.length
    if (dragIdx === targetIdx || dragIdx === targetIdx - 1) { setDragTaskId(null); return }
    const insertAt = dragIdx < targetIdx ? targetIdx - 1 : targetIdx
    const reordered = [...list]
    const [moved] = reordered.splice(dragIdx, 1)
    reordered.splice(insertAt, 0, moved)
    reordered.forEach((t, i) => {
      if (t.order !== i) onUpdateProjectTask(t.id, { order: i })
    })
    setDragTaskId(null)
  }

  const handleDropOnProjectRow = (targetProjectId: string | undefined) => {
    if (!dragProjectId) return
    const list = rowProjects
    const dragIdx = list.findIndex(p => p.id === dragProjectId)
    if (dragIdx === -1) { setDragProjectId(null); return }
    const targetIdx = targetProjectId ? list.findIndex(p => p.id === targetProjectId) : list.length
    if (dragIdx === targetIdx || dragIdx === targetIdx - 1) { setDragProjectId(null); return }
    const insertAt = dragIdx < targetIdx ? targetIdx - 1 : targetIdx
    const reordered = [...list]
    const [moved] = reordered.splice(dragIdx, 1)
    reordered.splice(insertAt, 0, moved)
    reordered.forEach((p, i) => {
      if (p.boardOrder !== i) onUpdateProject(p.id, { boardOrder: i })
    })
    setDragProjectId(null)
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>{t('nav.taskBoard')}</h1>
          <p style={styles.subtitle}>{t('board.subtitle')}</p>
        </div>
        <div style={styles.summaryRow}>
          {overallHabitStats && <MonthDonut pct={overallHabitStats.pct} label={t('board.monthlyHabitsLabel')} />}
          <SummaryMetric label={t('projects.todo')} value={String(todoCount)} />
          <SummaryMetric label={t('projects.active')} value={String(inProgressCount)} />
          <SummaryMetric label={t('projects.completed')} value={String(doneCount)} />
        </div>
      </div>

      <div style={styles.columns}>
        <div style={styles.leftCol}>
          <section style={styles.panel}>
            <h3 style={styles.panelTitle}>{t('board.addTaskTitle')}</h3>
            <input
              style={styles.input}
              placeholder={t('taskModal.taskName')}
              value={form.title}
              onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && handleAddTask()}
            />
            <select style={styles.input} value={form.categoryId} onChange={e => setForm(prev => ({ ...prev, categoryId: e.target.value }))}>
              <option value="">{t('taskModal.selectCategory')}</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select style={styles.input} value={form.projectId} onChange={e => setForm(prev => ({ ...prev, projectId: e.target.value }))}>
              <option value="">{t('board.noProjectOption')}</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <div style={styles.row}>
              <input style={{ ...styles.input, flex: 1 }} type="date" value={form.dueDate} onChange={e => setForm(prev => ({ ...prev, dueDate: e.target.value }))} />
              <select style={{ ...styles.input, width: 120 }} value={form.priority} onChange={e => setForm(prev => ({ ...prev, priority: e.target.value as PriorityLevel }))}>
                <option value="low">{t('common.low')}</option>
                <option value="medium">{t('common.medium')}</option>
                <option value="high">{t('common.high')}</option>
              </select>
            </div>
            <label style={styles.smallLabel}>{t('board.planTimeLabel')}</label>
            <div style={styles.row}>
              <input
                style={{ ...styles.input, flex: 1 }}
                type="time"
                value={form.startTime}
                onChange={e => setForm(prev => ({ ...prev, startTime: e.target.value }))}
                disabled={!form.dueDate}
              />
              <input
                style={{ ...styles.input, flex: 1 }}
                type="time"
                value={form.endTime}
                onChange={e => setForm(prev => ({ ...prev, endTime: e.target.value }))}
                disabled={!form.startTime}
              />
            </div>
            <button style={styles.addBtn} onClick={handleAddTask}>{t('nav.addTask')}</button>
          </section>

          <section style={styles.panel}>
            <div style={styles.sectionHeader}>
              <h3 style={styles.panelTitle}>{t('board.taskListTitle')}</h3>
              <label style={styles.hideDoneLabel}>
                <input type="checkbox" checked={hideDone} onChange={e => setHideDone(e.target.checked)} />
                {t('board.hideDone')}
              </label>
            </div>
            <div style={styles.taskList}>
              {visibleTasks.map(task => {
                const cat = taskCategory(task, categories, projects)
                const project = task.projectId ? projects.find(p => p.id === task.projectId) : undefined
                const overdue = isOverdueTask(task, todayStr)
                return (
                  <div key={task.id} style={{ ...styles.taskRow, flexDirection: 'column', alignItems: 'stretch', gap: overdue ? 6 : 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ ...styles.dot, background: cat?.color ?? '#999' }} />
                      <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => setEditingTaskId(task.id)}>
                        <div style={{ ...styles.taskName, ...(task.status === 'done' ? styles.taskNameDone : {}) }} title={t('board.clickToEdit')}>{task.title}</div>
                        <div style={styles.taskMeta}>
                          {cat?.name ?? t('board.noCategory')}{project ? ` · ${project.name}` : ''}{task.dueDate ? ` · ${t('weeklyView.dueDate', { date: task.dueDate })}` : ''}
                        </div>
                      </div>
                      <span style={{ ...styles.priorityDot, background: priorityColor(task.priority) }} title={priorityLabel(task.priority, t)} />
                      <button style={{ ...styles.statusPill, ...statusTone(task.status) }} onClick={() => toggleStatus(task)}>
                        {statusLabel(task.status, t)}
                      </button>
                      <button style={styles.deleteBtn} onClick={() => onDeleteProjectTask(task.id)} aria-label={t('board.deleteTaskAria')}>x</button>
                    </div>
                    {overdue && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={styles.overdueTag}>{t('board.overdueTag')}</span>
                        {postponingTaskId === task.id ? (
                          <input
                            type="date"
                            autoFocus
                            style={styles.overduePostponeInput}
                            onChange={e => handlePostponeTask(task, e.target.value)}
                            onBlur={() => setPostponingTaskId(null)}
                          />
                        ) : (
                          <button style={styles.overdueActionBtn} onClick={() => setPostponingTaskId(task.id)}>{t('board.postpone')}</button>
                        )}
                        <button style={styles.overdueActionBtn} onClick={() => handleAbandonTask(task)}>{t('board.abandon')}</button>
                      </div>
                    )}
                  </div>
                )
              })}
              {visibleTasks.length === 0 && <p style={styles.emptyText}>{t('board.noTasksYet')}</p>}
            </div>
          </section>

          <section style={styles.panel}>
            <h3 style={styles.panelTitle}>{t('board.habitsTitle')}</h3>
            <p style={styles.hint}>{t('board.habitsHint')}</p>
            <div style={styles.row}>
              <input
                style={{ ...styles.input, flex: 1, marginBottom: 0 }}
                placeholder={t('board.habitNamePlaceholder')}
                value={habitName}
                onChange={e => setHabitName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddHabit()}
              />
              <select style={{ ...styles.input, width: 110, marginBottom: 0 }} value={habitCategoryId} onChange={e => setHabitCategoryId(e.target.value)}>
                <option value="">{t('board.noCategory')}</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <button style={{ ...styles.addBtn, marginTop: 8 }} onClick={handleAddHabit}>{t('board.addHabit')}</button>
            {activeHabits.length > 0 && (
              <div style={{ ...styles.taskList, marginTop: 10 }}>
                {activeHabits.map(h => {
                  const cat = h.categoryId ? categories.find(c => c.id === h.categoryId) : undefined
                  const stats = habitMonthStats(h.id)
                  const barColor = cat?.color ?? 'var(--primary)'
                  return (
                    <div key={h.id} style={{ ...styles.taskRow, flexDirection: 'column', alignItems: 'stretch', gap: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ ...styles.dot, background: barColor }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={styles.taskName}>{h.name}</div>
                        </div>
                        <span style={styles.habitStatsLabel}>{stats.done}/{stats.total} · {Math.round(stats.pct * 100)}%</span>
                        <button style={styles.archiveBtn} onClick={() => onArchiveHabit(h.id)}>{t('board.archive')}</button>
                        <button style={styles.deleteBtn} onClick={() => onDeleteHabit(h.id)} aria-label={t('board.deleteHabitAria')}>x</button>
                      </div>
                      <div style={styles.habitBarTrack}>
                        <div style={{ ...styles.habitBarFill, width: `${Math.round(stats.pct * 100)}%`, background: barColor }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {archivedHabits.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <button style={styles.archivedToggle} onClick={() => setShowArchivedHabits(v => !v)}>
                  {showArchivedHabits
                    ? t('board.collapseArchivedHabits', { count: archivedHabits.length })
                    : t('board.expandArchivedHabits', { count: archivedHabits.length })}
                </button>
                {showArchivedHabits && (
                  <div style={{ ...styles.taskList, marginTop: 8 }}>
                    {archivedHabits.map(h => (
                      <div key={h.id} style={styles.taskRow}>
                        <span style={{ ...styles.dot, background: 'var(--text-muted)' }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ ...styles.taskName, color: 'var(--text-secondary)' }}>{h.name}</div>
                        </div>
                        <button style={styles.archiveBtn} onClick={() => onUnarchiveHabit(h.id)}>{t('board.restore')}</button>
                        <button style={styles.deleteBtn} onClick={() => onDeleteHabit(h.id)} aria-label={t('board.deleteHabitAria')}>x</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>
        </div>

        <div style={styles.midCol}>
          <section style={styles.panel}>
            <div style={styles.sectionHeader}>
              <h3 style={styles.panelTitle}>{t('board.dailyPlanTitle')}</h3>
              <div style={styles.row}>
                <button style={styles.navBtn} onClick={() => setWeekStart(addDays(weekStart, -7))}>{t('board.prevWeek')}</button>
                <button style={styles.navBtn} onClick={() => setWeekStart(startOfWeek(startOfToday()))}>{t('projects.thisWeek')}</button>
                <button style={styles.navBtn} onClick={() => setWeekStart(addDays(weekStart, 7))}>{t('board.nextWeek')}</button>
              </div>
            </div>
            <p style={styles.hint}>{t('board.dailyPlanHint')}</p>

            <div style={styles.rowControls}>
              <label style={styles.rowSortLabel}>{t('board.rowSortLabel')}</label>
              <select style={styles.rowSortSelect} value={rowSortMode} onChange={e => setRowSortMode(e.target.value as RowSortMode)}>
                {ROW_SORT_MODES.map(mode => (
                  <option key={mode} value={mode}>{rowSortLabel(mode, t)}</option>
                ))}
              </select>
              {(hiddenWithoutTasks.length > 0) && (
                <button style={styles.archivedToggle} onClick={() => setShowHiddenProjects(v => !v)}>
                  {showHiddenProjects
                    ? t('board.collapsePausedProjects', { count: hiddenWithoutTasks.length })
                    : t('board.expandPausedProjects', { count: hiddenWithoutTasks.length })}
                </button>
              )}
            </div>

            <table style={styles.dayTable}>
              <thead>
                <tr>
                  <th style={{ ...styles.dayTh, ...styles.projectHeadCell }}>{t('board.projectColumn')}</th>
                  {weekDays.map((d, i) => {
                    const ds = formatDate(d)
                    const isToday = ds === todayStr
                    return (
                      <th key={ds} style={{ ...styles.dayTh, ...(isToday ? styles.dayThToday : {}) }}>
                        {weekdayLabel(i, lang)}{isToday ? ` · ${t('nav.today')}` : ''}<br />{d.getMonth() + 1}/{d.getDate()}
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {rowProjects.map(project => {
                  const cat = categories.find(c => c.id === project.categoryId)
                  return (
                    <tr key={project.id} style={{ opacity: dragProjectId === project.id ? 0.4 : 1 }}>
                      <td
                        style={{ ...styles.projectRowLabel, borderLeft: `3px solid ${cat?.color ?? 'var(--border)'}` }}
                        draggable
                        onDragStart={() => setDragProjectId(project.id)}
                        onDragEnd={() => setDragProjectId(null)}
                        onDragOver={e => dragProjectId && e.preventDefault()}
                        onDrop={() => handleDropOnProjectRow(project.id)}
                        title={t('board.dragProjectRowTitle')}
                      >
                        <span style={styles.dragHandle}>::</span>{project.name}
                      </td>
                      {weekDays.map(d => {
                        const ds = formatDate(d)
                        const isToday = ds === todayStr
                        const cellTasks = tasksForCell(project.id, ds)
                        const isAdding = quickAddCell?.projectId === project.id && quickAddCell.ds === ds
                        return (
                          <td
                            key={ds}
                            style={{ ...styles.dayTd, ...(isToday ? styles.dayTdToday : {}) }}
                            onDragOver={e => dragTaskId && e.preventDefault()}
                            onDrop={() => handleDropOnCell(project.id, ds, undefined)}
                          >
                            {cellTasks.map(task => {
                              const done = task.status === 'done'
                              const overdue = isOverdueTask(task, todayStr)
                              return (
                                <div
                                  key={task.id}
                                  style={{ ...styles.dayTaskRow, opacity: dragTaskId === task.id ? 0.4 : 1 }}
                                  draggable
                                  onDragStart={() => setDragTaskId(task.id)}
                                  onDragEnd={() => setDragTaskId(null)}
                                  onDragOver={e => { e.stopPropagation(); dragTaskId && e.preventDefault() }}
                                  onDrop={e => { e.stopPropagation(); handleDropOnCell(project.id, ds, task) }}
                                >
                                  <span style={styles.dragHandle} title={t('board.dragTaskTitle')}>::</span>
                                  <input type="checkbox" checked={done} onChange={() => toggleDayTaskDone(task)} />
                                  <span
                                    style={{ ...styles.dayTaskTitle, ...(overdue ? styles.dayTaskOverdue : {}), ...(done ? styles.taskNameDone : {}) }}
                                    title={`${task.title}${t('board.clickToEditSuffix')}`}
                                    onClick={() => setEditingTaskId(task.id)}
                                  >
                                    {task.title}
                                  </span>
                                </div>
                              )
                            })}
                            {isAdding ? (
                              <input
                                autoFocus
                                style={styles.dayQuickInput}
                                value={quickAddText}
                                onChange={e => setQuickAddText(e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') submitQuickAdd()
                                  if (e.key === 'Escape') cancelQuickAdd()
                                }}
                                onBlur={() => submitQuickAdd()}
                                placeholder={t('board.enterToSubmit')}
                              />
                            ) : (
                              <button style={styles.dayAddSlot} onClick={() => { setQuickAddCell({ projectId: project.id, ds }); setQuickAddText('') }}>{t('board.quickAdd')}</button>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
                {hasUnassignedWeekTasks && (
                  <tr>
                    <td style={{ ...styles.projectRowLabel, borderLeft: '3px solid var(--text-muted)' }}>{t('board.noProjectRow')}</td>
                    {weekDays.map(d => {
                      const ds = formatDate(d)
                      const isToday = ds === todayStr
                      const cellTasks = tasksForCell(undefined, ds)
                      const isAdding = quickAddCell?.projectId === undefined && quickAddCell?.ds === ds
                      return (
                        <td
                          key={ds}
                          style={{ ...styles.dayTd, ...(isToday ? styles.dayTdToday : {}) }}
                          onDragOver={e => dragTaskId && e.preventDefault()}
                          onDrop={() => handleDropOnCell(undefined, ds, undefined)}
                        >
                          {cellTasks.map(task => {
                            const done = task.status === 'done'
                            const overdue = isOverdueTask(task, todayStr)
                            return (
                              <div
                                key={task.id}
                                style={{ ...styles.dayTaskRow, opacity: dragTaskId === task.id ? 0.4 : 1 }}
                                draggable
                                onDragStart={() => setDragTaskId(task.id)}
                                onDragEnd={() => setDragTaskId(null)}
                                onDragOver={e => { e.stopPropagation(); dragTaskId && e.preventDefault() }}
                                onDrop={e => { e.stopPropagation(); handleDropOnCell(undefined, ds, task) }}
                              >
                                <span style={styles.dragHandle} title={t('board.dragTaskTitle')}>::</span>
                                <input type="checkbox" checked={done} onChange={() => toggleDayTaskDone(task)} />
                                <span
                                  style={{ ...styles.dayTaskTitle, ...(overdue ? styles.dayTaskOverdue : {}), ...(done ? styles.taskNameDone : {}) }}
                                  title={`${task.title}${t('board.clickToEditSuffix')}`}
                                  onClick={() => setEditingTaskId(task.id)}
                                >
                                  {task.title}
                                </span>
                              </div>
                            )
                          })}
                          {isAdding ? (
                            <input
                              autoFocus
                              style={styles.dayQuickInput}
                              value={quickAddText}
                              onChange={e => setQuickAddText(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') submitQuickAdd()
                                if (e.key === 'Escape') cancelQuickAdd()
                              }}
                              onBlur={() => submitQuickAdd()}
                              placeholder={t('board.enterToSubmit')}
                            />
                          ) : (
                            <button style={styles.dayAddSlot} onClick={() => { setQuickAddCell({ projectId: undefined, ds }); setQuickAddText('') }}>{t('board.quickAdd')}</button>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr>
                  <td style={styles.dayTf}>{t('monthPlan.completionRate')}</td>
                  {dayTasksMap.map(({ ds, list }) => {
                    const doneCount = list.filter(t => t.status === 'done').length
                    const total = list.length
                    const pct = total ? Math.round((doneCount / total) * 100) : 0
                    return (
                      <td
                        key={ds}
                        style={styles.dayTf}
                        title={total ? t('board.dayCompletionTitle', { pct, done: doneCount, remaining: total - doneCount }) : t('board.noTasksScheduled')}
                      >
                        {total ? `${pct}% · ${doneCount}/${total - doneCount}` : '-'}
                      </td>
                    )
                  })}
                </tr>
              </tfoot>
            </table>
          </section>
        </div>

        <div style={styles.rightCol}>
          <section style={styles.panel}>
            <h3 style={styles.panelTitle}>{t('board.cycleTimeTitle')}</h3>
            <p style={styles.hint}>{t('board.cycleTimeHint')}</p>
            <CycleTimeChart tasks={projectTasks} categories={categories} projects={projects} emptyText={t('board.noCycleTimeData')} />
          </section>

          <section style={styles.panel}>
            <h3 style={styles.panelTitle}>{t('board.byCategoryTitle')}</h3>
            <p style={styles.hint}>{t('board.byCategoryHint')}</p>
            <SwarmChart tasks={projectTasks} categories={categories} projects={projects} noCategoriesText={t('board.noCategoriesData')} noTasksText={t('monthPlan.noTaskData')} />
          </section>

          <section style={styles.panel}>
            <h3 style={styles.panelTitle}>{t('board.categoryLegendTitle')}</h3>
            <p style={styles.hint}>{t('board.categoryLegendHint')}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {categories.map(c => (
                <div key={c.id} style={styles.legendRow}>
                  <span style={{ ...styles.dot, background: c.color }} />
                  {c.name}
                </div>
              ))}
            </div>
          </section>

          <section style={styles.panel}>
            <h3 style={styles.panelTitle}>{t('board.priorityLegendTitle')}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={styles.legendRow}><span style={{ ...styles.priorityDot, background: 'var(--danger)' }} />{t('common.high')}</div>
              <div style={styles.legendRow}><span style={{ ...styles.priorityDot, background: 'var(--warning)' }} />{t('common.medium')}</div>
              <div style={styles.legendRow}><span style={{ ...styles.priorityDot, background: 'var(--success)' }} />{t('common.low')}</div>
            </div>
          </section>
        </div>
      </div>

      {editingTask && (
        <div style={styles.modalBackdrop} onClick={() => setEditingTaskId(null)}>
          <div style={styles.modalBox} onClick={e => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>{t('taskModal.editTitle')}</h3>
              <button style={styles.deleteBtn} onClick={() => setEditingTaskId(null)} aria-label={t('board.closeAria')}>x</button>
            </div>

            <label style={styles.smallLabel}>{t('taskModal.taskName')}</label>
            <input
              style={styles.input}
              value={editingTask.title}
              onChange={e => updateEditingTask({ title: e.target.value })}
            />

            <label style={styles.smallLabel}>{t('taskModal.category')}</label>
            <select
              style={styles.input}
              value={editingTask.categoryId ?? ''}
              onChange={e => updateEditingTask({ categoryId: e.target.value || undefined })}
            >
              <option value="">{t('board.noCategory')}</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>

            <label style={styles.smallLabel}>{t('taskModal.projectOptional')}</label>
            <select
              style={styles.input}
              value={editingTask.projectId ?? ''}
              onChange={e => updateEditingTask({ projectId: e.target.value || undefined })}
            >
              <option value="">{t('board.noProjectOption')}</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>

            <label style={styles.smallLabel}>{t('board.dueDatePriorityLabel')}</label>
            <div style={styles.row}>
              <input
                style={{ ...styles.input, flex: 1 }}
                type="date"
                value={editingTask.dueDate ?? ''}
                onChange={e => {
                  const value = e.target.value
                  const wasPostponed = !!editingTask.dueDate && !!value && value !== editingTask.dueDate
                  updateEditingTask({ dueDate: value || undefined, ...(wasPostponed ? { postponed: true } : {}) })
                }}
              />
              <select
                style={{ ...styles.input, width: 110 }}
                value={editingTask.priority ?? ''}
                onChange={e => updateEditingTask({ priority: (e.target.value || undefined) as PriorityLevel | undefined })}
              >
                <option value="">{t('board.noPriority')}</option>
                <option value="low">{t('common.low')}</option>
                <option value="medium">{t('common.medium')}</option>
                <option value="high">{t('common.high')}</option>
              </select>
            </div>

            <label style={styles.smallLabel}>{t('board.planTimeLabel')}</label>
            <div style={styles.row}>
              <input
                style={{ ...styles.input, flex: 1 }}
                type="time"
                value={editingPlanBlock?.startTime ?? ''}
                onChange={e => setEditingPlanTime('start', e.target.value)}
                disabled={!editingTask.dueDate}
              />
              <input
                style={{ ...styles.input, flex: 1 }}
                type="time"
                value={editingPlanBlock?.endTime ?? ''}
                onChange={e => setEditingPlanTime('end', e.target.value)}
                disabled={!editingPlanBlock}
              />
            </div>

            <button
              style={styles.modalAbandonBtn}
              onClick={() => { onUpdateProjectTask(editingTask.id, { status: 'abandoned' }); setEditingTaskId(null) }}
            >
              {t('board.abandonTask')}
            </button>
            <button
              style={styles.modalDeleteBtn}
              onClick={() => { onDeleteProjectTask(editingTask.id); setEditingTaskId(null) }}
            >
              {t('board.deleteTask')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function CycleTimeChart({ tasks, categories, projects, emptyText }: { tasks: ProjectTask[]; categories: Category[]; projects: Project[]; emptyText: string }) {
  const ordered = [...tasks].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const points = ordered
    .map((t, i) => ({ task: t, i, cycle: cycleTimeDays(t) }))
    .filter((p): p is { task: ProjectTask; i: number; cycle: number } => p.cycle !== null)

  const W = 240, H = 140, pad = 26
  if (points.length === 0) {
    return <div style={{ ...styles.chartBox, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 12 }}>{emptyText}</div>
  }
  const maxCycle = Math.max(3, ...points.map(p => p.cycle))
  const n = ordered.length

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={styles.chartBox}>
      <line x1={pad} y1={H - pad} x2={W - 6} y2={H - pad} stroke="var(--border)" />
      <line x1={pad} y1={H - pad} x2={pad} y2={6} stroke="var(--border)" />
      {points.map(p => {
        const cat = taskCategory(p.task, categories, projects)
        const x = pad + (n <= 1 ? (W - pad - 14) / 2 : (p.i / (n - 1)) * (W - pad - 14))
        const y = H - pad - (p.cycle / maxCycle) * (H - pad - 14)
        return <circle key={p.task.id} cx={x} cy={y} r={4} fill={cat?.color ?? '#999'} />
      })}
    </svg>
  )
}

function SwarmChart({ tasks, categories, projects, noCategoriesText, noTasksText }: { tasks: ProjectTask[]; categories: Category[]; projects: Project[]; noCategoriesText: string; noTasksText: string }) {
  const W = 240, H = 130
  if (categories.length === 0) {
    return <div style={{ ...styles.chartBox, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 12 }}>{noCategoriesText}</div>
  }
  if (tasks.length === 0) {
    return <div style={{ ...styles.chartBox, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 12 }}>{noTasksText}</div>
  }
  const colW = W / categories.length

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={styles.chartBox}>
      {categories.map((c, ci) => {
        const cx = colW * ci + colW / 2
        const inCat = tasks.filter(t => taskCategory(t, categories, projects)?.id === c.id)
        return (
          <g key={c.id}>
            <line x1={cx} y1={6} x2={cx} y2={H - 10} stroke="var(--border-soft)" strokeDasharray="2 3" />
            {inCat.map((t, i) => {
              const jitterX = ((i * 37) % 17) - 8
              const jitterY = 14 + ((i * 13) % (H - 32))
              const r = t.priority === 'high' ? 5.5 : t.priority === 'low' ? 3.2 : 4.3
              return <circle key={t.id} cx={cx + jitterX} cy={jitterY} r={r} fill={c.color} opacity={0.85} />
            })}
          </g>
        )
      })}
    </svg>
  )
}

function MonthDonut({ pct, label }: { pct: number; label: string }) {
  const r = 19
  const c = 2 * Math.PI * r
  const clamped = Math.max(0, Math.min(1, pct))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <svg width="48" height="48" viewBox="0 0 48 48">
        <circle cx="24" cy="24" r={r} fill="none" stroke="var(--border-soft)" strokeWidth={6} />
        <circle
          cx="24" cy="24" r={r} fill="none" stroke="var(--primary)" strokeWidth={6}
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c - c * clamped}
          transform="rotate(-90 24 24)"
        />
        <text x="24" y="28" textAnchor="middle" fontSize="11" fontWeight={700} fill="var(--text-primary)">
          {Math.round(clamped * 100)}%
        </text>
      </svg>
      <span style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 700 }}>{label}</span>
    </div>
  )
}

function SummaryMetric({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.summaryMetric}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function statusTone(status: ProjectTaskStatus): CSSProperties {
  if (status === 'done') return { background: 'var(--success-soft)', color: '#047857' }
  if (status === 'in_progress') return { background: 'var(--primary-soft)', color: 'var(--primary)' }
  return { background: 'var(--surface-muted)', color: 'var(--text-secondary)' }
}

const styles: Record<string, CSSProperties> = {
  page: { flex: 1, overflow: 'auto', padding: 28, background: 'var(--app-bg)' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 16, flexWrap: 'wrap' },
  title: { margin: 0, fontSize: 28, lineHeight: 1.15, fontWeight: 800, color: 'var(--text-primary)' },
  subtitle: { margin: '5px 0 0', color: 'var(--text-secondary)', fontSize: 14, maxWidth: 420 },
  summaryRow: { display: 'flex', gap: 10 },
  summaryMetric: { border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'var(--surface)', padding: '10px 16px', boxShadow: 'var(--shadow-card)', display: 'flex', flexDirection: 'column', gap: 3, minWidth: 90 },
  columns: { display: 'grid', gridTemplateColumns: '300px minmax(0, 1fr) 260px', gap: 14, alignItems: 'start' },
  leftCol: { display: 'flex', flexDirection: 'column', gap: 14 },
  midCol: { display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 },
  rightCol: { display: 'flex', flexDirection: 'column', gap: 14 },
  panel: { border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'var(--surface)', padding: 14, boxShadow: 'var(--shadow-card)' },
  panelTitle: { margin: '0 0 8px', fontSize: 14, color: 'var(--text-primary)', fontWeight: 800 },
  sectionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 4 },
  hideDoneLabel: { display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text-secondary)' },
  input: { border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '8px 9px', font: 'inherit', fontSize: 13, boxSizing: 'border-box', width: '100%', color: 'var(--text-primary)', background: 'var(--surface)', marginBottom: 8 },
  row: { display: 'flex', gap: 8 },
  addBtn: { border: 'none', borderRadius: 'var(--radius-sm)', background: 'var(--primary)', color: '#fff', padding: '9px 12px', cursor: 'pointer', fontWeight: 800, width: '100%' },
  taskList: { display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 520, overflow: 'auto' },
  taskRow: { display: 'flex', alignItems: 'center', gap: 8, border: '1px solid var(--border-soft)', borderRadius: 'var(--radius-sm)', padding: 8, background: 'var(--surface-soft)' },
  dot: { width: 9, height: 9, borderRadius: '50%', display: 'inline-block', flexShrink: 0 },
  priorityDot: { width: 8, height: 8, borderRadius: '50%', display: 'inline-block', flexShrink: 0 },
  taskName: { fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  taskNameDone: { textDecoration: 'line-through', color: 'var(--text-secondary)' },
  taskMeta: { fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  statusPill: { border: 'none', borderRadius: 999, padding: '4px 8px', fontSize: 11, fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap' },
  deleteBtn: { border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13, padding: '0 2px' },
  emptyText: { margin: 0, color: 'var(--text-muted)', fontSize: 13 },
  navBtn: { border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'var(--surface)', color: 'var(--text-secondary)', padding: '5px 9px', cursor: 'pointer', fontSize: 12, fontWeight: 700 },
  hint: { fontSize: 11, color: 'var(--text-muted)', margin: '0 0 8px' },
  modeSwitch: { display: 'inline-flex', gap: 2, background: 'var(--surface-muted)', border: '1px solid var(--border)', borderRadius: 999, padding: 2, marginBottom: 8 },
  modeBtn: { border: 'none', background: 'transparent', borderRadius: 999, padding: '5px 12px', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', cursor: 'pointer' },
  modeBtnActive: { background: 'var(--surface)', color: 'var(--primary)', boxShadow: '0 1px 2px rgba(15, 23, 42, 0.08)' },
  gridWrap: { overflow: 'auto' },
  grid: { display: 'grid', border: '1px solid var(--border-soft)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' },
  cell: { borderRight: '1px solid var(--border-soft)', borderBottom: '1px solid var(--border-soft)', minHeight: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: 'var(--text-muted)' },
  headCell: { background: 'var(--surface-muted)', fontWeight: 700, fontSize: 10 },
  corner: { justifyContent: 'flex-start', paddingLeft: 6 },
  rowLabel: { justifyContent: 'flex-start', paddingLeft: 6, fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', background: 'var(--surface-soft)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  blockCell: { cursor: 'pointer' },
  dotCell: { width: 15, height: 15, borderRadius: '50%', boxSizing: 'border-box' },
  todayCol: { background: '#fffbe6' },
  chartBox: { width: '100%', height: 140, display: 'block' },
  legendRow: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-primary)' },
  habitStatsLabel: { fontSize: 10, color: 'var(--text-secondary)', whiteSpace: 'nowrap' },
  habitBarTrack: { height: 6, background: 'var(--surface-muted)', borderRadius: 3, overflow: 'hidden' },
  habitBarFill: { height: '100%', borderRadius: 3 },
  archiveBtn: { border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-secondary)', borderRadius: 999, padding: '3px 9px', fontSize: 10, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' },
  archivedToggle: { border: 'none', background: 'transparent', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: 0 },
  dayTaskRow: { display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, cursor: 'grab' },
  dragHandle: { color: 'var(--text-muted)', fontSize: 10, cursor: 'grab', flexShrink: 0, letterSpacing: -1 },
  dayTaskTitle: { flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-primary)' },
  dayTaskOverdue: { color: 'var(--danger)' },
  projectTag: { fontSize: 9, padding: '1px 6px', borderRadius: 999, background: 'var(--surface-muted)', color: 'var(--text-secondary)', whiteSpace: 'nowrap', flexShrink: 0 },
  dayTable: { width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontSize: 11 },
  dayTh: { border: '1px solid var(--border-soft)', background: 'var(--surface-muted)', padding: '5px 4px', fontWeight: 700, fontSize: 10, textAlign: 'center', lineHeight: 1.4, color: 'var(--text-secondary)' },
  dayThToday: { background: 'var(--primary-soft)', color: 'var(--primary)' },
  dayTd: { border: '1px solid var(--border-soft)', padding: '5px 6px', verticalAlign: 'top', height: 26 },
  dayTdToday: { background: '#fffbe6' },
  dayQuickInput: { width: '100%', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 5px', font: 'inherit', fontSize: 11, boxSizing: 'border-box' },
  dayAddSlot: { border: 'none', background: 'transparent', color: 'var(--text-muted)', fontSize: 11, cursor: 'pointer', padding: 0 },
  dayTf: { border: '1px solid var(--border-soft)', background: 'var(--surface-muted)', padding: '5px 4px', fontSize: 10, textAlign: 'center', color: 'var(--text-secondary)' },
  rowControls: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' },
  rowSortLabel: { fontSize: 11, color: 'var(--text-secondary)', fontWeight: 700 },
  rowSortSelect: { border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '4px 22px 4px 8px', font: 'inherit', fontSize: 11, color: 'var(--text-primary)', background: 'var(--surface)' },
  projectHeadCell: { textAlign: 'left', paddingLeft: 8, width: 92 },
  projectRowLabel: { border: '1px solid var(--border-soft)', background: 'var(--surface-soft)', padding: '5px 8px', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', cursor: 'grab', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  modalBackdrop: { position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 },
  modalBox: { background: 'var(--surface)', borderRadius: 'var(--radius-md)', padding: 16, width: 320, boxShadow: 'var(--shadow-popover)', maxHeight: '80vh', overflow: 'auto', boxSizing: 'border-box' },
  modalHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  modalTitle: { margin: 0, fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' },
  smallLabel: { fontSize: 11, color: 'var(--text-secondary)', fontWeight: 700, marginBottom: 3, display: 'block' },
  modalDeleteBtn: { border: '1px solid var(--danger)', borderRadius: 'var(--radius-sm)', background: 'transparent', color: 'var(--danger)', padding: '8px 10px', width: '100%', cursor: 'pointer', fontWeight: 700, fontSize: 12, marginTop: 4 },
  modalAbandonBtn: { border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'transparent', color: 'var(--text-secondary)', padding: '8px 10px', width: '100%', cursor: 'pointer', fontWeight: 700, fontSize: 12, marginTop: 8 },
  overdueTag: { fontSize: 9, fontWeight: 800, color: 'var(--danger)', background: 'var(--danger-soft)', borderRadius: 999, padding: '1px 7px', whiteSpace: 'nowrap', flexShrink: 0 },
  overdueActionBtn: { border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-secondary)', borderRadius: 999, padding: '2px 9px', fontSize: 10, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' },
  overduePostponeInput: { border: '1px solid var(--border)', borderRadius: 4, padding: '2px 5px', font: 'inherit', fontSize: 10, boxSizing: 'border-box' },
}
