import { useState, type CSSProperties } from 'react'
import type { Category, HabitItem, Project, ProjectTask, ProjectTaskStatus, PriorityLevel, TaskBlock } from '../types'
import { formatDate, timeToMinutes, minutesToTime } from '../utils/time'

interface Props {
  projectTasks: ProjectTask[]
  categories: Category[]
  projects: Project[]
  tasks: TaskBlock[]
  habits: HabitItem[]
  onAddProjectTask: (task: Omit<ProjectTask, 'id' | 'createdAt' | 'completedAt'>, options?: { skipCompletedAt?: boolean }) => string
  onUpdateProjectTask: (id: string, updates: Partial<Omit<ProjectTask, 'id' | 'createdAt'>>) => void
  onDeleteProjectTask: (id: string) => void
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
const STATUS_LABEL: Record<ProjectTaskStatus, string> = { todo: '待办', in_progress: '进行中', done: '已完成' }
const WEEKDAY_LABEL = ['一', '二', '三', '四', '五', '六', '日']

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
function priorityLabel(priority?: PriorityLevel) {
  if (priority === 'high') return '高'
  if (priority === 'medium') return '中'
  if (priority === 'low') return '低'
  return '无优先级'
}
function taskCategory(task: ProjectTask, categories: Category[], projects: Project[]): Category | undefined {
  if (task.categoryId) return categories.find(c => c.id === task.categoryId)
  const project = task.projectId ? projects.find(p => p.id === task.projectId) : undefined
  return project ? categories.find(c => c.id === project.categoryId) : undefined
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
  onAddProjectTask, onUpdateProjectTask, onDeleteProjectTask,
  onAddTask, onUpdateTask, onDeleteTask,
  onAddHabit, onDeleteHabit, onArchiveHabit, onUnarchiveHabit,
}: Props) {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(startOfToday()))
  const [form, setForm] = useState<NewTaskForm>({ ...emptyForm, categoryId: categories[0]?.id ?? '' })
  const [hideDone, setHideDone] = useState(false)
  const [habitName, setHabitName] = useState('')
  const [habitCategoryId, setHabitCategoryId] = useState('')
  const [showArchivedHabits, setShowArchivedHabits] = useState(false)
  const [quickAddDs, setQuickAddDs] = useState<string | null>(null)
  const [quickAddText, setQuickAddText] = useState('')
  const [dragTaskId, setDragTaskId] = useState<string | null>(null)
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const todayStr = formatDate(startOfToday())

  const visibleTasks = [...projectTasks]
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
      .filter(t => t.dueDate === ds)
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
  const maxSlots = Math.max(4, ...dayTasksMap.map(d => d.list.length + 1))

  const submitQuickAdd = (ds: string) => {
    const title = quickAddText.trim()
    if (title) onAddProjectTask({ title, status: 'todo', dueDate: ds })
    setQuickAddDs(null)
    setQuickAddText('')
  }
  const cancelQuickAdd = () => { setQuickAddDs(null); setQuickAddText('') }

  const handleDropOnDay = (ds: string, targetTask: ProjectTask | undefined) => {
    if (!dragTaskId) return
    const list = tasksForDay(ds)
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

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>任务看板</h1>
          <p style={styles.subtitle}>所有任务都在这里管理。实际花费的时间仍会同步到周视图和统计页。</p>
        </div>
        <div style={styles.summaryRow}>
          {overallHabitStats && <MonthDonut pct={overallHabitStats.pct} />}
          <SummaryMetric label="待办" value={String(todoCount)} />
          <SummaryMetric label="进行中" value={String(inProgressCount)} />
          <SummaryMetric label="已完成" value={String(doneCount)} />
        </div>
      </div>

      <div style={styles.columns}>
        <div style={styles.leftCol}>
          <section style={styles.panel}>
            <h3 style={styles.panelTitle}>添加任务</h3>
            <input
              style={styles.input}
              placeholder="任务名称"
              value={form.title}
              onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && handleAddTask()}
            />
            <select style={styles.input} value={form.categoryId} onChange={e => setForm(prev => ({ ...prev, categoryId: e.target.value }))}>
              <option value="">选择分类</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select style={styles.input} value={form.projectId} onChange={e => setForm(prev => ({ ...prev, projectId: e.target.value }))}>
              <option value="">不挂项目</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <div style={styles.row}>
              <input style={{ ...styles.input, flex: 1 }} type="date" value={form.dueDate} onChange={e => setForm(prev => ({ ...prev, dueDate: e.target.value }))} />
              <select style={{ ...styles.input, width: 120 }} value={form.priority} onChange={e => setForm(prev => ({ ...prev, priority: e.target.value as PriorityLevel }))}>
                <option value="low">低</option>
                <option value="medium">中</option>
                <option value="high">高</option>
              </select>
            </div>
            <label style={styles.smallLabel}>计划时间(可选，会同步到周视图)</label>
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
            <button style={styles.addBtn} onClick={handleAddTask}>+ 添加任务</button>
          </section>

          <section style={styles.panel}>
            <div style={styles.sectionHeader}>
              <h3 style={styles.panelTitle}>任务清单</h3>
              <label style={styles.hideDoneLabel}>
                <input type="checkbox" checked={hideDone} onChange={e => setHideDone(e.target.checked)} />
                隐藏已完成
              </label>
            </div>
            <div style={styles.taskList}>
              {visibleTasks.map(task => {
                const cat = taskCategory(task, categories, projects)
                const project = task.projectId ? projects.find(p => p.id === task.projectId) : undefined
                return (
                  <div key={task.id} style={styles.taskRow}>
                    <span style={{ ...styles.dot, background: cat?.color ?? '#999' }} />
                    <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => setEditingTaskId(task.id)}>
                      <div style={{ ...styles.taskName, ...(task.status === 'done' ? styles.taskNameDone : {}) }} title="点击编辑">{task.title}</div>
                      <div style={styles.taskMeta}>
                        {cat?.name ?? '无分类'}{project ? ` · ${project.name}` : ''}{task.dueDate ? ` · 截止 ${task.dueDate}` : ''}
                      </div>
                    </div>
                    <span style={{ ...styles.priorityDot, background: priorityColor(task.priority) }} title={priorityLabel(task.priority)} />
                    <button style={{ ...styles.statusPill, ...statusTone(task.status) }} onClick={() => toggleStatus(task)}>
                      {STATUS_LABEL[task.status]}
                    </button>
                    <button style={styles.deleteBtn} onClick={() => onDeleteProjectTask(task.id)} aria-label="删除任务">x</button>
                  </div>
                )
              })}
              {visibleTasks.length === 0 && <p style={styles.emptyText}>暂无任务，从上面添加一个吧。</p>}
            </div>
          </section>

          <section style={styles.panel}>
            <h3 style={styles.panelTitle}>习惯</h3>
            <p style={styles.hint}>这些是周期性打卡的小事(早睡、运动、阅读…)，不会挤进任务清单，只出现在进度网格的"习惯"视图里。</p>
            <div style={styles.row}>
              <input
                style={{ ...styles.input, flex: 1, marginBottom: 0 }}
                placeholder="习惯名称，比如早睡"
                value={habitName}
                onChange={e => setHabitName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddHabit()}
              />
              <select style={{ ...styles.input, width: 110, marginBottom: 0 }} value={habitCategoryId} onChange={e => setHabitCategoryId(e.target.value)}>
                <option value="">无分类</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <button style={{ ...styles.addBtn, marginTop: 8 }} onClick={handleAddHabit}>+ 添加习惯</button>
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
                        <button style={styles.archiveBtn} onClick={() => onArchiveHabit(h.id)}>归档</button>
                        <button style={styles.deleteBtn} onClick={() => onDeleteHabit(h.id)} aria-label="永久删除习惯">x</button>
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
                  {showArchivedHabits ? '收起' : '展开'}已归档习惯 ({archivedHabits.length})
                </button>
                {showArchivedHabits && (
                  <div style={{ ...styles.taskList, marginTop: 8 }}>
                    {archivedHabits.map(h => (
                      <div key={h.id} style={styles.taskRow}>
                        <span style={{ ...styles.dot, background: 'var(--text-muted)' }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ ...styles.taskName, color: 'var(--text-secondary)' }}>{h.name}</div>
                        </div>
                        <button style={styles.archiveBtn} onClick={() => onUnarchiveHabit(h.id)}>恢复</button>
                        <button style={styles.deleteBtn} onClick={() => onDeleteHabit(h.id)} aria-label="永久删除习惯">x</button>
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
              <h3 style={styles.panelTitle}>日计划</h3>
              <div style={styles.row}>
                <button style={styles.navBtn} onClick={() => setWeekStart(addDays(weekStart, -7))}>&#8249; 上一周</button>
                <button style={styles.navBtn} onClick={() => setWeekStart(startOfWeek(startOfToday()))}>本周</button>
                <button style={styles.navBtn} onClick={() => setWeekStart(addDays(weekStart, 7))}>下一周 &#8250;</button>
              </div>
            </div>
            <p style={styles.hint}>按截止日期落在每一天的任务，勾选即完成。没有截止日期的任务留在左侧任务清单里。</p>

            <table style={styles.dayTable}>
              <thead>
                <tr>
                  {weekDays.map((d, i) => {
                    const ds = formatDate(d)
                    const isToday = ds === todayStr
                    return (
                      <th key={ds} style={{ ...styles.dayTh, ...(isToday ? styles.dayThToday : {}) }}>
                        周{WEEKDAY_LABEL[i]}{isToday ? ' · 今天' : ''}<br />{d.getMonth() + 1}/{d.getDate()}
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: maxSlots }).map((_, rowIdx) => (
                  <tr key={rowIdx}>
                    {dayTasksMap.map(({ ds, list }) => {
                      const isToday = ds === todayStr
                      const task = list[rowIdx]
                      const isAddSlot = !task && rowIdx === list.length
                      const project = task?.projectId ? projects.find(p => p.id === task.projectId) : undefined
                      const done = task?.status === 'done'
                      return (
                        <td
                          key={ds}
                          style={{ ...styles.dayTd, ...(isToday ? styles.dayTdToday : {}) }}
                          onDragOver={e => dragTaskId && e.preventDefault()}
                          onDrop={() => handleDropOnDay(ds, task)}
                        >
                          {task && (
                            <div
                              style={{ ...styles.dayTaskRow, opacity: dragTaskId === task.id ? 0.4 : 1 }}
                              draggable
                              onDragStart={() => setDragTaskId(task.id)}
                              onDragEnd={() => setDragTaskId(null)}
                            >
                              <span style={styles.dragHandle} title="拖动排序">::</span>
                              <input type="checkbox" checked={done} onChange={() => toggleDayTaskDone(task)} />
                              <span
                                style={{ ...styles.dayTaskTitle, ...(done ? styles.taskNameDone : {}) }}
                                title={`${task.title}（点击编辑）`}
                                onClick={() => setEditingTaskId(task.id)}
                              >
                                {task.title}
                              </span>
                              {project && <span style={styles.projectTag}>{project.name}</span>}
                            </div>
                          )}
                          {!task && isAddSlot && (
                            quickAddDs === ds ? (
                              <input
                                autoFocus
                                style={styles.dayQuickInput}
                                value={quickAddText}
                                onChange={e => setQuickAddText(e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') submitQuickAdd(ds)
                                  if (e.key === 'Escape') cancelQuickAdd()
                                }}
                                onBlur={() => submitQuickAdd(ds)}
                                placeholder="输入后回车"
                              />
                            ) : (
                              <button style={styles.dayAddSlot} onClick={() => { setQuickAddDs(ds); setQuickAddText('') }}>+ 添加</button>
                            )
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  {dayTasksMap.map(({ ds, list }) => {
                    const doneCount = list.filter(t => t.status === 'done').length
                    const total = list.length
                    const pct = total ? Math.round((doneCount / total) * 100) : 0
                    return (
                      <td
                        key={ds}
                        style={styles.dayTf}
                        title={total ? `完成率 ${pct}% · 已完成 ${doneCount} · 未完成 ${total - doneCount}` : '这天没有安排任务'}
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
            <h3 style={styles.panelTitle}>周期时间</h3>
            <p style={styles.hint}>每个已完成任务从创建到完成的天数。</p>
            <CycleTimeChart tasks={projectTasks} categories={categories} projects={projects} />
          </section>

          <section style={styles.panel}>
            <h3 style={styles.panelTitle}>按分类</h3>
            <p style={styles.hint}>每一列对应一个分类(见下方图例)，每个点是一个任务。</p>
            <SwarmChart tasks={projectTasks} categories={categories} projects={projects} />
          </section>

          <section style={styles.panel}>
            <h3 style={styles.panelTitle}>分类图例</h3>
            <p style={styles.hint}>颜色跟随"设置"里的分类颜色。</p>
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
            <h3 style={styles.panelTitle}>优先级图例</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={styles.legendRow}><span style={{ ...styles.priorityDot, background: 'var(--danger)' }} />高</div>
              <div style={styles.legendRow}><span style={{ ...styles.priorityDot, background: 'var(--warning)' }} />中</div>
              <div style={styles.legendRow}><span style={{ ...styles.priorityDot, background: 'var(--success)' }} />低</div>
            </div>
          </section>
        </div>
      </div>

      {editingTask && (
        <div style={styles.modalBackdrop} onClick={() => setEditingTaskId(null)}>
          <div style={styles.modalBox} onClick={e => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>编辑任务</h3>
              <button style={styles.deleteBtn} onClick={() => setEditingTaskId(null)} aria-label="关闭">x</button>
            </div>

            <label style={styles.smallLabel}>任务名称</label>
            <input
              style={styles.input}
              value={editingTask.title}
              onChange={e => updateEditingTask({ title: e.target.value })}
            />

            <label style={styles.smallLabel}>分类</label>
            <select
              style={styles.input}
              value={editingTask.categoryId ?? ''}
              onChange={e => updateEditingTask({ categoryId: e.target.value || undefined })}
            >
              <option value="">无分类</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>

            <label style={styles.smallLabel}>项目(可选)</label>
            <select
              style={styles.input}
              value={editingTask.projectId ?? ''}
              onChange={e => updateEditingTask({ projectId: e.target.value || undefined })}
            >
              <option value="">不挂项目</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>

            <label style={styles.smallLabel}>截止日期 / 优先级</label>
            <div style={styles.row}>
              <input
                style={{ ...styles.input, flex: 1 }}
                type="date"
                value={editingTask.dueDate ?? ''}
                onChange={e => updateEditingTask({ dueDate: e.target.value || undefined })}
              />
              <select
                style={{ ...styles.input, width: 110 }}
                value={editingTask.priority ?? ''}
                onChange={e => updateEditingTask({ priority: (e.target.value || undefined) as PriorityLevel | undefined })}
              >
                <option value="">无优先级</option>
                <option value="low">低</option>
                <option value="medium">中</option>
                <option value="high">高</option>
              </select>
            </div>

            <label style={styles.smallLabel}>计划时间(可选，会同步到周视图)</label>
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
              style={styles.modalDeleteBtn}
              onClick={() => { onDeleteProjectTask(editingTask.id); setEditingTaskId(null) }}
            >
              删除任务
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function CycleTimeChart({ tasks, categories, projects }: { tasks: ProjectTask[]; categories: Category[]; projects: Project[] }) {
  const ordered = [...tasks].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const points = ordered
    .map((t, i) => ({ task: t, i, cycle: cycleTimeDays(t) }))
    .filter((p): p is { task: ProjectTask; i: number; cycle: number } => p.cycle !== null)

  const W = 240, H = 140, pad = 26
  if (points.length === 0) {
    return <div style={{ ...styles.chartBox, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 12 }}>暂无已完成任务数据</div>
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

function SwarmChart({ tasks, categories, projects }: { tasks: ProjectTask[]; categories: Category[]; projects: Project[] }) {
  const W = 240, H = 130
  if (categories.length === 0) {
    return <div style={{ ...styles.chartBox, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 12 }}>暂无分类</div>
  }
  if (tasks.length === 0) {
    return <div style={{ ...styles.chartBox, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 12 }}>暂无任务数据</div>
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

function MonthDonut({ pct }: { pct: number }) {
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
      <span style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 700 }}>本月习惯</span>
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
  projectTag: { fontSize: 9, padding: '1px 6px', borderRadius: 999, background: 'var(--surface-muted)', color: 'var(--text-secondary)', whiteSpace: 'nowrap', flexShrink: 0 },
  dayTable: { width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontSize: 11 },
  dayTh: { border: '1px solid var(--border-soft)', background: 'var(--surface-muted)', padding: '5px 4px', fontWeight: 700, fontSize: 10, textAlign: 'center', lineHeight: 1.4, color: 'var(--text-secondary)' },
  dayThToday: { background: 'var(--primary-soft)', color: 'var(--primary)' },
  dayTd: { border: '1px solid var(--border-soft)', padding: '5px 6px', verticalAlign: 'top', height: 26 },
  dayTdToday: { background: '#fffbe6' },
  dayQuickInput: { width: '100%', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 5px', font: 'inherit', fontSize: 11, boxSizing: 'border-box' },
  dayAddSlot: { border: 'none', background: 'transparent', color: 'var(--text-muted)', fontSize: 11, cursor: 'pointer', padding: 0 },
  dayTf: { border: '1px solid var(--border-soft)', background: 'var(--surface-muted)', padding: '5px 4px', fontSize: 10, textAlign: 'center', color: 'var(--text-secondary)' },
  modalBackdrop: { position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 },
  modalBox: { background: 'var(--surface)', borderRadius: 'var(--radius-md)', padding: 16, width: 320, boxShadow: 'var(--shadow-popover)', maxHeight: '80vh', overflow: 'auto', boxSizing: 'border-box' },
  modalHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  modalTitle: { margin: 0, fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' },
  smallLabel: { fontSize: 11, color: 'var(--text-secondary)', fontWeight: 700, marginBottom: 3, display: 'block' },
  modalDeleteBtn: { border: '1px solid var(--danger)', borderRadius: 'var(--radius-sm)', background: 'transparent', color: 'var(--danger)', padding: '8px 10px', width: '100%', cursor: 'pointer', fontWeight: 700, fontSize: 12, marginTop: 4 },
}
