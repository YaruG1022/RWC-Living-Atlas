# 公开卡片关联图层共享验证

任务日期：2026-10-25；起点：`81580bc`，分支 `codex/local-image-upload-preview`。

原实现不完整：ArcGIS 恢复查询没有排除私有卡片；自定义图层依赖查看者的个人库，其他账号和访客无法读取上传的 GeoJSON；查看者勾选还会修改卡片的发布状态。

修改后，公开卡片启用的关联 ArcGIS / Custom Layers 可供其他用户及访客查看。创建者/管理员修改卡片的默认显示状态，其他查看者只切换自己的地图。个人库批量切换仅更新自己卡片的关联；个人 ArcGIS Pin 不会自动发布关联。GeoJSON 按关联资产 ID 读取，避免不同账号的同名图层混用；公开属性弹窗按文本转义。

关联接口改用每请求连接和游标，建表检查移至启动。新增资产外键，历史数据优先匹配卡片创建者的库，或全库唯一来源。来源有歧义时不猜测，需创建者重新关联。删除资产后的空引用不会在重启时绑定到同名新上传。权限判断沿用现有应用的账号邮箱约定，本轮未引入新的认证协议。

## 验证结果

- 云工作区前端完整回归：28 suites / 193 tests 通过；生产构建通过。保留现有 lint / CSS / bundle 警告，以及 Card 的发布权限 Hook 依赖提示。
- 本机前端关联回归：`Card.gallery`、`sharedCardLayers`、`arcgisPopupUtils` 共 40 tests 通过；前端 HTTP 返回 200。
- 本机后端离线回归：53 tests 通过，包括新增 8 项关联共享合约。
- 本机真实 HTTP + PostgreSQL：`scripts/check_public_linked_layers.py` 通过，54 请求，47 个预期 200、2 个预期 403、5 个预期 404；无非预期响应。两个账号、一个访客视角、三张卡片、同名不同源资产；含 8 次并发读取（4 workers）。
- 验证了关闭/私有排除、公开改私有后再次读取撤销、创建者发布、访客本地切换、账号隔离、管理员跨库关联及历史迁移。测试创建的卡片、账号、关联和个人库记录已清理并审计零残留。

隔离目标为本机 `127.0.0.1:5433/livingatlas_test`，前后端为 localhost:3000 / 8000。后端重启已应用本地迁移，前端保持运行。此轮不涉及生产部署、线上历史库迁移验收或真实 Mapbox/ArcGIS 浏览器视觉验收；页面已打开时的权限变化不提供实时推送撤销。并发样本用于正确性回归，不代表生产容量。

## 重跑与证据

在 backend 执行 `.venv-local\Scripts\python.exe -u scripts\check_public_linked_layers.py`（必须通过本地测试环境守卫）。在 client 执行 `CI=true npm test -- --watchAll=false --runInBand`。

本机原始输出位于 `C:\Users\yarug\Documents\LivingAtlas-Dev\logs\public-layers-{backend-tests,integration,frontend-tests}.log`。云工作区完整前端及构建输出为 `/tmp/public-layers-full-tests.log`、`/tmp/public-layers-build.log`。
