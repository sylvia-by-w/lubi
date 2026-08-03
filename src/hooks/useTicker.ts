import { useEffect, useState } from 'react'

/**
 * Forces a re-render every `intervalMs` while `active` is true.
 * Used to keep elapsed-time displays and the live "recording" calendar block moving.
 */
export function useTicker(active: boolean, intervalMs: number) {
  const [, setTick] = useState(0)

  useEffect(() => {
    if (!active) return
    const id = setInterval(() => setTick(t => t + 1), intervalMs)
    return () => clearInterval(id)
  }, [active, intervalMs])
}
