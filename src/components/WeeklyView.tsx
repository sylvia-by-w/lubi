import { useRef, useEffect } from 'react'
import type { TaskBlock, Category } from '../types'
import { getWeekDays, formatDate, formatDayLabel } from '../utils/time'
import DayColumn from './DayColumn'

interface Props {
  weekStart: Date
  tasks: TaskBlock[]
  categories: Category[]
  onClickSlot: (date: string) => void
  onClickTask: (task: TaskBlock) => void
}

const SLOT_HEIGHT = 20
const TOTAL_HEIGHT = 96 * SLOT_HEIGHT

export default function WeeklyView({ weekStart, tasks, categories, onClickSlot, onClickTask }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const days = getWeekDays(weekStart)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = (6 / 24) * TOTAL_HEIGHT
    }
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', background: '#fff' }}>
        <div style={{ width: 56, flexShrink: 0 }} />
        {days.map(d => {
          const dateStr = formatDate(d)
          const isToday = dateStr === formatDate(new Date())
          return (
            <div
              key={dateStr}
              style={{
                flex: 1,
                textAlign: 'center',
                padding: '10px 0',
                fontSize: 13,
                fontWeight: isToday ? 700 : 400,
                color: isToday ? '#6366f1' : '#374151',
                borderLeft: '1px solid #e5e7eb',
              }}
            >
              {formatDayLabel(dateStr)}
            </div>
          )
        })}
      </div>

      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', position: 'relative' }}>
        <div style={{ display: 'flex', height: TOTAL_HEIGHT }}>
          <div style={{ width: 56, flexShrink: 0, position: 'relative' }}>
            {Array.from({ length: 24 }, (_, h) => (
              <div
                key={h}
                style={{
                  position: 'absolute',
                  top: h * 4 * SLOT_HEIGHT - 8,
                  left: 0,
                  width: '100%',
                  textAlign: 'right',
                  paddingRight: 8,
                  fontSize: 11,
                  color: '#9ca3af',
                }}
              >
                {String(h).padStart(2, '0')}:00
              </div>
            ))}
          </div>

          <div style={{ flex: 1, display: 'flex', position: 'relative' }}>
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
              {Array.from({ length: 97 }, (_, i) => (
                <div
                  key={i}
                  style={{
                    position: 'absolute',
                    top: i * SLOT_HEIGHT,
                    left: 0,
                    right: 0,
                    borderTop: i % 4 === 0
                      ? '1px solid #e5e7eb'
                      : '1px solid #f3f4f6',
                  }}
                />
              ))}
            </div>

            {days.map(d => {
              const dateStr = formatDate(d)
              const dayTasks = tasks.filter(t => t.date === dateStr)
              return (
                <DayColumn
                  key={dateStr}
                  dateStr={dateStr}
                  tasks={dayTasks}
                  categories={categories}
                  onClickSlot={onClickSlot}
                  onClickTask={onClickTask}
                />
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}