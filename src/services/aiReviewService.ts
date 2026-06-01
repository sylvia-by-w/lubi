export interface ReviewTask {
  name: string
  category: string
  project?: string
  startTime: string
  endTime: string
  durationMinutes: number
}

export interface ReviewTotal {
  name: string
  planned: number
  actual: number
  diff: number
}

export interface DailyReviewData {
  date: string
  plannedTasks: ReviewTask[]
  actualTasks: ReviewTask[]
  categoryTotals: ReviewTotal[]
  projectTotals: ReviewTotal[]
  biggestDeviations: ReviewTotal[]
  userNote?: string
}

export interface WeeklyReviewData {
  weekStart: string
  weekEnd: string
  tasks: ReviewTask[]
  categoryAllocation: ReviewTotal[]
  topProjects: ReviewTotal[]
  biggestDeviations: ReviewTotal[]
  dailyNotes: Array<{
    date: string
    userNote: string
  }>
  userNote?: string
}

export interface AIReviewResult {
  prompt: string
  output: string
  generatedAt: string
}

function fmtMinutes(minutes: number) {
  const abs = Math.abs(minutes)
  const h = Math.floor(abs / 60)
  const m = abs % 60
  const sign = minutes < 0 ? '-' : minutes > 0 ? '+' : ''
  const body = h === 0 ? `${m}min` : m === 0 ? `${h}h` : `${h}h${m}min`
  return `${sign}${body}`
}

function listTasks(tasks: ReviewTask[]) {
  if (tasks.length === 0) return '- None'
  return tasks
    .map(t => `- ${t.name} (${t.category}${t.project ? ` / ${t.project}` : ''}) ${t.startTime}-${t.endTime}, ${fmtMinutes(t.durationMinutes)}`)
    .join('\n')
}

function listTotals(totals: ReviewTotal[]) {
  if (totals.length === 0) return '- None'
  return totals
    .map(t => `- ${t.name}: planned ${fmtMinutes(t.planned)}, actual ${fmtMinutes(t.actual)}, diff ${fmtMinutes(t.diff)}`)
    .join('\n')
}

export function buildDailyReviewPrompt(data: DailyReviewData) {
  return [
    'You are reviewing one day using the Lyubishchev time accounting method.',
    'Return a concise, structured review with: Summary, Main deviation, Likely cause, Tomorrow adjustment.',
    '',
    `Date: ${data.date}`,
    '',
    'Planned tasks:',
    listTasks(data.plannedTasks),
    '',
    'Actual tasks:',
    listTasks(data.actualTasks),
    '',
    'Category totals:',
    listTotals(data.categoryTotals),
    '',
    'Project totals:',
    listTotals(data.projectTotals),
    '',
    'Biggest deviations:',
    listTotals(data.biggestDeviations),
    '',
    `User note: ${data.userNote || 'None'}`,
  ].join('\n')
}

export function buildWeeklyReviewPrompt(data: WeeklyReviewData) {
  return [
    'You are reviewing one week using the Lyubishchev time accounting method.',
    'Return a concise, structured review with: Weekly pattern, Allocation insight, Project focus, Biggest deviation, Next week adjustment.',
    '',
    `Week: ${data.weekStart} to ${data.weekEnd}`,
    '',
    'All tasks:',
    listTasks(data.tasks),
    '',
    'Weekly category allocation:',
    listTotals(data.categoryAllocation),
    '',
    'Top projects:',
    listTotals(data.topProjects),
    '',
    'Biggest deviations:',
    listTotals(data.biggestDeviations),
    '',
    `Weekly user note: ${data.userNote || 'None'}`,
    '',
    'Daily review notes:',
    data.dailyNotes.length === 0
      ? '- None'
      : data.dailyNotes.map(n => `- ${n.date}: ${n.userNote}`).join('\n'),
  ].join('\n')
}

function mockDailyOutput(data: DailyReviewData) {
  const totalPlanned = data.categoryTotals.reduce((sum, t) => sum + t.planned, 0)
  const totalActual = data.categoryTotals.reduce((sum, t) => sum + t.actual, 0)
  const biggest = data.biggestDeviations[0]

  return [
    `Summary: Planned ${fmtMinutes(totalPlanned)} and recorded ${fmtMinutes(totalActual)} of actual time on ${data.date}.`,
    biggest
      ? `Main deviation: ${biggest.name} changed by ${fmtMinutes(biggest.diff)} versus plan.`
      : 'Main deviation: No meaningful planned-vs-actual deviation was found.',
    data.userNote
      ? `Likely cause: Your note adds context: "${data.userNote}".`
      : 'Likely cause: Add a short deviation reason to make the next review more precise.',
    data.userNote
      ? 'Tomorrow adjustment: Convert the note into one concrete scheduling correction before starting the next day.'
      : 'Tomorrow adjustment: Choose one concrete scheduling correction before starting the day.',
  ].join('\n\n')
}

function mockWeeklyOutput(data: WeeklyReviewData) {
  const totalActual = data.categoryAllocation.reduce((sum, t) => sum + t.actual, 0)
  const topCategory = [...data.categoryAllocation].sort((a, b) => b.actual - a.actual)[0]
  const topProject = data.topProjects[0]
  const biggest = data.biggestDeviations[0]

  return [
    `Weekly pattern: You recorded ${fmtMinutes(totalActual)} of actual time from ${data.weekStart} to ${data.weekEnd}.`,
    topCategory
      ? `Allocation insight: ${topCategory.name} took the largest share at ${fmtMinutes(topCategory.actual)}.`
      : 'Allocation insight: There is not enough actual time data to identify a dominant category.',
    topProject
      ? `Project focus: ${topProject.name} was the main project with ${fmtMinutes(topProject.actual)} actual time.`
      : 'Project focus: No project has actual time recorded yet.',
    biggest
      ? `Biggest deviation: ${biggest.name} differed from plan by ${fmtMinutes(biggest.diff)}.`
      : 'Biggest deviation: No planned-vs-actual comparison is available yet.',
    data.userNote
      ? `Next week adjustment: Turn this note into a rule: ${data.userNote}`
      : 'Next week adjustment: Write one weekly finding, then convert it into a planning rule.',
  ].join('\n\n')
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function generateDailyReview(data: DailyReviewData): Promise<AIReviewResult> {
  const prompt = buildDailyReviewPrompt(data)
  await delay(350)
  return {
    prompt,
    output: mockDailyOutput(data),
    generatedAt: new Date().toISOString(),
  }
}

export async function generateWeeklyReview(data: WeeklyReviewData): Promise<AIReviewResult> {
  const prompt = buildWeeklyReviewPrompt(data)
  await delay(350)
  return {
    prompt,
    output: mockWeeklyOutput(data),
    generatedAt: new Date().toISOString(),
  }
}
