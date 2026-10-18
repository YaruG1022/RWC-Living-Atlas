# 手册与机器人共享知识：第 2～11 步

功能说明以 app 的 User Manual 为权威来源。当前页面读取 `LivingAtlas1-main/client/src/manual/sections/*.json`；机器人导入的内容包也直接从这些 JSON 生成。维护一次正文，即更新页面和待发布的机器人知识，不再人工重写 `chatbot/docs/*.md`。实时卡片与 ArcGIS 库存仍由实时工具查询。

## 日常维护

1. 在 `src/manual/sections/<chapter-id>.json` 修改对应正文、列表、说明或图片元数据。保持章节和 block ID 稳定。需要每个操作都保留的前提/警告，可用章节的 `contextBlockIds` 引用既有正文块；不要再复制一段文字。
2. 布局、样式及演示仍在 `UserManual.js`；通过 `ManualText` 引用章节/block ID。若新增正文块，同时在页面引用它；不要在 JSX 重新写一份相同正文。新增章节需更新 `index.json`、`catalog.js` 和页面渲染分支。
3. JSON 的 `heading` / `paragraph` / `list` / `note` 块支持文字、强调、链接、键盘提示和章节跳转。列表使用 `ordered` 保留顺序，`stepIds` 保留步骤身份，`feature-title` 标注操作边界。`examples` 标识 React 演示位置，`images` 记录已有示例图片与说明。构建后 Playwright 逐章节捕获实际页面与演示，图库另捕获 Slideshow 和下一张状态；静态示例中的已展开菜单仍按其实际渲染状态保存。
4. 内容版本在导出时从章节 JSON 计算；发布版本由完整 Git SHA 和内容包校验和前缀组成。同一 SHA 的文字包重复构建结果一致。截图可能受浏览器/字体环境影响，因此图片与截图清单另用完整 SHA-256 寻址；不得用未校验的图片替换同一 URL。格式检查拒绝重复 ID、缺失正文、危险链接、不存在的章节，以及未在布局引用的正文或演示。
5. 运行相关回归及构建。内容包只允许目录清单里的手册章节，不包含项目报告、会议记录、demo 数字或 AGENTS.md。

```bash
cd LivingAtlas1-main/client
node --test scripts/export-manual.test.cjs
CI=true npm test -- --watchAll=false --runInBand --runTestsByPath src/UserManual.test.js src/manual/ManualText.test.js src/manual/ManualSources.test.js src/ChatbotWidget.sources.test.js src/Changelog.test.js
COMMIT_REF=$(git rev-parse HEAD) CI=false npm run build
```

文字包生成在 `public/manual/`，完整的图文发布包生成在 `build/manual/`。两者和 `build/` 已被 Git 忽略。不要手工修改或提交生成包；应用构建会重新生成。开发机可以运行 `npm run manual:export`，云端沙箱若限制 Node 子进程则使用上面的显式 COMMIT_REF。

## 发布与同步

应用的 GitHub 工作流先验证内容、测试并构建，然后等待正式 app 的 `/manual/current.json` 的 Git SHA、文字清单、checksum 和截图数量与本次构建一致。图片清单校验实际部署生成的摘要，避免第二次渲染的像素差异误阻发布。失败或取消的 Netlify 部署不能触发导入。静态内容包由 Netlify 正常文件服务提供；保留原有 SPA fallback，current marker 禁止缓存，版本路径可长期缓存。

手册版本包含整个仓库的提交 SHA，因此仅修改文档、后端或维护脚本的 main 提交也需要新的生产构建。根目录和 client 目录的两个 `netlify.toml` 都在 `[context.production]` 设置 `ignore = "exit 1"`，覆盖 Netlify 只检查前端 base 目录的默认跳过逻辑。在 Netlify 的 ignore hook 中，退出码 1 表示继续构建，0 才表示跳过；Deploy Preview 保留默认优化。生产环境会因此为每个 main 提交构建。验证超时、站点不可达、无效 JSON 或旧 marker 仍必须以非零状态失败，不能仅打印警告并返回成功；`--verify-only` 同样如此。旧工作流被新 main 提交取代时由现有 concurrency 配置取消。

配置 dispatch 凭据时，部署完成后发送 `atlas-manual-published`，只含 commit、version、checksum。没有跨仓库 token 时仍检查发布门槛；机器人每 15 分钟的串行同步计划提供独立补偿，同时在其 main 更新后同步。计划任务可能被 GitHub 延迟，没有 15 分钟时效保证。机器人只访问它自身配置的 app origin，不接受事件载荷指定的主机。机器人校验 current marker、版本 manifest、文件校验和、章节/正文数量、页面可访问性及正文和富文本的一致性；新记录写入独立命名空间（当前抽取格式为 v2，仍接受 v1 的既有 pointer；格式升级也会重建同一个 app 版本），再验证每条记录、准确数量和逐章检索。启用前再次检查 app marker；切换一个持久化控制记录后，运行中的服务在后续请求读取新版本。每次回答的所有检索绑定同一版本。

| 配置位置 | 名称 | 值 / 用途 |
|---|---|---|
| 主项目 Actions variable，可选 | `ATLAS_MANUAL_BASE_URL` | 正式 app HTTPS origin，不含路径；默认 https://rwc-living-atlas.netlify.app |
| 主项目 Actions variable，可选 | `CHATBOT_REPO` | 机器人仓库 `owner/repo`；默认 YaruG1022/RWC-Living-Atlas-Chatbot |
| 主项目 Actions secret，可选 | `CHATBOT_DISPATCH_TOKEN` | 仅目标仓库 Contents write 的快速 dispatch 凭据；未配置时通过计划任务同步 |
| 机器人 Actions variable，可选 | `MANUAL_BASE_URL` | 同一个正式 app origin；默认 https://rwc-living-atlas.netlify.app |
| 机器人 Actions secret | `PINECONE_API_KEY` | 索引凭据 |
| 机器人 Actions variable 与运行服务 | `PINECONE_INDEX` / `PINECONE_INDEX_HOST` | 同一个 integrated-embedding 索引，text 映射到 content |
| 前端 Netlify build 环境 | `REACT_APP_CHATBOT_API_URL` | 独立机器人服务 origin |
| 机器人运行环境 | `PINECONE_API_KEY`, `DEEPSEEK_API`, `ALLOWED_ORIGINS` | 服务凭据与允许的 app origin |
| 机器人运行环境，可选 | `ATLAS_API_URL` | 实时公开卡片和 summary 数据来源 |

缺少 Pinecone 凭据等必要配置会明确失败，不假装同步成功。首次上线应先发布 app 内容包、导入并启用其手册版本，再让前端使用新版机器人。当前主项目 backend 不包含 `/chat/ask`；前端应明确指向独立服务，或由部署配置提供显式代理。

## 重试与恢复

- 上传或验证失败时保留原 active pointer 与旧命名空间。重试使用确定的 ID 重写同一个暂存版本；已启用的同版本直接跳过写入。
- 主项目工作流取消旧等待，机器人写入工作流串行且不取消。所有启用与回滚操作应使用同一写入队列，避免两个操作员并发切换。
- 旧的 `atlas-docs-changed` 事件仅记录为退役事件，不再打开人工漂移工单或重建旧索引；改动旧 `docs/` 不再触发索引。
- 机器人请求暂时读不到控制记录时，可沿用该进程最后读取的有效版本；新启动且尚无有效手册时会说明知识不可用，不读取旧文档。
- 回滚在机器人仓库运行 `python scripts/index_docs.py --rollback <version>`，验证保留的版本清单与搜索后显式切换。应与对应 app 版本协调；没有自动删除或垃圾清理。
- Indexer 的 `--bundle-dir` 只可暂存/验证本地生成包，不能直接启用未发布的手册。生产启用必须读取已发布的 origin，并可用 `--revision` 指定完整 SHA。

回答继续保留 `answer`，新增 `sources`。章节地址由实际检索记录的章节编号生成，带版本与正文/步骤 ID；网页显示成 User Manual 链接。返回的来源可用于查看实际检索的说明，不能机械证明模型每句话都正确；上线验收仍需检查真实问题、语言、步骤完整性与引用支持度。

## 图文理解与预算

- 完整发布目录含 `manual.json`、`manifest.json`、content-addressed `visuals/<sha256>.json` 与 `images/<sha256>.png`。清单记录章节、block/step/example ID、界面状态、app SHA/版本、字节数、尺寸和校验和，以及真实渲染的 button/select 标签、SVG 图标名和相对坐标；不采集 input 值。导入验证逐章/逐示例覆盖；聊天下载选中 PNG 后再次校验大小、摘要与尺寸，拒绝 SPA fallback 和重定向。
- 构建使用固定的 Playwright Core / Chromium npm 包，无浏览器外部下载；需要 Node 22.17+。捕获只打开本地构建、拦截外部请求、使用空账户状态；没有抓取真实卡片或私人账户。21 章节当前生成 146 张图，约 7.3 MB；generated 图不进 Git。
- 文本问题继续 DeepSeek 路径。明确的英文/中文图标、布局或控件位置问题强制首轮选择视觉工具，防止模型仅从文字直接回答；其他表述继续由模型选择工具。模型仅在视觉问题调用 `inspect_manual_visuals`；先检索对应文字，再给单独的 OpenAI 兼容视觉接口。截图按相关操作块、图片 ID 和手册 feature caption 与英文 query 的匹配选择；不因另一个章节先返回就优先取它的图，不用无关 overview 补足两图。保留 first-pass 和精化查询的正文。请求固定手册版本，每个问题最多一次视觉调用、两张图片，图片各不超过 2 MB。主模型不支持 tools 时的 eager fallback 不调用视觉服务。
- 图像、配置或提供商不可用时返回同章节文字与来源，并要求回答明确无法核实图像细节。截图只证明手册示例，不是当前公开数据。

在 **Render 的 RWC-Living-Atlas-Chatbot** 配置，密钥不放前端、Git 或聊天：

| 环境变量 | 用途 |
|---|---|
| `VISION_API_KEY` | 视觉供应商凭据，与 DeepSeek 凭据独立 |
| `VISION_MODEL` | 支持 image_url 输入的模型；例如 gpt-4.1-mini |
| `VISION_BASE_URL` | OpenAI 兼容 API base；默认 https://api.openai.com/v1 |

先验收已发布文字包与 active pointer，再启用视觉配置并执行实际视觉问题；图文服务失败仍保留文字能力。`/health` 返回协议、Render Git SHA 与视觉是否已配置；“已配置”不等于供应商调用成功。

## 评估与发布复核

机器人有 11 个发布评估场景，覆盖文字/中文/多步骤/图标与布局/手册未覆盖问题/实时查询。`Evaluate published manual answers` 为手动 Actions 工作流，手动运行默认 T01,T03,V01；服务 main 发布/操作员同步后也会执行全部 11 场景并要求实际视觉证据，定时同步不生成评估请求。每次都是真实模型调用，顺序执行，不做负载测试。artifact 保留回答、来源、版本、模型 usage、p50/p95/p99 和待人工复核项；结构检查也验证各视觉案例所需的具体截图与章节；仍不能替代正确性和引用支持度审查。

```bash
python scripts/evaluate_manual.py --base-url https://rwc-living-atlas-chatbot.onrender.com --ids T01,T03,V01 --expected-version <published-version> --output /tmp/manual-evaluation.json
# 视觉上线后追加 --require-vision；可按实际供应商报价提供 token price 参数。
```

`metrics` 是回答 API 的附加机器字段，网页仍仅显示答案与来源。价格/usage 缺失时成本为 null；估计不包含 Pinecone、托管或供应商额外费用。应在同一服务、同一手册版本保存文字基线，再比较视觉用例；小样本延迟不代表生产容量。

PR 检查使用真实浏览器生成完整包与 screenshot artifact；机器人 PR 只跑替身回归，不写索引。两个仓库分别 PR 合并到 main，保留逻辑提交。核对 Netlify/Render 实際部署 SHA，app marker/manifest/image checksum，以及新机器人来源和 live tools。API 服务健康不证明手册已激活。若已发布 app 需要修正，以 Git revert/修复提交重新发布；新索引失败继续原 active pointer。旧 docs 保留为历史材料，当前代码不会读取它们。

历史文字迁移实测见 [第 2～8 步报告](MANUAL_KNOWLEDGE_TEST_REPORT.zh-CN.md)，本轮图文与发布证据见 [第 9～11 步报告](MANUAL_VISUAL_RELEASE_TEST_REPORT.zh-CN.md)。线上状态与未覆盖项以发布报告记录为准。
