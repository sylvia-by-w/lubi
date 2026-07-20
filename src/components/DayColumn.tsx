import { useState } from 'react'
import type { TaskBlock, Category } from '../types'
import { minutesToTime } from '../utils/time'

interface Props {
  dateStr: string
  tasks: TaskBlock[]
  categories: Category[]
  onCreateSelection: (selection: {
    date: string
    type: 'plan' | 'actual'
    startTime: string
    endTime: string
  }) => void
  onClickTask: (task: TaskBlock) => void
}

function timeToMin(t: string) {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function formatDuration(startTime: string, endTime: string) {
  const minutes = Math.max(0, timeToMin(endTime) - timeToMin(startTime))
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}分钟`
  if (m === 0) return `${h}小时`
  return `${h}小时${m}分钟`
}

const SLOT_MINUTES = 15
const SLOT_COUNT = 96
const ACTUAL_LANE_WIDTH = 0.7

interface DragState {
  type: 'plan' | 'actual'
  startSlot: number
  currentSlot: number
}

function clampSlot(slot: number) {
  return Math.max(0, Math.min(SLOT_COUNT - 1, slot))
}

function slotFromPointerY(clientY: number, el: HTMLDivElement) {
  const rect = el.getBoundingClientRect()
  return clampSlot(Math.floor((clientY - rect.top) / (rect.height / SLOT_COUNT)))
}

function laneFromPointerX(clientX: number, el: HTMLDivElement): 'plan' | 'actual' {
  const rect = el.getBoundingClientRect()
  return (clientX - rect.left) / rect.width < ACTUAL_LANE_WIDTH ? 'actual' : 'plan'
}

function hasTaskAtSlot(tasks: TaskBlock[], type: 'plan' | 'actual', slot: number) {
  const startMin = slot * SLOT_MINUTES
  const endMin = startMin + SLOT_MINUTES
  return tasks.some(t =>
    t.type === type &&
    timeToMin(t.startTime) < endMin &&
    startMin < timeToMin(t.endTime)
  )
}

function hexToRgb(hex: string) {
  const normalized = hex.replace('#', '')
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return null
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16),
  }
}

function hexToRgba(hex: string, alpha: number) {
  const rgb = hexToRgb(hex)
  return rgb ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})` : hex
}

function readableTextColor(hex: string) {
  const rgb = hexToRgb(hex)
  if (!rgb) return '#fff'
  const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000
  return brightness > 150 ? '#111827' : '#fff'
}

export default function DayColumn({ dateStr, tasks, categories, onCreateSelection, onClickTask }: Props) {
  const [drag, setDrag] = useState<DragState | null>(null)
  const TOTAL = 24 * 60

  const finishDrag = (finalDrag: DragState) => {
    document.body.style.userSelect = ''

    const startSlot = Math.min(finalDrag.startSlot, finalDrag.currentSlot)
    const endSlot = Math.max(finalDrag.startSlot, finalDrag.currentSlot) + 1

    setDrag(null)
    onCreateSelection({
      date: dateStr,
      type: finalDrag.type,
      startTime: minutesToTime(startSlot * SLOT_MINUTES),
      endTime: minutesToTime(endSlot * SLOT_MINUTES),
    })
  }

  return (
    <div
      style={{ position: 'relative', flex: 1, borderLeft: '1px solid var(--border)', cursor: 'crosshair' }}
      onPointerDown={e => {
        if (e.button !== 0) return
        const el = e.currentTarget
        const type = laneFromPointerX(e.clientX, el)
        const slot = slotFromPointerY(e.clientY, el)
        if (hasTaskAtSlot(tasks, type, slot)) return

        e.preventDefault()
        el.setPointerCapture(e.pointerId)
        document.body.style.userSelect = 'none'
        setDrag({ type, startSlot: slot, currentSlot: slot })
      }}
      onPointerMove={e => {
        if (!drag) return
        const currentSlot = slotFromPointerY(e.clientY, e.currentTarget)
        setDrag({ ...drag, currentSlot })
      }}
      onPointerUp={e => {
        if (!drag) return
        e.preventDefault()
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId)
        }
        document.body.style.userSelect = ''
        finishDrag({
          ...drag,
          currentSlot: slotFromPointerY(e.clientY, e.currentTarget),
        })
      }}
      onPointerCancel={e => {
        if (!drag) return
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId)
        }
        document.body.style.userSelect = ''
        setDrag(null)
      }}
    >
      {drag && (
        <SelectionBlock drag={drag} />
      )}

      {tasks.map(task => {
        const startMin = timeToMin(task.startTime)
        const endMin = timeToMin(task.endTime)
        const top = (startMin / TOTAL) * 100
        const height = ((endMin - startMin) / TOTAL) * 100
        const isActual = task.type === 'actual'

        return (
          <div
            key={task.id}
            style={{
              position: 'absolute',
              top: `${top}%`,
              height: `${height}%`,
              left: isActual ? 0 : '70%',
              width: isActual ? '70%' : '30%',
              zIndex: 2,
            }}
          >
            {isActual ? (
              <ActualBlock
                task={task}
                categories={categories}
                onClick={onClickTask}
              />
            ) : (
              <PlanBlock
                task={task}
                categories={categories}
                onClick={onClickTask}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

function SelectionBlock({ drag }: { drag: DragState }) {
  const startSlot = Math.min(drag.startSlot, drag.currentSlot)
  const endSlot = Math.max(drag.startSlot, drag.currentSlot) + 1

  return (
    <div
      style={{
        position: 'absolute',
        top: `${(startSlot / SLOT_COUNT) * 100}%`,
        height: `${((endSlot - startSlot) / SLOT_COUNT) * 100}%`,
        left: drag.type === 'actual' ? 0 : '70%',
        width: drag.type === 'actual' ? '70%' : '30%',
        background: 'rgba(43, 43, 43, 0.14)',
        border: '1px solid rgba(43, 43, 43, 0.65)',
        boxSizing: 'border-box',
        pointerEvents: 'none',
        zIndex: 3,
      }}
    />
  )
}

function ActualBlock({ task, categories, onClick }: {
  task: TaskBlock
  categories: Category[]
  onClick: (task: TaskBlock) => void
}) {
  const cat = categories.find(c => c.id === task.categoryId)
  const color = cat?.color ?? '#6366f1'
  const textColor = readableTextColor(color)

  return (
    <div
      onPointerDown={e => e.stopPropagation()}
      onClick={e => { e.stopPropagation(); onClick(task) }}
      style={{
        width: '100%',
        height: '100%',
        background: color,
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
        color: textColor,
        lineHeight: 1.3,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}>
        {task.name}
      </span>
      <span style={{ fontSize: 10, color: hexToRgba(textColor, 0.78) }}>
        {formatDuration(task.startTime, task.endTime)}
      </span>
    </div>
  )
}

function PlanBlock({ task, categories, onClick }: {
  task: TaskBlock
  categories: Category[]
  onClick: (task: TaskBlock) => void
}) {
  const cat = categories.find(c => c.id === task.categoryId)
  const color = cat?.color ?? '#6366f1'

  return (
    <div
      onPointerDown={e => e.stopPropagation()}
      onClick={e => { e.stopPropagation(); onClick(task) }}
      style={{
        width: '100%',
        height: '100%',
        background: hexToRgba(color, 0.14),
        border: `1.5px dashed ${color}`,
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
        color: 'var(--text-primary)',
        lineHeight: 1.3,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}>
        {task.name}
      </span>
      <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
        {formatDuration(task.startTime, task.endTime)}
      </span>
    </div>
  )
}
