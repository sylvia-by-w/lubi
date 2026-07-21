import { useState } from 'react'
import type { TaskBlock, Category, Project, TimeQualityLevel } from '../types'

interface Props {
  open: boolean
  onClose: () => void
  onSave: (task: Omit<TaskBlock, 'id'>) => void
  onDelete?: (id: string) => void
  categories: Category[]
  projects: Project[]
  initialDate?: string
  initialType?: 'plan' | 'actual'
  initialStartTime?: string
  initialEndTime?: string
  initialCategoryId?: string
  initialProjectId?: string
  initialProjectTaskId?: string
  initialName?: string
  editTask?: TaskBlock | null
}

function suggestedValueLevel(categories: Category[], nextCategoryId: string): TimeQualityLevel | '' {
  const categoryName = categories.find(c => c.id === nextCategoryId)?.name.toLowerCase()
  if (!categoryName) return ''
  if (categoryName === 'waste') return 'low'
  if (categoryName === 'university' || categoryName === 'personal growth') return 'high'
  if (categoryName === 'fitness') return 'high'
  if (categoryName === 'life maintenance' || categoryName === 'relax / social') return 'medium'
  return ''
}

interface FormState {
  name: string
  categoryId: string
  projectId: string
  date: string
  startTime: string
  endTime: string
  type: 'plan' | 'actual'
  energyLevel: TimeQualityLevel | ''
  valueLevel: TimeQualityLevel | ''
}

function getInitialFormState({
  categories,
  editTask,
  initialDate,
  initialEndTime,
  initialStartTime,
  initialType,
  initialCategoryId,
  initialProjectId,
  initialName,
}: Pick<Props, 'categories' | 'editTask' | 'initialDate' | 'initialEndTime' | 'initialStartTime' | 'initialType' | 'initialCategoryId' | 'initialProjectId' | 'initialName'>): FormState {
  if (editTask) {
    return {
      name: editTask.name,
      categoryId: editTask.categoryId,
      projectId: editTask.projectId ?? '',
      date: editTask.date,
      startTime: editTask.startTime,
      endTime: editTask.endTime,
      type: editTask.type,
      energyLevel: editTask.energyLevel ?? '',
      valueLevel: editTask.valueLevel ?? '',
    }
  }

  const nextCategoryId = initialCategoryId ?? categories[0]?.id ?? ''
  const nextType = initialType ?? 'plan'
  return {
    name: initialName ?? '',
    categoryId: nextCategoryId,
    projectId: initialProjectId ?? '',
    date: initialDate ?? '',
    startTime: initialStartTime ?? '09:00',
    endTime: initialEndTime ?? '10:00',
    type: nextType,
    energyLevel: '',
    valueLevel: nextType === 'actual' ? suggestedValueLevel(categories, nextCategoryId) : '',
  }
}

export default function TaskModal({
  open, onClose, onSave, onDelete,
  categories, projects, initialDate, initialType, initialStartTime, initialEndTime,
  initialCategoryId, initialProjectId, initialProjectTaskId, initialName, editTask
}: Props) {
  if (!open) return null

  const modalKey = editTask
    ? `edit-${editTask.id}`
    : `new-${initialDate ?? ''}-${initialType ?? 'plan'}-${initialStartTime ?? ''}-${initialEndTime ?? ''}-${initialCategoryId ?? categories[0]?.id ?? ''}-${initialProjectId ?? ''}-${initialProjectTaskId ?? ''}-${initialName ?? ''}`

  return (
    <TaskModalContent
      key={modalKey}
      onClose={onClose}
      onDelete={onDelete}
      onSave={onSave}
      categories={categories}
      projects={projects}
      initialState={getInitialFormState({ categories, editTask, initialDate, initialEndTime, initialStartTime, initialType, initialCategoryId, initialProjectId, initialName })}
      editTask={editTask}
      projectTaskId={editTask?.projectTaskId ?? initialProjectTaskId}
    />
  )
}

function TaskModalContent({
  onClose,
  onDelete,
  onSave,
  categories,
  projects,
  initialState,
  editTask,
  projectTaskId,
}: {
  onClose: () => void
  onDelete?: (id: string) => void
  onSave: (task: Omit<TaskBlock, 'id'>) => void
  categories: Category[]
  projects: Project[]
  initialState: FormState
  editTask?: TaskBlock | null
  projectTaskId?: string
}) {
  const [name, setName] = useState(initialState.name)
  const [categoryId, setCategoryId] = useState(initialState.categoryId)
  const [projectId, setProjectId] = useState(initialState.projectId)
  const [date, setDate] = useState(initialState.date)
  const [startTime, setStartTime] = useState(initialState.startTime)
  const [endTime, setEndTime] = useState(initialState.endTime)
  const [type, setType] = useState<'plan' | 'actual'>(initialState.type)
  const [energyLevel, setEnergyLevel] = useState<TimeQualityLevel | ''>(initialState.energyLevel)
  const [valueLevel, setValueLevel] = useState<TimeQualityLevel | ''>(initialState.valueLevel)

  const handleProjectChange = (nextProjectId: string) => {
    setProjectId(nextProjectId)
    const project = projects.find(p => p.id === nextProjectId)
    if (project) {
      handleCategoryChange(project.categoryId)
    }
  }

  const handleCategoryChange = (nextCategoryId: string) => {
    const previousSuggestion = suggestedValueLevel(categories, categoryId)
    const nextSuggestion = suggestedValueLevel(categories, nextCategoryId)
    setCategoryId(nextCategoryId)
    if (type === 'actual' && (!valueLevel || valueLevel === previousSuggestion)) {
      setValueLevel(nextSuggestion)
    }
  }

  const handleTypeChange = (nextType: 'plan' | 'actual') => {
    setType(nextType)
    if (nextType === 'plan') {
      setEnergyLevel('')
      setValueLevel('')
      return
    }

    if (!valueLevel) {
      setValueLevel(suggestedValueLevel(categories, categoryId))
    }
  }

  const handleSave = () => {
    if (!name.trim() || !categoryId || !date) return
    onSave({
      name: name.trim(),
      categoryId,
      projectId: projectId || undefined,
      projectTaskId,
      date,
      startTime,
      endTime,
      type,
      energyLevel: type === 'actual' && energyLevel ? energyLevel : undefined,
      valueLevel: type === 'actual' && valueLevel ? valueLevel : undefined,
    })
    onClose()
  }

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <h2 style={styles.title}>{editTask ? '编辑任务' : '添加任务'}</h2>

        <label style={styles.label}>任务名称</label>
        <input
          style={styles.input}
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="例如：深度工作"
        />

        <label style={styles.label}>分类</label>
        <select style={styles.input} value={categoryId} onChange={e => handleCategoryChange(e.target.value)}>
          <option value="">选择分类</option>
          {categories.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        <label style={styles.label}>项目(可选)</label>
        <select style={styles.input} value={projectId} onChange={e => handleProjectChange(e.target.value)}>
          <option value="">无</option>
          {projects.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>

        <label style={styles.label}>日期</label>
        <input
          style={styles.input}
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
        />

        <div style={styles.row}>
          <div style={{ flex: 1 }}>
            <label style={styles.label}>开始</label>
            <input style={styles.input} type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={styles.label}>结束</label>
            <input style={styles.input} type="time" value={endTime} onChange={e => setEndTime(e.target.value)} />
          </div>
        </div>

        <label style={styles.label}>类型</label>
        <div style={styles.row}>
          <button
            style={{ ...styles.typeBtn, ...(type === 'plan' ? styles.typeBtnActive : {}) }}
            onClick={() => handleTypeChange('plan')}
          >计划</button>
          <button
            style={{ ...styles.typeBtn, ...(type === 'actual' ? styles.typeBtnActive : {}) }}
            onClick={() => handleTypeChange('actual')}
          >实际</button>
        </div>

        {type === 'actual' && (
          <div style={styles.qualityGrid}>
            <div>
              <label style={styles.label}>精力</label>
              <QualitySelector value={energyLevel} onChange={setEnergyLevel} />
            </div>
            <div>
              <label style={styles.label}>价值</label>
              <QualitySelector value={valueLevel} onChange={setValueLevel} />
            </div>
          </div>
        )}

        <div style={{ ...styles.row, marginTop: 24 }}>
          {editTask && onDelete && (
            <button style={styles.deleteBtn} onClick={() => { onDelete(editTask.id); onClose() }}>删除</button>
          )}
          <button style={styles.cancelBtn} onClick={onClose}>取消</button>
          <button style={styles.saveBtn} onClick={handleSave}>保存</button>
        </div>
      </div>
    </div>
  )
}

function QualitySelector({
  value,
  onChange,
}: {
  value: TimeQualityLevel | ''
  onChange: (value: TimeQualityLevel | '') => void
}) {
  const levels: { value: TimeQualityLevel; label: string }[] = [
    { value: 'low', label: '低' },
    { value: 'medium', label: '中' },
    { value: 'high', label: '高' },
  ]

  return (
    <div style={styles.qualityRow}>
      {levels.map(level => (
        <button
          key={level.value}
          style={{
            ...styles.qualityBtn,
            ...(value === level.value ? styles.qualityBtnActive : {}),
          }}
          onClick={() => onChange(value === level.value ? '' : level.value)}
        >
          {level.label}
        </button>
      ))}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(17, 24, 39, 0.42)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
  },
  modal: {
    background: 'var(--surface)', borderRadius: 'var(--radius-lg)', padding: 28, width: 420,
    display: 'flex', flexDirection: 'column', gap: 6,
    boxShadow: 'var(--shadow-popover)', border: '1px solid var(--border)',
  },
  title: { margin: 0, marginBottom: 8, fontSize: 20, fontWeight: 800, color: 'var(--text-primary)' },
  label: { fontSize: 13, color: 'var(--text-secondary)', marginBottom: 2, fontWeight: 700 },
  input: {
    width: '100%', padding: '8px 10px', borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border)', fontSize: 14, boxSizing: 'border-box',
    background: 'var(--surface)', color: 'var(--text-primary)',
  },
  row: { display: 'flex', gap: 8 },
  qualityGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 6 },
  qualityRow: { display: 'flex', gap: 4 },
  typeBtn: {
    flex: 1, padding: '8px 0', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)',
    fontSize: 14, cursor: 'pointer', fontWeight: 700, background: 'var(--surface-muted)', color: 'var(--text-primary)',
  },
  typeBtnActive: {
    background: 'var(--primary)', color: '#fff', borderColor: 'var(--primary)',
  },
  qualityBtn: {
    flex: 1, padding: '6px 0', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)',
    background: 'var(--surface)', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer', fontWeight: 700,
  },
  qualityBtnActive: {
    background: 'var(--primary-soft)', color: 'var(--primary)', border: '1px solid var(--border)',
  },
  saveBtn: {
    flex: 1, padding: '10px 0', borderRadius: 'var(--radius-sm)', border: 'none',
    background: 'var(--primary)', color: '#fff', fontSize: 14, cursor: 'pointer', fontWeight: 800,
  },
  cancelBtn: {
    flex: 1, padding: '10px 0', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)',
    background: 'var(--surface)', color: 'var(--text-secondary)', fontSize: 14, cursor: 'pointer', fontWeight: 700,
  },
  deleteBtn: {
    flex: 1, padding: '10px 0', borderRadius: 'var(--radius-sm)', border: 'none',
    background: 'var(--danger-soft)', color: 'var(--danger)', fontSize: 14, cursor: 'pointer', fontWeight: 700,
  },
}
