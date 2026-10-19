# dsh-lesson-generator（一键生成互动课件）

> **一键生成互动课件 · Lesson Generator** — 输入教材单元，自动生成可交互的 HTML 课件包。
> 内置翻牌配对 / 连连看 / 大转盘 / 猜猜看 4种游戏 + 口语跟读 + 小Quiz + 积分激励。
> 面向 K12 师生 / 机构 / 教育AI开发者。

`dsh-plugin` for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness). Everything is a plugin.

## 🎯 装了就出课件，不用写代码

只要描述教材单元（学科/年级/主题），插件自动生成**自包含、离线可跑、移动端优先**的互动课件 HTML：
1. **🃏 翻牌配对** — 点两面找配对（emoji ↔ 单词）
2. **🔗 连连看** — 中英文连线配对
3. **🎡 大转盘** — 转盘随机抽单词
4. **🤔 猜猜看** — 描述提示猜单词
5. **🗣 口语跟读** — 对话跟读，标重点词
6. **📝 小Quiz** — 单选测验
7. **⭐ 积分激励** — 答对得分，累积激励学习

不传任何内容时内置**三年级英语 Unit 5 Wild Animals** 示例课件（开箱即用）。

> ✅ **v0.1.3 修复**：此前无论传什么学科，游戏内容恒为内置英语示例（语文课件的翻牌/Quiz 也全是 lion/panda）——因为引擎被喂了 `SAMPLE`。
> 现在**给出了 `vocab` 就按该词表自动生成**全部游戏，适配语文/数学/英语任意学科；`dialog` 缺省时**自动隐藏跟读入口**，不再出现"英语示例污染其他学科"。

## 🔧 安装

> ⚠️ 本插件**托管在 GitHub，尚未发布到 npm registry**。安装时**必须写 `github:` 全名**；
> 只写包名会报 `ERR_PNPM_FETCH_404 Not Found - registry.npmjs.org`。

```bash
# 从 GitHub 安装（推荐，复制即用）
dsh plugin --profile demo add github:youyou709394/dsh-lesson-generator

# 启动
dsh --profile demo
```

- `add` 与 `install` 等价（`dsh plugin` 只是把参数转发给 pnpm）
- 也可以直接用本地目录：`dsh plugin --profile demo add /path/to/dsh-lesson-generator`
- 装机验证：`dsh plugin --profile demo list` 与 `dsh --profile demo --dump-config | grep lesson-generator`

## 📦 提供的工具

### `generate_lesson`（核心·一键生成课件）
- **参数**：`subject`(学科) / `grade`(年级) / `unit`(单元主题)
  - `vocab`（可选，每项 `{word, cn, emoji}`）— **给出后翻牌/连连看/大转盘/猜猜看/Quiz 全部按它自动生成**
    - ⚠️ **强烈建议每项都给 `cn`**：`cn` 是猜猜看/小Quiz 的题干来源。若只给纯字符串（如 `words:['red','blue']`）而**没有 `cn`**，猜猜看与小Quiz 会**正确地把入口隐藏掉**（不造假、不塞英语示例），但**连连看会退化成同词配对**（`red ↔ red`），练习意义很弱。
  - `content`（可选，自由文本，每行 `词|中文|emoji`、`词,中文` 或 `词：中文`）— 未给 `vocab` 时作为词表来源
  - `flip` / `connect` / `wheel` / `guess` / `quiz` / `dialog` / `readKeys`（可选）— 精确覆盖自动生成
  - **`out_path`（可选·强烈建议）** — 传入后**插件自己把生成的 HTML 写到该路径**并在结果里返回路径；模型**不要**再输出/重写 HTML（根治"拿到引擎课件却被诱导重写成另一份"的老问题）
- **返回**：完整课件 HTML（可直接保存用）+ 结构化课件数据 JSON + 摘要

## 🎓 使用示例

```
用户：小马，帮三年级做一个"Unit 3 At the Zoo"英语课件
模型：调 generate_lesson(subject='英语', grade='三年级', unit='Unit 3 At the Zoo')
      → 返回完整互动课件HTML，可保存文件或用浏览器打开
```

**任意学科**（推荐给 vocab，课件内容才贴合教材）：

```
generate_lesson(subject='语文', grade='二年级上册', unit='识字·日月明',
                vocab=[{word:'日',cn:'太阳',emoji:'☀️'},{word:'月',cn:'月亮',emoji:'🌙'},
                       {word:'明',cn:'明亮',emoji:'✨'}])
→ 翻牌出现"☀️ 日 / 🌙 月 / ✨ 明"，Quiz 出"☀️「日」的意思是？"，无英语示例残留
```

## 🛠 技术支持

- **引擎**：`lib/courseware-engine.js`（自包含，无外部依赖，纯前端可跑）
- **数据格式**：与悠悠成长中心课件一致（翻牌 flip / 连连看 connect / 转盘 wheel / 猜猜看 guess / 跟读 dialog / Quiz quiz）
- **游戏函数**：注入到课件 HTML 内，全部离线运行

## 🔧 技术细节（给开发者）

### 引号陷阱（踩坑 2026-08-19）
在 `PLAYER_JS` 反引号模板串里，内层 `h+='...'` 单引号字符串中嵌入 onclick 参数时：
- ❌ 不能用 `\'`（破坏外层字符串，导致 `Unexpected identifier`）
- ✅ 要用 `&apos;`（HTML 实体，赋给 innerHTML 后浏览器解码为单引号）

### 验证方法
```bash
node --input-type=module --check < index.js
node --input-type=module --check < lib/courseware-engine.js
# 生成后验证注入JS语法：
# 提取 <script> 内容，new Function(script) 不抛错即OK
```

## 未来规划
- [ ] TTS 语音朗读（接入 @deepseek-ai/dsh-tts-edge）
- [ ] 宠物/勋章激励体系（结合作业完成解锁）
- [ ] 班级管理 + 学生进度追踪（接入 dsh-memento）
- [ ] 多学科模板（语文/数学）
- [ ] 教师版班级管理订阅

## 更新记录
- **v0.1.7** — README 补 `cn` 提示：明确"只给纯字符串词表（无 `cn`）时，猜猜看/小Quiz 入口会隐藏、连连看会退化成同词配对"，帮你一次就传对。**无代码变更。**
- **v0.1.6** — 新增 `out_path` 参数：插件自己落盘并返回路径，结果里明确"不要重写 HTML"。根治连续 6 轮复现的产品级缺陷（`generate_lesson` 返回引擎课件后，模型被旧提示语诱导自写 HTML，用户拿到的不是测试过的引擎版本，还多烧 ~5K tokens）。
- **v0.1.5** — 参数容错：新增别名 `words`(=vocab) / `topic`(=unit)；`vocab` 现在也接受**纯字符串数组**（`["red","blue"]` 自动包装）；传入未识别参数时 `summary` 会**显式提示**（不再静默回退内置英语示例）。
- **v0.1.4** — README 补安装段（未发布 npm，必须用 `github:` 全名安装）。
- **v0.1.3** — 游戏内容随学科走（用你的 vocab 派生各游戏，不再恒取内置英语示例）。
- **v0.1.2** — 修游戏页面不可达 + 翻牌配对不可通关。
- **v0.1.0** — 首发。

## LICENSE
MIT
