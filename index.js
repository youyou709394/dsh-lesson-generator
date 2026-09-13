/**
 * dsh-lesson-generator index.js
 * 一键生成互动课件（Lesson Generator）DSH 插件
 * 
 * 核心工具 generate_lesson：
 *   输入教材单元（学科/年级/主题 + 可选的词汇/对话/游戏数据）
 *   输出一个自包含的互动课件 HTML（翻牌/连连看/大转盘/猜猜看 + 跟读 + Quiz）
 * 
 * 零配置演示：不传详细内容时，内置三年级英语示例课件（开箱即用）
 */
import { defineTool } from '@deepseek-ai/dsh-tools'
import { buildLessonHTML, buildLessonJSON } from './lib/courseware-engine.js'

export const name = 'dsh-lesson-generator'
export const inject = ['tools']

// ============ 内置示例课件（三年级英语 Unit 5 野生动物） ============
// 数据格式与 english-courseware-games 技能一致
const SAMPLE = {
  subject: '英语', grade: '三年级', unit: 'Unit 5 Wild Animals',
  vocab: [
    { word: 'lion', cn: '狮子', emoji: '🦁' },
    { word: 'tiger', cn: '老虎', emoji: '🐯' },
    { word: 'monkey', cn: '猴子', emoji: '🐵' },
    { word: 'elephant', cn: '大象', emoji: '🐘' },
    { word: 'panda', cn: '熊猫', emoji: '🐼' },
    { word: 'bear', cn: '熊', emoji: '🐻' },
    { word: 'rabbit', cn: '兔子', emoji: '🐰' },
    { word: 'bird', cn: '鸟', emoji: '🐦' },
  ],
  flip:  [ {emoji:'🦁',word:'lion'}, {emoji:'🐯',word:'tiger'}, {emoji:'🐵',word:'monkey'}, {emoji:'🐘',word:'elephant'}, {emoji:'🐼',word:'panda'}, {emoji:'🐻',word:'bear'}, {emoji:'🐰',word:'rabbit'}, {emoji:'🐦',word:'bird'} ],
  // 连连看：前6英 后6中
  connect: [ {left:'lion'},{left:'tiger'},{left:'panda'},{left:'bear'},{left:'rabbit'},{left:'monkey'},{right:'狮子'},{right:'老虎'},{right:'熊猫'},{right:'熊'},{right:'兔子'},{right:'猴子'} ],
  wheel:  ['lion','panda','tiger','bear','monkey','rabbit'],
  guess: [
    { hint: 'It is big and orange, it says "roar".', options:['cat','lion','dog'], answer:'lion' },
    { hint: 'It is black and white, from China.', options:['panda','zebra','pig'], answer:'panda' },
    { hint: 'It has a long nose.', options:['monkey','elephant','fox'], answer:'elephant' },
  ],
  dialog: [
    { who: 'Amy', text: 'Look! A lion! It is big.' },
    { who: 'Bob', text: 'Wow! The panda is cute.' },
    { who: 'Amy', text: 'Is that a tiger?' },
    { who: 'Bob', text: 'No, it is a bear. It is brown.' },
  ],
  readKeys: ['lion', 'panda', 'tiger', 'bear'],
  quiz: [
    { q: 'What animal is black and white?', options:['🐼 panda','🐯 tiger','🦁 lion'], correct:'🐼 panda' },
    { q: 'The lion is ___.', options:['small','big','cute'], correct:'big' },
    { q: 'Which one has a long nose?', options:['🐰 rabbit','🐵 monkey','🐘 elephant'], correct:'🐘 elephant' },
    { q: 'A panda comes from ___.', options:['China','USA','Japan'], correct:'China' },
    { q: 'What does a tiger say?', options:['Roar!','Meow!','Woof!'], correct:'Roar!' },
  ],
}

// ============ 内容派生：由用户 vocab/content 生成各游戏数据 ============
// 关键修复(v0.1.3)：旧版无论传什么学科，游戏数据恒取 SAMPLE →
// 语文课件的翻牌/连连看/猜猜看/Quiz 全是英文野生动物。现改为"用户数据优先，
// 缺失项由 vocab 自动派生，全部缺失才回落到内置示例"。

/** 从自由文本 content 解析词条，支持 "word|中文|emoji" / "word,中文" / "word：中文" 行格式 */
function parseContent(content) {
  if (!content || typeof content !== 'string') return []
  const out = []
  for (const raw of content.split(/\r?\n/)) {
    const t = raw.trim().replace(/^[-*•\d.、)\s]+/, '')
    if (!t) continue
    const parts = t.split(/[|｜\t,，]/).map(s => s.trim()).filter(Boolean)
    let word = parts[0], cn = parts[1] || '', emoji = parts[2] || '📘'
    if (parts.length < 2) {
      const m = t.split(/[:：]/).map(s => s.trim()).filter(Boolean)
      if (m.length >= 2) { word = m[0]; cn = m[1]; emoji = m[2] || '📘' }
    }
    if (word && word.length <= 24) out.push({ word, cn, emoji })
  }
  return out.length >= 2 ? out : []
}

function pickN(arr, n) {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] }
  return a.slice(0, n)
}

/** 由词表生成选择题：每题 = 正确项 + 2 个干扰项（去重） */
function makeChoicePool(words, keyOf, correctOf, makeQ, limit) {
  const pool = words.filter(w => keyOf(w))
  const out = []
  for (const w of pool) {
    const correct = correctOf(w)
    const others = [...new Set(pool.filter(o => correctOf(o) !== correct).map(correctOf))]
    const options = pickN([correct, ...pickN(others, 2)], 3)
    if (options.length < 2 || !options.includes(correct)) continue
    out.push(makeQ(w, options, correct))
    if (out.length >= limit) break
  }
  return out
}

/** 由 vocab 派生出全部可派生游戏数据；用户显式传入的优先 */
function deriveGames(vocab, args) {
  const words = (vocab || []).map(x => ({ word: x.word, cn: x.cn || '', emoji: x.emoji || '📘' }))
  const has = (a) => Array.isArray(a) && a.length > 0

  const flip = has(args.flip) ? args.flip : words.slice(0, 8).map(x => ({ emoji: x.emoji, word: x.word }))
  const wheel = has(args.wheel) ? args.wheel : words.map(x => x.word)

  let connect = has(args.connect) ? args.connect : []
  if (!connect.length) {
    const h = Math.min(words.length, 6)
    if (h >= 2) {
      // 前半 left，后半 right，左右同序 → 引擎按半区索引配对
      connect = words.slice(0, h).map(x => ({ left: x.word }))
        .concat(words.slice(0, h).map(x => ({ right: x.cn || x.word })))
    }
  }

  const quiz = has(args.quiz) ? args.quiz : makeChoicePool(
    words, w => w.cn, w => w.cn,
    (w, options, correct) => ({ q: `${w.emoji}「${w.word}」的意思是？`, options, correct }), 4)

  const guess = has(args.guess) ? args.guess : makeChoicePool(
    words, w => w.cn, w => w.word,
    (w, options, correct) => ({ hint: `意思是「${w.cn}」的词是？`, options, answer: correct }), 3)

  return {
    vocab: words,
    flip, connect, wheel, guess, quiz,
    dialog: has(args.dialog) ? args.dialog : [],
    readKeys: has(args.readKeys) ? args.readKeys : words.map(x => x.word),
  }
}

export function apply(ctx) {
  ctx.tools.register(defineTool({
    name: 'generate_lesson',
    description: '一键生成互动课件。输入教材单元(学科/年级/unit主题)，可选提供词汇/对话/游戏数据，生成一个自包含的可交互HTML课件包（含翻牌配对/连连看/大转盘/猜猜看 4种游戏 + 口语跟读 + 小Quiz）。给出 vocab 后所有游戏内容按该词表自动生成，适配任意学科；也可用 flip/connect/wheel/guess/quiz/dialog 精确覆盖。完全不传内容时内置三年级英语示例课件(开箱即用)。适合K12教师/机构快速出互动课件。',
    parameters: {
      subject: { type: 'string', description: '学科：英语/语文/数学等' },
      grade: { type: 'string', description: '年级，如"三年级"/"三年级上册"' },
      unit: { type: 'string', description: '单元主题，如"Unit 5 Wild Animals"' },
      vocab: { type: 'array', items: { type: 'object', additionalProperties: true }, description: '词汇表，每项{word, cn, emoji}。给出后，翻牌/连连看/大转盘/猜猜看/Quiz 会依据它自动生成。' },
      content: { type: 'string', description: '可选：课件内容文本，按行解析（每行 "词|中文|emoji"、"词,中文" 或 "词：中文"）。当未给 vocab 时用作词表来源。' },
      flip: { type: 'array', items: { type: 'object', additionalProperties: true }, description: '可选：翻牌配对数据[{emoji,word}]，覆盖自动生成。' },
      connect: { type: 'array', items: { type: 'object', additionalProperties: true }, description: '可选：连连看数据，前半[{left}]后半[{right}]且左右同序，覆盖自动生成。' },
      wheel: { type: 'array', items: { type: 'string' }, description: '可选：大转盘词条，覆盖自动生成。' },
      guess: { type: 'array', items: { type: 'object', additionalProperties: true }, description: '可选：猜猜看题目[{hint,options[],answer}]，覆盖自动生成。' },
      dialog: { type: 'array', items: { type: 'object', additionalProperties: true }, description: '可选：跟读对话[{who,text}]。缺省时不显示跟读入口（避免英语示例污染其他学科）。' },
      quiz: { type: 'array', items: { type: 'object', additionalProperties: true }, description: '可选：小Quiz题目[{q,options[],correct}]，覆盖自动生成。' },
      readKeys: { type: 'array', items: { type: 'string' }, description: '可选：跟读重点词，缺省取 vocab 词表。' },
    },
    output: {
      schema: { type: 'object', additionalProperties: true },
      render: (_args, value) => [{ type: 'text', text: value.summary }],
    },
    async execute(args) {
      const subject = args.subject || SAMPLE.subject
      const grade = args.grade || SAMPLE.grade
      const unit = args.unit || SAMPLE.unit

      // 词表来源优先级：显式 vocab > content 解析 > null
      const fromContent = parseContent(args.content)
      const vocab = (Array.isArray(args.vocab) && args.vocab.length) ? args.vocab
        : (fromContent.length ? fromContent : null)

      const hasAnyUserData = !!(vocab || args.flip?.length || args.connect?.length || args.wheel?.length
        || args.guess?.length || args.dialog?.length || args.quiz?.length)

      // 有用户内容 → 按用户内容生成（缺失项由 vocab 派生）；完全没有 → 内置示例兜底
      const c = { subject, grade, unit, vocab: vocab || SAMPLE.vocab }
      const d = hasAnyUserData ? deriveGames(c.vocab, args) : SAMPLE

      const html = buildLessonHTML(c, d)
      const data = buildLessonJSON(c, d)

      const games = []
      if (d.flip?.length) games.push(`翻牌配对(${d.flip.length})`)
      if (d.connect?.length) games.push(`连连看(${Math.floor(d.connect.length / 2)})`)
      if (d.wheel?.length) games.push(`大转盘(${d.wheel.length})`)
      if (d.guess?.length) games.push(`猜猜看(${d.guess.length})`)

      const summary = `📚 课件已生成：${c.grade} ${c.subject} · ${c.unit}
· 词汇 ${c.vocab.length} 个：${c.vocab.slice(0, 6).map(v => (v.emoji || '') + v.word).join(' ')}${c.vocab.length > 6 ? ' …' : ''}
· 互动游戏：${games.length ? games.join(' / ') : '（无）'}
· 口语跟读 ${(d.dialog || []).length} 句对话 · 小Quiz ${(d.quiz || []).length} 题
· 积分宠物激励 ⭐${hasAnyUserData ? '' : '\n· ⚠️ 未提供 vocab/内容，本次使用内置三年级英语示例数据'}

💻 课件HTML（自包含、离线可跑、移动端优先）已生成。
👉 如需把它保存成文件使用，请模型给用户输出完整HTML。

📦 数据结构预览：
${JSON.stringify(data).slice(0, 500)}...`

      return { summary, html, data, unit: `${c.grade} ${c.subject} ${c.unit}` }
    },
  }))
}
