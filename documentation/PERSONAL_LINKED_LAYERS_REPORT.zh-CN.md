# 关联图层按用户保存显示状态

日期：2026-10-25；起点 `f9f2435`，分支 `codex/local-image-upload-preview`。

## 行为与存储

每个登录用户对每张卡片的每条 ArcGIS / Custom Layer 关联分别保存显示/隐藏状态，创建者和管理员也只修改自己的状态。公开卡片的关联列表和可读取资产不再由任何人的勾选决定；新用户默认隐藏，仍可自行启用全部公开关联。私有卡片仍限创建者/管理员读取。

新增 `card_link_visibility`，以关联 ID 和用户 ID 为联合主键，删除关联/账号时级联清理。旧共享显示标志仅在首次建表时迁移给创建者，不复制给其他用户；重启不会覆盖已保存的隐藏设置。保留旧列供兼容回退，但当前接口不再更新它。权限识别沿用现有账号邮箱约定，本轮未更换应用认证协议。

访客选择保存在当前浏览器的独立存储区，不混入登录账号设置。关闭再打开卡片或刷新后重新打开会恢复选择。登录身份变化会清理上个身份的关联地图源并重新读取偏好，过期读取不能应用到新身份。快速点击按账号和关联串行保存；保存失败会还原复选框并提示重试。

卡片上传图层使用独立于个人库、也独立于其他卡片关联的地图源；Custom Layers 面板不再批量修改卡片设置。个人 ArcGIS Pin 不强制勾选或禁用关联复选框。地图第三方服务及已有 Pin 系统本身不在本轮重构范围。

## 验证

- 前端完整回归：29 suites / 200 tests 通过。生产构建通过，仅保留已有 lint / CSS / bundle 警告；原 Card 发布权限 Hook 警告已随相关逻辑移除。
- 本机前端针对性回归：4 suites / 47 tests 通过，覆盖卡片、共享地图源、个人偏好队列和 Custom Layers 面板。
- 本机后端：55 tests 通过，其中关联共享与个人偏好合约 10 项。
- 本机真实 HTTP + PostgreSQL：69 请求，64 个预期 200、1 个预期 403、4 个预期 404，无非预期响应。两个临时账号、三张卡片和访客视角覆盖：同卡片相反显示状态、相互不影响、重新读取恢复、管理员同样按个人保存、私有拒绝、旧批量接口账号隔离、两账号同时写入、公开改私有后访问撤销及删除关联级联清理。
- 独立临时 schema 验证旧显示标志仅迁移到创建者，隐藏偏好在重复迁移后保留；同时继续验证资产来源回填与删除后不重新绑定。临时 schema 事务回滚；临时卡片、账号、关联、偏好和上传资产均清理并审计。

首次前端针对性回归为 46 通过 / 1 失败：访客测试仍期待服务器原始 `is_visible` 对象，而实现已正确应用访客独立偏好。修正测试断言后完整 200 项通过。首次离线 ASGI 测试在云沙箱异步线程限制下停滞，改用允许的执行环境后 10 项通过。

隔离目标为本机 `127.0.0.1:5433/livingatlas_test`；前端 localhost:3000，后端 localhost:8000。本轮未执行线上部署、生产历史库迁移验收或真实 ArcGIS/Mapbox 浏览器视觉验收；正确性并发样本不代表生产容量。公共改私有的权限撤销在后续读取时生效，不提供已打开地图的实时推送。

## 命令与证据

在 client 执行 `CI=true npm test -- --watchAll=false --runInBand`。backend 的隔离集成执行 `.venv-local\Scripts\python.exe -u scripts\check_public_linked_layers.py`，脚本会校验本地测试目标。

云工作区日志：`/tmp/personal-linked-full-tests.log`、`/tmp/personal-linked-build.log`、`/tmp/personal-linked-backend-tests.log`、首次针对性回归 `/tmp/personal-linked-frontend-targeted.log`。本机日志：`C:\Users\yarug\Documents\LivingAtlas-Dev\logs\personal-linked-{integration,backend-tests,frontend-tests}.log`。
