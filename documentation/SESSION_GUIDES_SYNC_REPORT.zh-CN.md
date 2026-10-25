# 会话改动的引导与手册核对

日期：2026-10-25；起点 `1bc5313`；分支 `codex/sync-session-guides`。

## 核对与补齐

| 区域 | 核对结果与处理 |
| --- | --- |
| Changelog modal / Update History | 共用 `latestGuiUpdates.js`，原记录遗漏联系邮箱修复、大图上传、取景和重试；已补入同一日期的记录，两处一起显示。保留历史更新。 |
| Onboarding | 新建项目引导未覆盖独立联系邮箱、图片尺寸、取景和重试；Learn More 图库引导遗漏铅笔取景入口。已补齐，并说明 Custom Layers 库与项目个人显示设置相互独立、保存超时先检查是否已完成。 |
| User Manual | 创建章节仍称 Email，示例遗漏 Contact Email。已更正标签及示例，说明联系人不改变项目所属账号；明确铅笔图标及个人库快捷入口的适用范围。补充个人库显示选择与项目关联偏好分开保存的说明。 |
| 手册交互示例 | 原图库缺少取景按钮，现复用真实取景组件，支持取消和应用到单个示例图片。只修改本地示例状态，无项目写入。图库改用四张示例图并适当增宽，避免取景工具与 See all images 重叠。 |

位置类型双向转换、当前类型禁用、隐藏原地图表示、未保存关闭确认、账号/访客各自保存关联图层状态的说明原已更新；本轮复核后保留。

## 验证

- 相关前端：6 suites / 19 tests 通过，涵盖弹窗/历史页同源记录、所有手册章节导航、图库示例取景的取消/应用、其他示例不受影响及无真实项目写入。
- 手册导出合约通过；21 章节 / 347 段落全部可渲染并保留稳定 block ID，导出校验与内容哈希一致。
- 生产客户端构建通过；保留现有 lint / CSS / bundle 警告。
- 本机同样通过 19 项前端测试和导出合约。示例最终调整后，工作区和本机再次通过 UserManual 的 8 项回归。
- 离线静态构建检查创建项目、详情、自定义图层三章，生成并检查 43 张手册截图。浏览器只允许临时本地静态站点，阻止所有外部请求，无账号存储、真实地图、API 或数据库写入。

原始输出：工作区 `/tmp/session-guides-react-tests.log`、`/tmp/session-guides-manual-contracts.log`、`/tmp/session-guides-final-manual-tests.log`、`/tmp/session-guides-final-build.log`、`/tmp/session-guides-manual-capture-final.log`；本机 `C:\Users\yarug\Documents\LivingAtlas-Dev\logs\session-guides-*.log`。临时生成的手册和截图位于 `/tmp/session-guides-build/manual/`，未提交生成物。

本轮只更新发布说明、引导、手册和隔离示例；没有后端、迁移、账号权限或真实项目数据变化，也未执行生产部署。
