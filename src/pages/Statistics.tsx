import { useState } from 'react'
import type { TaskBlock, Category, Project } from '../types'
import { formatDate, timeToMinutes } from '../utils/time'

interface Props {
  tasks: TaskBlock[]
  categories: Category[]
  projects: Project[]
}

type Range = 'thisWeek' | 'lastWeek' | 'thisMonth'

function getRange(range: Range): { start: string; end: string } {
  const now = new Date()
  const day = now.getDay()
  const diff = day === 0 ? -6 : 1 - day

  if (range === 'thisWeek') {
    const start = new Date(now)
    start.setDate(now.getDate() + diff)
    const end = new Date(start)
    end.setDate(start.getDate() + 6)
    return { start: fmt(start), end: fmt(end) }
  }

  if (range === 'lastWeek') {
    const start = new Date(now)
    start.setDate(now.getDate() + diff - 7)
    const end = new Date(start)
    end.setDate(start.getDate() + 6)
    return { start: fmt(start), end: fmt(end) }
  }

  // thisMonth
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return { start: fmt(start), end: fmt(end) }
}

function fmt(d: Date) {
  return formatDate(d)
}

function calcMinutes(tasks: TaskBlock[]) {
  return tasks.reduce((sum, t) => {
    return sum + (timeToMinutes(t.endTime) - timeToMinutes(t.startTime))
  }, 0)
}

function fmtHours(min: number) {
  const h = Math.floor(Math.abs(min) / 60)
  const m = Math.abs(min) % 60
  const sign = min < 0 ? '-' : '+'
  return m === 0 ? `${sign}${h}h` : `${sign}${h}h${m}m`
}

function fmtHoursAbs(min: number) {
  const h = Math.floor(min / 60)
  const m = min % 60
  return m === 0 ? `${h}h` : `${h}h${m}m`
}

export default function Statistics({ tasks, categories, projects }: Props) {
  const [range, setRange] = useState<Range>('thisWeek')
  const { start, end } = getRange(range)

  const filtered = tasks.filter(t => t.date >= start && t.date <= end)

  // 按类别统计
  const byCat = categories.map(cat => {
    const planned = calcMinutes(filtered.filter(t => t.categoryId === cat.id && t.type === 'plan'))
    const actual = calcMinutes(filtered.filter(t => t.categoryId === cat.id && t.type === 'actual'))
    return { cat, planned, actual, diff: actual - planned }
  }).filter(r => r.planned > 0 || r.actual > 0)

  // 按项目统计
  const byProj = projects.map(proj => {
    const planned = calcMinutes(filtered.filter(t => t.projectId === proj.id && t.type === 'plan'))
    const actual = calcMinutes(filtered.filter(t => t.projectId === proj.id && t.type === 'actual'))
    const cat = categories.find(c => c.id === proj.categoryId)
    return { proj, cat, planned, actual, diff: actual - planned }
  }).filter(r => r.planned > 0 || r.actual > 0)

  const rangeOptions: { value: Range; label: string }[] = [
    { value: 'thisWeek', label: 'This Week' },
    { value: 'lastWeek', label: 'Last Week' },
    { value: 'thisMonth', label: 'This Month' },
  ]

  return (
    <div style={styles.page}>
      {/* 时间范围选择 */}
      <div style={styles.rangeRow}>
        {rangeOptions.map(o => (
          <button
            key={o.value}
            style={{ ...styles.rangeBtn, ...(range === o.value ? styles.rangeBtnActive : {}) }}
            onClick={() => setRange(o.value)}
          >{o.label}</button>
        ))}
      </div>

      {/* 按类别 */}
      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>By Category</h2>
        {byCat.length === 0 ? (
          <p style={styles.empty}>No data for this period</p>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Category</th>
                <th style={styles.th}>Planned</th>
                <th style={styles.th}>Actual</th>
                <th style={styles.th}>Diff</th>
              </tr>
            </thead>
            <tbody>
              {byCat.map(({ cat, planned, actual, diff }) => (
                <tr key={cat.id}>
                  <td style={styles.td}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: cat.color, display: 'inline-block' }} />
                      {cat.name}
                    </span>
                  </td>
                  <td style={styles.td}>{fmtHoursAbs(planned)}</td>
                  <td style={styles.td}>{fmtHoursAbs(actual)}</td>
                  <td style={{ ...styles.td, color: diff >= 0 ? '#16a34a' : '#dc2626', fontWeight: 600 }}>
                    {fmtHours(diff)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 按项目 */}
      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>By Project</h2>
        {byProj.length === 0 ? (
          <p style={styles.empty}>No data for this period</p>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Project</th>
                <th style={styles.th}>Category</th>
                <th style={styles.th}>Planned</th>
                <th style={styles.th}>Actual</th>
                <th style={styles.th}>Diff</th>
              </tr>
            </thead>
            <tbody>
              {byProj.map(({ proj, cat, planned, actual, diff }) => (
                <tr key={proj.id}>
                  <td style={styles.td}>{proj.name}</td>
                  <td style={styles.td}>
                    {cat ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 10, height: 10, borderRadius: '50%', background: cat.color, display: 'inline-block' }} />
                        {cat.name}
                      </span>
                    ) : (
                      <span style={{ color: '#9ca3af' }}>Unknown</span>
                    )}
                  </td>
                  <td style={styles.td}>{fmtHoursAbs(planned)}</td>
                  <td style={styles.td}>{fmtHoursAbs(actual)}</td>
                  <td style={{ ...styles.td, color: diff >= 0 ? '#16a34a' : '#dc2626', fontWeight: 600 }}>
                    {fmtHours(diff)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: { padding: 32, maxWidth: 800, margin: '0 auto' },
  rangeRow: { display: 'flex', gap: 8, marginBottom: 32 },
  rangeBtn: {
    padding: '8px 18px', borderRadius: 6, border: '1px solid #e5e7eb',
    background: '#fff', fontSize: 14, cursor: 'pointer', color: '#6b7280',
  },
  rangeBtnActive: { background: '#111827', color: '#fff', border: '1px solid #111827' },
  section: { marginBottom: 40 },
  sectionTitle: { fontSize: 16, fontWeight: 600, marginBottom: 16, color: '#111827' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { textAlign: 'left', padding: '10px 12px', borderBottom: '2px solid #e5e7eb', fontSize: 13, color: '#6b7280', fontWeight: 500 },
  td: { padding: '10px 12px', borderBottom: '1px solid #f3f4f6', fontSize: 14, color: '#374151' },
  empty: { color: '#9ca3af', fontSize: 14 },
}
