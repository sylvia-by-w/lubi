import { useState } from 'react'
import type { Category, Deadline, PriorityLevel, Project } from '../types'
import { useLanguage } from '../i18n/LanguageContext'

interface Props {
  open: boolean
  onClose: () => void
  deadlines: Deadline[]
  categories: Category[]
  projects: Project[]
  onAddDeadline: (deadline: Omit<Deadline, 'id' | 'createdAt' | 'updatedAt'>) => void
  onUpdateDeadline: (id: string, updates: Partial<Omit<Deadline, 'id' | 'createdAt'>>) => void
  onDeleteDeadline: (id: string) => void
}

interface FormState {
  title: string
  date: string
  time: string
  projectId: string
  categoryId: string
  priority: PriorityLevel | ''
  note: string
}

const emptyForm: FormState = {
  title: '',
  date: '',
  time: '',
  projectId: '',
  categoryId: '',
  priority: '',
  note: '',
}

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function deadlineToForm(deadline: Deadline): FormState {
  return {
    title: deadline.title,
    date: deadline.date,
    time: deadline.time ?? '',
    projectId: deadline.projectId ?? '',
    categoryId: deadline.categoryId ?? '',
    priority: deadline.priority ?? '',
    note: deadline.note ?? '',
  }
}

function formToDeadline(form: FormState): Omit<Deadline, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    title: form.title.trim(),
    date: form.date,
    time: form.time || undefined,
    projectId: form.projectId || undefined,
    categoryId: form.categoryId || undefined,
    priority: form.priority || undefined,
    note: form.note.trim() || undefined,
  }
}

export default function DeadlineModal({
  open,
  onClose,
  deadlines,
  categories,
  projects,
  onAddDeadline,
  onUpdateDeadline,
  onDeleteDeadline,
}: Props) {
  const [form, setForm] = useState<FormState>(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const { t } = useLanguage()

  if (!open) return null

  const today = todayStr()
  const sorted = [...deadlines].sort((a, b) => `${a.date}T${a.time ?? '00:00'}`.localeCompare(`${b.date}T${b.time ?? '00:00'}`))
  const upcoming = sorted.filter(d => d.date >= today)
  const past = sorted.filter(d => d.date < today).reverse()

  const patchForm = (updates: Partial<FormState>) => setForm(prev => ({ ...prev, ...updates }))

  const handleProjectChange = (projectId: string) => {
    const project = projects.find(p => p.id === projectId)
    patchForm({
      projectId,
      categoryId: project?.categoryId ?? form.categoryId,
    })
  }

  const startAdd = () => {
    setForm(emptyForm)
    setEditingId(null)
    setShowForm(true)
  }

  const startEdit = (deadline: Deadline) => {
    setForm(deadlineToForm(deadline))
    setEditingId(deadline.id)
    setShowForm(true)
  }

  const cancelForm = () => {
    setForm(emptyForm)
    setEditingId(null)
    setShowForm(false)
  }

  const saveForm = () => {
    if (!form.title.trim() || !form.date) return
    const payload = formToDeadline(form)
    if (editingId) {
      onUpdateDeadline(editingId, payload)
    } else {
      onAddDeadline(payload)
    }
    cancelForm()
  }

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.header}>
          <h2 style={styles.title}>{t('deadlineModal.title')}</h2>
          <button onClick={onClose} style={styles.closeBtn}>x</button>
        </div>

        <button style={styles.addBtn} onClick={startAdd}>{t('deadlineModal.addDeadline')}</button>

        {showForm && (
          <div style={styles.formCard}>
            <label style={styles.label}>{t('deadlineModal.titleLabel')}</label>
            <input
              style={styles.input}
              value={form.title}
              onChange={e => patchForm({ title: e.target.value })}
              placeholder={t('deadlineModal.titlePlaceholder')}
            />

            <div style={styles.row}>
              <div style={{ flex: 1 }}>
                <label style={styles.label}>{t('deadlineModal.date')}</label>
                <input style={styles.input} type="date" value={form.date} onChange={e => patchForm({ date: e.target.value })} />
              </div>
              <div style={{ width: 120 }}>
                <label style={styles.label}>{t('deadlineModal.time')}</label>
                <input style={styles.input} type="time" value={form.time} onChange={e => patchForm({ time: e.target.value })} />
              </div>
            </div>

            <label style={styles.label}>{t('deadlineModal.project')}</label>
            <select style={styles.input} value={form.projectId} onChange={e => handleProjectChange(e.target.value)}>
              <option value="">{t('common.none')}</option>
              {projects.map(project => (
                <option key={project.id} value={project.id}>{project.name}</option>
              ))}
            </select>

            <div style={styles.row}>
              <div style={{ flex: 1 }}>
                <label style={styles.label}>{t('deadlineModal.category')}</label>
                <select style={styles.input} value={form.categoryId} onChange={e => patchForm({ categoryId: e.target.value })}>
                  <option value="">{t('common.none')}</option>
                  {categories.map(category => (
                    <option key={category.id} value={category.id}>{category.name}</option>
                  ))}
                </select>
              </div>
              <div style={{ width: 130 }}>
                <label style={styles.label}>{t('deadlineModal.priority')}</label>
                <select style={styles.input} value={form.priority} onChange={e => patchForm({ priority: e.target.value as PriorityLevel | '' })}>
                  <option value="">{t('common.none')}</option>
                  <option value="low">{t('common.low')}</option>
                  <option value="medium">{t('common.medium')}</option>
                  <option value="high">{t('common.high')}</option>
                </select>
              </div>
            </div>

            <label style={styles.label}>{t('deadlineModal.note')}</label>
            <textarea
              style={{ ...styles.input, minHeight: 70, resize: 'vertical' }}
              value={form.note}
              onChange={e => patchForm({ note: e.target.value })}
              placeholder={t('deadlineModal.notePlaceholder')}
            />

            <div style={styles.actions}>
              <button style={styles.cancelBtn} onClick={cancelForm}>{t('common.cancel')}</button>
              <button style={styles.saveBtn} onClick={saveForm}>{editingId ? t('common.save') : t('common.add')}</button>
            </div>
          </div>
        )}

        <DeadlineList
          title={t('deadlineModal.upcoming')}
          deadlines={upcoming}
          projects={projects}
          categories={categories}
          emptyText={t('deadlineModal.noUpcoming')}
          onEdit={startEdit}
          onDelete={onDeleteDeadline}
        />

        {past.length > 0 && (
          <DeadlineList
            title={t('deadlineModal.expired')}
            deadlines={past}
            projects={projects}
            categories={categories}
            onEdit={startEdit}
            onDelete={onDeleteDeadline}
          />
        )}
      </div>
    </div>
  )
}

function DeadlineList({
  title,
  deadlines,
  projects,
  categories,
  emptyText,
  onEdit,
  onDelete,
}: {
  title: string
  deadlines: Deadline[]
  projects: Project[]
  categories: Category[]
  emptyText?: string
  onEdit: (deadline: Deadline) => void
  onDelete: (id: string) => void
}) {
  const { t } = useLanguage()
  return (
    <section style={styles.section}>
      <h3 style={styles.sectionTitle}>{title}</h3>
      {deadlines.length === 0 ? (
        <p style={styles.empty}>{emptyText ?? t('deadlineModal.noDeadline')}</p>
      ) : (
        <div style={styles.list}>
          {deadlines.map(deadline => {
            const project = deadline.projectId ? projects.find(p => p.id === deadline.projectId) : undefined
            const category = deadline.categoryId ? categories.find(c => c.id === deadline.categoryId) : undefined
            return (
              <div key={deadline.id} style={styles.item}>
                <div style={styles.itemMain}>
                  <div style={styles.itemTitleRow}>
                    <span style={styles.itemTitle}>{deadline.title}</span>
                    {deadline.priority && <span style={{ ...styles.priority, ...priorityStyle(deadline.priority) }}>{priorityText(deadline.priority, t)}</span>}
                  </div>
                  <div style={styles.meta}>
                    <span>{deadline.date}{deadline.time ? ` ${deadline.time}` : ''}</span>
                    {project && <span>{project.name}</span>}
                    {category && (
                      <span style={styles.categoryMeta}>
                        <span style={{ ...styles.dot, background: category.color }} />
                        {category.name}
                      </span>
                    )}
                  </div>
                  {deadline.note && <p style={styles.note}>{deadline.note}</p>}
                </div>
                <div style={styles.itemActions}>
                  <button style={styles.linkBtn} onClick={() => onEdit(deadline)}>{t('common.edit')}</button>
                  <button style={styles.linkBtnDanger} onClick={() => onDelete(deadline.id)}>{t('common.delete')}</button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

function priorityText(priority: PriorityLevel, t: (path: string) => string) {
  if (priority === 'high') return t('common.high')
  if (priority === 'medium') return t('common.medium')
  return t('common.low')
}

function priorityStyle(priority: PriorityLevel): React.CSSProperties {
  if (priority === 'high') return { background: '#fee2e2', color: '#b91c1c' }
  if (priority === 'medium') return { background: '#fef3c7', color: '#92400e' }
  return { background: '#e0f2fe', color: '#0369a1' }
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(17, 24, 39, 0.42)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
  },
  modal: {
    background: 'var(--surface)', borderRadius: 'var(--radius-lg)', padding: 24, width: 520,
    maxHeight: '84vh', overflowY: 'auto',
    border: '1px solid var(--border)', boxShadow: 'var(--shadow-popover)',
  },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  title: { margin: 0, fontSize: 20, fontWeight: 800, color: 'var(--text-primary)' },
  closeBtn: { border: 'none', background: 'transparent', color: 'var(--text-secondary)', fontSize: 16, cursor: 'pointer' },
  addBtn: {
    width: '100%', padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: 'none',
    background: 'var(--primary)', color: '#fff', fontSize: 14, fontWeight: 800, cursor: 'pointer', marginBottom: 14,
  },
  formCard: {
    border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 12, background: 'var(--surface-soft)',
    display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 18,
  },
  label: { fontSize: 12, color: 'var(--text-secondary)', fontWeight: 700 },
  input: {
    width: '100%', padding: '8px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)',
    background: 'var(--surface)', color: 'var(--text-primary)', fontSize: 14, boxSizing: 'border-box', font: 'inherit',
  },
  row: { display: 'flex', gap: 8 },
  actions: { display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 6 },
  cancelBtn: { padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 700 },
  saveBtn: { padding: '8px 14px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--primary)', color: '#fff', cursor: 'pointer', fontWeight: 800 },
  section: { marginTop: 12 },
  sectionTitle: { margin: '0 0 8px', fontSize: 13, color: 'var(--text-primary)', fontWeight: 800 },
  empty: { margin: 0, color: 'var(--text-muted)', fontSize: 13 },
  list: { display: 'flex', flexDirection: 'column', gap: 8 },
  item: {
    display: 'flex', gap: 10, alignItems: 'flex-start', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)', padding: 10, background: 'var(--surface)',
  },
  itemMain: { flex: 1, minWidth: 0 },
  itemTitleRow: { display: 'flex', alignItems: 'center', gap: 8 },
  itemTitle: { fontSize: 14, color: 'var(--text-primary)', fontWeight: 750 },
  priority: { borderRadius: 999, padding: '2px 6px', fontSize: 10, fontWeight: 700, textTransform: 'capitalize' },
  meta: { display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4, color: 'var(--text-secondary)', fontSize: 12 },
  categoryMeta: { display: 'inline-flex', alignItems: 'center', gap: 4 },
  dot: { width: 8, height: 8, borderRadius: '50%', display: 'inline-block' },
  note: { margin: '6px 0 0', color: 'var(--text-secondary)', fontSize: 12, lineHeight: 1.35 },
  itemActions: { display: 'flex', flexDirection: 'column', gap: 4 },
  linkBtn: { border: 'none', background: 'transparent', color: 'var(--primary)', fontSize: 12, fontWeight: 700, cursor: 'pointer' },
  linkBtnDanger: { border: 'none', background: 'transparent', color: 'var(--danger)', fontSize: 12, fontWeight: 700, cursor: 'pointer' },
}
