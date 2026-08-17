import { useState, useEffect, useRef } from 'react'
import type { ActiveTimer, Category, Deadline, HabitItem, HabitLog, MonthlyNote, Project, ProjectTask, TaskBlock, WeeklyNote } from '../types'
import { DEFAULT_AI_CONFIG, type AIConfig } from '../services/aiReviewService'
import { minutesToTime, subtractTimeRanges, timeToMinutes } from '../utils/time'
import { useLanguage } from '../i18n/LanguageContext'
import {
  getSession,
  onAuthStateChange,
  signUpWithEmail,
  signInWithEmail,
  signOut as signOutRemote,
  fetchRemoteData,
  pushRemoteData,
  snapshotHasContent,
  errorMessage,
  type Session,
} from '../services/cloudSync'

const KEYS = {
  categories: 'lyubishchev_categories',
  projects: 'lyubishchev_projects',
  projectTasks: 'lyubishchev_project_tasks',
  tasks: 'lyubishchev_tasks',
  deadlines: 'lyubishchev_deadlines',
  habits: 'lyubishchev_habits',
  habitLogs: 'lyubishchev_habit_logs',
  monthlyNotes: 'lyubishchev_monthly_notes',
  weeklyNotes: 'lyubishchev_weekly_notes',
  aiConfig: 'lyubishchev_ai_config',
  activeTimer: 'lyubishchev_active_timer',
}

function todayDateStr() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function save<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value))
}

function normalizeProjectTask(task: ProjectTask): ProjectTask {
  if (task.estimatedMinutes !== undefined || task.estimatedHours === undefined) {
    return task
  }

  const { estimatedHours, ...rest } = task
  return { ...rest, estimatedMinutes: estimatedHours * 60 }
}

export function useStore() {
  const { t } = useLanguage()
  const [categories, setCategories] = useState<Category[]>(() =>
    load(KEYS.categories, [
      { id: '1', name: 'University', color: '#9DC3E6' },
      { id: '2', name: 'Personal growth', color: '#A9D18E' },
      { id: '3', name: 'Life maintenance', color: '#F4B183' },
      { id: '4', name: 'Fitness', color: '#FF7070' },
      { id: '5', name: 'Relax / Social', color: '#B4A7D6' },
      { id: '6', name: 'Waste', color: '#D9D9D9' },
    ])
  )
  const [projects, setProjects] = useState<Project[]>(() =>
    load(KEYS.projects, [])
  )
  const [projectTasks, setProjectTasks] = useState<ProjectTask[]>(() =>
    load<ProjectTask[]>(KEYS.projectTasks, []).map(normalizeProjectTask)
  )
  const [tasks, setTasks] = useState<TaskBlock[]>(() =>
    load(KEYS.tasks, [])
  )
  const [deadlines, setDeadlines] = useState<Deadline[]>(() =>
    load(KEYS.deadlines, [])
  )
  const [habits, setHabits] = useState<HabitItem[]>(() =>
    load(KEYS.habits, [])
  )
  const [habitLogs, setHabitLogs] = useState<HabitLog[]>(() =>
    load(KEYS.habitLogs, [])
  )
  const [monthlyNotes, setMonthlyNotes] = useState<MonthlyNote[]>(() =>
    load(KEYS.monthlyNotes, [])
  )
  const [weeklyNotes, setWeeklyNotes] = useState<WeeklyNote[]>(() =>
    load(KEYS.weeklyNotes, [])
  )
  const [aiConfig, setAiConfig] = useState<AIConfig>(() =>
    load(KEYS.aiConfig, DEFAULT_AI_CONFIG)
  )
  const [activeTimer, setActiveTimer] = useState<ActiveTimer | null>(() =>
    load<ActiveTimer | null>(KEYS.activeTimer, null)
  )

  const [user, setUser] = useState<Session['user'] | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [authError, setAuthError] = useState('')
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle')
  const [syncError, setSyncError] = useState('')
  const [reconciledUserId, setReconciledUserId] = useState<string | null>(null)
  const reconcileStartedRef = useRef<string | null>(null)
  const pushTimerRef = useRef<number | null>(null)

  useEffect(() => save(KEYS.categories, categories), [categories])
  useEffect(() => save(KEYS.projects, projects), [projects])
  useEffect(() => save(KEYS.projectTasks, projectTasks), [projectTasks])
  useEffect(() => save(KEYS.tasks, tasks), [tasks])
  useEffect(() => save(KEYS.deadlines, deadlines), [deadlines])
  useEffect(() => save(KEYS.habits, habits), [habits])
  useEffect(() => save(KEYS.habitLogs, habitLogs), [habitLogs])
  useEffect(() => save(KEYS.monthlyNotes, monthlyNotes), [monthlyNotes])
  useEffect(() => save(KEYS.weeklyNotes, weeklyNotes), [weeklyNotes])
  useEffect(() => save(KEYS.aiConfig, aiConfig), [aiConfig])
  useEffect(() => save(KEYS.activeTimer, activeTimer), [activeTimer])

  useEffect(() => {
    let cancelled = false
    getSession()
      .then(session => { if (!cancelled) setUser(session?.user ?? null) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setAuthLoading(false) })
    const unsubscribe = onAuthStateChange(session => setUser(session?.user ?? null))
    return () => { cancelled = true; unsubscribe() }
  }, [])

  const addCategory = (cat: Omit<Category, 'id'>) => {
    const newCat = { ...cat, id: crypto.randomUUID() }
    setCategories(prev => [...prev, newCat])
  }

  const deleteCategory = (id: string) => {
    setCategories(prev => prev.filter(c => c.id !== id))
  }

  const addProject = (proj: Omit<Project, 'id'>) => {
    const newProj = {
      ...proj,
      status: proj.status ?? 'active',
      description: proj.description ?? '',
      createdAt: proj.createdAt ?? new Date().toISOString(),
      id: crypto.randomUUID(),
    }
    setProjects(prev => [...prev, newProj])
  }

  const updateProject = (id: string, updates: Partial<Omit<Project, 'id' | 'createdAt'>>) => {
    setProjects(prev => prev.map(p => p.id === id ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p))
  }

  const deleteProject = (id: string) => {
    setProjects(prev => prev.filter(p => p.id !== id))
  }

  const addProjectTask = (task: Omit<ProjectTask, 'id' | 'createdAt' | 'completedAt'>, options?: { skipCompletedAt?: boolean }) => {
    const now = new Date().toISOString()
    const newTask = {
      ...task,
      id: crypto.randomUUID(),
      createdAt: now,
      completedAt: !options?.skipCompletedAt && task.status === 'done' ? now : undefined,
    }
    setProjectTasks(prev => [...prev, newTask])
    return newTask.id
  }

  const updateProjectTask = (id: string, updates: Partial<Omit<ProjectTask, 'id' | 'createdAt'>>) => {
    setProjectTasks(prev => prev.map(task => {
      if (task.id !== id) return task
      const nextStatus = updates.status ?? task.status
      return {
        ...task,
        ...updates,
        completedAt: nextStatus === 'done' ? updates.completedAt ?? task.completedAt ?? new Date().toISOString() : undefined,
      }
    }))
  }

  const deleteProjectTask = (id: string) => {
    setProjectTasks(prev => prev.filter(task => task.id !== id))
  }

  const addTask = (task: Omit<TaskBlock, 'id'>) => {
    const newTask = { ...task, id: crypto.randomUUID() }
    setTasks(prev => [...prev, newTask])
  }

  const updateTask = (id: string, updates: Partial<TaskBlock>) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t))
  }

  const deleteTask = (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id))
  }

  const addRecurringTasks = (base: Omit<TaskBlock, 'id' | 'date' | 'recurrenceId'>, dates: string[]) => {
    if (dates.length === 0) return
    const recurrenceId = crypto.randomUUID()
    const newTasks: TaskBlock[] = dates.map(date => ({
      ...base,
      date,
      recurrenceId,
      id: crypto.randomUUID(),
    }))
    setTasks(prev => [...prev, ...newTasks])
  }

  const deleteTasksByRecurrenceId = (recurrenceId: string) => {
    setTasks(prev => prev.filter(t => t.recurrenceId !== recurrenceId))
  }

  /**
   * Saves the timer as one or more 'actual' blocks, trimming away any part of
   * its span that already overlaps an existing actual record for that date
   * (e.g. a manually logged block, or a previous timer). Returns false if the
   * entire span was absorbed by existing records and nothing new was saved.
   */
  const finishActiveTimer = (timer: ActiveTimer): boolean => {
    const start = new Date(timer.startedAt)
    const now = new Date()
    const startMinutes = start.getHours() * 60 + start.getMinutes()
    const crossedMidnight = now.toDateString() !== start.toDateString()
    const rawEndMinutes = crossedMidnight
      ? 24 * 60 - 1
      : now.getHours() * 60 + now.getMinutes()
    const endMinutes = Math.min(Math.max(rawEndMinutes, startMinutes + 1), 24 * 60 - 1)

    const blockers = tasks
      .filter(existing => existing.type === 'actual' && existing.date === timer.date)
      .map(existing => ({ start: timeToMinutes(existing.startTime), end: timeToMinutes(existing.endTime) }))

    const segments = subtractTimeRanges({ start: startMinutes, end: endMinutes }, blockers)
      .filter(seg => seg.end - seg.start >= 1)

    segments.forEach(seg => {
      addTask({
        name: timer.name,
        categoryId: timer.categoryId,
        projectId: timer.projectId,
        projectTaskId: timer.projectTaskId,
        date: timer.date,
        startTime: minutesToTime(seg.start),
        endTime: minutesToTime(seg.end),
        type: 'actual',
      })
    })

    return segments.length > 0
  }

  const startTimer = (params: { name: string; categoryId: string; projectId?: string; projectTaskId?: string; sourcePlanTaskId?: string }) => {
    if (activeTimer) finishActiveTimer(activeTimer)
    setActiveTimer({
      id: crypto.randomUUID(),
      name: params.name,
      categoryId: params.categoryId,
      projectId: params.projectId,
      projectTaskId: params.projectTaskId,
      sourcePlanTaskId: params.sourcePlanTaskId,
      date: todayDateStr(),
      startedAt: new Date().toISOString(),
    })
  }

  const stopTimer = () => {
    if (activeTimer) {
      const saved = finishActiveTimer(activeTimer)
      if (!saved) alert(t('timer.fullyOverlappedAlert'))
    }
    setActiveTimer(null)
  }

  const discardTimer = () => {
    setActiveTimer(null)
  }

  const addDeadline = (deadline: Omit<Deadline, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date().toISOString()
    const newDeadline = { ...deadline, id: crypto.randomUUID(), createdAt: now }
    setDeadlines(prev => [...prev, newDeadline])
  }

  const updateDeadline = (id: string, updates: Partial<Omit<Deadline, 'id' | 'createdAt'>>) => {
    setDeadlines(prev => prev.map(d => d.id === id ? { ...d, ...updates, updatedAt: new Date().toISOString() } : d))
  }

  const deleteDeadline = (id: string) => {
    setDeadlines(prev => prev.filter(d => d.id !== id))
  }

  const addHabit = (habit: Omit<HabitItem, 'id' | 'createdAt'>) => {
    const newHabit = { ...habit, id: crypto.randomUUID(), createdAt: new Date().toISOString() }
    setHabits(prev => [...prev, newHabit])
  }

  const updateHabit = (id: string, updates: Partial<Omit<HabitItem, 'id' | 'createdAt'>>) => {
    setHabits(prev => prev.map(h => h.id === id ? { ...h, ...updates } : h))
  }

  const deleteHabit = (id: string) => {
    setHabits(prev => prev.filter(h => h.id !== id))
    setHabitLogs(prev => prev.filter(l => l.habitId !== id))
  }

  const archiveHabit = (id: string) => {
    updateHabit(id, { archived: true })
  }

  const unarchiveHabit = (id: string) => {
    updateHabit(id, { archived: false })
  }

  const toggleHabitLog = (habitId: string, date: string) => {
    setHabitLogs(prev => {
      const existing = prev.find(l => l.habitId === habitId && l.date === date)
      if (existing) return prev.filter(l => l.id !== existing.id)
      return [...prev, { id: crypto.randomUUID(), habitId, date }]
    })
  }

  const updateAIConfig = (updates: Partial<AIConfig>) => {
    setAiConfig(prev => ({ ...prev, ...updates }))
  }

  const upsertMonthlyNote = (month: string, updates: Partial<Omit<MonthlyNote, 'id' | 'month'>>) => {
    setMonthlyNotes(prev => {
      const existing = prev.find(n => n.month === month)
      if (existing) return prev.map(n => n.id === existing.id ? { ...n, ...updates } : n)
      return [...prev, { id: crypto.randomUUID(), month, ...updates }]
    })
  }

  const upsertWeeklyNote = (week: string, updates: Partial<Omit<WeeklyNote, 'id' | 'week'>>) => {
    setWeeklyNotes(prev => {
      const existing = prev.find(n => n.week === week)
      if (existing) return prev.map(n => n.id === existing.id ? { ...n, ...updates } : n)
      return [...prev, { id: crypto.randomUUID(), week, ...updates }]
    })
  }

  const exportAllData = () => {
    return JSON.stringify({ categories, projects, projectTasks, tasks, deadlines, habits, habitLogs, monthlyNotes, weeklyNotes }, null, 2)
  }

  const importAllData = (json: string) => {
    const data = JSON.parse(json)
    if (Array.isArray(data.categories)) setCategories(data.categories)
    if (Array.isArray(data.projects)) setProjects(data.projects)
    if (Array.isArray(data.projectTasks)) setProjectTasks(data.projectTasks.map(normalizeProjectTask))
    if (Array.isArray(data.tasks)) setTasks(data.tasks)
    if (Array.isArray(data.deadlines)) setDeadlines(data.deadlines)
    if (Array.isArray(data.habits)) setHabits(data.habits)
    if (Array.isArray(data.habitLogs)) setHabitLogs(data.habitLogs)
    if (Array.isArray(data.monthlyNotes)) setMonthlyNotes(data.monthlyNotes)
    if (Array.isArray(data.weeklyNotes)) setWeeklyNotes(data.weeklyNotes)
  }

  // On sign-in, reconcile whatever's already in this browser with whatever's
  // already in the cloud, then hand off to the debounced auto-push effect
  // below for every change after that.
  useEffect(() => {
    if (!user) {
      reconcileStartedRef.current = null
      return
    }
    if (reconcileStartedRef.current === user.id) return
    reconcileStartedRef.current = user.id
    let cancelled = false
    setSyncStatus('syncing')
    setSyncError('')

    ;(async () => {
      try {
        const remote = await fetchRemoteData(user.id)
        const localSnapshot = JSON.parse(exportAllData())
        const remoteHasContent = remote ? snapshotHasContent(remote.data) : false
        const localHasContent = snapshotHasContent(localSnapshot)

        if (remoteHasContent && localHasContent) {
          const useRemote = confirm(t('settingsModal.syncConflictConfirm'))
          if (cancelled) return
          if (useRemote) importAllData(JSON.stringify(remote!.data))
          else await pushRemoteData(user.id, localSnapshot)
        } else if (remoteHasContent) {
          importAllData(JSON.stringify(remote!.data))
        } else {
          await pushRemoteData(user.id, localSnapshot)
        }
        if (!cancelled) setSyncStatus('synced')
      } catch (err) {
        if (!cancelled) {
          setSyncStatus('error')
          setSyncError(errorMessage(err))
        }
      } finally {
        if (!cancelled) setReconciledUserId(user.id)
      }
    })()

    return () => { cancelled = true }
    // Intentionally re-runs only when `user` changes — the ref guard above
    // makes this a run-once-per-login effect; `exportAllData`/`t` are stable
    // enough in practice and re-including them would refire on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  // Debounced auto-push: once reconciled, mirror every local change to the
  // cloud a moment after the user stops editing.
  useEffect(() => {
    if (!user || reconciledUserId !== user.id) return
    if (pushTimerRef.current) window.clearTimeout(pushTimerRef.current)
    const snapshot = { categories, projects, projectTasks, tasks, deadlines, habits, habitLogs, monthlyNotes, weeklyNotes }
    pushTimerRef.current = window.setTimeout(() => {
      setSyncStatus('syncing')
      pushRemoteData(user.id, snapshot)
        .then(() => setSyncStatus('synced'))
        .catch(err => {
          setSyncStatus('error')
          setSyncError(errorMessage(err))
        })
    }, 1500)
    return () => { if (pushTimerRef.current) window.clearTimeout(pushTimerRef.current) }
  }, [user, reconciledUserId, categories, projects, projectTasks, tasks, deadlines, habits, habitLogs, monthlyNotes, weeklyNotes])

  const signUp = async (email: string, password: string) => {
    setAuthError('')
    try {
      return await signUpWithEmail(email, password)
    } catch (err) {
      setAuthError(errorMessage(err))
      return null
    }
  }

  const signIn = async (email: string, password: string) => {
    setAuthError('')
    try {
      await signInWithEmail(email, password)
      return true
    } catch (err) {
      setAuthError(errorMessage(err))
      return false
    }
  }

  const signOutUser = async () => {
    await signOutRemote()
    setSyncStatus('idle')
    setSyncError('')
  }

  return {
    categories, projects, projectTasks, tasks, deadlines, habits, habitLogs, monthlyNotes, weeklyNotes, aiConfig, activeTimer,
    addCategory, deleteCategory,
    addProject, updateProject, deleteProject,
    addProjectTask, updateProjectTask, deleteProjectTask,
    addTask, updateTask, deleteTask, addRecurringTasks, deleteTasksByRecurrenceId,
    addDeadline, updateDeadline, deleteDeadline,
    addHabit, updateHabit, deleteHabit, archiveHabit, unarchiveHabit, toggleHabitLog,
    upsertMonthlyNote,
    upsertWeeklyNote,
    updateAIConfig,
    startTimer, stopTimer, discardTimer,
    exportAllData, importAllData,
    user, authLoading, authError, syncStatus, syncError,
    signUp, signIn, signOutUser,
  }
}
