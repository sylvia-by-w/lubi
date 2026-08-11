export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

export interface MinuteRange {
  start: number
  end: number
}

/**
 * Subtracts every blocker range from `range`, returning the remaining
 * non-overlapping sub-ranges (0, 1, or more — a blocker in the middle
 * splits the range in two).
 */
export function subtractTimeRanges(range: MinuteRange, blockers: MinuteRange[]): MinuteRange[] {
  let segments: MinuteRange[] = [range]
  for (const blocker of blockers) {
    const next: MinuteRange[] = []
    for (const seg of segments) {
      if (blocker.end <= seg.start || blocker.start >= seg.end) {
        next.push(seg)
        continue
      }
      if (blocker.start > seg.start) next.push({ start: seg.start, end: Math.min(blocker.start, seg.end) })
      if (blocker.end < seg.end) next.push({ start: Math.max(blocker.end, seg.start), end: seg.end })
    }
    segments = next
  }
  return segments.filter(seg => seg.end - seg.start > 0)
}

export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function getWeekDays(monday: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })
}

export function formatDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function formatDayLabel(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' })
}

export function parseDateStr(dateStr: string): Date {
  return new Date(dateStr + 'T00:00:00')
}

export function addDaysToDateStr(dateStr: string, days: number): string {
  const d = parseDateStr(dateStr)
  d.setDate(d.getDate() + days)
  return formatDate(d)
}

/** 0 = Sunday ... 6 = Saturday, matching Date#getDay() */
export function weekdayOfDateStr(dateStr: string): number {
  return parseDateStr(dateStr).getDay()
}

/**
 * Expands a recurrence rule into a list of concrete date strings (inclusive
 * of both `startDate` and `untilDate`). For 'weekly', only dates whose
 * weekday is in `weekdays` (Date#getDay() convention) are included — pass
 * the start date's own weekday to keep at least that day.
 * Capped at `maxCount` results as a safety net against runaway ranges.
 */
export function expandRecurrenceDates(
  startDate: string,
  untilDate: string,
  freq: 'daily' | 'weekly',
  weekdays: number[],
  maxCount = 200
): string[] {
  if (untilDate < startDate) return []
  const dates: string[] = []
  let cursor = startDate
  let guard = 0
  while (cursor <= untilDate && dates.length < maxCount && guard < 3660) {
    guard++
    if (freq === 'daily' || weekdays.includes(weekdayOfDateStr(cursor))) {
      dates.push(cursor)
    }
    cursor = addDaysToDateStr(cursor, 1)
  }
  return dates
}
