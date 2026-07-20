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
  onExportAllData: () => string
  onImportAllData: (json: string) => void
}

const PRESET_COLORS = [
  '#6366f1', '#f59e0b', '#10b981', '#ef4444',
  '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6',
  '#f97316', '#84cc16',
]

export default function SettingsModal({
  open, onClose, categories, projects,
  onAddCategory, onDeleteCategory,
  onAddProject, onDeleteProject,
  onExportAllData, onImportAllData,
}: Props) {
  const [catName, setCatName] = useState('')
  const [catColor, setCatColor] = useState(PRESET_COLORS[0])
  const [projName, setProjName] = useState('')
  const [projCategoryId, setProjCategoryId] = useState(categories[0]?.id ?? '')
  const [tab, setTab] = useState<'categories' | 'projects' | 'backup'>('categories')
  const [importMessage, setImportMessage] = useState('')

  const handleExport = () => {
    const json = onExportAllData()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const stamp = new Date().toISOString().slice(0, 10)
    a.href = url
    a.download = `lubi-backup-${stamp}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImportFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        onImportAllData(String(reader.result))
        setImportMessage('Data imported successfully.')
      } catch {
        setImportMessage('Import failed - the file is not valid backup JSON.')
      }
    }
    reader.readAsText(file)
    event.target.value = ''
  }

  if (!open) return null

  const selectedProjCategoryId = categories.some(c => c.id === projCategoryId)
    ? projCategoryId
    : categories[0]?.id ?? ''

  const projectsByCategory = categories
    .map(cat => ({
      cat,
      projects: projects.filter(proj => proj.categoryId === cat.id),
    }))
    .filter(group => group.projects.length > 0)

  const isPresetColor = PRESET_COLORS.includes(catColor)

  const handleAddCat = () => {
    if (!catName.trim()) return
    onAddCategory({ name: catName.trim(), color: catColor })
    setCatName('')
  }

  const handleAddProj = () => {
    if (!projName.trim() || !selectedProjCategoryId) return
    onAddProject({ name: projName.trim(), categoryId: selectedProjCategoryId })
    setProjName('')
  }

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: 'var(--text-primary)' }}>Settings</h2>
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
          <button
            style={{ ...styles.tab, ...(tab === 'backup' ? styles.tabActive : {}) }}
            onClick={() => setTab('backup')}
          >Backup</button>
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
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
              {PRESET_COLORS.map(c => (
                <div
                  key={c}
                  onClick={() => setCatColor(c)}
                  style={{
                    width: 24, height: 24, borderRadius: '50%', background: c,
                    cursor: 'pointer', border: catColor === c ? '3px solid var(--text-primary)' : '3px solid transparent'
                  }}
                />
              ))}
              <label
                style={{
                  ...styles.colorPickerWrap,
                  border: isPresetColor ? '3px solid transparent' : '3px solid var(--text-primary)',
                }}
              >
                <input
                  type="color"
                  value={catColor}
                  onChange={e => setCatColor(e.target.value)}
                  style={styles.colorPicker}
                />
              </label>
            </div>
            <div style={styles.list}>
              {categories.map(cat => (
                <div key={cat.id} style={styles.listItem}>
                  <span style={{ width: 12, height: 12, borderRadius: '50%', background: cat.color, display: 'inline-block', marginRight: 8 }} />
                  <span style={{ flex: 1 }}>{cat.name}</span>
                  <button onClick={() => onDeleteCategory(cat.id)} style={styles.deleteBtn}>✕</button>
                </div>
              ))}
              {categories.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>No categories yet</p>}
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
              <select
                style={{ ...styles.input, width: 150 }}
                value={selectedProjCategoryId}
                onChange={e => setProjCategoryId(e.target.value)}
              >
                <option value="">Category</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
              <button onClick={handleAddProj} style={styles.addBtn}>Add</button>
            </div>
            <div style={styles.list}>
              {projectsByCategory.map(({ cat, projects }) => (
                <div key={cat.id} style={styles.projectGroup}>
                  <div style={styles.groupTitle}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: cat.color, display: 'inline-block' }} />
                    {cat.name}
                  </div>
                  {projects.map(proj => (
                    <div key={proj.id} style={styles.listItem}>
                      <span style={{ flex: 1 }}>{proj.name}</span>
                      <button onClick={() => onDeleteProject(proj.id)} style={styles.deleteBtn}>✕</button>
                    </div>
                  ))}
                </div>
              ))}
              {projects.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>No projects yet</p>}
            </div>
          </div>
        )}

        {tab === 'backup' && (
          <div>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 0 }}>
              All your data (categories, projects, tasks, time blocks, deadlines) lives in this browser only.
              Moving to a new domain or clearing browser data starts fresh unless you back up first.
            </p>
            <button onClick={handleExport} style={{ ...styles.addBtn, marginBottom: 12 }}>Export all data</button>
            <div>
              <label style={{ ...styles.addBtn, display: 'inline-block', cursor: 'pointer', background: 'var(--surface-muted)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}>
                Import all data
                <input type="file" accept="application/json" onChange={handleImportFile} style={{ display: 'none' }} />
              </label>
            </div>
            {importMessage && <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{importMessage}</p>}
          </div>
        )}
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
    background: 'var(--surface)', borderRadius: 'var(--radius-lg)', padding: 28, width: 440,
    maxHeight: '80vh', overflowY: 'auto',
    border: '1px solid var(--border)', boxShadow: 'var(--shadow-popover)',
  },
  tabs: { display: 'flex', gap: 4, marginBottom: 20, padding: 3, border: '1px solid var(--border)', borderRadius: 999, background: 'var(--surface-muted)' },
  tab: {
    padding: '6px 16px', borderRadius: 999, border: 'none',
    background: 'transparent', fontSize: 14, cursor: 'pointer', color: 'var(--text-secondary)', fontWeight: 700,
  },
  tabActive: { background: 'var(--surface)', color: 'var(--primary)', fontWeight: 800, boxShadow: '0 1px 2px rgba(15, 23, 42, 0.08)' },
  addRow: { display: 'flex', gap: 8, marginBottom: 12 },
  input: {
    padding: '8px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: 14,
    background: 'var(--surface)', color: 'var(--text-primary)',
  },
  addBtn: {
    padding: '8px 16px', borderRadius: 'var(--radius-sm)', border: 'none',
    background: 'var(--primary)', color: '#fff', fontSize: 14, cursor: 'pointer', fontWeight: 800,
  },
  list: { display: 'flex', flexDirection: 'column', gap: 4 },
  projectGroup: { display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 },
  groupTitle: {
    display: 'flex', alignItems: 'center', gap: 6,
    fontSize: 12, color: 'var(--text-secondary)', fontWeight: 700, marginTop: 4,
  },
  colorPickerWrap: {
    width: 24, height: 24, borderRadius: '50%', overflow: 'hidden',
    cursor: 'pointer', boxSizing: 'border-box',
  },
  colorPicker: {
    width: 36, height: 36, border: 'none', padding: 0,
    transform: 'translate(-6px, -6px)', cursor: 'pointer',
  },
  listItem: {
    display: 'flex', alignItems: 'center', padding: '8px 10px',
    borderRadius: 'var(--radius-sm)', background: 'var(--surface-soft)', fontSize: 14, color: 'var(--text-primary)',
  },
  deleteBtn: {
    border: 'none', background: 'transparent', cursor: 'pointer',
    color: 'var(--text-muted)', fontSize: 12, padding: '2px 4px',
  },
  closeBtn: {
    border: 'none', background: 'transparent', cursor: 'pointer',
    fontSize: 16, color: 'var(--text-secondary)',
  },
}
