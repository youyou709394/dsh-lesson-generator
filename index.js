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

export function apply(ctx) {
  ctx.tools.register(defineTool({
    name: 'generate_lesson',
    description: '一键生成互动课件。输入教材单元(学科/年级/unit主题)，可选提供词汇/对话/游戏数据，生成一个自包含的可交互HTML课件包（含翻牌配对/连连看/大转盘/猜猜看 4种游戏 + 口语跟读 + 小Quiz）。不传详细内容时内置三年级英语示例课件(开箱即用)。适合K12教师/机构快速出互动课件。',
    parameters: {
      subject: { type: 'string', required: false, description: '学科：英语/语文/数学等' },
      grade: { type: 'string', required: false, description: '年级，如"三年级"/"三年级上册"' },
      unit: { type: 'string', required: false, description: '单元主题，如"Unit 5 Wild Animals"' },
      vocab: { type: 'array', items: { type: 'object' }, required: false, description: '词汇表，每项{word, cn, emoji}' },
      content: { type: 'string', required: false, description: '可选：由模型或使用者整理的课件内容文本，插件会尽量结构化' },
    },
    output: {
      schema: { type: 'object' },
      render: (_args, value) => [{ type: 'text', text: value.summary }],
    },
    async execute(args) {
      // 合并：用户提供的 + 示例兜底
      const c = {
        subject: args.subject || SAMPLE.subject,
        grade: args.grade || SAMPLE.grade,
        unit: args.unit || SAMPLE.unit,
        vocab: (args.vocab && args.vocab.length) ? args.vocab : SAMPLE.vocab,
      }
      const html = buildLessonHTML(c, SAMPLE)
      const data = buildLessonJSON(c, SAMPLE)

      const summary = `📚 课件已生成：${c.grade} ${c.subject} · ${c.unit}
· 词汇 ${c.vocab.length} 个：${c.vocab.slice(0,6).map(v=>v.emoji+v.word).join(' ')}${c.vocab.length>6?' …':''}
· 4种互动游戏：翻牌配对 / 连连看 / 大转盘 / 猜猜看
· 口语跟读 ${SAMPLE.dialog.length} 句对话 · 小Quiz ${SAMPLE.quiz.length} 题
· 积分宠物激励 ⭐

💻 课件HTML（自包含、离线可跑、移动端优先）已生成。
👉 如需把它保存成文件使用，请模型给用户输出完整HTML。

📦 数据结构预览：
${JSON.stringify(data).slice(0,500)}...`

      return { summary, html, data, unit: `${c.grade} ${c.subject} ${c.unit}` }
    },
  }))
}
