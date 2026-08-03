import { useState } from 'react'
import type { Category, Project } from '../types'
import { useLanguage } from '../i18n/LanguageContext'

interface Props {
  open: boolean
  onClose: () => void
  onStart: (params: { name: string; categoryId: string; projectId?: string }) => void
  categories: Category[]
  projects: Project[]
}

export default function TimerStartModal({ open, onClose, onStart, categories, projects }: Props) {
  const { t } = useLanguage()
  const [name, setName] = useState('')
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? '')
  const [projectId, setProjectId] = useState('')

  if (!open) return null

  const handleProjectChange = (nextProjectId: string) => {
    setProjectId(nextProjectId)
    const project = projects.find(p => p.id === nextProjectId)
    if (project) setCategoryId(project.categoryId)
  }

  const handleStart = () => {
    if (!name.trim() || !categoryId) return
    onStart({ name: name.trim(), categoryId, projectId: projectId || undefined })
    setName('')
    setProjectId('')
    onClose()
  }

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        <h2 style={styles.title}>{t('timer.quickStartTitle')}</h2>

        <label style={styles.label}>{t('taskModal.taskName')}</label>
        <input
          style={styles.input}
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder={t('taskModal.namePlaceholder')}
          autoFocus
          onKeyDown={e => { if (e.key === 'Enter') handleStart() }}
        />

        <label style={styles.label}>{t('taskModal.category')}</label>
        <select style={styles.input} value={categoryId} onChange={e => setCategoryId(e.target.value)}>
          <option value="">{t('taskModal.selectCategory')}</option>
          {categories.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        <label style={styles.label}>{t('taskModal.projectOptional')}</label>
        <select style={styles.input} value={projectId} onChange={e => handleProjectChange(e.target.value)}>
          <option value="">{t('common.none')}</option>
          {projects.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>

        <div style={styles.row}>
          <button style={styles.cancelBtn} onClick={onClose}>{t('common.cancel')}</button>
          <button style={styles.startBtn} onClick={handleStart}>{t('timer.start')}</button>
        </div>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(17, 24, 39, 0.42)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
  },
  modal: {
    background: 'var(--surface)', borderRadius: 'var(--radius-lg)', padding: 28, width: 360,
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
  row: { display: 'flex', gap: 8, marginTop: 18 },
  cancelBtn: {
    flex: 1, padding: '10px 0', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)',
    background: 'var(--surface)', color: 'var(--text-secondary)', fontSize: 14, cursor: 'pointer', fontWeight: 700,
  },
  startBtn: {
    flex: 1, padding: '10px 0', borderRadius: 'var(--radius-sm)', border: 'none',
    background: '#dc2626', color: '#fff', fontSize: 14, cursor: 'pointer', fontWeight: 800,
  },
}
