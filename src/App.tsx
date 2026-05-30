import { useState } from 'react'
import { useStore } from './store/useStore'
import NavBar from './components/NavBar'
import WeeklyView from './components/WeeklyView'
import TaskModal from './components/TaskModal'
import Statistics from './pages/Statistics'
import SettingsModal from './components/SettingsModal'
import type { TaskBlock } from './types'

interface TaskDefaults {
  date: string
  type: 'plan' | 'actual'
  startTime: string
  endTime: string
}

function getMonday(date: Date): Date {
  const day = date.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const monday = new Date(date)
  monday.setDate(date.getDate() + diff)
  monday.setHours(0, 0, 0, 0)
  return monday
}

export default function App() {
  const {
    categories, projects, tasks,
    addTask, updateTask, deleteTask,
    addCategory, deleteCategory,
    addProject, deleteProject
  } = useStore()

  const [page, setPage] = useState<'weekly' | 'statistics'>('weekly')
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()))
  const [modalOpen, setModalOpen] = useState(false)
  const [taskDefaults, setTaskDefaults] = useState<TaskDefaults | null>(null)
  const [editTask, setEditTask] = useState<TaskBlock | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const handlePrevWeek = () => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() - 7)
    setWeekStart(d)
  }

  const handleNextWeek = () => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + 7)
    setWeekStart(d)
  }

  const handleCreateSelection = (defaults: TaskDefaults) => {
    setTaskDefaults(defaults)
    setEditTask(null)
    setModalOpen(true)
  }

  const handleClickTask = (task: TaskBlock) => {
    setEditTask(task)
    setTaskDefaults(null)
    setModalOpen(true)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <NavBar
        weekStart={weekStart}
        onPrevWeek={handlePrevWeek}
        onNextWeek={handleNextWeek}
        onAddTask={() => { setEditTask(null); setTaskDefaults(null); setModalOpen(true) }}
        currentPage={page}
        onChangePage={setPage}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      {page === 'weekly' ? (
        <WeeklyView
          weekStart={weekStart}
          tasks={tasks}
          categories={categories}
          projects={projects}
          onCreateSelection={handleCreateSelection}
          onClickTask={handleClickTask}
        />
      ) : (
        <Statistics tasks={tasks} categories={categories} projects={projects} />
      )}

      <TaskModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={editTask ? (t) => updateTask(editTask.id, t) : addTask}
        onDelete={deleteTask}
        categories={categories}
        projects={projects}
        initialDate={taskDefaults?.date}
        initialType={taskDefaults?.type}
        initialStartTime={taskDefaults?.startTime}
        initialEndTime={taskDefaults?.endTime}
        editTask={editTask}
      />

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        categories={categories}
        projects={projects}
        onAddCategory={addCategory}
        onDeleteCategory={deleteCategory}
        onAddProject={addProject}
        onDeleteProject={deleteProject}
      />
    </div>
  )
}
