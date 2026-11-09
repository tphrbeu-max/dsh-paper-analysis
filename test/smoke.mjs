// Smoke test for paper-analysis host: module load, tool register, import/save/history flows, record routes.
import { pathToFileURL } from 'node:url'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

const pkgDir = 'C:\\Users\\ThinkPad\\Documents\\deepseek-harness\\default-workspace\\plugins\\paper-analysis'
const mod = await import(pathToFileURL(join(pkgDir, 'index.js')).href)

let tool = null
const routes = new Map()
const ctx = {
  tools: { register: (t) => { tool = t; return () => {} } },
  get(name) {
    if (name === 'webServer') return { register: (r) => { routes.set(r.path, r.handler); return () => {} } }
    if (name === 'workingDirectory') return { defaultDirectory: pkgDir }
    return undefined
  },
  effect(fn) { fn(); return () => {} },
}
mod.apply(ctx)

if (!tool) throw new Error('tool not registered')
console.log('tool:', tool.name)

// import flow
let out = await tool.execute({
  action: 'import',
  title: '2026 高一数学期中试卷',
  subject: '数学',
  examType: '期中',
  date: '2026-11-05',
  score: '98',
  totalScore: '150',
  questions: [
    { no: '1', type: '选择题', score: '5', fullScore: '5', knowledgePoint: '集合与常用逻辑用语' },
    { no: '2', type: '选择题', score: '3', fullScore: '5', knowledgePoint: '函数概念与性质' },
    { no: '3', type: '填空题', score: '0', fullScore: '5', knowledgePoint: '三角恒等变换' },
    { no: '4', type: '解答题', score: '8', fullScore: '12', knowledgePoint: '函数零点与建模' },
    { no: '5', type: '解答题', score: '12', fullScore: '12', knowledgePoint: '平面向量' },
  ],
}, {})
if (!out.ok) throw new Error('import failed')
const stats = out.stats
console.log('scoreRate:', stats.scoreRate.toFixed(3), 'total:', stats.totalScore + '/' + stats.totalFull)
console.log('byType:', stats.byType.map((x) => `${x.type}:${(x.scoreRate * 100).toFixed(0)}%`).join(' '))
console.log('wrong:', stats.wrong.map((w) => `${w.no}(-${w.lost},${w.knowledgePoint})`).join(' '))
console.log('snapped kp:', out.draft.questions.map((q) => q.knowledgePoint).join(' | '))

// catalog action
{
  const cat = await tool.execute({ action: 'catalog', subject: '物理' }, {})
  console.log('catalog 物理 topics:', cat.ok ? cat.topics.length : cat.error)
  if (!cat.ok || !cat.topics.length) throw new Error('catalog failed')
}
if (stats.wrong.length !== 3) throw new Error('wrong count mismatch')
const sel = stats.byType.find((x) => x.type === '选择题')
if (Math.abs(sel.scoreRate - 8 / 10) > 1e-9) throw new Error('type score rate mismatch')

// save as record
out = await tool.execute({ action: 'save' }, {})
console.log('saved record:', out.record.id, out.record.title, 'wrong=' + out.record.wrongCount)
const recordId = out.record.id

out = await tool.execute({ action: 'history' }, {})
console.log('history count:', out.records.length)
if (!out.records.length) throw new Error('history empty')

// record routes
function mockReq(method, body) {
  const listeners = {}
  return {
    method,
    url: '/paper-analysis/record.json?id=' + recordId,
    on(ev, fn) { listeners[ev] = fn },
    destroy() {},
    fire() {
      if (body !== undefined) {
        listeners.data && listeners.data(Buffer.from(JSON.stringify(body)))
      }
      listeners.end && listeners.end()
    },
  }
}
function mockRes() {
  return {
    statusCode: 0,
    headers: {},
    setHeader(k, v) { this.headers[k] = v },
    body: null,
    end(b) { this.body = b },
  }
}

// GET detail
const h = routes.get('/paper-analysis/record.json')
{
  const req = mockReq('GET'); const res = mockRes()
  h(req, res)
  const json = JSON.parse(res.body)
  console.log('GET record:', json.record.title, 'questions:', json.record.questions.length)
}

// POST update (overwrite) — annotate error reason
{
  const detail = await new Promise((resolvePromise) => {
    const req = mockReq('GET'); const res = mockRes()
    h(req, res); resolvePromise(JSON.parse(res.body).record)
  })
  detail.questions[1].errorCategory = '知识失分'
  detail.questions[1].errorReason = '概念不清'
  detail.questions[2].errorCategory = '审题失分'
  detail.questions[2].errorReason = '看错设问'
  detail.questions[2].note = '把“不正确”看成“正确”'
  const req = mockReq('POST', detail); const res = mockRes()
  h(req, res); req.fire()
  await new Promise((r) => setTimeout(r, 100))
  const json = JSON.parse(res.body)
  if (!json.ok) throw new Error('record update failed')
  const q3 = json.record.questions[2]
  console.log('annotated:', q3.no, q3.errorCategory + '/' + q3.errorReason, '|', q3.note)
  // invalid taxonomy values must be rejected
  const bad = JSON.parse(JSON.stringify(detail))
  bad.questions[3].errorCategory = '不存在的类'
  bad.questions[3].errorReason = '编造原因'
  const req2 = mockReq('POST', bad); const res2 = mockRes()
  h(req2, res2); req2.fire()
  await new Promise((r) => setTimeout(r, 100))
  const json2 = JSON.parse(res2.body)
  if (json2.record.questions[3].errorCategory !== '') throw new Error('taxonomy validation failed')
  console.log('taxonomy validation ok')
}

// records list route
{
  const req = mockReq('GET'); const res = mockRes()
  routes.get('/paper-analysis/records')(req, res)
  const json = JSON.parse(res.body)
  console.log('records route:', json.records.length, 'first:', json.records[0].title)
}

// delete record
{
  const req = mockReq('POST', { id: recordId }); const res = mockRes()
  routes.get('/paper-analysis/record/delete')(req, res); req.fire()
  await new Promise((r) => setTimeout(r, 100))
  console.log('deleted:', JSON.parse(res.body).deleted)
}

// draft route roundtrip
{
  const req = mockReq('GET'); const res = mockRes()
  routes.get('/paper-analysis/state.json')(req, res)
  const json = JSON.parse(res.body)
  console.log('draft route: questions=', json.draft.questions.length, 'stats.wrong=', json.stats.wrong.length)
}

// knowledge board route
{
  const req = mockReq('GET'); const res = mockRes()
  routes.get('/paper-analysis/knowledge')(req, res)
  const json = JSON.parse(res.body)
  const board = json.boards.find((b) => b.subject === '数学') || json.boards[0]
  if (!board) throw new Error('board missing')
  const withData = board.nodes.filter((n) => n.count > 0)
  console.log('board:', board.subject, '| nodes:', board.nodes.length, '| edges:', board.edges.length, '| withData:', withData.length)
  console.log('withData:', withData.map((n) => `${n.name}:${Math.round(n.rate * 100)}%`).join(' '))
  if (!board.edges.length) throw new Error('edges missing')
  if (!withData.length) throw new Error('no node has data')
  const q = json.questions[withData[0].name]
  if (!q || !q.length) throw new Error('kp questions missing')
}

// kg route
{
  const req = mockReq('GET'); const res = mockRes()
  req.url = '/paper-analysis/kg?subject=' + encodeURIComponent('物理')
  routes.get('/paper-analysis/kg')(req, res)
  const json = JSON.parse(res.body)
  console.log('kg 物理 topics:', json.topics.length, 'chapters:', json.chapters.length)
  if (!json.topics.length) throw new Error('kg topics missing')
}

console.log('SMOKE OK')
