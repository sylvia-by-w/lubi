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
  const body = h === 0 ? `${m}分钟` : m === 0 ? `${h}小时` : `${h}小时${m}分钟`
  return `${sign}${body}`
}

function listTasks(tasks: ReviewTask[]) {
  if (tasks.length === 0) return '- 无'
  return tasks
    .map(t => `- ${t.name}（${t.category}${t.project ? ` / ${t.project}` : ''}）${t.startTime}-${t.endTime}，${fmtMinutes(t.durationMinutes)}`)
    .join('\n')
}

function listTotals(totals: ReviewTotal[]) {
  if (totals.length === 0) return '- 无'
  return totals
    .map(t => `- ${t.name}：计划 ${fmtMinutes(t.planned)}，实际 ${fmtMinutes(t.actual)}，差值 ${fmtMinutes(t.diff)}`)
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
    `概览：${data.date} 计划 ${fmtMinutes(totalPlanned)}，实际记录 ${fmtMinutes(totalActual)}。`,
    biggest
      ? `主要偏差：${biggest.name} 与计划相差 ${fmtMinutes(biggest.diff)}。`
      : '主要偏差：没有发现明显的计划与实际差异。',
    data.userNote
      ? `可能原因：你的备注提供了背景——"${data.userNote}"。`
      : '可能原因：加一句简短的偏差原因，能让下次回顾更准确。',
    data.userNote
      ? '明日调整：把这条备注转化成一个具体的日程调整动作。'
      : '明日调整：开始明天之前，先定一个具体的日程调整动作。',
  ].join('\n\n')
}

function mockWeeklyOutput(data: WeeklyReviewData) {
  const totalActual = data.categoryAllocation.reduce((sum, t) => sum + t.actual, 0)
  const topCategory = [...data.categoryAllocation].sort((a, b) => b.actual - a.actual)[0]
  const topProject = data.topProjects[0]
  const biggest = data.biggestDeviations[0]

  return [
    `本周规律：从 ${data.weekStart} 到 ${data.weekEnd}，共记录实际时间 ${fmtMinutes(totalActual)}。`,
    topCategory
      ? `分配洞察：${topCategory.name} 占比最大，共 ${fmtMinutes(topCategory.actual)}。`
      : '分配洞察：实际时间数据还不够多，看不出主要占用的分类。',
    topProject
      ? `项目聚焦：${topProject.name} 是本周投入最多的项目，共 ${fmtMinutes(topProject.actual)}。`
      : '项目聚焦：本周还没有项目记录实际时间。',
    biggest
      ? `最大偏差：${biggest.name} 与计划相差 ${fmtMinutes(biggest.diff)}。`
      : '最大偏差：暂时没有可比较的计划与实际数据。',
    data.userNote
      ? `下周调整：把这条备注转化成一条规则——${data.userNote}`
      : '下周调整：写一条本周的发现，再把它转化成一条计划规则。',
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
