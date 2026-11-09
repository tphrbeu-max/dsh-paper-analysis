// 冒烟测试会把测试草稿写进 analysis.data.json；此脚本把它恢复为物理卷草稿。
import { readFileSync, writeFileSync } from 'node:fs'

const dataPath = 'C:/Users/ThinkPad/Documents/deepseek-harness/default-workspace/plugins/paper-analysis/analysis.data.json'
const recordsPath = 'C:/Users/ThinkPad/Documents/deepseek-harness/default-workspace/plugins/paper-analysis/records.data.json'

// 从最近的物理历史记录恢复草稿（内容一致，updatedAt 取现在）
const records = JSON.parse(readFileSync(recordsPath, 'utf8'))
const physics = records.find((r) => r.subject === '物理')
if (!physics) throw new Error('没有找到物理记录，无法恢复草稿')
const { id, createdAt, ...rest } = physics
const draft = { ...rest, updatedAt: new Date().toISOString() }
writeFileSync(dataPath, JSON.stringify(draft, null, 2) + '\n', 'utf8')
console.log('draft restored:', draft.title, 'questions:', draft.questions.length)
