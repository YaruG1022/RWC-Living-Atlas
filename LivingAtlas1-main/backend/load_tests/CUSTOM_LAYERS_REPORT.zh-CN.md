# Custom Layers 保存并发回归

任务日期：2026-10-25。起点：`77268b9`，分支 `codex/local-image-upload-preview`。
范围为本地保存、列表、GeoJSON、文件夹、排序、删除及错误恢复；验证正确性，不作生产容量结论。

## 首次失败与修复

修复前，本机连续单独保存 3/3 成功。并发数 4，执行 5 组“保存、保存、读取图层、读取文件夹”：20 次请求中 12 次返回 500，其中 10 次保存有 6 次失败。错误为 `no results to fetch` 和 `'NoneType' object is not subscriptable`。

这些路由共用模块级连接/游标，每次请求执行 DDL 并提交事务，导致结果和事务互相干扰。本次全部 10 个 Custom Layers / Custom Folders 路由改用请求独立的池连接和游标；建表、补列移至启动迁移。失败时回滚并归还连接。前端提供具体保存错误、加载失败提示和 Retry，不再将加载失败显示为空列表；保存超时提醒先检查是否已保存。

## 环境与结果

YG1022，Windows、Python 3.12、PostgreSQL `127.0.0.1:5433/livingatlas_test`、`LOCAL_TEST_MODE=1`。隔离配置和真实 `/allCards` 查询均通过，未记录凭据。单 worker 使用应用端口 8000、默认池大小 1；双 worker 使用临时端口 8012、每 worker 池大小 2。临时服务测试后关闭，正常应用继续运行。

每轮 42 个正常请求及 400/404 各 1 个预期拒绝，并发数最高 4。覆盖原先失败的 20 请求场景、重复保存、8 个不同图层、GeoJSON/层级排序保留、文件夹改名/删除、回到 Root、图层删除及错误后的继续读取。

| 场景 | 正常请求 | 意外错误 | p50 / p95 / p99 / max |
| --- | --- | --- | --- |
| 单 worker | 42/42 | 0 | 12.1 / 31.2 / 48.0 / 48.0 ms |
| 双 worker、池大小 2 | 42/42 | 0 | 15.8 / 44.8 / 48.4 / 48.4 ms |

两轮原并发场景均为 20/20 成功。API 与数据库均确认 9 个不同 service key 对应 9 行，重复保存不新增行。各轮测试使用唯一邮箱；最终测试图层、文件夹、临时 schema 均为 0 残留。旧版缺少 `sort_order/layer_order/geojson` 的表补列后可重复迁移，原标签、GeoJSON、排序保持不变。

- 前端全量：23 suites / 152 tests 通过；最终区分读取/保存超时提示后，本机和工作区相关 6 项再次通过。
- 本机后端离线：45 tests 通过，新增 6 项 HTTP 合约涵盖请求无 DDL、独立游标、提交/回滚/归还、503 和 404。
- 生产构建通过，存在原有 lint、CSS 压缩及 bundle 大小警告。

测试启动曾遇到旧 Starlette TestClient 与 httpx 的兼容问题，新增测试已使用 AsyncClient + ASGITransport；应用依赖版本不变。最终本机测试覆盖 FastAPI 0.95.0 / Starlette 0.26.1。

## 命令与证据

在 backend 目录，针对已启动的隔离本地后端执行：

```powershell
& .\.venv-local\Scripts\python.exe -u scripts\check_custom_layer_workflow.py
& .\.venv-local\Scripts\python.exe -m unittest -v tests.test_custom_layers
```

双 worker 在单独端口启动，设置 `DB_REQUEST_POOL_SIZE=2`；运行脚本时设置 `TEST_API_BASE=http://127.0.0.1:8012`。脚本拒绝非本地目标/非测试数据库，并在 finally 中按唯一邮箱清理数据。

原始证据在 YG1022 的 `C:\Users\yarug\Documents\LivingAtlas-Dev\logs\`：`probe-custom-layer-save.log`（修复前）、`custom-layer-integration.log`、`custom-layer-two-worker-integration.log`、`custom-layer-backend-tests.log`、`custom-layer-client-tests.log`。工作区日志：`/tmp/custom-layer-all-client-tests.log`、`/tmp/custom-layer-final-build.log`。

退出条件已满足：原失败用例通过、数据一致、无残留、相邻回归通过。未测 CPU/内存容量或生产环境，未联系外部 ArcGIS，也未执行浏览器视觉验收。其他仍使用模块级数据库对象的旧路由不在本轮范围内。

## ZIP 上传与当前文件夹回归（2026-11-25）

实现提交（commit）为 `a8034fe`，测试提交为 `62f5541`。本轮覆盖顶层和嵌套 ZIP 上传、当前文件夹下的手动创建、同名导入与重试（retry）、部分保存及首次保存失败时的事务回滚（transaction rollback）。

测试使用 Windows、Node.js 24.22.3、Python 3.12.12 和 PostgreSQL 17.6。后端通过隔离测试库（isolated test database）验证了真实的 `/allCards` 查询。数据库地址为 `127.0.0.1:5433/livingatlas_test`，`LOCAL_TEST_MODE=1`。应用程序接口（application programming interface, API）位于 `127.0.0.1:8012`，单进程连接池（connection pool）大小为 4，最高并发数为 4。前端组件测试（component tests）使用接口和地图替身（test doubles），后端转换测试使用合成文件。

| 检查 | 结果 |
| --- | --- |
| 图层面板和上传前端测试 | 3 套件，16 项通过 |
| 更新记录和手册前端测试 | 2 套件，9 项通过 |
| 前端完整回归 | 44 套件，304 项通过 |
| 后端合约与 ZIP 转换 | 19 项通过 |
| 本地 API 和数据库 | 50/50 正常请求通过，另有 3 次预期的错误响应（400、404、500 各 1 次） |
| 本地请求延迟（request latency） | p50 / p95 / p99 分别为 26.1 / 117.1 / 125.0 毫秒 |
| 前端生产构建（production build） | 编译成功，输出既有的检查和资源体积警告 |

同名并发请求创建独立文件夹，同一保存请求重试沿用原文件夹。第二个图层保存到对应 ZIP 的文件夹。故意触发首次保存失败后，测试确认没有生成空文件夹。数据库核对与清理完成后，测试图层、文件夹和临时模式（temporary schema）残留均为 0。

首次从受限执行环境启动测试服务时，本地数据库连接超时。改用获准的本地进程后完成验证。测量数据仅覆盖本地功能样本，生产环境和浏览器端到端流程（end-to-end flow）未参与本轮测试。

在 `client` 目录运行前端测试和构建：

```powershell
node node_modules/react-scripts/bin/react-scripts.js test --transformIgnorePatterns 'node_modules/(?!axios)/' --watchAll=false --runInBand CustomLayersPanel.test.js CustomLayersPanel.upload.test.js customLayerUpload.test.js Changelog.test.js UserManual.test.js
node node_modules/react-scripts/bin/react-scripts.js test --transformIgnorePatterns 'node_modules/(?!axios)/' --watchAll=false --runInBand --silent
node node_modules/react-scripts/bin/react-scripts.js build
```

在 `backend` 目录运行后端测试。服务启动时设置 `DB_REQUEST_POOL_SIZE=4` 并绑定本地端口 `8012`：

```powershell
& .\.venv-local\Scripts\python.exe -m unittest -v tests.test_custom_layers tests.test_gis_import
$env:TEST_API_BASE='http://127.0.0.1:8012'
& .\.venv-local\Scripts\python.exe -u scripts\check_custom_layer_workflow.py
```
