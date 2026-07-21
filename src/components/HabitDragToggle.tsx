import { useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'

interface Props {
  done: boolean
  color: string
  onToggle: () => void
  disabled?: boolean
  title?: string
}

const TRACK_W = 26
const THUMB = 12
const PAD = 2
const MAX_X = TRACK_W - THUMB - PAD * 2
const CLICK_THRESHOLD = 4

export default function HabitDragToggle({ done, color, onToggle, disabled, title }: Props) {
  const trackRef = useRef<HTMLDivElement>(null)
  const startRef = useRef<{ x: number; startedDone: boolean } | null>(null)
  const [dragX, setDragX] = useState<number | null>(null)

  const clampFromClientX = (clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect()
    if (!rect) return 0
    const x = clientX - rect.left - PAD - THUMB / 2
    return Math.max(0, Math.min(MAX_X, x))
  }

  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (disabled) return
    e.currentTarget.setPointerCapture(e.pointerId)
    startRef.current = { x: e.clientX, startedDone: done }
    setDragX(done ? MAX_X : 0)
  }

  const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (dragX === null) return
    setDragX(clampFromClientX(e.clientX))
  }

  const handlePointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (dragX === null || !startRef.current) {
      setDragX(null)
      return
    }
    const totalDelta = Math.abs(e.clientX - startRef.current.x)
    const shouldBeDone = totalDelta < CLICK_THRESHOLD
      ? !startRef.current.startedDone
      : clampFromClientX(e.clientX) > MAX_X / 2
    if (shouldBeDone !== done) onToggle()
    setDragX(null)
    startRef.current = null
  }

  const thumbX = dragX !== null ? dragX : (done ? MAX_X : 0)

  const trackStyle: CSSProperties = {
    width: TRACK_W,
    height: THUMB + PAD * 2,
    borderRadius: 999,
    background: done ? color : 'var(--surface-muted)',
    border: '1.5px solid var(--border-soft)',
    position: 'relative',
    cursor: disabled ? 'default' : 'pointer',
    opacity: disabled ? 0.35 : 1,
    touchAction: 'none',
    boxSizing: 'border-box',
    flexShrink: 0,
  }

  const thumbStyle: CSSProperties = {
    position: 'absolute',
    top: PAD - 1.5,
    left: PAD - 1.5 + thumbX,
    width: THUMB,
    height: THUMB,
    borderRadius: '50%',
    background: '#fff',
    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.3)',
    transition: dragX === null ? 'left 0.15s ease' : 'none',
  }

  return (
    <div
      ref={trackRef}
      style={trackStyle}
      title={title}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => { setDragX(null); startRef.current = null }}
    >
      <div style={thumbStyle} />
    </div>
  )
}
