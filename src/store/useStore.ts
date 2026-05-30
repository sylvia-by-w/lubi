import { useState, useEffect } from 'react'
import type { Category, Project, TaskBlock } from '../types'

const KEYS = {
  categories: 'lyubishchev_categories',
  projects: 'lyubishchev_projects',
  tasks: 'lyubishchev_tasks',
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
  const [tasks, setTasks] = useState<TaskBlock[]>(() =>
    load(KEYS.tasks, [])
  )

  useEffect(() => save(KEYS.categories, categories), [categories])
  useEffect(() => save(KEYS.projects, projects), [projects])
  useEffect(() => save(KEYS.tasks, tasks), [tasks])

  const addCategory = (cat: Omit<Category, 'id'>) => {
    const newCat = { ...cat, id: crypto.randomUUID() }
    setCategories(prev => [...prev, newCat])
  }

  const deleteCategory = (id: string) => {
    setCategories(prev => prev.filter(c => c.id !== id))
  }

  const addProject = (proj: Omit<Project, 'id'>) => {
    const newProj = { ...proj, id: crypto.randomUUID() }
    setProjects(prev => [...prev, newProj])
  }

  const deleteProject = (id: string) => {
    setProjects(prev => prev.filter(p => p.id !== id))
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

  return {
    categories, projects, tasks,
    addCategory, deleteCategory,
    addProject, deleteProject,
    addTask, updateTask, deleteTask,
  }
}