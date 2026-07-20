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
  projectId?: string
  categoryId?: string
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
  projectTaskId?: string
  date: string
  startTime: string
  endTime: string
  type: 'plan' | 'actual'
  energyLevel?: TimeQualityLevel
  valueLevel?: TimeQualityLevel
}

export interface HabitItem {
  id: string
  name: string
  categoryId?: string
  createdAt: string
  archived?: boolean
}

export interface HabitLog {
  id: string
  habitId: string
  date: string
}

export interface MonthlyNote {
  id: string
  month: string
  quote?: string
  reminder?: string
}

export interface AppState {
  categories: Category[]
  projects: Project[]
  projectTasks: ProjectTask[]
  tasks: TaskBlock[]
  deadlines: Deadline[]
  habits: HabitItem[]
  habitLogs: HabitLog[]
  monthlyNotes: MonthlyNote[]
}
