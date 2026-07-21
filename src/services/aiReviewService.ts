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

// ---- AI provider configuration ----

export type AIProvider = 'zhipu' | 'deepseek' | 'openai' | 'custom'

export interface AIConfig {
  provider: AIProvider
  baseUrl: string
  apiKey: string
  model: string
}

export interface AIProviderPreset {
  label: string
  baseUrl: string
  model: string
  keyUrl: string
  note: string
}

export const AI_PROVIDER_PRESETS: Record<Exclude<AIProvider, 'custom'>, AIProviderPreset> = {
  zhipu: {
    label: '智谱 GLM（免费，推荐）',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
    model: 'glm-4.7-flash',
    keyUrl: 'https://open.bigmodel.cn/usercenter/apikeys',
    note: 'GLM-4.7-Flash 对个人开发者永久免费，注册后在个人中心获取 API Key。',
  },
  deepseek: {
    label: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/chat/completions',
    model: 'deepseek-chat',
    keyUrl: 'https://platform.deepseek.com/api_keys',
    note: '新用户注册有免费额度，之后按量计费，价格较低。',
  },
  openai: {
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1/chat/completions',
    model: 'gpt-4o-mini',
    keyUrl: 'https://platform.openai.com/api-keys',
    note: '需要绑定信用卡付费使用，没有长期免费额度。',
  },
}

export const DEFAULT_AI_CONFIG: AIConfig = {
  provider: 'zhipu',
  baseUrl: AI_PROVIDER_PRESETS.zhipu.baseUrl,
  apiKey: '',
  model: AI_PROVIDER_PRESETS.zhipu.model,
}

export function isAIConfigured(config: AIConfig) {
  return Boolean(config.apiKey.trim() && config.baseUrl.trim() && config.model.trim())
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
    '请用柳比歇夫时间统计法帮我回顾这一天。',
    '',
    `日期：${data.date}`,
    '',
    '计划任务：',
    listTasks(data.plannedTasks),
    '',
    '实际任务：',
    listTasks(data.actualTasks),
    '',
    '分类统计（计划 vs 实际）：',
    listTotals(data.categoryTotals),
    '',
    '项目统计（计划 vs 实际）：',
    listTotals(data.projectTotals),
    '',
    '偏差最大的项：',
    listTotals(data.biggestDeviations),
    '',
    `我的备注：${data.userNote || '无'}`,
  ].join('\n')
}

export function buildWeeklyReviewPrompt(data: WeeklyReviewData) {
  return [
    '请用柳比歇夫时间统计法帮我回顾这一周。',
    '',
    `周期：${data.weekStart} 至 ${data.weekEnd}`,
    '',
    '本周全部任务：',
    listTasks(data.tasks),
    '',
    '本周分类分配（计划 vs 实际）：',
    listTotals(data.categoryAllocation),
    '',
    '投入最多的项目：',
    listTotals(data.topProjects),
    '',
    '偏差最大的项：',
    listTotals(data.biggestDeviations),
    '',
    `本周备注：${data.userNote || '无'}`,
    '',
    '每日回顾备注：',
    data.dailyNotes.length === 0
      ? '- 无'
      : data.dailyNotes.map(n => `- ${n.date}：${n.userNote}`).join('\n'),
  ].join('\n')
}

const DAILY_SYSTEM_PROMPT = [
  '你是一位使用柳比歇夫时间统计法的中文时间管理教练。',
  '请基于用户提供的当天计划与实际时间记录，输出一份简洁、口语化的中文回顾。',
  '严格按以下四个部分输出，每部分一到三句话，用小标题加冒号开头，不要输出多余的开场白或结尾寒暄：',
  '概览：\n主要偏差：\n可能原因：\n明日调整：',
].join('\n')

const WEEKLY_SYSTEM_PROMPT = [
  '你是一位使用柳比歇夫时间统计法的中文时间管理教练。',
  '请基于用户提供的一周计划与实际时间记录，输出一份简洁、口语化的中文回顾。',
  '严格按以下五个部分输出，每部分一到三句话，用小标题加冒号开头，不要输出多余的开场白或结尾寒暄：',
  '本周规律：\n分配洞察：\n项目聚焦：\n最大偏差：\n下周调整：',
].join('\n')

// ---- mock fallback (used when no API key is configured) ----

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

// ---- real API call ----

async function extractErrorDetail(res: Response) {
  try {
    const data = await res.clone().json()
    return data?.error?.message || data?.error?.msg || data?.message || JSON.stringify(data)
  } catch {
    try {
      const text = await res.text()
      return text.slice(0, 300)
    } catch {
      return ''
    }
  }
}

async function callChatCompletion(config: AIConfig, systemPrompt: string, userPrompt: string): Promise<string> {
  let res: Response
  try {
    res = await fetch(config.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey.trim()}`,
      },
      body: JSON.stringify({
        model: config.model.trim(),
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
      }),
    })
  } catch {
    throw new Error('无法连接到 AI 接口，请检查网络，或确认该服务允许浏览器直接调用（部分服务需要代理）。')
  }

  if (!res.ok) {
    const detail = await extractErrorDetail(res)
    const hint = res.status === 401 || res.status === 403
      ? '请检查 API Key 是否正确。'
      : res.status === 404
        ? '请检查 Base URL 和模型名称是否正确。'
        : ''
    throw new Error(`AI 接口返回错误（状态码 ${res.status}）：${detail || '未知错误'}${hint ? ` ${hint}` : ''}`)
  }

  const json = await res.json().catch(() => null)
  const content = json?.choices?.[0]?.message?.content
  if (!content || typeof content !== 'string') {
    throw new Error('AI 返回内容为空，请检查模型名称是否正确，或稍后重试。')
  }
  return content.trim()
}

export async function testAIConnection(config: AIConfig): Promise<{ ok: boolean; message: string }> {
  if (!isAIConfigured(config)) {
    return { ok: false, message: '请先填写 Base URL、模型名称和 API Key。' }
  }
  try {
    const content = await callChatCompletion(config, '你是一个连接测试助手。', '请只回复"连接成功"四个字，不要输出其他内容。')
    return { ok: true, message: content || '连接成功' }
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : '连接失败，请重试。' }
  }
}

export async function generateDailyReview(data: DailyReviewData, config: AIConfig): Promise<AIReviewResult> {
  const prompt = buildDailyReviewPrompt(data)

  if (!isAIConfigured(config)) {
    await delay(350)
    return {
      prompt,
      output: mockDailyOutput(data),
      generatedAt: new Date().toISOString(),
    }
  }

  const output = await callChatCompletion(config, DAILY_SYSTEM_PROMPT, prompt)
  return {
    prompt,
    output,
    generatedAt: new Date().toISOString(),
  }
}

export async function generateWeeklyReview(data: WeeklyReviewData, config: AIConfig): Promise<AIReviewResult> {
  const prompt = buildWeeklyReviewPrompt(data)

  if (!isAIConfigured(config)) {
    await delay(350)
    return {
      prompt,
      output: mockWeeklyOutput(data),
      generatedAt: new Date().toISOString(),
    }
  }

  const output = await callChatCompletion(config, WEEKLY_SYSTEM_PROMPT, prompt)
  return {
    prompt,
    output,
    generatedAt: new Date().toISOString(),
  }
}
