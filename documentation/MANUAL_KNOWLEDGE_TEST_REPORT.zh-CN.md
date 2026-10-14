# 手册共享知识第 2～8 步实测记录

日期：2026-10-14（America/Los_Angeles）。主项目产品代码基线 `6e3ddde60cf8e7b514b99bfb11453d76fea4e969`；机器人产品代码 `9790889`，同步工作流 `02509b1`。第一步成果另存为 `bb2fdcd` 与 `3a33e59`。本报告中的后续文档提交不改变受测产品行为。

## 范围与判据

验证统一章节格式、React 页面迁移、内容导出、版本索引、来源 API/展示与发布后同步。优先风险是正文丢失、demo 内容进入索引、旧知识覆盖新手册、索引更新造成知识空窗、跨版本混用，以及未发布版本被启用。进入完成状态要求：当前章节可访问、正文和演示迁移一致、导出可重现且校验和正确、失败不清空旧命名空间、来源指向实际检索章节、同步受 app 发布版本约束。

仅执行云端工作区的静态/组件/合约/故障回归。没有启动主项目数据库或写入用户、卡片、附件；数据库隔离与负载场景不属于本次变更，不运行生产压测。Pinecone、模型、ArcGIS 和 live card 外部服务使用替身；没有执行线上索引切换、部署、合并或远端推送。第 9 步图文理解与第 10 步真实模型评估尚未开始。

环境：Linux `/workspace`，Node v24.19.0、Python 3.12.14、Pinecone SDK 10.0.0；前端使用现有 package-lock 安装，Python 依赖安装于 `/tmp/rwc-chatbot-venv`。调用参数按 Pinecone integrated records / fetch / search 官方文档核对。没有记录或打印真实凭据。

## 结果

| 检查 | 规模 / 判据 | 结果 |
|---|---|---|
| 创建卡片试点 | 单章节切换到 JSON 后立即执行手册导航与图库测试 | 原 6 项通过，再迁移其他章节 |
| 全章节迁移对比 | 21 个 URL；与迁移前组件比较归一化正文、图片 src/alt 和按钮数量 | 21/21 通过。基线取第一步结束的 UserManual；临时对比组件/测试运行后删除，未提交第二份正文 |
| 当前前端回归 | UserManual、ManualText、ManualSources、ChatbotWidget sources、Changelog 共 5 套件 | 13/13 通过；6.025 秒。覆盖导航、直达/回退、改单处正文同时改变渲染和实际导出包、来源链接过滤、聊天 API 来源展示/历史字段和旧更新历史保留 |
| 导出验证 | 相同 SHA 重复导出、checksum、章节/块清单、单处编辑改变版本、无 sample card 数字、缺失正文失败 | 1 项 Node 测试通过。导出器额外校验 JSX 引用与 JSON 清单一一对应，包括演示编号 |
| 机器人回归 | 包校验、语义操作分块、partial failure、逐章不可检索、幂等、stale deployment、rollback、请求绑定版本、真实来源、API、legacy 拒用、live 工具、SPA fallback | 12/12 通过；0.80 秒。FastAPI TestClient 真正经过 ASGI 请求，但模型、数据库和索引均为替身 |
| 发布门槛 | 旧 marker 等待、正确 marker 放行、失败禁止 dispatch、网络重试及 origin 拒绝 | 4/4 通过；使用替身，没有发送实际 repository_dispatch |
| 两仓库内容包互通 | 当前实际 app 导出完整包 → Python 校验 → FakeIndex 写入/统计/21 章节检索/启用/检索来源 | 21 章节、346 块、156 记录全部通过；最大记录 1456 字符，包 195355 bytes。模拟 legacy namespace 保持不变；并非线上激活 |
| 前端生产构建 | 含 prebuild 导出与资源构建 | 成功；保留项目已有 lint/CSS calc/cqw、bundle 大小警告 |
| 提交与忽略检查 | git diff --check、生成文件、AGENTS、私密文件 | 通过。AGENTS.md 只在云工作区、被忽略且不在任一提交中；public/manual 与 build 不提交 |

完整互通所用版本：`6e3ddde60cf8e7b514b99bfb11453d76fea4e969-0ff3627c71c7`。内容包 SHA-256 在对应生成 manifest 中记录；部署时由构建根据最终部署 SHA 重新生成，不复用本机生成包。

## 首次失败与修正

- Node 的导出入口首次通过子进程读取 Git SHA 时受到沙箱 EPERM 限制；使用显式 `COMMIT_REF` 后导出成功。Netlify 的 COMMIT_REF 与 Actions 的 GITHUB_SHA 都受支持，没有用假版本绕过验证。
- 缩小的跨仓库 fixture 最初包含指向未收录章节的引用，校验器按预期拒绝；改为真实导出器生成的两个代表性章节/16 块 fixture 后通过。fixture 仅在 tests 下，不是运行知识来源。
- jsdom 没有 scrollIntoView，首次聊天组件测试在 spy 时失败；仅给测试补该浏览器方法，再复测通过。
- 沙箱默认限制使 TestClient 的本地 event-loop socket 等待，8 秒 thread dump 定位在 AnyIO portal，22 秒诊断超时后终止测试进程。允许该测试的本地网络后正常完成；外部服务仍被 mock。初次运行另有两项断言失败：FakeIndex 按插入顺序返回 chatbot 片段，而用例询问创建卡片；改用确定的检索替身匹配章节后通过。未将其当作真实语义检索质量证据。
- 二次源码复核发现第一步新增的 ArcGIS 本地目录回退说法不准确；修正 shared chapter 为当前 backend 不可用/空目录行为，并修正 picker 中同类旧说明。当前 UserManual 的新工具、多点、多图片、公共底图与 StreamStats 内容保留；旧 chatbot 文件未反向覆盖这些内容。
- 操作中曾在仓库根目录执行前端构建而收到 Missing script: build，并有少量相对路径命令定位错误；改在 `LivingAtlas1-main/client` 执行后通过，无产品改动用来掩盖这些命令错误。

## 重跑命令与证据

主项目根目录：

```bash
python -m unittest discover -s scripts -p 'test_notify_manual_release.py'
```

前端目录 `LivingAtlas1-main/client`：

```bash
node --test scripts/export-manual.test.cjs
CI=true npm test -- --watchAll=false --runInBand --runTestsByPath src/UserManual.test.js src/manual/ManualText.test.js src/manual/ManualSources.test.js src/ChatbotWidget.sources.test.js src/Changelog.test.js
COMMIT_REF=$(git rev-parse HEAD) CI=false npm run build
```

机器人仓库：

```bash
python -m pytest -q tests
```

本轮云环境原始日志：`/tmp/rwc-manual-front-tests.log`、`/tmp/rwc-shared-manual-build.log`、`/tmp/rwc-chatbot-tests.log`；初次 ASGI 诊断为 `/tmp/rwc-chat-contract-diagnostics.log`。这些是临时执行证据，未提交仓库。迁移对比和完整互通结果另见本会话工具输出。

## 限制与启用条件

代码实现到第 8 步；线上启用仍须发布两个仓库并配置 [维护说明](MANUAL_KNOWLEDGE_PIPELINE.zh-CN.md) 中的 origin、dispatch、Pinecone 和前端服务地址。当前测试未验证真实 GitHub token scope、Netlify 发布、Render 进程读取控制记录、Pinecone eventual consistency 时长或提供商可用性。没有生产 p50/p95/p99、吞吐、成本或模型正确率数值，因此不宣称线上容量或回答质量已达标。

来源由检索记录生成且可打开到对应章节；它不能自动判断模型是否正确解释了每一步。后续上线验收应验证真实问题（含中文）、引用支持度、资料版本、没有依据时的行为，以及实际部署回滚。图文截图和视觉模型不在本轮。
