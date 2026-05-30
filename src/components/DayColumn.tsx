import type { TaskBlock, Category } from '../types'

interface Props {
  dateStr: string
  tasks: TaskBlock[]
  categories: Category[]
  onClickSlot: (date: string) => void
  onClickTask: (task: TaskBlock) => void
}

interface SegmentGroup {
  startMin: number
  endMin: number
  planTask: TaskBlock | null
  actualTask: TaskBlock | null
}

function timeToMin(t: string) {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function buildSegments(tasks: TaskBlock[]): SegmentGroup[] {
  const planTasks = tasks.filter(t => t.type === 'plan')
  const actualTasks = tasks.filter(t => t.type === 'actual')

  const points = new Set<number>([0, 24 * 60])
  tasks.forEach(t => {
    points.add(timeToMin(t.startTime))
    points.add(timeToMin(t.endTime))
  })

  const sorted = Array.from(points).sort((a, b) => a - b)
  const segments: SegmentGroup[] = []

  for (let i = 0; i < sorted.length - 1; i++) {
    const segStart = sorted[i]
    const segEnd = sorted[i + 1]
    const mid = (segStart + segEnd) / 2

    const planTask = planTasks.find(t =>
      timeToMin(t.startTime) <= mid && mid < timeToMin(t.endTime)
    ) ?? null

    const actualTask = actualTasks.find(t =>
      timeToMin(t.startTime) <= mid && mid < timeToMin(t.endTime)
    ) ?? null

    if (planTask || actualTask) {
      segments.push({ startMin: segStart, endMin: segEnd, planTask, actualTask })
    }
  }

  const merged: SegmentGroup[] = []
  for (const seg of segments) {
    const last = merged[merged.length - 1]
    if (
      last &&
      last.planTask?.id === seg.planTask?.id &&
      last.actualTask?.id === seg.actualTask?.id
    ) {
      last.endMin = seg.endMin
    } else {
      merged.push({ ...seg })
    }
  }

  return merged
}

export default function DayColumn({ dateStr, tasks, categories, onClickSlot, onClickTask }: Props) {
  const segments = buildSegments(tasks)
  const TOTAL = 24 * 60

  return (
    <div
      style={{ position: 'relative', flex: 1, borderLeft: '1px solid #e5e7eb', cursor: 'pointer' }}
      onClick={() => onClickSlot(dateStr)}
    >
      {segments.map((seg, i) => {
        const top = (seg.startMin / TOTAL) * 100
        const height = ((seg.endMin - seg.startMin) / TOTAL) * 100

        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              top: `${top}%`,
              height: `${height}%`,
              left: 0,
              right: 0,
              display: 'flex',
            }}
          >
            {/* 实际永远占左边70% */}
            {seg.actualTask ? (
              <ActualBlock
                task={seg.actualTask}
                categories={categories}
                onClick={onClickTask}
              />
            ) : (
              <div style={{ width: '70%' }} />
            )}

            {/* 计划永远占右边30% */}
            {seg.planTask ? (
              <PlanBlock
                task={seg.planTask}
                categories={categories}
                onClick={onClickTask}
              />
            ) : (
              <div style={{ width: '30%' }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

function ActualBlock({ task, categories, onClick }: {
  task: TaskBlock
  categories: Category[]
  onClick: (task: TaskBlock) => void
}) {
  const cat = categories.find(c => c.id === task.categoryId)
  const color = cat?.color ?? '#6366f1'

  return (
    <div
      onClick={e => { e.stopPropagation(); onClick(task) }}
      style={{
        width: '70%',
        height: '100%',
        background: `${color}cc`,
        borderLeft: `4px solid ${color}`,
        boxSizing: 'border-box',
        padding: '3px 6px',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-start',
      }}
    >
      <span style={{
        fontSize: 12,
        fontWeight: 600,
        color: '#fff',
        lineHeight: 1.3,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}>
        {task.name}
      </span>
      <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.8)' }}>
        {task.startTime}–{task.endTime}
      </span>
    </div>
  )
}

function PlanBlock({ task, onClick }: {
  task: TaskBlock
  categories: Category[]
  onClick: (task: TaskBlock) => void
}) {
  return (
    <div
      onClick={e => { e.stopPropagation(); onClick(task) }}
      style={{
        width: '30%',
        height: '100%',
        background: '#f3f4f6',
        border: '1.5px dashed #d1d5db',
        boxSizing: 'border-box',
        padding: '3px 4px',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-start',
      }}
    >
      <span style={{
        fontSize: 10,
        fontWeight: 500,
        color: '#9ca3af',
        lineHeight: 1.3,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}>
        {task.name}
      </span>
    </div>
  )
}
