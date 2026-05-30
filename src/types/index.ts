export interface Category {
  id: string
  name: string
  color: string
}

export interface Project {
  id: string
  name: string
  categoryId: string
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
}

export interface AppState {
  categories: Category[]
  projects: Project[]
  tasks: TaskBlock[]
}
