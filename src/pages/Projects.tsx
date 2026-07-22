import { useState, type CSSProperties } from 'react'
import type { Category, Deadline, PriorityLevel, Project, ProjectStatus, ProjectTask, ProjectTaskStatus, TaskBlock } from '../types'
import { timeToMinutes } from '../utils/time'
import { useLanguage } from '../i18n/LanguageContext'

type TFunc = (path: string, vars?: Record<string, string | number>) => string

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

interface ProjectMetrics {
  category?: Category
  deadline?: Deadline
  deadlineLabel: string
  investedMinutes: number
  thisWeekMinutes: number
  linkedTasks: ProjectTask[]
  doneTasks: number
  nextTask?: ProjectTask
  timeRatio: number
  taskRatio: number
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

function fmtHours(minutes: number, t: TFunc) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0 && m === 0) return t('common.zeroHours')
  return m === 0 ? t('common.durationHours', { h }) : t('common.hoursMinutesShort', { h, m })
}

function fmtEstimate(minutes: number, t: TFunc) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return t('common.durationMinutes', { m })
  if (m === 0) return t('common.durationHours', { h })
  return t('common.durationHoursMinutes', { h, m })
}

function taskEstimateMinutes(task: ProjectTask) {
  return task.estimatedMinutes ?? (task.estimatedHours !== undefined ? task.estimatedHours * 60 : undefined)
}

function formatStatus(status: string, t: TFunc) {
  switch (status) {
    case 'all': return t('projects.all')
    case 'active': return t('projects.active')
    case 'paused': return t('projects.paused')
    case 'completed': return t('projects.completed')
    case 'archived': return t('projects.archived')
    case 'todo': return t('projects.todo')
    case 'in_progress': return t('projects.active')
    case 'done': return t('projects.completed')
    default: return status
  }
}

function priorityText(priority: PriorityLevel, t: TFunc) {
  if (priority === 'high') return t('common.high')
  if (priority === 'medium') return t('common.medium')
  return t('common.low')
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

function getProjectDeadline(project: Project, deadlines: Deadline[], t: TFunc) {
  const linked = project.deadlineId ? deadlines.find(item => item.id === project.deadlineId) : undefined
  if (linked) return linked

  const projectLinked = deadlines
    .filter(item => item.projectId === project.id)
    .sort((a, b) => a.date.localeCompare(b.date))[0]
  if (projectLinked) return projectLinked

  const legacyDeadline = (project as Project & { deadline?: string }).deadline
  if (legacyDeadline) {
    return {
      id: `project-${project.id}-deadline`,
      title: t('projects.legacyDeadlineTitle'),
      date: legacyDeadline,
      projectId: project.id,
      createdAt: project.createdAt ?? '',
    }
  }

  return undefined
}

function buildProjectMetrics(
  project: Project,
  categories: Category[],
  deadlines: Deadline[],
  calendarTasks: TaskBlock[],
  projectTasks: ProjectTask[],
  weekStart: Date,
  t: TFunc
): ProjectMetrics {
  const category = categories.find(cat => cat.id === project.categoryId)
  const deadline = getProjectDeadline(project, deadlines, t)
  const actualTasks = calendarTasks.filter(task => task.projectId === project.id && task.type === 'actual')
  const investedMinutes = calcMinutes(actualTasks)
  const weekDates = weekDateSet(weekStart)
  const thisWeekMinutes = calcMinutes(actualTasks.filter(task => weekDates.has(task.date)))
  const linkedTasks = projectTasks.filter(task => task.projectId === project.id)
  const doneTasks = linkedTasks.filter(task => task.status === 'done').length
  const nextTask = linkedTasks
    .filter(task => task.status !== 'done')
    .sort((a, b) => (a.dueDate ?? '9999-12-31').localeCompare(b.dueDate ?? '9999-12-31'))[0]
  const targetMinutes = (project.targetHours ?? 0) * 60

  return {
    category,
    deadline,
    deadlineLabel: deadline ? `${deadline.title}: ${deadline.date}` : t('deadlineModal.noDeadline'),
    investedMinutes,
    thisWeekMinutes,
    linkedTasks,
    doneTasks,
    nextTask,
    timeRatio: targetMinutes > 0 ? Math.min(investedMinutes / targetMinutes, 1) : 0,
    taskRatio: linkedTasks.length > 0 ? doneTasks / linkedTasks.length : 0,
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
  const { t } = useLanguage()
  const [filter, setFilter] = useState<ProjectStatus | 'all'>('all')
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [pinWarning, setPinWarning] = useState('')
  const selectedProject = selectedProjectId ? projects.find(project => project.id === selectedProjectId) : undefined
  const visibleProjects = projects.filter(project => filter === 'all' || projectStatus(project) === filter)
  const pinnedCount = projects.filter(project => project.pinnedToHome).length
  const weekDates = weekDateSet(weekStart)
  const thisWeekInvested = calcMinutes(calendarTasks.filter(task => task.type === 'actual' && task.projectId && weekDates.has(task.date)))
  const doneProjectTasks = projectTasks.filter(task => task.status === 'done').length

  const togglePin = (project: Project) => {
    setPinWarning('')
    if (!project.pinnedToHome && pinnedCount >= 3) {
      setPinWarning(t('projects.maxPinWarning'))
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
          <h1 style={styles.title}>{t('nav.projects')}</h1>
          <p style={styles.subtitle}>{t('projects.subtitle')}</p>
        </div>
        <div style={styles.filterRow}>
          {statusesWithAll.map(status => (
            <button
              key={status}
              style={{ ...styles.filterBtn, ...(filter === status ? styles.filterBtnActive : {}) }}
              onClick={() => setFilter(status)}
            >
              {formatStatus(status, t)}
            </button>
          ))}
        </div>
      </div>

      <div style={styles.summaryRow}>
        <SummaryMetric label={t('projects.summaryActiveProjects')} value={String(projects.filter(project => projectStatus(project) === 'active').length)} />
        <SummaryMetric label={t('projects.summaryPinnedProjects')} value={`${pinnedCount}/3`} />
        <SummaryMetric label={t('projects.summaryWeekInvested')} value={fmtHours(thisWeekInvested, t)} />
        <SummaryMetric label={t('projects.summaryDoneTasks')} value={`${doneProjectTasks}/${projectTasks.length}`} />
      </div>
      {pinWarning && <div style={styles.warningBanner}>{pinWarning}</div>}

      {visibleProjects.length === 0 ? (
        <div style={styles.emptyCard}>{t('projects.emptyProjects')}</div>
      ) : (
        <div style={styles.grid}>
          {visibleProjects.map(project => (
            <ProjectCard
              key={project.id}
              project={project}
              metrics={buildProjectMetrics(project, categories, deadlines, calendarTasks, projectTasks, weekStart, t)}
              onTogglePin={() => togglePin(project)}
              onOpen={() => setSelectedProjectId(project.id)}
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

const statusesWithAll: Array<ProjectStatus | 'all'> = ['all', ...statuses]

function ProjectCard({
  project,
  metrics,
  onTogglePin,
  onOpen,
}: {
  project: Project
  metrics: ProjectMetrics
  onTogglePin: () => void
  onOpen: () => void
}) {
  const { t } = useLanguage()
  const accent = metrics.category?.color ?? '#9ca3af'

  return (
    <article style={styles.projectCard} onClick={onOpen}>
      <div style={styles.cardTop}>
        <div style={styles.cardTitleBlock}>
          <h2 style={styles.projectName}>{project.name}</h2>
          <span style={styles.categoryLine}>
            <span style={{ ...styles.dot, background: accent }} />
            {metrics.category?.name ?? t('projects.unknownCategory')}
          </span>
        </div>
        <div style={styles.cardActions}>
          <span style={{ ...styles.statusPill, ...statusTone(projectStatus(project)) }}>{formatStatus(projectStatus(project), t)}</span>
          <button
            style={{ ...styles.pinBtn, ...(project.pinnedToHome ? styles.pinBtnActive : {}) }}
            onClick={event => {
              event.stopPropagation()
              onTogglePin()
            }}
            title={project.pinnedToHome ? t('projects.pinnedToHome') : t('projects.pinToHome')}
          >
            {project.pinnedToHome ? t('projects.pinned') : t('projects.pin')}
          </button>
        </div>
      </div>

      {project.description && <p style={styles.cardDescription}>{project.description}</p>}

      <div style={styles.metricGrid}>
        <Metric label={t('projects.totalInvested')} value={fmtHours(metrics.investedMinutes, t)} />
        <Metric label={t('projects.thisWeek')} value={fmtHours(metrics.thisWeekMinutes, t)} />
      </div>

      <Progress
        label={t('projects.timeProgress')}
        value={metrics.timeRatio}
        color={accent}
        note={project.targetHours ? t('projects.timeProgressNote', { invested: fmtHours(metrics.investedMinutes, t), target: project.targetHours }) : t('projects.noTarget')}
      />
      <Progress
        label={t('projects.taskProgress')}
        value={metrics.taskRatio}
        color={accent}
        note={`${metrics.doneTasks}/${metrics.linkedTasks.length}`}
      />

      <div style={styles.cardMetaLine}>
        <span style={metrics.deadline ? styles.deadlineText : styles.muted}>{metrics.deadlineLabel}</span>
      </div>
      <div style={styles.nextTask}>
        <span style={styles.nextTaskLabel}>{t('projects.nextTask')}</span>
        <strong>{metrics.nextTask?.title ?? t('projects.noNextTask')}</strong>
      </div>

      <div style={styles.cardButtonRow}>
        <button
          style={styles.secondaryBtn}
          onClick={event => {
            event.stopPropagation()
            onOpen()
          }}
        >
          {t('projects.viewDetail')}
        </button>
        <button
          style={styles.primaryLightBtn}
          onClick={event => {
            event.stopPropagation()
            onOpen()
          }}
        >
          {t('projects.addTask')}
        </button>
      </div>
    </article>
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
  const { t, lang } = useLanguage()
  const metrics = buildProjectMetrics(project, categories, deadlines, calendarTasks, projectTasks, weekStart, t)
  const accent = metrics.category?.color ?? '#9ca3af'
  const [description, setDescription] = useState(project.description ?? '')
  const [targetHours, setTargetHours] = useState(project.targetHours ? String(project.targetHours) : '')
  const [status, setStatus] = useState<ProjectStatus>(projectStatus(project))
  const [deadlineId, setDeadlineId] = useState(project.deadlineId ?? '')
  const [taskForm, setTaskForm] = useState<ProjectTaskForm>(emptyTaskForm)
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)

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
    onAddProjectTask({
      projectId: task.projectId,
      title: `${task.title}${t('projects.copySuffix')}`,
      status: 'todo',
      dueDate: task.dueDate,
      estimatedMinutes: taskEstimateMinutes(task),
      estimatedHours: undefined,
      priority: task.priority,
    }, { skipCompletedAt: true })
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
              <span style={{ ...styles.dot, background: accent }} />
              {metrics.category?.name ?? t('projects.unknownCategory')}
            </span>
          </div>
          <div style={styles.detailActions}>
            <span style={{ ...styles.statusPill, ...statusTone(projectStatus(project)) }}>{formatStatus(projectStatus(project), t)}</span>
            <button
              style={{ ...styles.pinBtn, ...(project.pinnedToHome ? styles.pinBtnActive : {}) }}
              onClick={onTogglePin}
              title={project.pinnedToHome ? t('projects.pinnedToHome') : t('projects.pinToHome')}
            >
              {project.pinnedToHome ? t('projects.pinned') : t('projects.pinToHome')}
            </button>
            <button style={styles.closeBtn} onClick={onClose} aria-label={t('projects.closeDetail')}>x</button>
          </div>
        </div>
        {!project.pinnedToHome && pinnedCount >= 3 && (
          <div style={styles.warningBanner}>{t('projects.maxPinWarning')}</div>
        )}

        <div style={styles.detailSummary}>
          <Metric label={t('projects.totalInvested')} value={fmtHours(metrics.investedMinutes, t)} />
          <Metric label={t('projects.thisWeek')} value={fmtHours(metrics.thisWeekMinutes, t)} />
          <Metric label={t('projects.targetDuration')} value={project.targetHours ? t('common.durationHours', { h: project.targetHours }) : t('projects.noTarget')} />
          <Metric label={t('projects.dueDateLabel')} value={metrics.deadline?.date ?? t('deadlineModal.noDeadline')} />
        </div>

        <div style={styles.twoCol}>
          <section style={styles.panelSection}>
            <h3 style={styles.sectionTitle}>{t('projects.overview')}</h3>
            <label style={styles.label}>{t('projects.description')}</label>
            <textarea
              style={{ ...styles.input, minHeight: 82, resize: 'vertical' }}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder={t('projects.descriptionPlaceholder')}
            />

            <div style={styles.row}>
              <div style={{ flex: 1 }}>
                <label style={styles.label}>{t('projects.targetHoursLabel')}</label>
                <input style={styles.input} type="number" min="0" value={targetHours} onChange={e => setTargetHours(e.target.value)} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={styles.label}>{t('projects.statusLabel')}</label>
                <select style={styles.input} value={status} onChange={e => setStatus(e.target.value as ProjectStatus)}>
                  {statuses.map(item => <option key={item} value={item}>{formatStatus(item, t)}</option>)}
                </select>
              </div>
            </div>

            <label style={styles.label}>{t('projects.dueDateLabel')}</label>
            <select style={styles.input} value={deadlineId} onChange={e => setDeadlineId(e.target.value)}>
              <option value="">{t('deadlineModal.noDeadline')}</option>
              {deadlines.map(deadline => (
                <option key={deadline.id} value={deadline.id}>{deadline.title} ({deadline.date})</option>
              ))}
            </select>

            <button style={styles.saveBtn} onClick={saveOverview}>{t('projects.saveOverview')}</button>
          </section>

          <section style={styles.panelSection}>
            <h3 style={styles.sectionTitle}>{t('projects.progressTitle')}</h3>
            <Progress
              label={t('projects.timeProgress')}
              value={metrics.timeRatio}
              color={accent}
              note={project.targetHours ? t('projects.timeProgressNote', { invested: fmtHours(metrics.investedMinutes, t), target: project.targetHours }) : t('projects.noTarget')}
            />
            <Progress
              label={t('projects.taskProgress')}
              value={metrics.taskRatio}
              color={accent}
              note={`${metrics.doneTasks}/${metrics.linkedTasks.length}`}
            />
            <div style={styles.detailMetaStack}>
              <span><strong>{t('projects.statusColon')}</strong>{formatStatus(projectStatus(project), t)}</span>
              <span><strong>{t('projects.pinnedColon')}</strong>{project.pinnedToHome ? t('common.yes') : t('common.no')}</span>
              <span><strong>{t('projects.dueDateColon')}</strong>{metrics.deadlineLabel}</span>
            </div>
          </section>
        </div>

        <section style={styles.panelSection}>
          <div style={styles.sectionHeader}>
            <h3 style={styles.sectionTitle}>{t('projects.tasksTitle')}</h3>
            {editingTaskId && <button style={styles.linkBtn} onClick={() => { setTaskForm(emptyTaskForm); setEditingTaskId(null) }}>{t('projects.cancelEdit')}</button>}
          </div>
          <div style={styles.taskForm}>
            <input style={{ ...styles.input, flex: '1 1 230px' }} placeholder={t('projects.taskTitlePlaceholder')} value={taskForm.title} onChange={e => setTaskForm(prev => ({ ...prev, title: e.target.value }))} />
            <select style={{ ...styles.input, width: 132 }} value={taskForm.status} onChange={e => setTaskForm(prev => ({ ...prev, status: e.target.value as ProjectTaskStatus }))}>
              {taskStatuses.map(item => <option key={item} value={item}>{formatStatus(item, t)}</option>)}
            </select>
            <input style={{ ...styles.input, width: 138 }} type="date" value={taskForm.dueDate} onChange={e => setTaskForm(prev => ({ ...prev, dueDate: e.target.value }))} />
            <input style={{ ...styles.input, width: 72 }} type="number" min="0" placeholder={t('projects.hoursPlaceholder')} value={taskForm.estimatedHours} onChange={e => setTaskForm(prev => ({ ...prev, estimatedHours: e.target.value }))} />
            <input style={{ ...styles.input, width: 72 }} type="number" min="0" max="59" placeholder={t('projects.minutesPlaceholder')} value={taskForm.estimatedMinutes} onChange={e => setTaskForm(prev => ({ ...prev, estimatedMinutes: e.target.value }))} />
            <select style={{ ...styles.input, width: 112 }} value={taskForm.priority} onChange={e => setTaskForm(prev => ({ ...prev, priority: e.target.value as PriorityLevel | '' }))}>
              <option value="">{t('deadlineModal.priority')}</option>
              <option value="low">{t('common.low')}</option>
              <option value="medium">{t('common.medium')}</option>
              <option value="high">{t('common.high')}</option>
            </select>
            <button style={styles.saveBtn} onClick={saveProjectTask}>{editingTaskId ? t('projects.saveTask') : t('projects.addTask')}</button>
          </div>

          <div style={styles.taskList}>
            {projectTasks.map(task => (
              <div key={task.id} style={{ ...styles.taskRow, ...(task.status === 'done' ? styles.taskRowDone : {}) }}>
                <input
                  type="checkbox"
                  checked={task.status === 'done'}
                  onChange={() => toggleProjectTaskDone(task)}
                  style={styles.checkbox}
                  title={task.status === 'done' ? t('projects.markTodo') : t('projects.markDone')}
                />
                <button style={styles.taskTitleButton} onClick={() => { setTaskForm(taskToForm(task)); setEditingTaskId(task.id) }}>
                  <span style={{ ...styles.taskTitle, ...(task.status === 'done' ? styles.taskTitleDone : {}) }}>{task.title}</span>
                  <span style={styles.createdText}>{t('projects.createdOn', { date: new Date(task.createdAt).toLocaleDateString(lang === 'en' ? 'en-US' : 'zh-CN') })}</span>
                </button>
                <span style={styles.statusPill}>{formatStatus(task.status, t)}</span>
                {task.dueDate && <span style={styles.muted}>{t('weeklyView.dueDate', { date: task.dueDate })}</span>}
                {taskEstimateMinutes(task) !== undefined && <span style={styles.muted}>{fmtEstimate(taskEstimateMinutes(task) ?? 0, t)}</span>}
                {task.priority && <span style={{ ...styles.priorityBadge, ...priorityTone(task.priority) }}>{priorityText(task.priority, t)}</span>}
                <button style={styles.linkBtn} onClick={() => { setTaskForm(taskToForm(task)); setEditingTaskId(task.id) }}>{t('common.edit')}</button>
                <button style={styles.linkBtn} onClick={() => duplicateProjectTask(task)}>{t('projects.duplicate')}</button>
                <button style={styles.dangerBtn} onClick={() => onDeleteProjectTask(task.id)}>{t('common.delete')}</button>
              </div>
            ))}
            {projectTasks.length === 0 && <p style={styles.emptyText}>{t('projects.noProjectTasks')}</p>}
          </div>
        </section>
      </div>
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

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.metric}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function Progress({ label, value, color, note }: { label: string; value: number; color: string; note?: string }) {
  return (
    <div style={styles.progressBlock}>
      <div style={styles.progressLabel}>
        <span>{label}</span>
        <strong>{note ?? `${Math.round(value * 100)}%`}</strong>
      </div>
      <div style={styles.progressTrack}>
        <div style={{ ...styles.progressFill, width: `${Math.max(value * 100, value > 0 ? 4 : 0)}%`, background: color }} />
      </div>
    </div>
  )
}

function statusTone(status: ProjectStatus): CSSProperties {
  if (status === 'active') return { background: 'var(--success-soft)', color: '#047857' }
  if (status === 'paused') return { background: 'var(--warning-soft)', color: '#a16207' }
  if (status === 'completed') return { background: 'var(--primary-soft)', color: 'var(--primary)' }
  return { background: 'var(--surface-muted)', color: 'var(--text-secondary)' }
}

function priorityTone(priority: PriorityLevel): CSSProperties {
  if (priority === 'high') return { background: 'var(--danger-soft)', color: '#b91c1c' }
  if (priority === 'medium') return { background: 'var(--warning-soft)', color: '#a16207' }
  return { background: 'var(--surface-muted)', color: 'var(--text-secondary)' }
}

const styles: Record<string, CSSProperties> = {
  page: { flex: 1, overflow: 'auto', padding: 28, background: 'var(--app-bg)' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 14 },
  title: { margin: 0, fontSize: 28, lineHeight: 1.15, fontWeight: 800, color: 'var(--text-primary)' },
  subtitle: { margin: '5px 0 0', color: 'var(--text-secondary)', fontSize: 14 },
  filterRow: { display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'flex-end' },
  filterBtn: { padding: '7px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-secondary)', cursor: 'pointer', textTransform: 'capitalize', fontWeight: 700 },
  filterBtnActive: { background: 'var(--primary-soft)', color: 'var(--primary)', borderColor: 'var(--border)' },
  summaryRow: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 14 },
  summaryMetric: { border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'var(--surface)', padding: '12px 14px', boxShadow: 'var(--shadow-card)', display: 'flex', flexDirection: 'column', gap: 3 },
  warningBanner: { border: '1px solid #fde68a', background: 'var(--warning-soft)', color: '#92400e', borderRadius: 'var(--radius-sm)', padding: '9px 11px', fontSize: 12, fontWeight: 700, marginBottom: 12 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 },
  projectCard: { textAlign: 'left', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'var(--surface)', padding: 16, cursor: 'pointer', boxShadow: 'var(--shadow-card)' },
  cardTop: { display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start', marginBottom: 12 },
  cardTitleBlock: { minWidth: 0 },
  cardActions: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 },
  pinBtn: { border: '1px solid var(--border)', borderRadius: 999, background: 'var(--surface)', color: 'var(--text-secondary)', padding: '4px 9px', fontSize: 11, fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap' },
  pinBtnActive: { borderColor: '#fbbf24', background: 'var(--warning-soft)', color: '#a16207' },
  projectName: { margin: '0 0 4px', color: 'var(--text-primary)', fontSize: 17, fontWeight: 800, lineHeight: 1.25 },
  categoryLine: { display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)', fontSize: 12 },
  dot: { width: 9, height: 9, borderRadius: '50%', display: 'inline-block', flexShrink: 0 },
  statusPill: { borderRadius: 999, background: 'var(--surface-muted)', color: 'var(--text-primary)', padding: '3px 8px', fontSize: 11, fontWeight: 800, textTransform: 'capitalize', whiteSpace: 'nowrap' },
  cardDescription: { margin: '0 0 12px', color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.45 },
  metricGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 12 },
  metric: { border: '1px solid var(--border-soft)', borderRadius: 'var(--radius-sm)', padding: 9, background: 'var(--surface-soft)', display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 },
  progressBlock: { display: 'flex', flexDirection: 'column', gap: 5, marginTop: 10 },
  progressLabel: { display: 'flex', justifyContent: 'space-between', gap: 8, color: 'var(--text-secondary)', fontSize: 12 },
  progressTrack: { height: 7, borderRadius: 999, background: 'var(--border-soft)', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 999 },
  cardMetaLine: { marginTop: 11, fontSize: 12 },
  deadlineText: { color: 'var(--text-secondary)' },
  nextTask: { marginTop: 10, border: '1px solid var(--border-soft)', borderRadius: 'var(--radius-sm)', background: 'var(--surface-soft)', padding: '9px 10px', display: 'flex', flexDirection: 'column', gap: 2 },
  nextTaskLabel: { color: 'var(--text-muted)', fontSize: 11, fontWeight: 800, textTransform: 'uppercase' },
  cardButtonRow: { display: 'flex', gap: 8, marginTop: 12 },
  secondaryBtn: { flex: 1, border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'var(--surface)', color: 'var(--text-primary)', padding: '8px 10px', cursor: 'pointer', fontWeight: 800 },
  primaryLightBtn: { border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'var(--primary-soft)', color: 'var(--primary)', padding: '8px 10px', cursor: 'pointer', fontWeight: 800 },
  muted: { color: 'var(--text-muted)', fontSize: 12 },
  emptyCard: { border: '1px solid var(--border)', background: 'var(--surface)', borderRadius: 'var(--radius-md)', padding: 18, color: 'var(--text-muted)', boxShadow: 'var(--shadow-card)' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(17, 24, 39, 0.42)', display: 'flex', justifyContent: 'flex-end', zIndex: 1000 },
  detailPanel: { width: 820, maxWidth: '94vw', height: '100%', overflow: 'auto', background: 'var(--surface)', padding: 24, boxSizing: 'border-box', boxShadow: 'var(--shadow-popover)' },
  detailHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14, marginBottom: 16 },
  detailActions: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' },
  detailTitle: { margin: '0 0 4px', fontSize: 22, color: 'var(--text-primary)', fontWeight: 800 },
  closeBtn: { border: 'none', background: 'transparent', color: 'var(--text-secondary)', fontSize: 18, cursor: 'pointer' },
  detailSummary: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 9, marginBottom: 12 },
  twoCol: { display: 'grid', gridTemplateColumns: 'minmax(0, 1.35fr) minmax(260px, 0.85fr)', gap: 12 },
  panelSection: { border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 14, background: 'var(--surface)', marginBottom: 12, boxShadow: '0 1px 2px rgba(15, 23, 42, 0.03)' },
  sectionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  sectionTitle: { margin: '0 0 10px', fontSize: 14, color: 'var(--text-primary)', fontWeight: 800 },
  label: { display: 'block', margin: '9px 0 4px', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 700 },
  input: { border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '8px 9px', font: 'inherit', fontSize: 13, boxSizing: 'border-box', width: '100%', color: 'var(--text-primary)', background: 'var(--surface)' },
  row: { display: 'flex', gap: 8, marginTop: 2 },
  saveBtn: { border: 'none', borderRadius: 'var(--radius-sm)', background: 'var(--primary)', color: '#fff', padding: '8px 12px', cursor: 'pointer', fontWeight: 800 },
  detailMetaStack: { display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14, color: 'var(--text-secondary)', fontSize: 13 },
  taskForm: { display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  taskList: { display: 'flex', flexDirection: 'column', gap: 7, marginTop: 10 },
  taskRow: { display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, border: '1px solid var(--border-soft)', borderRadius: 'var(--radius-sm)', padding: 8, fontSize: 13, background: 'var(--surface)' },
  taskRowDone: { opacity: 0.72, background: 'var(--surface-soft)' },
  checkbox: { width: 16, height: 16, cursor: 'pointer', accentColor: 'var(--primary)', flexShrink: 0 },
  taskTitleButton: { flex: 1, minWidth: 150, border: 'none', background: 'transparent', textAlign: 'left', padding: 0, cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 1 },
  taskTitle: { color: 'var(--text-primary)', fontWeight: 800 },
  taskTitleDone: { textDecoration: 'line-through', color: 'var(--text-secondary)' },
  createdText: { color: 'var(--text-muted)', fontSize: 11 },
  priorityBadge: { borderRadius: 999, padding: '3px 7px', fontSize: 11, fontWeight: 800, textTransform: 'capitalize', whiteSpace: 'nowrap' },
  linkBtn: { border: 'none', background: 'transparent', color: 'var(--primary)', cursor: 'pointer', fontWeight: 800 },
  dangerBtn: { border: 'none', background: 'transparent', color: 'var(--danger)', cursor: 'pointer', fontWeight: 800 },
  emptyText: { margin: 0, color: 'var(--text-muted)', fontSize: 13 },
}
