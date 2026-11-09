/**
 * 试卷分析助手 Host 端（v2，对齐《分析模板.xlsx》）。
 * - 维护试卷分析草稿（试卷信息、逐题得分、错题知识点映射、错误原因标注、复习计划），持久化到包目录 analysis.data.json
 * - 维护历史分析记录（保存 / 列表 / 详情 / 覆盖更新 / 删除），持久化到包目录 records.data.json
 * - 注册智能体工具 paper_analysis：AI 读取试卷扫描件后导入逐题得分与知识点映射，并可保存历史记录
 * - 通过 Web 路由向「试卷分析」面板提供数据读写、扫描件上传与历史记录管理
 */
import { execFile, execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve, sep } from 'node:path'

const pkgDir = dirname(fileURLToPath(import.meta.url))
const dataPath = join(pkgDir, 'analysis.data.json')
const recordsPath = join(pkgDir, 'records.data.json')
const renderPdfScript = join(pkgDir, 'assets', 'render_pdf.py')

const EXAM_TYPES = ['月考', '期中', '期末', '其他']

// 错误原因两级体系，来自《分析模板.xlsx》「典型错误原因」。
const ERROR_TAXONOMY = {
  知识失分: ['概念不清', '知识遗忘', '知识盲区', '迁移失败'],
  审题失分: ['漏看条件', '看错设问', '漏看限定', '误读信息'],
  过程失分: ['计算错误', '方法不当', '跳步心算', '思路卡壳'],
  表达失分: ['采分缺失', '表述不严', '书写失范', '答非所问'],
  习惯失分: ['粗心大意', '惯性思维', '誊抄错位', '紧张空白'],
}

// 各科知识点章节概览在 KG 加载后构建（见 KP_CATALOG 常量）。

// 各科知识点先修/关联图（知识图谱缺失时的回退）：edges 中 [A, B] 表示 A 是 B 的基础/前置。
const KP_GRAPH = {
  数学: {
    nodes: ['集合与常用逻辑用语', '一元二次不等式与基本不等式', '函数概念与性质', '指数/对数/幂函数', '函数零点与建模', '三角函数', '三角恒等变换', '平面向量', '复数', '立体几何初步', '统计与概率'],
    edges: [
      ['集合与常用逻辑用语', '函数概念与性质'],
      ['一元二次不等式与基本不等式', '函数概念与性质'],
      ['函数概念与性质', '指数/对数/幂函数'],
      ['指数/对数/幂函数', '函数零点与建模'],
      ['三角函数', '三角恒等变换'],
      ['平面向量', '三角函数'],
      ['复数', '平面向量'],
    ],
  },
  物理: {
    nodes: ['匀变速直线运动', '自由落体', '运动图象', '相互作用与力的合成分解', '共点力平衡', '牛顿运动定律', '曲线运动', '抛体与圆周运动', '万有引力与航天', '机械能', '物理实验'],
    edges: [
      ['匀变速直线运动', '自由落体'],
      ['匀变速直线运动', '运动图象'],
      ['匀变速直线运动', '牛顿运动定律'],
      ['相互作用与力的合成分解', '共点力平衡'],
      ['共点力平衡', '牛顿运动定律'],
      ['牛顿运动定律', '曲线运动'],
      ['曲线运动', '抛体与圆周运动'],
      ['抛体与圆周运动', '万有引力与航天'],
      ['牛顿运动定律', '机械能'],
      ['匀变速直线运动', '物理实验'],
      ['相互作用与力的合成分解', '物理实验'],
    ],
  },
  化学: {
    nodes: ['化学计量', '离子反应', '氧化还原', '元素化合物', '物质结构与元素周期律', '化学键', '反应与能量', '有机入门', '化学实验基础'],
    edges: [
      ['化学计量', '离子反应'],
      ['化学计量', '元素化合物'],
      ['离子反应', '氧化还原'],
      ['氧化还原', '元素化合物'],
      ['物质结构与元素周期律', '化学键'],
      ['元素化合物', '化学实验基础'],
      ['化学计量', '化学实验基础'],
      ['反应与能量', '有机入门'],
    ],
  },
  生物: {
    nodes: ['生命系统的结构层次', '细胞学说', '显微镜的使用', '组成细胞的分子', '细胞结构', '跨膜运输', '酶与ATP', '呼吸与光合作用', '细胞增殖分化', '减数分裂', '孟德尔定律', '伴性遗传', 'DNA与基因表达', '变异', '生物进化'],
    edges: [
      ['生命系统的结构层次', '细胞结构'],
      ['细胞学说', '细胞结构'],
      ['显微镜的使用', '细胞结构'],
      ['组成细胞的分子', '细胞结构'],
      ['细胞结构', '跨膜运输'],
      ['跨膜运输', '酶与ATP'],
      ['酶与ATP', '呼吸与光合作用'],
      ['细胞结构', '细胞增殖分化'],
      ['细胞增殖分化', '减数分裂'],
      ['减数分裂', '孟德尔定律'],
      ['孟德尔定律', '伴性遗传'],
      ['DNA与基因表达', '变异'],
      ['变异', '生物进化'],
    ],
  },
  历史: {
    nodes: ['中国古代史', '中国近现代史', '世界史'],
    edges: [['中国古代史', '中国近现代史'], ['世界史', '中国近现代史']],
  },
  地理: {
    nodes: ['自然地理', '人文地理'],
    edges: [['自然地理', '人文地理']],
  },
  思想政治: {
    nodes: ['中国特色社会主义', '经济与社会', '政治与法治'],
    edges: [['中国特色社会主义', '经济与社会'], ['经济与社会', '政治与法治']],
  },
}

// ---- K12 知识图谱（assets/kg-high.json，来自 cn-k12-dxyc2286，高中必修+选择性必修） ----

let KG = {}
try {
  KG = JSON.parse(readFileSync(join(pkgDir, 'assets', 'kg-high.json'), 'utf8'))
} catch { KG = {} }

/** 二元组 Dice 相似度（中文按字符二元组）。 */
function bigramDice(a, b) {
  if (a === b) return 1
  const grams = (s) => {
    const g = new Map()
    for (let i = 0; i < s.length - 1; i++) {
      const k = s.slice(i, i + 2)
      g.set(k, (g.get(k) || 0) + 1)
    }
    return g
  }
  const ga = grams(a)
  const gb = grams(b)
  if (!ga.size || !gb.size) return 0
  let hit = 0
  for (const [k, c] of ga) hit += Math.min(c, gb.get(k) || 0)
  return (2 * hit) / (a.length - 1 + b.length - 1)
}

/** 把 AI/用户填写的知识点名称对齐到图谱标准名称；相似度不足时保留原文。 */
function snapKgName(subject, name) {
  const sub = KG[subject]
  if (!sub || !name) return name
  if (sub.topics.some((t) => t.name === name)) return name
  let best = null
  let bestScore = 0
  for (const t of sub.topics) {
    const cand = t.name
    let s = bigramDice(name, cand)
    if (name.includes(cand) || cand.includes(name)) {
      s = Math.max(s, 0.25 + 0.6 * (Math.min(name.length, cand.length) / Math.max(name.length, cand.length)))
    }
    if (t.level === 'unit') s += 0.06 // 单元级（粗粒度）节点优先
    // 得分相近时取更短的名称（避免粗名称被吸附到过细的课时）
    if (s > bestScore + 1e-9 || (Math.abs(s - bestScore) <= 1e-9 && best && cand.length < best.length)) {
      bestScore = s
      best = cand
    }
  }
  return bestScore >= 0.6 ? best : name
}

/** 某科的知识点名称列表；maxGrade 限制年级（10-12=必修，13-16=选择性必修）。 */
function kgTopicNames(subject, maxGrade = 16) {
  const sub = KG[subject]
  if (!sub) return []
  return sub.topics.filter((t) => t.grade <= maxGrade).map((t) => t.name)
}

// 图谱缺失时的章节概览回退（来自《高一知识点.docx》内置清单）。
const KP_CATALOG_FALLBACK = [
  '数学：集合与常用逻辑用语、一元二次不等式与基本不等式、函数概念与性质、指数/对数/幂函数、函数零点与建模、三角函数、三角恒等变换、平面向量、复数、立体几何初步、统计与概率',
  '物理：匀变速直线运动、自由落体、运动图象、相互作用与力的合成分解、共点力平衡、牛顿运动定律、曲线运动、抛体与圆周运动、万有引力与航天、机械能、物理实验',
  '化学：化学计量、离子反应、氧化还原、元素化合物、物质结构与元素周期律、化学键、反应与能量、有机入门、化学实验基础',
  '生物：组成细胞的分子、细胞结构、跨膜运输、酶与ATP、呼吸与光合作用、细胞增殖分化、减数分裂、孟德尔定律、伴性遗传、DNA与基因表达、变异、生物进化',
  '历史：中国古代史、中国近现代史、世界史',
  '地理：自然地理（大气、水循环、地貌等）、人文地理（人口、城乡、区位等）',
  '思想政治：中国特色社会主义、经济与社会、政治与法治',
].join('\n')

// 各科知识点章节概览：优先取知识图谱的章节目录。
const KP_CATALOG = Object.keys(KG).length
  ? Object.entries(KG)
      .map(([sub, v]) => `${sub}（章节）：${v.chapters.join('；')}`)
      .join('\n')
  : KP_CATALOG_FALLBACK

const emptyDraft = () => ({
  title: '',
  subject: '',
  examType: '',
  date: '',
  score: '',
  totalScore: '',
  questions: [],
  reviewPlan: '',
  updatedAt: null,
})

const asText = (v) => (typeof v === 'string' ? v.trim() : v == null ? '' : String(v))
const asExamType = (v) => (EXAM_TYPES.includes(v) ? v : '')

function normalizeError(category, reason) {
  const cat = ERROR_TAXONOMY[category] ? category : ''
  const sub = cat && ERROR_TAXONOMY[cat].includes(reason) ? reason : ''
  return { errorCategory: cat, errorReason: sub }
}

function normalizeCrop(raw) {
  if (raw === null || typeof raw !== 'object') return null
  const page = Math.floor(Number(raw.page))
  const box = ['x0', 'y0', 'x1', 'y1'].map((k) => Number(raw[k]))
  if (!Number.isInteger(page) || page < 1) return null
  if (box.some((v) => !Number.isFinite(v) || v < 0 || v > 1)) return null
  const [x0, y0, x1, y1] = box
  if (x1 - x0 < 0.02 || y1 - y0 < 0.02) return null
  return { page, x0, y0, x1, y1 }
}

function normalizeQuestion(raw, i) {
  if (raw === null || typeof raw !== 'object') return null
  const { errorCategory, errorReason } = normalizeError(asText(raw.errorCategory), asText(raw.errorReason))
  const q = {
    no: asText(raw.no) || String(i + 1),
    type: asText(raw.type),
    score: asText(raw.score),
    fullScore: asText(raw.fullScore),
    knowledgePoint: asText(raw.knowledgePoint),
    errorCategory,
    errorReason,
    note: asText(raw.note),
    image: asText(raw.image),
    crop: normalizeCrop(raw.crop),
  }
  return q.type || q.score || q.fullScore || q.knowledgePoint ? q : null
}

function normalizeDraft(raw) {
  const base = emptyDraft()
  if (raw === null || typeof raw !== 'object') return base
  // 兼容 v1 数据：paper.* / examTypes 数组 / advice → reviewPlan
  const paper = raw.paper && typeof raw.paper === 'object' ? raw.paper : {}
  const oldExamTypes = Array.isArray(paper.examTypes) ? paper.examTypes : []
  return {
    title: asText(raw.title),
    subject: asText(raw.subject) || asText(paper.subject),
    examType: asExamType(raw.examType) || asExamType(oldExamTypes[0]),
    date: asText(raw.date),
    score: asText(raw.score) || asText(paper.score),
    totalScore: asText(raw.totalScore) || asText(paper.totalScore),
    questions: (Array.isArray(raw.questions) ? raw.questions : []).map(normalizeQuestion).filter(Boolean),
    reviewPlan: asText(raw.reviewPlan) || asText(raw.advice),
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : null,
  }
}

function loadDraft() {
  try {
    return normalizeDraft(JSON.parse(readFileSync(dataPath, 'utf8')))
  } catch {
    return emptyDraft()
  }
}

let draft = loadDraft()

function saveDraft() {
  writeFileSync(dataPath, JSON.stringify(draft, null, 2) + '\n', 'utf8')
}

// ---- 历史分析记录 ----

function normalizeRecord(raw) {
  if (raw === null || typeof raw !== 'object') return null
  const id = asText(raw.id)
  if (!id) return null
  const d = normalizeDraft(raw)
  return {
    id,
    ...d,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : d.updatedAt || new Date().toISOString(),
    updatedAt: d.updatedAt || new Date().toISOString(),
  }
}

function loadRecords() {
  try {
    const raw = JSON.parse(readFileSync(recordsPath, 'utf8'))
    return (Array.isArray(raw) ? raw : []).map(normalizeRecord).filter(Boolean)
  } catch {
    return []
  }
}

let records = loadRecords()

function saveRecords() {
  writeFileSync(recordsPath, JSON.stringify(records, null, 2) + '\n', 'utf8')
}

function recordSummary(rec) {
  const stats = statsOf(rec)
  return {
    id: rec.id,
    title: rec.title,
    subject: rec.subject,
    examType: rec.examType,
    date: rec.date,
    score: rec.score,
    totalScore: rec.totalScore,
    questionCount: rec.questions.length,
    wrongCount: stats.wrong.length,
    scoreRate: stats.scoreRate,
    createdAt: rec.createdAt,
    updatedAt: rec.updatedAt,
  }
}

// ---- 扫描任务状态：让面板能看到「上传 → 转换 → 识别 → 完成」的进度 ----

const scanPath = join(pkgDir, 'scan.data.json')

const SCAN_STAGES = ['pending', 'rendering', 'notified', 'analyzing', 'done', 'error']

function loadScan() {
  try {
    const raw = JSON.parse(readFileSync(scanPath, 'utf8'))
    if (raw === null || typeof raw !== 'object') return null
    if (typeof raw.filePath !== 'string' || !raw.filePath) return null
    return {
      fileName: asText(raw.fileName),
      filePath: raw.filePath,
      kind: raw.kind === 'pdf' ? 'pdf' : 'image',
      pages: Array.isArray(raw.pages) ? raw.pages.filter((p) => typeof p === 'string') : [],
      status: SCAN_STAGES.includes(raw.status) ? raw.status : 'pending',
      note: asText(raw.note),
      percent: Number.isFinite(raw.percent) ? Math.min(Math.max(raw.percent, 0), 100) : null,
      error: asText(raw.error),
      updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : null,
    }
  } catch {
    return null
  }
}

let scan = loadScan()

function saveScan() {
  try {
    if (scan) writeFileSync(scanPath, JSON.stringify(scan, null, 2) + '\n', 'utf8')
  } catch { /* 进度持久化失败不影响主流程 */ }
}

function setScan(patch) {
  scan = { ...(scan || {}), ...patch, updatedAt: new Date().toISOString() }
  saveScan()
}

function clearScan() {
  scan = null
  try {
    writeFileSync(scanPath, 'null\n', 'utf8')
  } catch { /* optional */ }
}

const num = (v) => {
  const n = parseFloat(v)
  return Number.isFinite(n) ? n : 0
}

function statsOf(data) {
  let full = 0
  let got = 0
  const wrong = []
  const byType = new Map()
  for (const q of data.questions) {
    const f = num(q.fullScore)
    const s = Math.min(Math.max(num(q.score), 0), f || Infinity)
    const lost = Math.min(Math.max(f - s, 0), f || Infinity)
    full += f
    got += s
    const typeName = q.type || '未分类'
    const agg = byType.get(typeName) || { type: typeName, score: 0, fullScore: 0, count: 0 }
    agg.score += s
    agg.fullScore += f
    agg.count += 1
    byType.set(typeName, agg)
    if (lost > 0) {
      wrong.push({
        no: q.no,
        type: q.type,
        score: s,
        fullScore: f,
        lost,
        knowledgePoint: q.knowledgePoint,
        errorCategory: q.errorCategory,
        errorReason: q.errorReason,
      })
    }
  }
  return {
    totalFull: full,
    totalScore: got,
    totalLost: Math.max(full - got, 0),
    scoreRate: full > 0 ? got / full : 0,
    byType: Array.from(byType.values()).map((t) => ({
      ...t,
      lost: Math.max(t.fullScore - t.score, 0),
      scoreRate: t.fullScore > 0 ? t.score / t.fullScore : 0,
    })),
    wrong,
  }
}

/** 学情看板：跨历史记录（含当前草稿）聚合各知识点的得分率与相关题目。 */
function knowledgeBoard() {
  const sources = records.map((r) => ({ title: r.title || '未命名试卷', subject: r.subject, questions: r.questions }))
  if (draft.questions.length) {
    sources.push({ title: '当前草稿（未保存）', subject: draft.subject, questions: draft.questions })
  }
  const byKp = new Map()
  for (const src of sources) {
    for (const q of src.questions || []) {
      const name = q.knowledgePoint || '未标注'
      let entry = byKp.get(name)
      if (!entry) {
        entry = { name, subject: '', score: 0, full: 0, wrong: 0, questions: [] }
        byKp.set(name, entry)
      }
      const f = num(q.fullScore)
      const s = Math.min(Math.max(num(q.score), 0), f || Infinity)
      entry.score += s
      entry.full += f
      if (f - s > 0) entry.wrong++
      if (src.subject) entry.subject = src.subject
      entry.questions.push({
        paper: src.title,
        no: q.no,
        type: q.type,
        score: s,
        fullScore: f,
        lost: Math.max(f - s, 0),
        errorCategory: q.errorCategory,
        errorReason: q.errorReason,
        image: q.image || '',
      })
    }
  }
  // 只展示出现过数据的科目；catalog 节点 + 观测到的额外节点
  const subjects = []
  for (const e of byKp.values()) {
    if (e.subject && !subjects.includes(e.subject)) subjects.push(e.subject)
  }
  const boards = subjects.map((sub) => {
    const kg = KG[sub]
    const graph = kg
      ? { nodes: kg.topics.map((t) => t.name), edges: kg.edges }
      : KP_GRAPH[sub] || { nodes: [], edges: [] }
    const names = [...graph.nodes]
    for (const e of byKp.values()) {
      if (e.subject === sub && !names.includes(e.name)) names.push(e.name)
    }
    const nodes = names.map((name) => {
      const e = byKp.get(name)
      return {
        name,
        rate: e && e.full > 0 ? e.score / e.full : null,
        score: e ? e.score : 0,
        full: e ? e.full : 0,
        count: e ? e.questions.length : 0,
        wrong: e ? e.wrong : 0,
      }
    })
    const nameSet = new Set(names)
    return { subject: sub, nodes, edges: graph.edges.filter(([a, b]) => nameSet.has(a) && nameSet.has(b)) }
  })
  const questions = {}
  for (const e of byKp.values()) questions[e.name] = e.questions
  return { boards, questions }
}

function readBody(req) {
  return new Promise((resolvePromise, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (c) => {
      size += c.length
      if (size > 64 * 1024 * 1024) {
        reject(new Error('请求体过大'))
        req.destroy()
        return
      }
      chunks.push(c)
    })
    req.on('end', () => resolvePromise(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

function sendJson(res, status, value) {
  const body = JSON.stringify(value)
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.end(body)
}

// ---- PDF rendering (PyMuPDF via an available Python) ----

const PDF_PY_CANDIDATES = [
  process.env.PAPER_ANALYSIS_PYTHON,
  'C:\\ProgramData\\anaconda3\\python.exe',
  'python',
  'py',
]
let pdfPython // undefined = not probed yet, null = unavailable, string = executable

function findPdfPython() {
  if (pdfPython !== undefined) return pdfPython
  for (const candidate of PDF_PY_CANDIDATES.filter(Boolean)) {
    try {
      const args = candidate === 'py' ? ['-3', '-c', 'import fitz'] : ['-c', 'import fitz']
      execFileSync(candidate, args, { stdio: 'ignore', windowsHide: true, timeout: 20000 })
      pdfPython = candidate
      return candidate
    } catch { /* try next */ }
  }
  pdfPython = null
  return null
}

function execFileText(cmd, args) {
  return new Promise((resolvePromise, reject) => {
    execFile(
      cmd,
      args,
      { windowsHide: true, timeout: 180000, maxBuffer: 16 * 1024 * 1024 },
      (err, stdout, stderr) => {
        if (err) {
          reject(new Error(String(stderr || err.message || err)))
        } else {
          resolvePromise(String(stdout))
        }
      },
    )
  })
}

/** Render a PDF to per-page PNGs; returns { pages, chars } or null when no converter exists. */
async function renderPdf(pdfPath, outDir, prefix, maxPages = 10) {
  const py = findPdfPython()
  if (!py) return null
  const scriptArgs = [renderPdfScript, pdfPath, outDir, prefix, String(maxPages)]
  const args = py === 'py' ? ['-3', ...scriptArgs] : scriptArgs
  const stdout = await execFileText(py, args)
  const line = stdout.trim().split(/\r?\n/).filter(Boolean).pop()
  return JSON.parse(line)
}

// ---- 逐题截图：按 AI 估算的归一化坐标从页面 PNG 中裁剪 ----

const cropScript = join(pkgDir, 'assets', 'crop_png.py')
const cropsDir = join(pkgDir, 'crops')

/** 为带 crop 坐标的题目生成截图并把访问 URL 写回 q.image；返回生成数量。 */
async function generateCrops(questions) {
  const py = findPdfPython()
  const pages = scan?.pages || []
  if (!py || !pages.length) return 0
  mkdirSync(cropsDir, { recursive: true })
  const stamp = Date.now()
  let made = 0
  for (const q of questions) {
    if (!q.crop) continue
    const pagePath = pages[q.crop.page - 1]
    if (!pagePath) continue
    const safeNo = q.no.replace(/[\\/:*?"<>|]/g, '_')
    const fileName = `q-${safeNo}-${stamp}.png`
    const args = [cropScript, pagePath, String(q.crop.x0), String(q.crop.y0), String(q.crop.x1), String(q.crop.y1), join(cropsDir, fileName)]
    try {
      await execFileText(py, py === 'py' ? ['-3', ...args] : args)
      q.image = `/paper-analysis/crop?f=${encodeURIComponent(fileName)}`
      made++
    } catch { /* 单题裁剪失败不影响整体导入 */ }
  }
  return made
}

const ANALYSIS_GUIDE =
  '识别试卷内容后调用 paper_analysis 工具（action=import）写入分析结果，包括：' +
  '试卷基本信息（标题、科目、考试类型、日期、总得分、满分，能识别多少填多少）、' +
  '逐题得分（每道题的题号、题型、得分、满分，选择题/填空题可按题组或逐小题录入）、' +
  '以及每道题考查的知识点。' +
  '知识点必须标准化：确定科目后，先调用 paper_analysis（action=catalog, subject=科目）获取该科高中标准知识点清单，' +
  '每题的 knowledgePoint 从清单中选取最接近的一个名称（照抄清单原文，不要自造名称）。' +
  '下面是各科章节概览，帮助判断试卷内容属于哪个科目与范围：\n' + KP_CATALOG + '\n' +
  '另外请为每道题估算其在扫描页中的位置并填入 crop 字段（用于生成题目截图）：page 为从 1 开始的页码，' +
  'x0、y0、x1、y1 为相对页面宽度和高度的 0~1 小数，框住该题题干与作答区域即可，宁大勿小；跨页题目取其题干所在的页与区域。' +
  '错误原因不要填写，由用户在面板中自己标注。' +
  '识别过程中请用 paper_analysis（action=progress）汇报进度：开始识别时一次，每读完一页更新一次（note 如「正在识别第 2/3 页」，percent 为 0-100 的百分比），' +
  '让用户能在「试卷分析」面板看到进度。import 成功后进度会自动标记为完成。' +
  '完成后请提醒用户到「试卷分析」面板核对结果、为错题标注错误原因，并点击「保存结果」归档。'

function imageScanInstruction(scanFile) {
  return (
    `用户刚刚在「试卷分析」面板上传了试卷扫描件，已保存到：${scanFile}。\n` +
    `请使用 read_image 工具查看这张试卷扫描件，${ANALYSIS_GUIDE}`
  )
}

function pdfScanInstruction(pdfPath, pages, textExcerpt) {
  let text =
    `用户刚刚在「试卷分析」面板上传了 PDF 格式试卷（原文件：${pdfPath}），已自动转换为 ${pages.length} 页图片：\n` +
    pages.map((p, i) => `${i + 1}. ${p}`).join('\n') +
    `\n请使用 read_image 工具逐页查看这些图片，${ANALYSIS_GUIDE}`
  if (textExcerpt) {
    text += `\n\n该 PDF 带有文字层，摘录如下供参考（可能不完整，内容以图片为准）：\n${textExcerpt}`
  }
  return text
}

/** Build one well-formed user message (same shape as @deepseek-ai/dsh-llm createUserMessage). */
function buildUserPromptMessage(text) {
  return {
    id: randomUUID(),
    role: 'user',
    content: [{ type: 'text', text }],
    source: { kind: 'user', rpcId: randomUUID() },
  }
}

/**
 * Remove malformed (non-object) entries from one live agent's durable inbox.
 * Older builds of this plugin injected raw strings via agent.inject(text), which
 * poisoned the inbox and crashed every later prompt with
 * "Cannot read properties of undefined (reading 'kind')". Splicing them out
 * appends a proper corrective event through the host's own machinery.
 */
function sanitizeAgentInbox(agent) {
  const inbox = agent?.inbox
  if (!inbox || typeof inbox.splice !== 'function') return 0
  let removed = 0
  for (const [target, queue] of [['next-turn', inbox.nextTurn], ['next-step', inbox.nextStep]]) {
    if (!Array.isArray(queue)) continue
    for (let i = queue.length - 1; i >= 0; i--) {
      const entry = queue[i]
      if (entry === null || typeof entry !== 'object' || !Array.isArray(entry.content) || !entry.source) {
        inbox.splice(target, i, 1, [])
        removed++
      }
    }
  }
  return removed
}

/** Purge malformed inbox entries on every live agent; returns per-agent counts. */
function repairLiveInboxes(ctx) {
  const agents = ctx.get('agents')
  if (!agents || typeof agents.list !== 'function') return { ok: false, reason: 'no-agents-service' }
  const repaired = []
  for (const agent of agents.list()) {
    try {
      const removed = sanitizeAgentInbox(agent)
      if (removed > 0) repaired.push({ sessionId: agent.id, removed })
    } catch (err) {
      repaired.push({ sessionId: agent?.id, error: String(err?.message || err) })
    }
  }
  return { ok: true, repaired }
}

/** Best-effort: ask the live root agent to analyze a freshly uploaded scan. */
function notifyAgent(ctx, instruction) {
  const agents = ctx.get('agents')
  if (!agents || typeof agents.roots !== 'function') return { notified: false, reason: 'no-agents-service' }
  const roots = agents.roots()
  const agent = roots[roots.length - 1]
  if (!agent) return { notified: false, reason: 'no-live-session' }
  try {
    sanitizeAgentInbox(agent)
  } catch { /* best-effort cleanup only */ }
  try {
    if (typeof agent.followup !== 'function') return { notified: false, reason: 'no-followup' }
    agent.followup(buildUserPromptMessage(instruction))
  } catch {
    return { notified: false, reason: 'followup-failed' }
  }
  return { notified: true }
}

const questionSchema = {
  type: 'object',
  properties: {
    no: { type: 'string', description: '题号，如 1、2、3 或 17(1)。' },
    type: { type: 'string', description: '题型，如 选择题、填空题、解答题。' },
    score: { type: 'string', description: '该题实际得分（数字）。' },
    fullScore: { type: 'string', description: '该题满分（数字）。' },
    knowledgePoint: { type: 'string', description: '该题考查的知识点，尽量使用标准知识点名称，如 函数零点与建模、共点力平衡。' },
    crop: {
      type: 'object',
      description: '该题在扫描页中的位置（可选，用于生成题目截图）：page 为 1 起的页码，x0/y0/x1/y1 为相对页面宽高的 0-1 小数。',
      properties: {
        page: { type: 'number', description: '页码，从 1 开始。' },
        x0: { type: 'number', description: '左边界，0-1。' },
        y0: { type: 'number', description: '上边界，0-1。' },
        x1: { type: 'number', description: '右边界，0-1。' },
        y1: { type: 'number', description: '下边界，0-1。' },
      },
      required: ['page', 'x0', 'y0', 'x1', 'y1'],
      additionalProperties: false,
    },
  },
  required: ['type', 'score', 'fullScore'],
  additionalProperties: false,
}

/** 保存当前草稿为一条历史记录；带 id 时覆盖对应记录。返回保存后的记录摘要。 */
function saveDraftAsRecord(id) {
  const now = new Date().toISOString()
  const idx = id ? records.findIndex((r) => r.id === id) : -1
  if (idx >= 0) {
    const rec = { ...records[idx], ...draft, id: records[idx].id, createdAt: records[idx].createdAt, updatedAt: now }
    records[idx] = rec
    saveRecords()
    return recordSummary(rec)
  }
  const rec = { id: randomUUID(), ...draft, createdAt: now, updatedAt: now }
  records.unshift(rec)
  saveRecords()
  return recordSummary(rec)
}

export const inject = ['tools']

export function apply(ctx) {
  ctx.effect(() =>
    ctx.tools.register({
      name: 'paper_analysis',
      description:
        '试卷分析数据的读写与归档，配合「试卷分析」面板使用。当用户上传试卷扫描件/照片/PDF 并要求做试卷分析、提取知识点、统计得分率时：' +
        '先用 read_image 查看图片，识别试卷信息、逐题的题型/满分/得分、每题考查的知识点及题目在页面中的位置（crop），然后 action=import 写入（错误原因留给用户标注，不要填写）；' +
        '识别过程中用 action=progress 汇报进度（开始一次、每页一次），面板会实时显示。' +
        '写入后提醒用户到「试卷分析」面板核对并标注错误原因。action=get 读取当前草稿与统计；action=catalog 获取某科目的高中标准知识点清单（subject 必填）；action=save 把当前草稿保存为历史记录；' +
        'action=history 列出历史记录；action=clear 清空草稿开始新分析。',
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['get', 'import', 'save', 'history', 'clear', 'progress', 'catalog'], description: '要执行的操作。' },
          note: { type: 'string', description: '进度说明，如「正在识别第 2/3 页」；仅 progress 时生效。' },
          percent: { type: 'number', description: '进度百分比 0-100；仅 progress 时生效。' },
          title: { type: 'string', description: '试卷标题，如「2026 高一数学期中试卷」；仅 import 时生效。' },
          subject: { type: 'string', description: '科目，如 数学；catalog 时必填，用于返回该科标准知识点清单。' },
          examType: { type: 'string', enum: EXAM_TYPES, description: '考试类型；仅 import 时生效。' },
          date: { type: 'string', description: '考试日期，如 2026-11-08；仅 import 时生效。' },
          score: { type: 'string', description: '总得分；仅 import 时生效。' },
          totalScore: { type: 'string', description: '试卷满分；仅 import 时生效。' },
          questions: {
            type: 'array',
            description: '逐题得分情况，完整替换；仅 import 时生效。每题包含题型、得分、满分与考查知识点。不要填写错误原因。',
            items: questionSchema,
          },
          reviewPlan: { type: 'string', description: '复习计划建议；仅 import 时生效。' },
        },
        required: ['action'],
        additionalProperties: false,
      },
      output: {
        schema: { type: 'object' },
        render: (args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
      },
      async execute(args) {
        const input = args && typeof args === 'object' ? args : {}
        if (input.action === 'get') return { draft, stats: statsOf(draft), scan }
        if (input.action === 'catalog') {
          const subject = asText(input.subject)
          const names = kgTopicNames(subject, 12)
          if (!names.length) return { ok: false, error: `未收录科目「${subject}」的标准知识点清单`, subjects: Object.keys(KG) }
          return { ok: true, subject, topics: names, hint: '知识点名称请从 topics 中选取最接近的一个（照抄原文）。' }
        }
        if (input.action === 'progress') {
          if (!scan) return { ok: false, error: '当前没有进行中的扫描任务' }
          const percent = Number(input.percent)
          setScan({
            status: 'analyzing',
            note: asText(input.note),
            percent: Number.isFinite(percent) ? Math.min(Math.max(percent, 0), 100) : scan.percent,
            error: '',
          })
          return { ok: true, scan }
        }
        if (input.action === 'clear') {
          draft = emptyDraft()
          saveDraft()
          clearScan()
          return { ok: true, draft }
        }
        if (input.action === 'import') {
          const next = normalizeDraft({
            title: input.title !== undefined ? input.title : draft.title,
            subject: input.subject !== undefined ? input.subject : draft.subject,
            examType: input.examType !== undefined ? input.examType : draft.examType,
            date: input.date !== undefined ? input.date : draft.date,
            score: input.score !== undefined ? input.score : draft.score,
            totalScore: input.totalScore !== undefined ? input.totalScore : draft.totalScore,
            questions: input.questions !== undefined ? input.questions : draft.questions,
            reviewPlan: input.reviewPlan !== undefined ? input.reviewPlan : draft.reviewPlan,
          })
          if (input.questions !== undefined) {
            // 知识点名称对齐到知识图谱标准名称（相似度不足时保留原文，由用户在面板中修正）。
            const subject = next.subject
            if (subject) {
              next.questions = next.questions.map((q) => ({ ...q, knowledgePoint: snapKgName(subject, q.knowledgePoint) }))
            }
            // 错误原因由用户标注：题号与知识点都相同的题目，已有标注在新导入时保留；已有截图在无新坐标时也保留。
            const keep = new Map(draft.questions.map((q) => [`${q.no}::${q.knowledgePoint}`, q]))
            next.questions = next.questions.map((q) => {
              const prev = keep.get(`${q.no}::${q.knowledgePoint}`)
              return prev
                ? { ...q, errorCategory: prev.errorCategory, errorReason: prev.errorReason, note: q.note || prev.note, image: q.crop ? '' : prev.image }
                : q
            })
            const made = await generateCrops(next.questions)
            if (made > 0) next.updatedAt = new Date().toISOString()
          }
          next.updatedAt = new Date().toISOString()
          draft = next
          saveDraft()
          if (scan && scan.status !== 'done') {
            setScan({ status: 'done', note: '分析完成，数据已写入', percent: 100, error: '' })
          }
          return { ok: true, draft, stats: statsOf(draft), crops: next.questions.filter((q) => q.image).length }
        }
        if (input.action === 'save') {
          const summary = saveDraftAsRecord()
          return { ok: true, record: summary, hint: '已保存到历史记录，用户可在「试卷分析」面板的「历史记录」中查看详情。' }
        }
        if (input.action === 'history') {
          return { ok: true, records: records.map(recordSummary) }
        }
        throw new Error(`未知 action：${String(input.action)}`)
      },
    }),
  )

  const webServer = ctx.get('webServer')
  if (webServer) {
    ctx.effect(() =>
      webServer.register({
        kind: 'exact',
        path: '/paper-analysis/state.json',
        handler(req, res) {
          if (req.method === 'GET' || req.method === 'HEAD') {
            sendJson(res, 200, { draft, stats: statsOf(draft), scan })
            return
          }
          if (req.method === 'POST') {
            readBody(req)
              .then((body) => {
                const patch = JSON.parse(body.toString('utf8') || '{}')
                const merged = normalizeDraft({ ...draft, ...patch })
                merged.updatedAt = new Date().toISOString()
                draft = merged
                saveDraft()
                sendJson(res, 200, { ok: true, draft, stats: statsOf(draft) })
              })
              .catch((err) => sendJson(res, 400, { ok: false, error: String(err?.message || err) }))
            return
          }
          res.statusCode = 405
          res.setHeader('allow', 'GET, HEAD, POST')
          res.end()
        },
      }),
    )

    // 学情看板：知识点关联图 + 掌握情况聚合
    ctx.effect(() =>
      webServer.register({
        kind: 'exact',
        path: '/paper-analysis/knowledge',
        handler(req, res) {
          if (req.method !== 'GET' && req.method !== 'HEAD') {
            res.statusCode = 405
            res.setHeader('allow', 'GET, HEAD')
            res.end()
            return
          }
          sendJson(res, 200, knowledgeBoard())
        },
      }),
    )

    // 知识图谱：某科的标准知识点清单（面板知识点输入框的自动补全）
    ctx.effect(() =>
      webServer.register({
        kind: 'exact',
        path: '/paper-analysis/kg',
        handler(req, res) {
          if (req.method !== 'GET' && req.method !== 'HEAD') {
            res.statusCode = 405
            res.setHeader('allow', 'GET, HEAD')
            res.end()
            return
          }
          const subject = asText(new URL(req.url, 'http://localhost').searchParams.get('subject'))
          const sub = KG[subject]
          sendJson(res, 200, {
            subject,
            subjects: Object.keys(KG),
            topics: sub ? sub.topics.map((t) => t.name) : [],
            chapters: sub ? sub.chapters : [],
          })
        },
      }),
    )

    // 历史记录：列表
    ctx.effect(() =>
      webServer.register({
        kind: 'exact',
        path: '/paper-analysis/records',
        handler(req, res) {
          if (req.method !== 'GET' && req.method !== 'HEAD') {
            res.statusCode = 405
            res.setHeader('allow', 'GET, HEAD')
            res.end()
            return
          }
          sendJson(res, 200, { records: records.map(recordSummary) })
        },
      }),
    )

    // 历史记录：把草稿保存为新记录（body 可带 id 表示覆盖已有记录）
    ctx.effect(() =>
      webServer.register({
        kind: 'exact',
        path: '/paper-analysis/records/save',
        handler(req, res) {
          if (req.method !== 'POST') {
            res.statusCode = 405
            res.setHeader('allow', 'POST')
            res.end()
            return
          }
          readBody(req)
            .then((body) => {
              const payload = JSON.parse(body.toString('utf8') || '{}')
              if (payload.draft && typeof payload.draft === 'object') {
                const merged = normalizeDraft({ ...draft, ...payload.draft })
                merged.updatedAt = new Date().toISOString()
                draft = merged
                saveDraft()
              }
              const summary = saveDraftAsRecord(asText(payload.id))
              sendJson(res, 200, { ok: true, record: summary })
            })
            .catch((err) => sendJson(res, 400, { ok: false, error: String(err?.message || err) }))
        },
      }),
    )

    // 历史记录：详情读取 / 覆盖更新（?id=...）
    ctx.effect(() =>
      webServer.register({
        kind: 'exact',
        path: '/paper-analysis/record.json',
        handler(req, res) {
          const id = asText(new URL(req.url, 'http://localhost').searchParams.get('id'))
          const idx = records.findIndex((r) => r.id === id)
          if (idx < 0) {
            sendJson(res, 404, { ok: false, error: '记录不存在' })
            return
          }
          if (req.method === 'GET' || req.method === 'HEAD') {
            sendJson(res, 200, { record: records[idx], stats: statsOf(records[idx]) })
            return
          }
          if (req.method === 'POST') {
            readBody(req)
              .then((body) => {
                const patch = JSON.parse(body.toString('utf8') || '{}')
                const merged = normalizeDraft({ ...records[idx], ...patch })
                records[idx] = { ...records[idx], ...merged, id, updatedAt: new Date().toISOString() }
                saveRecords()
                sendJson(res, 200, { ok: true, record: records[idx], stats: statsOf(records[idx]) })
              })
              .catch((err) => sendJson(res, 400, { ok: false, error: String(err?.message || err) }))
            return
          }
          res.statusCode = 405
          res.setHeader('allow', 'GET, HEAD, POST')
          res.end()
        },
      }),
    )

    // 历史记录：删除
    ctx.effect(() =>
      webServer.register({
        kind: 'exact',
        path: '/paper-analysis/record/delete',
        handler(req, res) {
          if (req.method !== 'POST') {
            res.statusCode = 405
            res.setHeader('allow', 'POST')
            res.end()
            return
          }
          readBody(req)
            .then((body) => {
              const payload = JSON.parse(body.toString('utf8') || '{}')
              const id = asText(payload.id)
              const before = records.length
              records = records.filter((r) => r.id !== id)
              if (records.length !== before) saveRecords()
              sendJson(res, 200, { ok: true, deleted: before - records.length })
            })
            .catch((err) => sendJson(res, 400, { ok: false, error: String(err?.message || err) }))
        },
      }),
    )

    ctx.effect(() =>
      webServer.register({
        kind: 'exact',
        path: '/paper-analysis/scan',
        handler(req, res) {
          if (req.method !== 'POST') {
            res.statusCode = 405
            res.setHeader('allow', 'POST')
            res.end()
            return
          }
          readBody(req)
            .then(async (body) => {
              const payload = JSON.parse(body.toString('utf8') || '{}')
              const dataBase64 = asText(payload.dataBase64)
              if (!dataBase64) throw new Error('缺少文件数据')
              const nameRaw = asText(payload.name) || 'scan.png'
              const isPdf = /\.pdf$/i.test(nameRaw)
              const ext = isPdf
                ? 'pdf'
                : (nameRaw.match(/\.(png|jpe?g|webp|gif)$/i)?.[1] || 'png').toLowerCase()
              const wd = ctx.get('workingDirectory')
              const baseDir = wd?.defaultDirectory || process.cwd()
              const dir = resolve(baseDir, 'paper-scans')
              if (!dir.startsWith(resolve(baseDir) + sep)) throw new Error('非法目录')
              mkdirSync(dir, { recursive: true })
              const stamp = Date.now()
              const filePath = join(dir, `scan-${stamp}.${ext}`)
              writeFileSync(filePath, Buffer.from(dataBase64, 'base64'))

              scan = {
                fileName: nameRaw,
                filePath,
                kind: isPdf ? 'pdf' : 'image',
                pages: [],
                status: isPdf ? 'rendering' : 'pending',
                note: isPdf ? '正在将 PDF 转换为图片…' : '',
                percent: null,
                error: '',
                updatedAt: new Date().toISOString(),
              }
              saveScan()

              if (!isPdf) {
                const notice = notifyAgent(ctx, imageScanInstruction(filePath))
                setScan({
                  status: notice.notified ? 'notified' : 'pending',
                  note: notice.notified ? '已发送给助手，等待开始识别' : '',
                })
                sendJson(res, 200, { ok: true, path: filePath, scan, ...notice })
                return
              }

              // PDF：先渲染为逐页图片再交给助手识别。
              let rendered = null
              let renderError = null
              try {
                rendered = await renderPdf(filePath, dir, `scan-${stamp}`)
              } catch (err) {
                renderError = String(err?.message || err)
              }
              if (rendered && Array.isArray(rendered.pages) && rendered.pages.length) {
                let excerpt = ''
                if (rendered.chars > 100) {
                  try {
                    excerpt = readFileSync(join(dir, `scan-${stamp}.txt`), 'utf8').slice(0, 3000)
                  } catch { /* optional */ }
                }
                const notice = notifyAgent(ctx, pdfScanInstruction(filePath, rendered.pages, excerpt))
                setScan({
                  pages: rendered.pages,
                  status: notice.notified ? 'notified' : 'pending',
                  note: notice.notified ? `已转换为 ${rendered.pages.length} 页图片，等待开始识别` : '',
                  error: notice.notified ? '' : renderError || '',
                })
                sendJson(res, 200, {
                  ok: true,
                  path: filePath,
                  pdf: true,
                  pages: rendered.pages.length,
                  textLayer: rendered.chars > 100,
                  scan,
                  ...notice,
                })
              } else {
                setScan({
                  status: 'error',
                  note: '',
                  error: renderError || 'no-pdf-converter',
                })
                sendJson(res, 200, {
                  ok: true,
                  path: filePath,
                  pdf: true,
                  converted: false,
                  notified: false,
                  scan,
                  error: renderError || 'no-pdf-converter',
                })
              }
            })
            .catch((err) => sendJson(res, 400, { ok: false, error: String(err?.message || err) }))
        },
      }),
    )

    // 题目截图：按文件名从 crops 目录读取（文件名已校验，无路径穿越）。
    ctx.effect(() =>
      webServer.register({
        kind: 'exact',
        path: '/paper-analysis/crop',
        handler(req, res) {
          if (req.method !== 'GET' && req.method !== 'HEAD') {
            res.statusCode = 405
            res.setHeader('allow', 'GET, HEAD')
            res.end()
            return
          }
          const f = asText(new URL(req.url, 'http://localhost').searchParams.get('f'))
          if (!/^[\w一-龥()（）.-]+\.png$/.test(f)) {
            res.statusCode = 400
            res.end()
            return
          }
          try {
            const buf = readFileSync(join(cropsDir, f))
            res.statusCode = 200
            res.setHeader('content-type', 'image/png')
            res.setHeader('cache-control', 'no-store')
            res.end(buf)
          } catch {
            res.statusCode = 404
            res.end()
          }
        },
      }),
    )

    // 手动启动/重新启动当前扫描任务的分析（用于上传时没有活动会话，或助手长时间没有反应的情况）。
    ctx.effect(() =>
      webServer.register({
        kind: 'exact',
        path: '/paper-analysis/scan/start',
        handler(req, res) {
          if (req.method !== 'POST') {
            res.statusCode = 405
            res.setHeader('allow', 'POST')
            res.end()
            return
          }
          if (!scan || scan.status === 'done') {
            sendJson(res, 400, { ok: false, error: '当前没有待分析的扫描件', scan })
            return
          }
          const instruction =
            scan.kind === 'pdf' && scan.pages.length
              ? pdfScanInstruction(scan.filePath, scan.pages, '')
              : imageScanInstruction(scan.filePath)
          const notice = notifyAgent(ctx, instruction)
          if (notice.notified) {
            setScan({ status: 'notified', note: '已发送给助手，等待开始识别', error: '' })
          } else {
            setScan({ status: 'pending', note: '' })
          }
          sendJson(res, 200, { ok: true, scan, ...notice })
        },
      }),
    )

    // 一次性修复：清除所有活动会话收件箱中的畸形条目（旧版本插件注入的原始字符串）。
    ctx.effect(() =>
      webServer.register({
        kind: 'exact',
        path: '/paper-analysis/repair-inboxes',
        handler(req, res) {
          if (req.method !== 'POST') {
            res.statusCode = 405
            res.setHeader('allow', 'POST')
            res.end()
            return
          }
          try {
            sendJson(res, 200, repairLiveInboxes(ctx))
          } catch (err) {
            sendJson(res, 500, { ok: false, error: String(err?.message || err) })
          }
        },
      }),
    )

    // 忽略/清除当前扫描任务进度卡片。
    ctx.effect(() =>
      webServer.register({
        kind: 'exact',
        path: '/paper-analysis/scan/dismiss',
        handler(req, res) {
          if (req.method !== 'POST') {
            res.statusCode = 405
            res.setHeader('allow', 'POST')
            res.end()
            return
          }
          clearScan()
          sendJson(res, 200, { ok: true })
        },
      }),
    )
  }
}
