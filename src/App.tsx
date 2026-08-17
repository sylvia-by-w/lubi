import { useState } from 'react'
import { useStore } from './store/useStore'
import NavBar from './components/NavBar'
import WeeklyView from './components/WeeklyView'
import TaskModal from './components/TaskModal'
import Board from './pages/Board'
import MonthPlan from './pages/MonthPlan'
import Projects from './pages/Projects'
import Statistics from './pages/Statistics'
import SettingsModal from './components/SettingsModal'
import DeadlineModal from './components/DeadlineModal'
import TimerStartModal from './components/TimerStartModal'
import type { ProjectTask, TaskBlock } from './types'
import { exportWeeklyExcel } from './utils/excelExport'

interface TaskDefaults {
  date: string
  type: 'plan' | 'actual'
  startTime: string
  endTime: string
  categoryId?: string
  projectId?: string
  projectTaskId?: string
  name?: string
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
    categories, projects, projectTasks, tasks, deadlines, habits, habitLogs, monthlyNotes, weeklyNotes, aiConfig, activeTimer,
    addTask, updateTask, deleteTask, addRecurringTasks, deleteTasksByRecurrenceId,
    addCategory, deleteCategory,
    addProject, updateProject, deleteProject,
    addProjectTask, updateProjectTask, deleteProjectTask,
    addDeadline, updateDeadline, deleteDeadline,
    addHabit, deleteHabit, archiveHabit, unarchiveHabit, toggleHabitLog, upsertMonthlyNote, upsertWeeklyNote,
    updateAIConfig,
    startTimer, stopTimer, discardTimer,
    exportAllData, importAllData,
    user, authLoading, authError, syncStatus, syncError, signUp, signIn, signOutUser,
  } = useStore()

  const [page, setPage] = useState<'weekly' | 'board' | 'month' | 'projects' | 'statistics'>('weekly')
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()))
  const [modalOpen, setModalOpen] = useState(false)
  const [taskDefaults, setTaskDefaults] = useState<TaskDefaults | null>(null)
  const [editTask, setEditTask] = useState<TaskBlock | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [deadlinesOpen, setDeadlinesOpen] = useState(false)
  const [quickTimerOpen, setQuickTimerOpen] = useState(false)

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

  const handleLogTime = (task: ProjectTask, date: string, existingBlock?: TaskBlock) => {
    if (existingBlock) {
      setEditTask(existingBlock)
      setTaskDefaults(null)
    } else {
      setEditTask(null)
      setTaskDefaults({
        date,
        type: 'actual',
        startTime: '09:00',
        endTime: '10:00',
        categoryId: task.categoryId,
        projectId: task.projectId,
        projectTaskId: task.id,
      })
    }
    setModalOpen(true)
  }

  const handleLogActualFromPlan = (planTask: TaskBlock) => {
    setEditTask(null)
    setTaskDefaults({
      date: planTask.date,
      type: 'actual',
      startTime: planTask.startTime,
      endTime: planTask.endTime,
      categoryId: planTask.categoryId,
      projectId: planTask.projectId,
      projectTaskId: planTask.projectTaskId,
      name: planTask.name,
    })
    setModalOpen(true)
  }

  const handleStartTimerFromPlan = (planTask: TaskBlock) => {
    startTimer({
      name: planTask.name,
      categoryId: planTask.categoryId,
      projectId: planTask.projectId,
      projectTaskId: planTask.projectTaskId,
      sourcePlanTaskId: planTask.id,
    })
  }

  const handleMoveTask = (id: string, updates: { date: string; startTime: string; endTime: string }) => {
    updateTask(id, updates)
  }

  const handleDuplicateTask = (task: TaskBlock, updates: { date: string; startTime: string; endTime: string }) => {
    addTask({
      name: task.name,
      categoryId: task.categoryId,
      projectId: task.projectId,
      projectTaskId: task.projectTaskId,
      type: task.type,
      energyLevel: task.energyLevel,
      valueLevel: task.valueLevel,
      ...updates,
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--app-bg)', color: 'var(--text-primary)' }}>
      <NavBar
        weekStart={weekStart}
        onPrevWeek={handlePrevWeek}
        onNextWeek={handleNextWeek}
        onAddTask={() => { setEditTask(null); setTaskDefaults(null); setModalOpen(true) }}
        onExportWeeklyExcel={() => exportWeeklyExcel({ weekStart, tasks, categories, projects })}
        onOpenDeadlines={() => setDeadlinesOpen(true)}
        deadlines={deadlines}
        projects={projects}
        currentPage={page}
        onChangePage={setPage}
        onOpenSettings={() => setSettingsOpen(true)}
        activeTimer={activeTimer}
        onOpenQuickStartTimer={() => setQuickTimerOpen(true)}
        onStopTimer={stopTimer}
        onDiscardTimer={discardTimer}
      />

      {page === 'weekly' ? (
        <WeeklyView
          weekStart={weekStart}
          tasks={tasks}
          categories={categories}
          projects={projects}
          projectTasks={projectTasks}
          deadlines={deadlines}
          aiConfig={aiConfig}
          onCreateSelection={handleCreateSelection}
          onClickTask={handleClickTask}
          onLogActualFromPlan={handleLogActualFromPlan}
          onStartTimerFromPlan={handleStartTimerFromPlan}
          onMoveTask={handleMoveTask}
          onDuplicateTask={handleDuplicateTask}
          activeTimer={activeTimer}
          onStopTimer={stopTimer}
        />
      ) : page === 'board' ? (
        <Board
          projectTasks={projectTasks}
          categories={categories}
          projects={projects}
          tasks={tasks}
          habits={habits}
          habitLogs={habitLogs}
          weeklyNotes={weeklyNotes}
          onAddProjectTask={addProjectTask}
          onUpdateProjectTask={updateProjectTask}
          onDeleteProjectTask={deleteProjectTask}
          onUpdateProject={updateProject}
          onLogTime={handleLogTime}
          onAddTask={addTask}
          onUpdateTask={updateTask}
          onDeleteTask={deleteTask}
          onAddHabit={addHabit}
          onDeleteHabit={deleteHabit}
          onArchiveHabit={archiveHabit}
          onUnarchiveHabit={unarchiveHabit}
          onToggleHabitLog={toggleHabitLog}
          onUpsertWeeklyNote={upsertWeeklyNote}
        />
      ) : page === 'month' ? (
        <MonthPlan
          habits={habits}
          habitLogs={habitLogs}
          categories={categories}
          monthlyNotes={monthlyNotes}
          projectTasks={projectTasks}
          projects={projects}
          onToggleHabitLog={toggleHabitLog}
          onUpsertMonthlyNote={upsertMonthlyNote}
        />
      ) : page === 'projects' ? (
        <Projects
          projects={projects}
          categories={categories}
          deadlines={deadlines}
          calendarTasks={tasks}
          projectTasks={projectTasks}
          weekStart={weekStart}
          onUpdateProject={updateProject}
          onAddProjectTask={addProjectTask}
          onUpdateProjectTask={updateProjectTask}
          onDeleteProjectTask={deleteProjectTask}
        />
      ) : (
        <Statistics tasks={tasks} categories={categories} projects={projects} deadlines={deadlines} />
      )}

      <TaskModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={editTask ? (t) => updateTask(editTask.id, t) : addTask}
        onDelete={deleteTask}
        onSaveRecurring={addRecurringTasks}
        onDeleteSeries={deleteTasksByRecurrenceId}
        categories={categories}
        projects={projects}
        initialDate={taskDefaults?.date}
        initialType={taskDefaults?.type}
        initialStartTime={taskDefaults?.startTime}
        initialEndTime={taskDefaults?.endTime}
        initialCategoryId={taskDefaults?.categoryId}
        initialProjectId={taskDefaults?.projectId}
        initialProjectTaskId={taskDefaults?.projectTaskId}
        initialName={taskDefaults?.name}
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
        onExportAllData={exportAllData}
        onImportAllData={importAllData}
        aiConfig={aiConfig}
        onUpdateAIConfig={updateAIConfig}
        user={user}
        authLoading={authLoading}
        authError={authError}
        syncStatus={syncStatus}
        syncError={syncError}
        onSignUp={signUp}
        onSignIn={signIn}
        onSignOut={signOutUser}
      />

      <TimerStartModal
        open={quickTimerOpen}
        onClose={() => setQuickTimerOpen(false)}
        onStart={params => startTimer(params)}
        categories={categories}
        projects={projects}
      />

      <DeadlineModal
        open={deadlinesOpen}
        onClose={() => setDeadlinesOpen(false)}
        deadlines={deadlines}
        categories={categories}
        projects={projects}
        onAddDeadline={addDeadline}
        onUpdateDeadline={updateDeadline}
        onDeleteDeadline={deleteDeadline}
      />
    </div>
  )
}
