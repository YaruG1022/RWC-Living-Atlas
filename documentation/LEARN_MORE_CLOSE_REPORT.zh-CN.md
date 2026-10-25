# Learn More 未保存更改关闭保护

任务日期：2026-10-25；起点：`9d482b9`，分支 `codex/local-image-upload-preview`。

问题：原有关闭确认遗漏 funding、org、is_public、待上传附件及新图片等状态；内部键盘事件拦截导致 Esc 未进入统一关闭流程。教程自动进入编辑模式时也没有建立更改基线。

修改：补齐草稿检测；Close、遮罩点击和 Esc 使用同一确认处理。取消确认保留弹窗和草稿，确认后回滚草稿并关闭。丢弃时清除基线和临时状态；教程返回查看模式后仍保护留下的草稿。无改动或字段已还原时不提示。

验证：使用真实 ReactModal 的 10 项回归覆盖三个关闭入口、拒绝/接受确认、funding/org/visibility/文件队列、更改还原、无更改直接关闭、教程后的草稿保护。前端完整回归 26 suites / 183 tests 通过，最后整理 Hook 依赖后，相关 58 项再次通过；生产构建通过，保留既有 lint、CSS 压缩和 bundle 大小警告。

本机 Card.close、Card.gallery 和 Card.location 共 58 项通过；最终依赖同步后 Card.close 的 10 项再次通过。测试替换后端、地图及外部服务，无真实数据写入；本轮没有执行浏览器视觉验收或生产部署。

工作区命令：在 client 目录执行 `CI=true npm test -- --watchAll=false --runInBand`。完整输出：`/tmp/learn-more-close-final-all-tests.log`；构建输出：`/tmp/learn-more-close-checked-build.log`。本机输出：`C:\Users\yarug\Documents\LivingAtlas-Dev\logs\learn-more-close-tests.log`。
