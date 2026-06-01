export interface Category {
  id: string
  name: string
  color: string
}

export interface Project {
  id: string
  name: string
  categoryId: string
  description?: string
  status?: ProjectStatus
  targetHours?: number
  deadlineId?: string
  pinnedToHome?: boolean
  homeOrder?: number
  createdAt?: string
  updatedAt?: string
}

export type ProjectStatus = 'active' | 'paused' | 'completed' | 'archived'
export type ProjectTaskStatus = 'todo' | 'in_progress' | 'done'
export type PriorityLevel = 'low' | 'medium' | 'high'

export interface ProjectTask {
  id: string
  projectId: string
  title: string
  status: ProjectTaskStatus
  dueDate?: string
  estimatedMinutes?: number
  estimatedHours?: number
  priority?: PriorityLevel
  createdAt: string
  completedAt?: string
}

export interface Deadline {
  id: string
  title: string
  date: string
  time?: string
  projectId?: string
  categoryId?: string
  priority?: PriorityLevel
  note?: string
  createdAt: string
  updatedAt?: string
}

export type TimeQualityLevel = 'low' | 'medium' | 'high'

export type AIReviewScope = 'daily' | 'weekly'

export interface AIReview {
  id: string
  scope: AIReviewScope
  date?: string
  weekStart?: string
  weekEnd?: string
  aiContent: string
  userNote?: string
  createdAt: string
  updatedAt?: string
}

export interface TaskBlock {
  id: string
  name: string
  categoryId: string
  projectId?: string
  date: string        // "2026-05-26"
  startTime: string   // "09:00"
  endTime: string     // "11:00"
  type: 'plan' | 'actual'
  energyLevel?: TimeQualityLevel
  valueLevel?: TimeQualityLevel
}

export interface AppState {
  categories: Category[]
  projects: Project[]
  projectTasks: ProjectTask[]
  tasks: TaskBlock[]
  deadlines: Deadline[]
}
