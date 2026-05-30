import { useState, useEffect } from 'react'
import type { TaskBlock, Category, Project } from '../types'

interface Props {
  open: boolean
  onClose: () => void
  onSave: (task: Omit<TaskBlock, 'id'>) => void
  onDelete?: (id: string) => void
  categories: Category[]
  projects: Project[]
  initialDate?: string
  editTask?: TaskBlock | null
}

export default function TaskModal({
  open, onClose, onSave, onDelete,
  categories, projects, initialDate, editTask
}: Props) {
  const [name, setName] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [projectId, setProjectId] = useState('')
  const [date, setDate] = useState(initialDate ?? '')
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('10:00')
  const [type, setType] = useState<'plan' | 'actual'>('plan')

  useEffect(() => {
    if (editTask) {
      setName(editTask.name)
      setCategoryId(editTask.categoryId)
      setProjectId(editTask.projectId ?? '')
      setDate(editTask.date)
      setStartTime(editTask.startTime)
      setEndTime(editTask.endTime)
      setType(editTask.type)
    } else {
      setName('')
      setCategoryId(categories[0]?.id ?? '')
      setProjectId('')
      setDate(initialDate ?? '')
      setStartTime('09:00')
      setEndTime('10:00')
      setType('plan')
    }
  }, [editTask, open])

  if (!open) return null

  const handleSave = () => {
    if (!name.trim() || !categoryId || !date) return
    onSave({
      name: name.trim(),
      categoryId,
      projectId: projectId || undefined,
      date,
      startTime,
      endTime,
      type,
    })
    onClose()
  }

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <h2 style={styles.title}>{editTask ? 'Edit Task' : 'Add Task'}</h2>

        <label style={styles.label}>Task Name</label>
        <input
          style={styles.input}
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. Deep Work"
        />

        <label style={styles.label}>Category</label>
        <select style={styles.input} value={categoryId} onChange={e => setCategoryId(e.target.value)}>
          <option value="">Select category</option>
          {categories.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        <label style={styles.label}>Project (optional)</label>
        <select style={styles.input} value={projectId} onChange={e => setProjectId(e.target.value)}>
          <option value="">None</option>
          {projects.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>

        <label style={styles.label}>Date</label>
        <input
          style={styles.input}
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
        />

        <div style={styles.row}>
          <div style={{ flex: 1 }}>
            <label style={styles.label}>Start</label>
            <input style={styles.input} type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={styles.label}>End</label>
            <input style={styles.input} type="time" value={endTime} onChange={e => setEndTime(e.target.value)} />
          </div>
        </div>

        <label style={styles.label}>Type</label>
        <div style={styles.row}>
          <button
            style={{ ...styles.typeBtn, background: type === 'plan' ? '#6366f1' : '#f3f4f6', color: type === 'plan' ? '#fff' : '#374151' }}
            onClick={() => setType('plan')}
          >Plan</button>
          <button
            style={{ ...styles.typeBtn, background: type === 'actual' ? '#6366f1' : '#f3f4f6', color: type === 'actual' ? '#fff' : '#374151' }}
            onClick={() => setType('actual')}
          >Actual</button>
        </div>

        <div style={{ ...styles.row, marginTop: 24 }}>
          {editTask && onDelete && (
            <button style={styles.deleteBtn} onClick={() => { onDelete(editTask.id); onClose() }}>Delete</button>
          )}
          <button style={styles.cancelBtn} onClick={onClose}>Cancel</button>
          <button style={styles.saveBtn} onClick={handleSave}>Save</button>
        </div>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
  },
  modal: {
    background: '#fff', borderRadius: 12, padding: 28, width: 420,
    display: 'flex', flexDirection: 'column', gap: 6,
  },
  title: { margin: 0, marginBottom: 8, fontSize: 18, fontWeight: 600 },
  label: { fontSize: 13, color: '#6b7280', marginBottom: 2 },
  input: {
    width: '100%', padding: '8px 10px', borderRadius: 6,
    border: '1px solid #e5e7eb', fontSize: 14, boxSizing: 'border-box',
  },
  row: { display: 'flex', gap: 8 },
  typeBtn: {
    flex: 1, padding: '8px 0', borderRadius: 6, border: 'none',
    fontSize: 14, cursor: 'pointer', fontWeight: 500,
  },
  saveBtn: {
    flex: 1, padding: '10px 0', borderRadius: 6, border: 'none',
    background: '#6366f1', color: '#fff', fontSize: 14, cursor: 'pointer', fontWeight: 500,
  },
  cancelBtn: {
    flex: 1, padding: '10px 0', borderRadius: 6, border: '1px solid #e5e7eb',
    background: '#fff', fontSize: 14, cursor: 'pointer',
  },
  deleteBtn: {
    flex: 1, padding: '10px 0', borderRadius: 6, border: 'none',
    background: '#fee2e2', color: '#dc2626', fontSize: 14, cursor: 'pointer',
  },
}