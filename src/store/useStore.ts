import { useState, useEffect } from 'react'
import type { ActiveTimer, Category, Deadline, HabitItem, HabitLog, MonthlyNote, Project, ProjectTask, TaskBlock } from '../types'
import { DEFAULT_AI_CONFIG, type AIConfig } from '../services/aiReviewService'
import { minutesToTime } from '../utils/time'

const KEYS = {
  categories: 'lyubishchev_categories',
  projects: 'lyubishchev_projects',
  projectTasks: 'lyubishchev_project_tasks',
  tasks: 'lyubishchev_tasks',
  deadlines: 'lyubishchev_deadlines',
  habits: 'lyubishchev_habits',
  habitLogs: 'lyubishchev_habit_logs',
  monthlyNotes: 'lyubishchev_monthly_notes',
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
  const [aiConfig, setAiConfig] = useState<AIConfig>(() =>
    load(KEYS.aiConfig, DEFAULT_AI_CONFIG)
  )
  const [activeTimer, setActiveTimer] = useState<ActiveTimer | null>(() =>
    load<ActiveTimer | null>(KEYS.activeTimer, null)
  )

  useEffect(() => save(KEYS.categories, categories), [categories])
  useEffect(() => save(KEYS.projects, projects), [projects])
  useEffect(() => save(KEYS.projectTasks, projectTasks), [projectTasks])
  useEffect(() => save(KEYS.tasks, tasks), [tasks])
  useEffect(() => save(KEYS.deadlines, deadlines), [deadlines])
  useEffect(() => save(KEYS.habits, habits), [habits])
  useEffect(() => save(KEYS.habitLogs, habitLogs), [habitLogs])
  useEffect(() => save(KEYS.monthlyNotes, monthlyNotes), [monthlyNotes])
  useEffect(() => save(KEYS.aiConfig, aiConfig), [aiConfig])
  useEffect(() => save(KEYS.activeTimer, activeTimer), [activeTimer])

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

  const finishActiveTimer = (timer: ActiveTimer) => {
    const start = new Date(timer.startedAt)
    const now = new Date()
    const startMinutes = start.getHours() * 60 + start.getMinutes()
    const crossedMidnight = now.toDateString() !== start.toDateString()
    const rawEndMinutes = crossedMidnight
      ? 24 * 60 - 1
      : now.getHours() * 60 + now.getMinutes()
    const endMinutes = Math.max(rawEndMinutes, startMinutes + 1)

    addTask({
      name: timer.name,
      categoryId: timer.categoryId,
      projectId: timer.projectId,
      projectTaskId: timer.projectTaskId,
      date: timer.date,
      startTime: minutesToTime(startMinutes),
      endTime: minutesToTime(Math.min(endMinutes, 24 * 60 - 1)),
      type: 'actual',
    })
  }

  const startTimer = (params: { name: string; categoryId: string; projectId?: string; projectTaskId?: string; sourcePlanTaskId?: string }) => {
    setActiveTimer(prev => {
      if (prev) finishActiveTimer(prev)
      return {
        id: crypto.randomUUID(),
        name: params.name,
        categoryId: params.categoryId,
        projectId: params.projectId,
        projectTaskId: params.projectTaskId,
        sourcePlanTaskId: params.sourcePlanTaskId,
        date: todayDateStr(),
        startedAt: new Date().toISOString(),
      }
    })
  }

  const stopTimer = () => {
    setActiveTimer(prev => {
      if (prev) finishActiveTimer(prev)
      return null
    })
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

  const exportAllData = () => {
    return JSON.stringify({ categories, projects, projectTasks, tasks, deadlines, habits, habitLogs, monthlyNotes }, null, 2)
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
  }

  return {
    categories, projects, projectTasks, tasks, deadlines, habits, habitLogs, monthlyNotes, aiConfig, activeTimer,
    addCategory, deleteCategory,
    addProject, updateProject, deleteProject,
    addProjectTask, updateProjectTask, deleteProjectTask,
    addTask, updateTask, deleteTask,
    addDeadline, updateDeadline, deleteDeadline,
    addHabit, updateHabit, deleteHabit, archiveHabit, unarchiveHabit, toggleHabitLog,
    upsertMonthlyNote,
    updateAIConfig,
    startTimer, stopTimer, discardTimer,
    exportAllData, importAllData,
  }
}
