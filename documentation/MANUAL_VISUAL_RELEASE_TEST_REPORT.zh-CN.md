# 手册图文与发布准备实测记录（第 9～11 步）

日期：2026-10-14 UTC。本文记录提交前的云端测试；后续 PR、CI、实际部署和线上评估结果保存于相应 PR/Actions 发布记录，不能由本文的替身测试推断。

代码起点：主项目 `be08d4b`（文字共享第 2～8 步），机器人 `f327228`。图文功能为主项目 `3457547`，样式修复 `1d09d86`，用户说明 `d93604d`；机器人图文 `f931dda`，评估/usage `5cac80b`，维护说明 `ae36c9b`。提交按目的拆分，AGENTS.md 保持忽略且不上传 GitHub。

## 范围、风险与退出条件

验证 21 章节/所有演示截图、文字/图片版本一致、目录/PNG 校验、相关操作截图选择、视觉请求格式、中文问题、调用预算、缺图/配置/模型失败回退、来源/实时工具与 PR 检查。截图来自无账户的本地生产构建，全部外部请求被拦截；没有主数据库、真实卡片、附件或私人账户写入，也没有生产压测。Pinecone 和模型仍使用替身。真实模型回答的正确性、完整步骤与引用支持度须在已部署服务另行验收。

环境：Linux `/workspace`，Node 24.19.0、Python 3.12.14；Playwright Core 1.64.0、packaged Chromium 153.0.0、Pinecone SDK 10.0.0。Netlify/Actions 指定 Node 22.17+，npm 使用 ignore-scripts，不下载另一份 Chrome driver/browser。

## 提交前结果

| 检查 | 规模 / 判据 | 结果 |
|---|---|---|
| 生产构建 + 真实浏览器捕获 | 21 章节、123 默认演示、21 概览、图库 Slideshow/下一张两个状态；逐章正文 ID、图片加载与 pageerror 检查 | 146/146 张生成，最后一轮 PNG 合计 7,383,684 bytes；不存在真实用户数据采集 |
| 浏览器视觉抽查 | 工具栏图标/关联说明、图库布局/下一张状态 | 工具栏清晰；首次发现图库样式与控件重叠，修复后重新构建与捕获；已检查修复结果 |
| 前端回归 | UserManual/ManualText/ManualSources/ChatbotWidget/Changelog 5 套件 | 14/14 通过，包含新增图库布局切换与下一张；最近一轮 6.627 秒 |
| 文字导出 | 确定版本、正文引用/覆盖/摘要、编辑影响、非法内容失败 | Node 1/1 通过 |
| 发布门槛 | 正确文字 SHA、图片清单差异、缺图拒绝、失败/重试/不可信 origin | Python unittest 5/5 通过；没有实际 dispatch |
| 机器人回归 | 旧 12 项 + 8 项视觉 + 2 项评估 | 22/22 通过，0.56 秒；PNG/catalog 篡改、跨版本、引用、SPA fallback、失败/缺配置、中文 image_url 请求、一次/两图预算、文字 eager 不调用 VLM、未知成本、来源错版检查 |
| 全包跨仓库互通 | 实际 21 章节/346 块、156 条操作记录、146 图的目录 → Python 校验 → FakeIndex 暂存/统计/逐章搜索/启用 | 通过；仅模拟启用，没有线上 Pinecone 写入 |
| 忽略、格式与源文件 | AGENTS、生成包、构建、凭据、git diff --check | 通过；截图/catalog/current.json 不进 Git |

文字包版本由 app SHA 与 bundle 摘要组成；生成图片和图片清单另以完整 SHA-256 寻址。CI 的文字身份与正式部署须相同，截图 count 须一致；机器人验证正式部署清单及图像摘要，不能把两台机器的字体差异当作新 app 内容。运行回答固定一个 pointer/图文版本。

## 首次失败与修正

- npm 默认 cache 落在沙箱不可写的 /home/agent；指定 /tmp/rwc-npm-cache 后安装完成，没有升级现有依赖来绕过问题。
- 第一次 postbuild 截图报 `chromium.executablePath is not a function`；新版本包为 ESM default export，改用 `.default`，先验证 detail-view 小样本再捕获全章节。
- 图库视觉抽查发现原样式只匹配真实 Modal，手册新增 Slideshow 状态没有套用按钮样式。扩展同一图库样式的预览作用域后复测；随后发现窄演示区的分页/排序控件重叠，调整手册该示例为独立宽预览行，重新检查截图。
- 首次视觉 selection 测试假定文字 fixture 有演示而抛 StopIteration；该缩小 fixture 的 examples 本来为空。仅在视觉测试中显式构造 synthetic gallery 元数据，完整 app 的真实 146 图另行验证；没有伪称 fixture 是真实语义检索评估。
- 一次互通命令使用系统 Python，缺少 requests；改用既有 venv 后通过。这不是运行服务依赖缺失。
- 云端直接访问正式 Netlify marker 和 Render health 均被 CONNECT 403 拒绝。环境 allowlist 没有这些 host；服务状态由连接器检查，直接线上请求需在允许这些 origin 的环境或提供的 Actions 评估执行。
- 云端 SDK 的直接 Pinecone 连接失败；显式使用会话 proxy/CA 后仍有 credential Unauthorized 结果。未更换、打印凭据或写入索引；线上同步应核对 Actions 的独立 secret 与实际运行服务配置。

## 评估与尚未完成的线上判据

新增 11 场景：T01–T04 文字/中文/多步骤，V01–V04 工具栏/布局/中文图标/Slideshow，U01 手册不支持的计划导出，L01–L02 公开数据/实时数量。测试模型请求使用真实 PNG 编码合约替身；没有依据替身模型声称真实回答准确。

真实 `/chat/ask` 响应增加机器字段 metrics：总延迟、每轮文本 usage、视觉 status/版本/图像 ID/usage。`evaluate_manual.py` 顺序请求，输出小样本 p50/p95/p99、来源与版本检查、完整回答、人工复核 pending。只有明确传入供应商价格且每次 usage 完整才计算模型 token 成本；缺少则 null，且不包含 Pinecone、托管等费用。应在同一手册与服务先保存文字基线，再比较视觉用例。当前报告没有真实生产延迟/成本/容量/正确率结论。

用户已告知 Render 视觉配置添加完毕。合并后的验证仍须确认 health 的部署 SHA/protocol/configuration，实际 V01–V04 成功调用视觉模型，来源与图片同版；“环境变量已添加”不能替代真实调用成功。首个 active manual 未准备好时，新服务会明确说明知识不可用，不读取旧 docs。

## 重跑与证据

```bash
# App root
python -m unittest discover -s scripts -p 'test_notify_manual_release.py'
# client
node --test scripts/export-manual.test.cjs
CI=true npm test -- --watchAll=false --runInBand --runTestsByPath src/UserManual.test.js src/manual/ManualText.test.js src/manual/ManualSources.test.js src/ChatbotWidget.sources.test.js src/Changelog.test.js
COMMIT_REF=$(git rev-parse HEAD) CI=false npm run build
# chatbot
python -m pytest -q tests
python scripts/evaluate_manual.py --base-url https://rwc-living-atlas-chatbot.onrender.com --ids T01,T03,V01 --expected-version <published-version> --output /tmp/manual-evaluation.json --require-vision
```

云端日志：`/tmp/rwc-visual-build-first.log`、`/tmp/rwc-capture-full-first.log`、`/tmp/rwc-visual-layout-build.log`、`/tmp/rwc-manual-visual-final-build.log`；回归 `/tmp/rwc-visual-guidance-tests.log`、`/tmp/rwc-vision-bot-tests-first.log`、`/tmp/rwc-visual-eval-tests.log`。这些日志和 generated 包是临时证据，未提交。PR 的 screenshot artifact 提供可下载的构建证据；实际发布按 PR/Actions 中记录的最终 SHA 验收。
