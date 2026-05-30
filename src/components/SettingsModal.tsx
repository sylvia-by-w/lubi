import { useState } from 'react'
import type { Category, Project } from '../types'

interface Props {
  open: boolean
  onClose: () => void
  categories: Category[]
  projects: Project[]
  onAddCategory: (cat: Omit<Category, 'id'>) => void
  onDeleteCategory: (id: string) => void
  onAddProject: (proj: Omit<Project, 'id'>) => void
  onDeleteProject: (id: string) => void
}

const PRESET_COLORS = [
  '#6366f1', '#f59e0b', '#10b981', '#ef4444',
  '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6',
  '#f97316', '#84cc16',
]

export default function SettingsModal({
  open, onClose, categories, projects,
  onAddCategory, onDeleteCategory,
  onAddProject, onDeleteProject
}: Props) {
  const [catName, setCatName] = useState('')
  const [catColor, setCatColor] = useState(PRESET_COLORS[0])
  const [projName, setProjName] = useState('')
  const [tab, setTab] = useState<'categories' | 'projects'>('categories')

  if (!open) return null

  const handleAddCat = () => {
    if (!catName.trim()) return
    onAddCategory({ name: catName.trim(), color: catColor })
    setCatName('')
  }

  const handleAddProj = () => {
    if (!projName.trim()) return
    onAddProject({ name: projName.trim() })
    setProjName('')
  }

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Settings</h2>
          <button onClick={onClose} style={styles.closeBtn}>✕</button>
        </div>

        <div style={styles.tabs}>
          <button
            style={{ ...styles.tab, ...(tab === 'categories' ? styles.tabActive : {}) }}
            onClick={() => setTab('categories')}
          >Categories</button>
          <button
            style={{ ...styles.tab, ...(tab === 'projects' ? styles.tabActive : {}) }}
            onClick={() => setTab('projects')}
          >Projects</button>
        </div>

        {tab === 'categories' && (
          <div>
            <div style={styles.addRow}>
              <input
                style={{ ...styles.input, flex: 1 }}
                placeholder="Category name"
                value={catName}
                onChange={e => setCatName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddCat()}
              />
              <button onClick={handleAddCat} style={styles.addBtn}>Add</button>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
              {PRESET_COLORS.map(c => (
                <div
                  key={c}
                  onClick={() => setCatColor(c)}
                  style={{
                    width: 24, height: 24, borderRadius: '50%', background: c,
                    cursor: 'pointer', border: catColor === c ? '3px solid #111827' : '3px solid transparent'
                  }}
                />
              ))}
            </div>
            <div style={styles.list}>
              {categories.map(cat => (
                <div key={cat.id} style={styles.listItem}>
                  <span style={{ width: 12, height: 12, borderRadius: '50%', background: cat.color, display: 'inline-block', marginRight: 8 }} />
                  <span style={{ flex: 1 }}>{cat.name}</span>
                  <button onClick={() => onDeleteCategory(cat.id)} style={styles.deleteBtn}>✕</button>
                </div>
              ))}
              {categories.length === 0 && <p style={{ color: '#9ca3af', fontSize: 14 }}>No categories yet</p>}
            </div>
          </div>
        )}

        {tab === 'projects' && (
          <div>
            <div style={styles.addRow}>
              <input
                style={{ ...styles.input, flex: 1 }}
                placeholder="Project name"
                value={projName}
                onChange={e => setProjName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddProj()}
              />
              <button onClick={handleAddProj} style={styles.addBtn}>Add</button>
            </div>
            <div style={styles.list}>
              {projects.map(proj => (
                <div key={proj.id} style={styles.listItem}>
                  <span style={{ flex: 1 }}>{proj.name}</span>
                  <button onClick={() => onDeleteProject(proj.id)} style={styles.deleteBtn}>✕</button>
                </div>
              ))}
              {projects.length === 0 && <p style={{ color: '#9ca3af', fontSize: 14 }}>No projects yet</p>}
            </div>
          </div>
        )}
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
    background: '#fff', borderRadius: 12, padding: 28, width: 440,
    maxHeight: '80vh', overflowY: 'auto',
  },
  tabs: { display: 'flex', gap: 4, marginBottom: 20 },
  tab: {
    padding: '6px 16px', borderRadius: 6, border: 'none',
    background: 'transparent', fontSize: 14, cursor: 'pointer', color: '#6b7280',
  },
  tabActive: { background: '#f3f4f6', color: '#111827', fontWeight: 500 },
  addRow: { display: 'flex', gap: 8, marginBottom: 12 },
  input: {
    padding: '8px 10px', borderRadius: 6, border: '1px solid #e5e7eb', fontSize: 14,
  },
  addBtn: {
    padding: '8px 16px', borderRadius: 6, border: 'none',
    background: '#111827', color: '#fff', fontSize: 14, cursor: 'pointer',
  },
  list: { display: 'flex', flexDirection: 'column', gap: 4 },
  listItem: {
    display: 'flex', alignItems: 'center', padding: '8px 10px',
    borderRadius: 6, background: '#f9fafb', fontSize: 14,
  },
  deleteBtn: {
    border: 'none', background: 'transparent', cursor: 'pointer',
    color: '#9ca3af', fontSize: 12, padding: '2px 4px',
  },
  closeBtn: {
    border: 'none', background: 'transparent', cursor: 'pointer',
    fontSize: 16, color: '#6b7280',
  },
}