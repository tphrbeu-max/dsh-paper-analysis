// 从 cn-k12 知识图谱 topics.json 中提取高中（grade 10-16）主干学科的知识点，
// 生成插件资产 assets/kg-high.json：
// { subjects: { 物理: { topics: [{name, chapter, grade}], edges: [[先修名, 后续名]] } } }
import { readFileSync, writeFileSync } from 'node:fs'

const SRC = 'C:/Users/ThinkPad/Documents/deepseek-harness/default-workspace/kg-src/topics.json'
const OUT = 'C:/Users/ThinkPad/Documents/deepseek-harness/default-workspace/plugins/paper-analysis/assets/kg-high.json'

const SUBJECT_MAP = {
  math: '数学',
  physics: '物理',
  chemistry: '化学',
  biology: '生物',
  history: '历史',
  geography: '地理',
  politics: '思想政治',
}

const topics = JSON.parse(readFileSync(SRC, 'utf8'))
console.log('total topics:', topics.length)

const byId = new Map(topics.map((t) => [t.id, t]))
const result = {}

// 去掉名称中的章节编号前缀（如「5.5 三角恒等变换」→「三角恒等变换」）
const cleanName = (n) => String(n).replace(/^\d+(\.\d+)*\s+/, '').trim()

for (const [code, zh] of Object.entries(SUBJECT_MAP)) {
  const rawList = topics.filter((t) => t.subject === code && t.grade >= 10 && t.grade <= 16)
  // 按清洗后的名称去重（同一名称在不同教材/年级可能重复，保留第一条）
  const byName = new Map()
  const idToName = new Map()
  for (const t of rawList) {
    const name = cleanName(t.name)
    if (!name) continue
    idToName.set(t.id, name)
    if (!byName.has(name)) {
      byName.set(name, { name, chapter: t.chapter || '', grade: t.grade, level: t.level || '' })
    }
  }
  const list = [...byName.values()]
  const edges = []
  const seen = new Set()
  for (const t of rawList) {
    const toName = idToName.get(t.id)
    for (const pre of t.prerequisites || []) {
      const fromName = idToName.get(pre)
      if (!fromName || !toName || fromName === toName) continue
      const key = `${fromName}→${toName}`
      if (seen.has(key)) continue
      seen.add(key)
      edges.push([fromName, toName])
    }
  }
  // 章节顶层名（用于 prompt 提示）：取「· 第X节」之前的部分并去重
  const chapters = [...new Set(list.map((t) => String(t.chapter || '').split('·')[0].trim()).filter(Boolean))]
  result[zh] = {
    topics: list,
    edges,
    chapters,
  }
  console.log(`${zh}: ${list.length} topics, ${edges.length} edges, ${chapters.length} chapters`)
}

writeFileSync(OUT, JSON.stringify(result))
const kb = (Buffer.byteLength(JSON.stringify(result)) / 1024).toFixed(0)
console.log('written:', OUT, kb + ' KB')

// 抽样检查
const phys = result['物理']
console.log('物理样例:', phys.topics.slice(0, 5).map((t) => `${t.name}(${t.grade}年级/${t.chapter})`))
console.log('物理边样例:', phys.edges.slice(0, 5))
