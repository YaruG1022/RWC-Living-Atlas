# 手册与机器人共享知识：第 2～8 步

功能说明以 app 的 User Manual 为权威来源。当前页面读取 `LivingAtlas1-main/client/src/manual/sections/*.json`；机器人导入的内容包也直接从这些 JSON 生成。维护一次正文，即更新页面和待发布的机器人知识，不再人工重写 `chatbot/docs/*.md`。实时卡片与 ArcGIS 库存仍由实时工具查询。

## 日常维护

1. 在 `src/manual/sections/<chapter-id>.json` 修改对应正文、列表、说明或图片元数据。保持章节和 block ID 稳定。
2. 布局、样式及演示仍在 `UserManual.js`；通过 `ManualText` 引用章节/block ID。若新增正文块，同时在页面引用它；不要在 JSX 重新写一份相同正文。新增章节需更新 `index.json`、`catalog.js` 和页面渲染分支。
3. JSON 的 `heading` / `paragraph` / `list` / `note` 块支持文字、强调、链接、键盘提示和章节跳转。列表使用 `ordered` 保留顺序，`stepIds` 保留步骤身份，`feature-title` 标注操作边界。截图尚未生成，现有 `examples` 标识保留 React 演示位置，`images` 记录已有示例图片与说明。
4. 内容版本在导出时从章节 JSON 计算；发布版本由完整 Git SHA 和内容包校验和前缀组成。同一版本重复构建结果一致。格式检查拒绝重复 ID、缺失正文、危险链接、不存在的章节，以及未在布局引用的正文或演示。
5. 运行相关回归及构建。内容包只允许目录清单里的手册章节，不包含项目报告、会议记录、demo 数字或 AGENTS.md。

```bash
cd LivingAtlas1-main/client
node --test scripts/export-manual.test.cjs
CI=true npm test -- --watchAll=false --runInBand --runTestsByPath src/UserManual.test.js src/manual/ManualText.test.js src/manual/ManualSources.test.js src/ChatbotWidget.sources.test.js src/Changelog.test.js
COMMIT_REF=$(git rev-parse HEAD) CI=false npm run build
```

生成的 `public/manual/` 和 `build/` 已被 Git 忽略。不要手工修改或提交生成包；应用构建会重新生成。开发机可以运行 `npm run manual:export`，云端沙箱若限制 Node 子进程则使用上面的显式 COMMIT_REF。

## 发布与同步

应用的 GitHub 工作流先验证内容、测试并构建，然后等待正式 app 的 `/manual/current.json` 与本次构建的 manifest 完全一致。失败或取消的 Netlify 部署不能触发导入。静态内容包由 Netlify 正常文件服务提供；保留原有 SPA fallback，current marker 禁止缓存，版本路径可长期缓存。

部署完成后发送 `atlas-manual-published`，只含 commit、version、checksum。机器人只访问它自身配置的 app origin，不接受事件载荷指定的主机。机器人校验 current marker、版本 manifest、文件校验和、章节/正文数量、页面可访问性及正文和富文本的一致性；新记录写入独立命名空间，再验证每条记录、准确数量和逐章检索。启用前再次检查 app marker；切换一个持久化控制记录后，运行中的服务在后续请求读取新版本。每次回答的所有检索绑定同一版本。

| 配置位置 | 名称 | 值 / 用途 |
|---|---|---|
| 主项目 Actions variable | `ATLAS_MANUAL_BASE_URL` | 正式 app HTTPS origin，不含路径 |
| 主项目 Actions variable | `CHATBOT_REPO` | 机器人仓库 `owner/repo` |
| 主项目 Actions secret | `CHATBOT_DISPATCH_TOKEN` | 仅目标仓库 Contents write 的 dispatch 凭据 |
| 机器人 Actions variable | `MANUAL_BASE_URL` | 同一个正式 app origin |
| 机器人 Actions secret | `PINECONE_API_KEY` | 索引凭据 |
| 机器人 Actions variable 与运行服务 | `PINECONE_INDEX` / `PINECONE_INDEX_HOST` | 同一个 integrated-embedding 索引，text 映射到 content |
| 前端 Netlify build 环境 | `REACT_APP_CHATBOT_API_URL` | 独立机器人服务 origin |
| 机器人运行环境 | `PINECONE_API_KEY`, `DEEPSEEK_API`, `ALLOWED_ORIGINS` | 服务凭据与允许的 app origin |
| 机器人运行环境，可选 | `ATLAS_API_URL` | 实时公开卡片和 summary 数据来源 |

缺少配置会明确失败，不假装同步成功。首次上线应先发布 app 内容包、导入并启用其手册版本，再让前端使用新版机器人。当前主项目 backend 不包含 `/chat/ask`；前端应明确指向独立服务，或由部署配置提供显式代理。

## 重试与恢复

- 上传或验证失败时保留原 active pointer 与旧命名空间。重试使用确定的 ID 重写同一个暂存版本；已启用的同版本直接跳过写入。
- 主项目工作流取消旧等待，机器人写入工作流串行且不取消。所有启用与回滚操作应使用同一写入队列，避免两个操作员并发切换。
- 旧的 `atlas-docs-changed` 事件仅记录为退役事件，不再打开人工漂移工单或重建旧索引；改动旧 `docs/` 不再触发索引。
- 机器人请求暂时读不到控制记录时，可沿用该进程最后读取的有效版本；新启动且尚无有效手册时会说明知识不可用，不读取旧文档。
- 回滚在机器人仓库运行 `python scripts/index_docs.py --rollback <version>`，验证保留的版本清单与搜索后显式切换。应与对应 app 版本协调；没有自动删除或垃圾清理。
- Indexer 的 `--bundle-dir` 只可暂存/验证本地生成包，不能直接启用未发布的手册。生产启用必须读取已发布的 origin，并可用 `--revision` 指定完整 SHA。

回答继续保留 `answer`，新增 `sources`。章节地址由实际检索记录的章节编号生成，带版本与正文/步骤 ID；网页显示成 User Manual 链接。返回的来源可用于查看实际检索的说明，不能机械证明模型每句话都正确；上线验收仍需检查真实问题、语言、步骤完整性与引用支持度。

## 本轮范围

第 2～8 步的实现及离线回归见 [测试报告](MANUAL_KNOWLEDGE_TEST_REPORT.zh-CN.md)。本轮未部署、未将代码推送至远端，也未启用线上 Pinecone 版本。没有开始第 9 步的截图捕获、图文模型调用或用户截图能力。
