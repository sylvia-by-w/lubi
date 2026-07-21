import { useState } from 'react'
import type { Category, Project } from '../types'
import {
  AI_PROVIDER_PRESETS,
  testAIConnection,
  type AIConfig,
  type AIProvider,
} from '../services/aiReviewService'

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
  aiConfig: AIConfig
  onUpdateAIConfig: (updates: Partial<AIConfig>) => void
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
  aiConfig, onUpdateAIConfig,
}: Props) {
  const [catName, setCatName] = useState('')
  const [catColor, setCatColor] = useState(PRESET_COLORS[0])
  const [projName, setProjName] = useState('')
  const [projCategoryId, setProjCategoryId] = useState(categories[0]?.id ?? '')
  const [tab, setTab] = useState<'categories' | 'projects' | 'ai' | 'backup'>('categories')
  const [importMessage, setImportMessage] = useState('')
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'ok' | 'error'>('idle')
  const [testMessage, setTestMessage] = useState('')

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
        setImportMessage('数据导入成功。')
      } catch {
        setImportMessage('导入失败——这个文件不是有效的备份 JSON。')
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

  const handleProviderChange = (provider: AIProvider) => {
    if (provider === 'custom') {
      onUpdateAIConfig({ provider })
      return
    }
    const preset = AI_PROVIDER_PRESETS[provider]
    onUpdateAIConfig({ provider, baseUrl: preset.baseUrl, model: preset.model })
  }

  const handleTestConnection = async () => {
    setTestStatus('testing')
    setTestMessage('')
    const result = await testAIConnection(aiConfig)
    setTestStatus(result.ok ? 'ok' : 'error')
    setTestMessage(result.message)
  }

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: 'var(--text-primary)' }}>设置</h2>
          <button onClick={onClose} style={styles.closeBtn}>✕</button>
        </div>

        <div style={styles.tabs}>
          <button
            style={{ ...styles.tab, ...(tab === 'categories' ? styles.tabActive : {}) }}
            onClick={() => setTab('categories')}
          >分类</button>
          <button
            style={{ ...styles.tab, ...(tab === 'projects' ? styles.tabActive : {}) }}
            onClick={() => setTab('projects')}
          >项目</button>
          <button
            style={{ ...styles.tab, ...(tab === 'ai' ? styles.tabActive : {}) }}
            onClick={() => setTab('ai')}
          >AI 回顾</button>
          <button
            style={{ ...styles.tab, ...(tab === 'backup' ? styles.tabActive : {}) }}
            onClick={() => setTab('backup')}
          >备份数据</button>
        </div>

        {tab === 'categories' && (
          <div>
            <div style={styles.addRow}>
              <input
                style={{ ...styles.input, flex: 1 }}
                placeholder="分类名称"
                value={catName}
                onChange={e => setCatName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddCat()}
              />
              <button onClick={handleAddCat} style={styles.addBtn}>添加</button>
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
              {categories.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>暂无分类</p>}
            </div>
          </div>
        )}

        {tab === 'projects' && (
          <div>
            <div style={styles.addRow}>
              <input
                style={{ ...styles.input, flex: 1 }}
                placeholder="项目名称"
                value={projName}
                onChange={e => setProjName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddProj()}
              />
              <select
                style={{ ...styles.input, width: 150 }}
                value={selectedProjCategoryId}
                onChange={e => setProjCategoryId(e.target.value)}
              >
                <option value="">分类</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
              <button onClick={handleAddProj} style={styles.addBtn}>添加</button>
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
              {projects.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>暂无项目</p>}
            </div>
          </div>
        )}

        {tab === 'ai' && (
          <div>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 0 }}>
              填写 API Key 后，"AI 回顾"会真正调用大模型生成内容；不填的话会继续用内置的模板生成回顾。
              Key 只保存在这个浏览器本地，不会上传到任何服务器。
            </p>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
              {(Object.keys(AI_PROVIDER_PRESETS) as Array<Exclude<AIProvider, 'custom'>>).map(key => (
                <button
                  key={key}
                  onClick={() => handleProviderChange(key)}
                  style={{
                    ...styles.providerChip,
                    ...(aiConfig.provider === key ? styles.providerChipActive : {}),
                  }}
                >{AI_PROVIDER_PRESETS[key].label}</button>
              ))}
              <button
                onClick={() => handleProviderChange('custom')}
                style={{
                  ...styles.providerChip,
                  ...(aiConfig.provider === 'custom' ? styles.providerChipActive : {}),
                }}
              >自定义</button>
            </div>

            {aiConfig.provider !== 'custom' && (
              <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: -8, marginBottom: 14 }}>
                {AI_PROVIDER_PRESETS[aiConfig.provider].note}
                {' '}
                <a
                  href={AI_PROVIDER_PRESETS[aiConfig.provider].keyUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: 'var(--primary)' }}
                >去获取 API Key →</a>
              </p>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
              <label style={styles.fieldLabel}>
                Base URL
                <input
                  style={{ ...styles.input, width: '100%', marginTop: 4, boxSizing: 'border-box' }}
                  value={aiConfig.baseUrl}
                  onChange={e => onUpdateAIConfig({ baseUrl: e.target.value })}
                  placeholder="https://open.bigmodel.cn/api/paas/v4/chat/completions"
                />
              </label>
              <label style={styles.fieldLabel}>
                模型名称
                <input
                  style={{ ...styles.input, width: '100%', marginTop: 4, boxSizing: 'border-box' }}
                  value={aiConfig.model}
                  onChange={e => onUpdateAIConfig({ model: e.target.value })}
                  placeholder="glm-4.7-flash"
                />
              </label>
              <label style={styles.fieldLabel}>
                API Key
                <input
                  type="password"
                  style={{ ...styles.input, width: '100%', marginTop: 4, boxSizing: 'border-box' }}
                  value={aiConfig.apiKey}
                  onChange={e => onUpdateAIConfig({ apiKey: e.target.value })}
                  placeholder="sk-..."
                  autoComplete="off"
                />
              </label>
            </div>

            <button
              onClick={handleTestConnection}
              disabled={testStatus === 'testing'}
              style={{ ...styles.addBtn, marginBottom: 10 }}
            >
              {testStatus === 'testing' ? '测试中...' : '测试连接'}
            </button>

            {testStatus === 'ok' && (
              <p style={{ color: '#10b981', fontSize: 13 }}>连接成功：{testMessage}</p>
            )}
            {testStatus === 'error' && (
              <p style={{ color: '#ef4444', fontSize: 13 }}>{testMessage}</p>
            )}
          </div>
        )}

        {tab === 'backup' && (
          <div>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 0 }}>
              所有数据(分类、项目、任务、时间块、截止日期)都只存在这个浏览器里。
              换域名或清空浏览器数据前，记得先导出备份。
            </p>
            <button onClick={handleExport} style={{ ...styles.addBtn, marginBottom: 12 }}>导出全部数据</button>
            <div>
              <label style={{ ...styles.addBtn, display: 'inline-block', cursor: 'pointer', background: 'var(--surface-muted)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}>
                导入全部数据
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
  providerChip: {
    padding: '6px 12px', borderRadius: 999, border: '1px solid var(--border)',
    background: 'var(--surface)', color: 'var(--text-secondary)', fontSize: 13,
    fontWeight: 700, cursor: 'pointer',
  },
  providerChipActive: {
    background: 'var(--primary)', color: '#fff', borderColor: 'var(--primary)',
  },
  fieldLabel: {
    display: 'flex', flexDirection: 'column', fontSize: 12, fontWeight: 700,
    color: 'var(--text-secondary)',
  },
}
