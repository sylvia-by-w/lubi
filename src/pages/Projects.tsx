import { useState, type CSSProperties } from 'react'
import type { Category, Deadline, PriorityLevel, Project, ProjectStatus, ProjectTask, ProjectTaskStatus, TaskBlock } from '../types'
import { timeToMinutes } from '../utils/time'

interface Props {
  projects: Project[]
  categories: Category[]
  deadlines: Deadline[]
  calendarTasks: TaskBlock[]
  projectTasks: ProjectTask[]
  weekStart: Date
  onUpdateProject: (id: string, updates: Partial<Omit<Project, 'id' | 'createdAt'>>) => void
  onAddProjectTask: (task: Omit<ProjectTask, 'id' | 'createdAt' | 'completedAt'>, options?: { skipCompletedAt?: boolean }) => string
  onUpdateProjectTask: (id: string, updates: Partial<Omit<ProjectTask, 'id' | 'createdAt'>>) => void
  onDeleteProjectTask: (id: string) => void
}

interface ProjectTaskForm {
  title: string
  status: ProjectTaskStatus
  dueDate: string
  estimatedHours: string
  estimatedMinutes: string
  priority: PriorityLevel | ''
}

const statuses: ProjectStatus[] = ['active', 'paused', 'completed', 'archived']
const taskStatuses: ProjectTaskStatus[] = ['todo', 'in_progress', 'done']

const emptyTaskForm: ProjectTaskForm = {
  title: '',
  status: 'todo',
  dueDate: '',
  estimatedHours: '',
  estimatedMinutes: '',
  priority: '',
}

function calcMinutes(tasks: TaskBlock[]) {
  return tasks.reduce((sum, task) => sum + timeToMinutes(task.endTime) - timeToMinutes(task.startTime), 0)
}

function fmtHours(minutes: number) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m === 0 ? `${h}h` : `${h}h${m}m`
}

function fmtEstimate(minutes: number) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h${m}m`
}

function taskEstimateMinutes(task: ProjectTask) {
  return task.estimatedMinutes ?? (task.estimatedHours !== undefined ? task.estimatedHours * 60 : undefined)
}

function formatStatus(status: string) {
  return status.replace('_', ' ')
}

function projectStatus(project: Project): ProjectStatus {
  return project.status ?? 'active'
}

function weekDateSet(weekStart: Date) {
  return new Set(Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart)
    date.setDate(weekStart.getDate() + index)
    return date.toISOString().slice(0, 10)
  }))
}

function taskToForm(task: ProjectTask): ProjectTaskForm {
  const estimatedMinutes = taskEstimateMinutes(task)
  return {
    title: task.title,
    status: task.status,
    dueDate: task.dueDate ?? '',
    estimatedHours: estimatedMinutes !== undefined ? String(Math.floor(estimatedMinutes / 60)) : '',
    estimatedMinutes: estimatedMinutes !== undefined ? String(estimatedMinutes % 60) : '',
    priority: task.priority ?? '',
  }
}

export default function Projects({
  projects,
  categories,
  deadlines,
  calendarTasks,
  projectTasks,
  weekStart,
  onUpdateProject,
  onAddProjectTask,
  onUpdateProjectTask,
  onDeleteProjectTask,
}: Props) {
  const [filter, setFilter] = useState<ProjectStatus | 'all'>('active')
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [pinWarning, setPinWarning] = useState('')
  const selectedProject = selectedProjectId ? projects.find(project => project.id === selectedProjectId) : undefined
  const visibleProjects = projects.filter(project => filter === 'all' || projectStatus(project) === filter)
  const pinnedCount = projects.filter(project => project.pinnedToHome).length

  const togglePin = (project: Project) => {
    setPinWarning('')
    if (!project.pinnedToHome && pinnedCount >= 3) {
      setPinWarning('You can pin up to 3 projects to the homepage.')
      return
    }

    const nextHomeOrder = projects.reduce((max, item) => Math.max(max, item.homeOrder ?? 0), 0) + 1
    onUpdateProject(project.id, {
      pinnedToHome: !project.pinnedToHome,
      homeOrder: project.pinnedToHome ? undefined : nextHomeOrder,
    })
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Projects</h1>
          <p style={styles.subtitle}>Long-term goals, milestones, and invested time.</p>
        </div>
        <div style={styles.filterRow}>
          {pinWarning && <span style={styles.warning}>{pinWarning}</span>}
          <button style={{ ...styles.filterBtn, ...(filter === 'all' ? styles.filterBtnActive : {}) }} onClick={() => setFilter('all')}>All</button>
          {statuses.map(status => (
            <button
              key={status}
              style={{ ...styles.filterBtn, ...(filter === status ? styles.filterBtnActive : {}) }}
              onClick={() => setFilter(status)}
            >
              {formatStatus(status)}
            </button>
          ))}
        </div>
      </div>

      {visibleProjects.length === 0 ? (
        <div style={styles.emptyCard}>No projects in this view. Add projects in Settings for now.</div>
      ) : (
        <div style={styles.grid}>
          {visibleProjects.map(project => (
            <ProjectCard
              key={project.id}
              project={project}
              categories={categories}
              deadlines={deadlines}
              calendarTasks={calendarTasks}
              projectTasks={projectTasks}
              weekStart={weekStart}
              onTogglePin={() => togglePin(project)}
              onClick={() => setSelectedProjectId(project.id)}
            />
          ))}
        </div>
      )}

      {selectedProject && (
        <ProjectDetail
          project={selectedProject}
          categories={categories}
          deadlines={deadlines}
          calendarTasks={calendarTasks}
          projectTasks={projectTasks.filter(task => task.projectId === selectedProject.id)}
          weekStart={weekStart}
          pinnedCount={pinnedCount}
          onClose={() => setSelectedProjectId(null)}
          onUpdateProject={updates => onUpdateProject(selectedProject.id, updates)}
          onTogglePin={() => togglePin(selectedProject)}
          onAddProjectTask={onAddProjectTask}
          onUpdateProjectTask={onUpdateProjectTask}
          onDeleteProjectTask={onDeleteProjectTask}
        />
      )}
    </div>
  )
}

function ProjectCard({
  project,
  categories,
  deadlines,
  calendarTasks,
  projectTasks,
  weekStart,
  onTogglePin,
  onClick,
}: {
  project: Project
  categories: Category[]
  deadlines: Deadline[]
  calendarTasks: TaskBlock[]
  projectTasks: ProjectTask[]
  weekStart: Date
  onTogglePin: () => void
  onClick: () => void
}) {
  const category = categories.find(cat => cat.id === project.categoryId)
  const deadline = project.deadlineId ? deadlines.find(item => item.id === project.deadlineId) : undefined
  const actualTasks = calendarTasks.filter(task => task.projectId === project.id && task.type === 'actual')
  const investedMinutes = calcMinutes(actualTasks)
  const weekDates = weekDateSet(weekStart)
  const thisWeekMinutes = calcMinutes(actualTasks.filter(task => weekDates.has(task.date)))
  const linkedTasks = projectTasks.filter(task => task.projectId === project.id)
  const doneTasks = linkedTasks.filter(task => task.status === 'done').length
  const targetMinutes = (project.targetHours ?? 0) * 60
  const timeRatio = targetMinutes > 0 ? Math.min(investedMinutes / targetMinutes, 1) : 0
  const taskRatio = linkedTasks.length > 0 ? doneTasks / linkedTasks.length : 0

  return (
    <button style={styles.projectCard} onClick={onClick}>
      <div style={styles.cardTop}>
        <div>
          <h2 style={styles.projectName}>{project.name}</h2>
          <span style={styles.categoryLine}>
            <span style={{ ...styles.dot, background: category?.color ?? '#9ca3af' }} />
            {category?.name ?? 'Unknown'}
          </span>
        </div>
        <div style={styles.cardActions}>
          <button
            style={{ ...styles.pinBtn, ...(project.pinnedToHome ? styles.pinBtnActive : {}) }}
            onClick={event => {
              event.stopPropagation()
              onTogglePin()
            }}
            title={project.pinnedToHome ? 'Pinned to homepage' : 'Pin to homepage'}
          >
            {project.pinnedToHome ? '★ Pinned' : '☆ Pin'}
          </button>
          <span style={styles.statusPill}>{formatStatus(projectStatus(project))}</span>
        </div>
      </div>

      <div style={styles.metricGrid}>
        <Metric label="Invested" value={fmtHours(investedMinutes)} />
        <Metric label="This week" value={fmtHours(thisWeekMinutes)} />
        <Metric label="Tasks" value={`${doneTasks}/${linkedTasks.length}`} />
      </div>

      <Progress label={project.targetHours ? `Target ${project.targetHours}h` : 'No target'} value={timeRatio} color={category?.color ?? '#6366f1'} />
      <Progress label="Task progress" value={taskRatio} color={category?.color ?? '#6366f1'} />

      <div style={styles.deadlineLine}>
        {deadline ? `Deadline ${deadline.date}` : 'No linked deadline'}
      </div>
    </button>
  )
}

function ProjectDetail({
  project,
  categories,
  deadlines,
  calendarTasks,
  projectTasks,
  weekStart,
  pinnedCount,
  onClose,
  onUpdateProject,
  onTogglePin,
  onAddProjectTask,
  onUpdateProjectTask,
  onDeleteProjectTask,
}: {
  project: Project
  categories: Category[]
  deadlines: Deadline[]
  calendarTasks: TaskBlock[]
  projectTasks: ProjectTask[]
  weekStart: Date
  pinnedCount: number
  onClose: () => void
  onUpdateProject: (updates: Partial<Omit<Project, 'id' | 'createdAt'>>) => void
  onTogglePin: () => void
  onAddProjectTask: (task: Omit<ProjectTask, 'id' | 'createdAt' | 'completedAt'>, options?: { skipCompletedAt?: boolean }) => string
  onUpdateProjectTask: (id: string, updates: Partial<Omit<ProjectTask, 'id' | 'createdAt'>>) => void
  onDeleteProjectTask: (id: string) => void
}) {
  const category = categories.find(cat => cat.id === project.categoryId)
  const [description, setDescription] = useState(project.description ?? '')
  const [targetHours, setTargetHours] = useState(project.targetHours ? String(project.targetHours) : '')
  const [status, setStatus] = useState<ProjectStatus>(projectStatus(project))
  const [deadlineId, setDeadlineId] = useState(project.deadlineId ?? '')
  const [taskForm, setTaskForm] = useState<ProjectTaskForm>(emptyTaskForm)
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const actualTasks = calendarTasks.filter(task => task.projectId === project.id && task.type === 'actual')
  const investedMinutes = calcMinutes(actualTasks)
  const weekDates = weekDateSet(weekStart)
  const thisWeekMinutes = calcMinutes(actualTasks.filter(task => weekDates.has(task.date)))
  const doneTasks = projectTasks.filter(task => task.status === 'done').length
  const targetMinutes = (project.targetHours ?? 0) * 60
  const timeRatio = targetMinutes > 0 ? Math.min(investedMinutes / targetMinutes, 1) : 0
  const taskRatio = projectTasks.length > 0 ? doneTasks / projectTasks.length : 0
  const recentRecords = [...actualTasks].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8)

  const saveOverview = () => {
    onUpdateProject({
      description,
      status,
      deadlineId: deadlineId || undefined,
      targetHours: targetHours ? Number(targetHours) : undefined,
    })
  }

  const saveProjectTask = () => {
    if (!taskForm.title.trim()) return
    const estimatedMinutes =
      (taskForm.estimatedHours ? Number(taskForm.estimatedHours) * 60 : 0) +
      (taskForm.estimatedMinutes ? Number(taskForm.estimatedMinutes) : 0)
    const payload = {
      projectId: project.id,
      title: taskForm.title.trim(),
      status: taskForm.status,
      dueDate: taskForm.dueDate || undefined,
      estimatedMinutes: estimatedMinutes > 0 ? estimatedMinutes : undefined,
      estimatedHours: undefined,
      priority: taskForm.priority || undefined,
    }
    if (editingTaskId) {
      onUpdateProjectTask(editingTaskId, payload)
    } else {
      onAddProjectTask(payload)
    }
    setTaskForm(emptyTaskForm)
    setEditingTaskId(null)
  }

  const duplicateProjectTask = (task: ProjectTask) => {
    const copy = {
      projectId: task.projectId,
      title: `${task.title} Copy`,
      status: task.status,
      dueDate: task.dueDate,
      estimatedMinutes: taskEstimateMinutes(task),
      estimatedHours: undefined,
      priority: task.priority,
    }
    const copiedId = onAddProjectTask(copy, { skipCompletedAt: true })
    setTaskForm({
      title: copy.title,
      status: copy.status,
      dueDate: copy.dueDate ?? '',
      estimatedHours: copy.estimatedMinutes !== undefined ? String(Math.floor(copy.estimatedMinutes / 60)) : '',
      estimatedMinutes: copy.estimatedMinutes !== undefined ? String(copy.estimatedMinutes % 60) : '',
      priority: copy.priority ?? '',
    })
    setEditingTaskId(copiedId)
  }

  const toggleProjectTaskDone = (task: ProjectTask) => {
    if (task.status === 'done') {
      onUpdateProjectTask(task.id, { status: 'todo', completedAt: undefined })
      return
    }

    onUpdateProjectTask(task.id, { status: 'done', completedAt: new Date().toISOString() })
  }

  return (
    <div style={styles.overlay}>
      <div style={styles.detailPanel}>
        <div style={styles.detailHeader}>
          <div>
            <h2 style={styles.detailTitle}>{project.name}</h2>
            <span style={styles.categoryLine}>
              <span style={{ ...styles.dot, background: category?.color ?? '#9ca3af' }} />
              {category?.name ?? 'Unknown'}
            </span>
          </div>
          <div style={styles.detailActions}>
            <button
              style={{ ...styles.pinBtn, ...(project.pinnedToHome ? styles.pinBtnActive : {}) }}
              onClick={onTogglePin}
              title={project.pinnedToHome ? 'Pinned to homepage' : 'Pin to homepage'}
            >
              {project.pinnedToHome ? '★ Pinned' : '☆ Pin to Home'}
            </button>
            {!project.pinnedToHome && pinnedCount >= 3 && (
              <span style={styles.warning}>You can pin up to 3 projects to the homepage.</span>
            )}
            <button style={styles.closeBtn} onClick={onClose}>x</button>
          </div>
        </div>

        <div style={styles.twoCol}>
          <section style={styles.panelSection}>
            <h3 style={styles.sectionTitle}>Overview</h3>
            <label style={styles.label}>Description</label>
            <textarea style={{ ...styles.input, minHeight: 78 }} value={description} onChange={e => setDescription(e.target.value)} />

            <div style={styles.row}>
              <div style={{ flex: 1 }}>
                <label style={styles.label}>Target hours</label>
                <input style={styles.input} type="number" min="0" value={targetHours} onChange={e => setTargetHours(e.target.value)} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={styles.label}>Status</label>
                <select style={styles.input} value={status} onChange={e => setStatus(e.target.value as ProjectStatus)}>
                  {statuses.map(item => <option key={item} value={item}>{formatStatus(item)}</option>)}
                </select>
              </div>
            </div>

            <label style={styles.label}>Deadline</label>
            <select style={styles.input} value={deadlineId} onChange={e => setDeadlineId(e.target.value)}>
              <option value="">No deadline</option>
              {deadlines.map(deadline => (
                <option key={deadline.id} value={deadline.id}>{deadline.title} ({deadline.date})</option>
              ))}
            </select>

            <button style={styles.saveBtn} onClick={saveOverview}>Save overview</button>
          </section>

          <section style={styles.panelSection}>
            <h3 style={styles.sectionTitle}>Progress</h3>
            <Metric label="Invested" value={fmtHours(investedMinutes)} />
            <Metric label="This week" value={fmtHours(thisWeekMinutes)} />
            <Metric label="Tasks done" value={`${doneTasks}/${projectTasks.length}`} />
            <Progress label={project.targetHours ? `Time target ${project.targetHours}h` : 'No time target'} value={timeRatio} color={category?.color ?? '#6366f1'} />
            <Progress label="Task progress" value={taskRatio} color={category?.color ?? '#6366f1'} />
          </section>
        </div>

        <section style={styles.panelSection}>
          <h3 style={styles.sectionTitle}>Project Tasks</h3>
          <div style={styles.taskForm}>
            <input style={{ ...styles.input, flex: 1 }} placeholder="Milestone or checklist item" value={taskForm.title} onChange={e => setTaskForm(prev => ({ ...prev, title: e.target.value }))} />
            <select style={{ ...styles.input, width: 130 }} value={taskForm.status} onChange={e => setTaskForm(prev => ({ ...prev, status: e.target.value as ProjectTaskStatus }))}>
              {taskStatuses.map(item => <option key={item} value={item}>{formatStatus(item)}</option>)}
            </select>
            <input style={{ ...styles.input, width: 130 }} type="date" value={taskForm.dueDate} onChange={e => setTaskForm(prev => ({ ...prev, dueDate: e.target.value }))} />
            <input style={{ ...styles.input, width: 70 }} type="number" min="0" placeholder="h" value={taskForm.estimatedHours} onChange={e => setTaskForm(prev => ({ ...prev, estimatedHours: e.target.value }))} />
            <input style={{ ...styles.input, width: 70 }} type="number" min="0" max="59" placeholder="m" value={taskForm.estimatedMinutes} onChange={e => setTaskForm(prev => ({ ...prev, estimatedMinutes: e.target.value }))} />
            <select style={{ ...styles.input, width: 110 }} value={taskForm.priority} onChange={e => setTaskForm(prev => ({ ...prev, priority: e.target.value as PriorityLevel | '' }))}>
              <option value="">Priority</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
            <button style={styles.saveBtn} onClick={saveProjectTask}>{editingTaskId ? 'Save' : 'Add'}</button>
          </div>

          <div style={styles.taskList}>
            {projectTasks.map(task => (
              <div key={task.id} style={{ ...styles.taskRow, ...(task.status === 'done' ? styles.taskRowDone : {}) }}>
                <input
                  type="checkbox"
                  checked={task.status === 'done'}
                  onChange={() => toggleProjectTaskDone(task)}
                  style={styles.checkbox}
                  title={task.status === 'done' ? 'Mark as todo' : 'Mark as done'}
                />
                <span style={{ ...styles.taskTitle, ...(task.status === 'done' ? styles.taskTitleDone : {}) }}>{task.title}</span>
                <span style={styles.statusPill}>{formatStatus(task.status)}</span>
                {task.dueDate && <span style={styles.muted}>{task.dueDate}</span>}
                {taskEstimateMinutes(task) && <span style={styles.muted}>{fmtEstimate(taskEstimateMinutes(task) ?? 0)}</span>}
                <button style={styles.linkBtn} onClick={() => { setTaskForm(taskToForm(task)); setEditingTaskId(task.id) }}>Edit</button>
                <button style={styles.linkBtn} onClick={() => duplicateProjectTask(task)}>Copy</button>
                <button style={styles.dangerBtn} onClick={() => onDeleteProjectTask(task.id)}>Delete</button>
              </div>
            ))}
            {projectTasks.length === 0 && <p style={styles.emptyText}>No project tasks yet.</p>}
          </div>
        </section>

        <section style={styles.panelSection}>
          <h3 style={styles.sectionTitle}>Recent Time Records</h3>
          <div style={styles.taskList}>
            {recentRecords.map(record => (
              <div key={record.id} style={styles.taskRow}>
                <span style={styles.taskTitle}>{record.name}</span>
                <span style={styles.muted}>{record.date}</span>
                <span style={styles.muted}>{record.startTime}-{record.endTime}</span>
                <strong>{fmtHours(calcMinutes([record]))}</strong>
              </div>
            ))}
            {recentRecords.length === 0 && <p style={styles.emptyText}>No linked actual time records yet.</p>}
          </div>
        </section>
      </div>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.metric}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function Progress({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={styles.progressBlock}>
      <div style={styles.progressLabel}>
        <span>{label}</span>
        <strong>{Math.round(value * 100)}%</strong>
      </div>
      <div style={styles.progressTrack}>
        <div style={{ ...styles.progressFill, width: `${Math.max(value * 100, value > 0 ? 4 : 0)}%`, background: color }} />
      </div>
    </div>
  )
}

const styles: Record<string, CSSProperties> = {
  page: { flex: 1, overflow: 'auto', padding: 28, background: 'var(--app-bg)' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 22 },
  title: { margin: 0, fontSize: 28, lineHeight: 1.15, fontWeight: 800, color: 'var(--text-primary)' },
  subtitle: { margin: '5px 0 0', color: 'var(--text-secondary)', fontSize: 14 },
  filterRow: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  warning: { alignSelf: 'center', color: '#b45309', fontSize: 12, fontWeight: 700 },
  filterBtn: { padding: '7px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-secondary)', cursor: 'pointer', textTransform: 'capitalize', fontWeight: 700 },
  filterBtnActive: { background: 'var(--primary-soft)', color: 'var(--primary)', borderColor: '#c7d2fe' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 },
  projectCard: { textAlign: 'left', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'var(--surface)', padding: 16, cursor: 'pointer', boxShadow: 'var(--shadow-card)' },
  cardTop: { display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start', marginBottom: 12 },
  cardActions: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 },
  pinBtn: { border: '1px solid var(--border)', borderRadius: 999, background: 'var(--surface)', color: 'var(--text-secondary)', padding: '4px 8px', fontSize: 11, fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap' },
  pinBtnActive: { borderColor: '#fbbf24', background: 'var(--warning-soft)', color: '#a16207' },
  projectName: { margin: '0 0 4px', color: 'var(--text-primary)', fontSize: 17, fontWeight: 800 },
  categoryLine: { display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)', fontSize: 12 },
  dot: { width: 9, height: 9, borderRadius: '50%', display: 'inline-block', flexShrink: 0 },
  statusPill: { borderRadius: 999, background: 'var(--surface-muted)', color: 'var(--text-primary)', padding: '3px 7px', fontSize: 11, fontWeight: 700, textTransform: 'capitalize', whiteSpace: 'nowrap' },
  metricGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 },
  metric: { border: '1px solid var(--border-soft)', borderRadius: 'var(--radius-sm)', padding: 8, background: 'var(--surface-soft)', display: 'flex', flexDirection: 'column', gap: 2 },
  progressBlock: { display: 'flex', flexDirection: 'column', gap: 5, marginTop: 8 },
  progressLabel: { display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', fontSize: 12 },
  progressTrack: { height: 7, borderRadius: 999, background: 'var(--border-soft)', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 999 },
  deadlineLine: { marginTop: 10, fontSize: 12, color: 'var(--text-secondary)' },
  emptyCard: { border: '1px solid var(--border)', background: 'var(--surface)', borderRadius: 'var(--radius-md)', padding: 18, color: 'var(--text-muted)', boxShadow: 'var(--shadow-card)' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(17, 24, 39, 0.42)', display: 'flex', justifyContent: 'flex-end', zIndex: 1000 },
  detailPanel: { width: 760, maxWidth: '92vw', height: '100%', overflow: 'auto', background: 'var(--surface)', padding: 24, boxSizing: 'border-box', boxShadow: 'var(--shadow-popover)' },
  detailHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 },
  detailActions: { display: 'flex', alignItems: 'center', gap: 8 },
  detailTitle: { margin: '0 0 4px', fontSize: 22, color: 'var(--text-primary)', fontWeight: 800 },
  closeBtn: { border: 'none', background: 'transparent', color: 'var(--text-secondary)', fontSize: 18, cursor: 'pointer' },
  twoCol: { display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(240px, 0.8fr)', gap: 12 },
  panelSection: { border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 14, background: 'var(--surface)', marginBottom: 12, boxShadow: '0 1px 2px rgba(15, 23, 42, 0.03)' },
  sectionTitle: { margin: '0 0 10px', fontSize: 14, color: 'var(--text-primary)', fontWeight: 800 },
  label: { display: 'block', marginBottom: 4, color: 'var(--text-secondary)', fontSize: 12, fontWeight: 700 },
  input: { border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '8px 9px', font: 'inherit', fontSize: 13, boxSizing: 'border-box', width: '100%', color: 'var(--text-primary)', background: 'var(--surface)' },
  row: { display: 'flex', gap: 8, marginTop: 8 },
  saveBtn: { border: 'none', borderRadius: 'var(--radius-sm)', background: 'var(--primary)', color: '#fff', padding: '8px 12px', cursor: 'pointer', fontWeight: 800, marginTop: 8 },
  taskForm: { display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  taskList: { display: 'flex', flexDirection: 'column', gap: 7, marginTop: 10 },
  taskRow: { display: 'flex', alignItems: 'center', gap: 8, border: '1px solid var(--surface-muted)', borderRadius: 'var(--radius-sm)', padding: 8, fontSize: 13 },
  taskRowDone: { opacity: 0.68, background: 'var(--surface-soft)' },
  checkbox: { width: 16, height: 16, cursor: 'pointer', accentColor: 'var(--primary)' },
  taskTitle: { flex: 1, color: 'var(--text-primary)', fontWeight: 700 },
  taskTitleDone: { textDecoration: 'line-through', color: 'var(--text-secondary)' },
  muted: { color: 'var(--text-secondary)', fontSize: 12 },
  linkBtn: { border: 'none', background: 'transparent', color: 'var(--primary)', cursor: 'pointer', fontWeight: 700 },
  dangerBtn: { border: 'none', background: 'transparent', color: 'var(--danger)', cursor: 'pointer', fontWeight: 700 },
  emptyText: { margin: 0, color: 'var(--text-muted)', fontSize: 13 },
}
