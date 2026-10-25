# 位置类型转换与地图编辑回归

起点：`eed57fc`，分支 `codex/local-image-upload-preview`。任务日期：2026-10-25。

## 范围与实现

Learn More 编辑模式支持 Point（含 multipoint）、Polygon、Image 之间切换，禁用当前类型。新类型及位置仅在地图编辑器确认后成为草稿，主 Save 才提交；取消地图编辑或整个草稿均保留原表示。

统一地图编辑状态关闭项目弹窗，并隐藏本项目的点标记、polygon/image 可见层、hover/hit 层；地图重建标记或样式变化后继续隐藏。退出时恢复此前可见性，并遵守全局隐藏状态。停止在草稿编辑期间直接修改持久地图数据，避免取消后留下未保存的几何。Image 转换保存所选图片文件。右侧浮动折叠按钮保留代码并临时隐藏，Create Project 移除额外邮箱说明。

## 验证与退出条件

- 前端完整回归：25 suites / 173 tests 通过；新增 18 项 Card 转换测试、3 项地图隐藏/恢复测试。
- 六种有向转换分别验证空白编辑器、当前类型禁用、关闭弹窗、仅隐藏本项目、取消恢复、主 Save 的类型/几何/图片载荷；另测多点及完成编辑后放弃草稿。
- 本机复跑 Card.location、cardLocationEditing、Card.gallery 共 51 项；本地开发服务重新编译正常。
- 生产构建通过，保留既有 lint、CSS 压缩及 bundle 大小警告。
- YG1022 本地真实 HTTP/数据库验证：`LOCAL_TEST_MODE=1`、`127.0.0.1:5433/livingatlas_test`；一个唯一前缀合成账号/项目，依次 point → polygon → image → point → image → polygon → point → multipoint，7 次更新全部成功。每步核对相同 CardID、数据库 LocationType/顶点行数、`/allCards`、`/getMarkers` 的类型与几何。
- 两次 Image 转换上传真实小型 PNG，确认本地存储 URL；清理后两张图片均返回 404，测试账号/项目/几何已删除。仅按本轮唯一测试标识清理数据，不删除其他账号或项目。

第一次接口测试因隔离库没有 River 对应类别记录，触发外键拒绝；脚本改为选择库内已有的合法类别，无需修改类别或业务代码。保留首次日志 `location-conversion-fixture-category.log`。修复后验证通过且无测试数据残留。

功能验证使用地图替身检查状态、层可见性和恢复逻辑，未执行真实 Mapbox 浏览器视觉验收；未联系外部 ArcGIS，不作生产容量结论。退出条件：所有转换、取消/保存、数据一致与清理均通过。

## 命令和证据

本地 backend 已启动后，在 backend 目录执行：

```powershell
& .\.venv-local\Scripts\python.exe -u scripts\check_location_conversion.py
```

脚本先验证本地测试目标，在 finally 中清理唯一账号/项目及其本地文件，拒绝删除远程图片。

本机日志：`C:\Users\yarug\Documents\LivingAtlas-Dev\logs\location-conversion-integration.log`、`location-client-tests.log`；工作区日志：`/tmp/location-all-client-tests.log`、`/tmp/location-final-build.log`。
