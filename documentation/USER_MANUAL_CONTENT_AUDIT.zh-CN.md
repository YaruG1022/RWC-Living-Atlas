# User Manual 内容核对与读取范围（19-010 第一步）

核对日期：2026-10-14。

基线：主项目 `6d078ba`；机器人项目 `92b6f44`。本报告针对本会话云端工作区的代码快照，不代表已经核实线上部署版本。主项目用户说明入口为 [UserManual.js](../LivingAtlas1-main/client/src/UserManual.js)，路由为 `/user-manual`。参考文档来自工作区的 `RWC-Living-Atlas-Chatbot/docs/*.md`，共 36 份；没有查询 Pinecone 中的记录。

## 1. 本轮结论与边界

**app 的 User Manual 页面是后续 chatbot 功能说明的读取来源。** 旧机器人文档仅用于发现手册遗漏和冲突，不是新的内容权威，也不要求逐句搬运到手册。以当前实现核实操作、权限和控件名称，再修正或补充页面。卡片数量、类别/标签词汇、现有服务和图层清单继续来自实时查询，不能从手册示例推断。

根据用户后续明确要求，旧文件不能反向覆盖当前手册：只有旧文件提到、但无法由当前 app 页面或代码确认的内容不进入手册。保留已有多点、多图片、位置编辑、公共底图、StreamStats 和丰富图层工具说明。机构使命、主题范围和完整缩写词表不从旧文档搬入；数据来源链接直接核对 `ArcgisUploadPanel.js`，产品背景核对当前 `About.js`。第 2 节是历史参考去向记录，不是后续机器人抓取清单，也不要求保留旧文档全部表述。

本轮完成原方案第 1 步：核对范围、补充必要的用户操作说明、为每份旧文档记录去向。新增四个可直达章节，保留原有章节 ID 和演示：

| 新章节 ID | 标题 | 补齐内容 |
|---|---|---|
| `navigation` | Navigation & Preferences | 公共页面、侧栏、头像菜单、面板关系、保存偏好和章节链接 |
| `accounts` | Login, Registration & Passwords | 注册申请、审批等待、登录、密码找回、退出和操作权限 |
| `profile-admin` | Profile & Administration | Edit Profile、用户名/简介/头像、改密码、邀请、切换账户、用户管理与审批 |
| `tutorials-updates` | Tutorials & Updates | 通用/面板教程、What's new、Updates 历史 |

已有章节补充：Overview 中的产品与卡片概念；Atlas Helper 的键盘操作、当前公开数据范围和故障提示；卡片键盘打开、工具栏说明、创建表单限制；ArcGIS 图层选择、加载、目录回退和当前配置的来源链接；Custom Layers 的选择/隐藏/删除区别、搜索和偏好；底图偏好。

本轮没有修改机器人服务、索引器、同步工作流或旧文档，也没有删除或重建 Pinecone 索引。**chatbot 尚未改为读取手册页面。** 内容格式、页面读取/导出、检索更新、来源链接和截图理解是后续步骤。没有新增 app 操作流程，因此未改新手引导或发布新的产品版本记录。

## 2. 36 份旧文档的对应关系

文件名均相对于参考仓库 `docs/`。同一文档可拆到多个现有章节，重复说明合并；不把接口协议、数据库结构、内部状态变量、历史部署信息放入用户手册。表中“修正”意味着后续读取手册的正确说明，旧文档本轮保持原样用于追溯。

| # | 参考文档 | 手册章节 ID / 其他去向 | 核对与处理 |
|---|---|---|---|
| 1 | `features_app_overview_and_about.md` | `home`, `accounts`, `navigation` | 补产品、卡片、浏览与登录权限；项目背景指向 About。旧的“额外 authorized user”层级不迁入。架构/技术栈/本地启动属于开发资料，依当前源码与 README 核实，不作为操作知识。 |
| 2 | `features_arcgis_panel_info_modals_and_time_filters.md` | `arcgis-panel`, `service-layer-info` | 已有元数据、透明度、日期/时间轴与来源链接；保留“取决于服务支持和返回字段”。 |
| 3 | `features_arcgis_panel_layer_selection_and_map_updates.md` | `arcgis-panel` | 补服务/叶图层/组/图例条目勾选、清空和加载；内部状态名、图层 ID 算法和事件实现留在源码。 |
| 4 | `features_arcgis_panel_management_context_menu_and_preferences.md` | `arcgis-panel`, `custom-layers`, `navigation` | 补登录、账户 pin 偏好、自动恢复区别；重命名入口依代码修正。旧 remove 服务处理器没有当前菜单入口，不描述成可执行操作。 |
| 5 | `features_arcgis_panel_overview_and_navigation.md` | `arcgis-panel` | 已有层级/面包屑/帮助/教程/内置图层；补目录后端优先、回退与图层上游依赖。 |
| 6 | `features_arcgis_panel_search_and_results.md` | `arcgis-panel` | 已有范围、Added 与上下匹配导航；补异步加载期间等待提示。 |
| 7 | `features_arcgis_service_layer_learn_more_and_context_menu_user_guide.md` | `arcgis-panel`, `service-layer-info` | 与第 2/4 份合并；pin 和保存明确需要登录，不承诺匿名用户可 pin。 |
| 8 | `features_arcgis_state_data_sources_and_builtin_layers.md` | `arcgis-panel`, `map-controls` | 从当前 ArcgisUploadPanel 配置核实三个来源链接，补 MapServer/FeatureServer 和内置图层点击；当前目录走实时查询。旧机构背景、主题例子、使命和缩写词表均不迁入，保留旧文件仅供追溯。 |
| 9 | `features_authentication_login_signup_reset.md` | `accounts` | 补注册、登录、找回密码和退出；用当前 Username / Sponsor/Message / Submit Request 名称。 |
| 10 | `features_avatar_accessible_pages_profile_admin_switch_account.md` | `profile-admin` | 补资料编辑、改密码、邀请、切换和管理员审批/角色/删除；用 Edit Profile、Change Role、Confirm 等现有控件名。 |
| 11 | `features_avatar_menu_modal_and_actions.md` | `navigation`, `profile-admin`, `accounts` | 补头像菜单，与第 9/10 份合并；Administration 的当前页面管理用户，卡片操作在详情页。 |
| 12 | `features_basemap_panel.md` | `basemap-panel`, `navigation` | 原手册已比旧文档完整（含公共底图）；补浏览器/账户偏好，不承诺每次同步成功。 |
| 13 | `features_card_favorites_and_scope.md` | `toolbar`, `card-container` | 手册已有 All Cards/In View；以 Filter By 内的 favorites 选项为准，旧独立 Favorites 按钮不迁入。 |
| 14 | `features_card_item_interactions.md` | `card-container` | 补 Enter/Space 打开；缩略图采用手册现有 No image，旧默认 CEREO 图片说明不迁入。 |
| 15 | `features_card_learn_more_modal.md` | `detail-view` | 现有详情、编辑/保存/取消、删除、PDF、文件、图像、图层链接与位置编辑已覆盖；不搬旧坐标直接输入框/旧图库按钮描述。 |
| 16 | `features_card_searchbar.md` | `toolbar` | 校验后修正手册：卡片面板搜索按标题匹配；保留清除及 viewport 暂停说明。 |
| 17 | `features_card_sort_and_filter.md` | `toolbar` | 已有 Apply/Clear、类别/标签组合；补距离排序需要定位或地图搜索点。界面选项与全库实时词汇区别记录在第 3 节。 |
| 18 | `features_card_titlebar_controls.md` | `toolbar`, `card-container` | 补 Help/Tutorial/Close 与重新打开状态；计数保留为实时显示，不复制示例数字。 |
| 19 | `features_card_toolbar_layers_layout_view.md` | `toolbar`, `map-controls` | 已有 grid/list 与左右停靠；显示/隐藏地图标记的入口以地图工具栏为准。 |
| 20 | `features_cards_database_query.md` | `chatbot`；实时工具 | 补公开字段、查询范围和隐私边界；数量/当前卡片走实时工具。数据库查询和参数化规则留服务源码，不进入手册。 |
| 21 | `features_chatbot_widget_and_chat_endpoint.md` | `chatbot`, `navigation`；服务源码/README | 补 Enter/Shift+Enter、等待、错误、查询和 quick action；删除迁移内容中的“始终不可用”旧结论。API 格式、模型配置和检索实现留服务资料。 |
| 22 | `features_create_card.md` | `add-card`, `add-single-point`, `polygon-tools`, `add-png`, `detail-view` | 以手册和表单验证为准；补字符/几何限制。修正旧必填 Category、PNG-only、独立封面上传和默认 logo 说法；附件处理以当前上传/下载实现为准。 |
| 23 | `features_custom_layers_panel_context_menu_modals_pinning_and_onboarding.md` | `custom-layers`, `service-layer-info` | 已有菜单/信息/pin；核实 Custom Layers pins 确实存在浏览器，补与保存到账户的 library 和 ArcGIS Upload pins 的区别。 |
| 24 | `features_custom_layers_panel_folder_and_order_management.md` | `custom-layers` | 已有文件夹、面包屑、拖动、移动、删除回 Root；补路径式嵌套名字。 |
| 25 | `features_custom_layers_panel_layer_selection_and_map_rendering.md` | `custom-layers` | 补服务/个别图层/组选取、隐藏与删除区别；现有 Added/Clear/透明度保留。 |
| 26 | `features_custom_layers_panel_overview_and_access.md` | `custom-layers`, `navigation` | login 与保存来源已覆盖；当前 Home 侧栏互斥行为核实后修正原手册，同时保留更丰富的上传文件/盆地功能。 |
| 27 | `features_custom_layers_panel_search_navigation_and_filters.md` | `custom-layers` | 补当前文件夹范围、Root、Prev/Next；当前 Custom Layers 没有可选择的类型下拉框，不搬旧 Any/Folder/Service/Layer 操作。组织与拖动说明合并第 24 份。 |
| 28 | `features_general_onboarding_and_whats_new.md` | `tutorials-updates` | 补通用教程、重播、panel play、bell 和完整更新历史；启动按钮核实为 Start App Tour，不搬旧 Play General Onboarding；不承诺每次更新自动弹窗。 |
| 29 | `features_home_shell_sidebar_and_preferences.md` | 不迁入；由 `navigation` 根据 Home 重新说明 | 文件只有 `C:\Users\yarug`，没有任何功能说明，是无效来源；不索引这个路径，不用它生成正文。旧文件未删除。 |
| 30 | `features_mapbox_builtin_layers_and_metadata.md` | `arcgis-panel`, `map-controls`, `toolbar` | 补内置图层的启用与点击；鼠标坐标和 In View 原手册已覆盖。 |
| 31 | `features_mapbox_map_interactions_and_card_overlays.md` | `card-container`, `add-card`, `detail-view` | 已有定位、高亮、图像/多边形 popup、图库；默认颜色不是所有卡片的固定规则，支持自选 marker/icon/style，旧颜色表不作为通用结论。 |
| 32 | `features_mapbox_polygon_and_image_drawing_workflows.md` | `polygon-tools`, `add-png` | 以手册的 pencil → Coordinate/Polygon/Image、多格式文件与拖动放置为准；修正手册中 Save 误称 map filter。 |
| 33 | `features_mapbox_toolbar_controls.md` | `map-controls`, `add-single-point`, `polygon-tools`, `add-png` | 现手册包含 zoom axis、GPS、fullscreen、截图、reset、visibility；旧 Add Tools/+ 入口不迁入。 |
| 34 | `features_navbar_pages_and_navigation.md` | `navigation`, `accounts`, `profile-admin` | 补公共导航/登录头像入口；旧 CEREO logo 外链被品牌开关隐藏，不写成始终可见。 |
| 35 | `features_static_pages_about_and_contact.md` | `navigation`；About/Contact 当前页面 | 手册说明入口即可；联系方式由 Contact 页面维护，避免复制后再次漂移。 |
| 36 | `features_user_manual_and_update_history_pages.md` | `navigation`, `tutorials-updates` | 补章节 URL 和 Updates；章节点击不自动改地址，不声称当前 URL 总是对应已选择章节。 |

## 3. 冲突判定和依据

以下主项目源码路径省略 `LivingAtlas1-main/` 前缀；这里的源码核对不等于对线上 API 或管理员权限做了实际端到端验证。

| 冲突 / 限制 | 本轮判定 | 依据 |
|---|---|---|
| authorized user 与任意登录用户可创建的冲突 | 使用当前登录创建、owner/admin 编辑删除的实际操作规则；不新增权限层级 | `client/src/FormModal.js` 的提交条件；`Card.js` 的编辑/删除身份检查；`backend/endpoint_files/card.py` |
| 必填字段 / Category | Author Name、Email、Title、有效位置；Category 可选 | `FormModal.js` 的 validate 和字段 required；category 默认 None |
| 卡片搜索 title vs description | 修正为 title。机器人 public-data 搜索是另一条路径，可匹配 title/description/org/tags | `backend/endpoint_files/filterbar.py` 的 searchBar；`cards_summary.py` 的 live query |
| favorites 单独按钮 vs Filter By | 使用 Filter By → Show only favorited cards → Apply | `client/src/FilterDropdown.js`, `Content2.js` |
| 地图加卡入口和图片格式 | 现行 pencil 菜单；支持 PNG/JPEG/GIF/WebP；有效图片放置后进入表单 | `client/src/Content1.js`, `FormModal.js` 和现有 `add-png` 手册章节 |
| Polygon Save 被描述为 map filter | 修正为创建流程的几何转交；提交表单才创建 card | `Content1.js` 的绘图保存回调与 `FormModal.js` |
| ArcGIS / Custom Layers 同时打开 | 侧栏操作互斥；Project Cards 左停靠可与活动面板分屏 | `client/src/Home.js` 的两组 sidebar onClick 与 splitBottom |
| ArcGIS Rename / Remove / recycle bin 的入口 | 当前 service 右键没有 Rename/Remove。去除手册右键 Rename 示例；inline rename 受 isAdmin 控制，但 Home 当前未传该 prop，不能承诺管理员能从此入口操作。旧 remove 处理器无当前入口，recycle bin 没有足够实现依据 | `ArcgisUploadPanel.js` 调用 `LayerContextMenuPopup` 只传 Save extraServiceItems；isAdmin 默认 false；`Home.js`；`LayerContextMenu.js` |
| 匿名 pin / 仅本地 pin | ArcGIS Upload 用户点 pin 需登录，存账户偏好；Custom Layers 进入面板需登录，但其 pins 存浏览器的 custom_layers_pinned_items。library、folder/order 存账户。不能承诺两种 pin 都跨设备同步 | `ArcgisUploadPanel.js` 的 handleTogglePinGuarded、加载/保存偏好；`CustomLayersPanel.js` 的 PINNED_STORAGE_KEY；`userPreferencesLocalCache.js` |
| 旧教程 / 登录 / 搜索按钮名 | 本轮使用 Start App Tour 和 Login；Custom Layers 不写不存在的搜索类型下拉框。ArcGIS Picker 中该下拉框确实存在，保留对应手册说明 | `GeneralOnboardingModal.js`；`Login.js`；`CustomLayersPanel.js`；`ArcGISPickerModal.js` |
| 缩略图 / 固定 marker 颜色 | 无图采用 No image；marker 支持保存图标与颜色，不能用旧三色表概括所有卡片 | `Card.js`；`Content1.js` 的多点/自定义 marker 分支 |
| 帮手不可用、跨刷新记忆、现况实时性 | 初始欢迎语已可提问；组件内历史不跨 reload；live summary 有缓存且查询有限额，手册不写“全部当前数据保证可用” | `ChatbotWidget.js`；参考服务 `chat_tools.py`, `chat.py` |
| 全库词汇 vs 界面固定选项 | FilterDropdown/FormModal 当前提供固定类别选项，而 live taxonomy 从数据库统计；手册介绍 UI 选项，实时工具介绍当前数据库词汇，两者不可混为一份权威库存 | `FilterDropdown.js`, `FormModal.js`；`backend/endpoint_files/atlas_summary.py` |
| 旧栈 / 文件 zip 信息 | 旧 Google Cloud / Azure 托管叙述不用于新功能知识；当前有 Azure blob 工具。文件下载走 downloadFile，部分上传会压缩为 zip；不承诺每种文件都用同一格式 | `backend/endpoint_files/azure_storage.py`, `card.py`, `file_utils.py`, `attachment_download.py`；`Card.js` |

## 4. 以页面作为后续读取来源的约束

- 入口是 app 的 `/user-manual?section=<id>`。手册为 React 客户端渲染，一次仅显示当前章节；只抓首页 HTML 或只读 Overview 会漏掉其他章节。后续页面读取需运行浏览器，逐章访问并等待对应正文出现。
- 现有 17 个章节（含 Overview）以及本轮 4 个新章节，共 21 个。列表包括：`home`, `navigation`, `accounts`, `profile-admin`, `tutorials-updates`, `feature-search-panel`, `chatbot`, `card-container`, `toolbar`, `detail-view`, `add-card`, `add-single-point`, `polygon-tools`, `add-png`, `arcgis-picker`, `arcgis-panel`, `custom-layers`, `service-layer-info`, `basemap-panel`, `watershed-panel`, `map-controls`。
- 读取正文以 `.um-content-area` 内当前 `.um-section` 为范围；排除 navbar、侧栏、首页章节卡片、重复演示控件、样例数字、示例联系人和示例数据。保留标题、正文、步骤、注意事项和有效来源链接。截图/交互示例的处理是后续图文阶段。
- 页面中的地图/图库演示不是生产数据，也不是可执行任务；不要把 demo checkbox 的状态或 sample card 数量当作当前查询结果。
- 功能说明以页面为准；公开卡片和目录现况来自 live 工具。禁止把项目报告、会议资料、旧 developer 段落或无效路径混入手册读取内容。
- 仍应记录对应部署版本、章节链接及读取失败，以免网页已经更新而机器人使用过时内容；具体同步、检索及存储方式留到后续实现。

## 5. 验证记录

- `UserManual.test.js`：6 个用例通过。覆盖全部 20 个非 Overview 导航入口、现有图库回调、四个新章节直达 URL、未知章节回退与继续导航、分享链接目标。
- 内容核对脚本：逐一比对参考 `docs/*.md` 文件名与第 2 节表格，36/36 恰好一次且无遗漏；只读取导航常量确认 21 个章节 ID 唯一、各有渲染分支并在本报告中记录；报告相对文件链接可解析。
- `git diff --check` 通过；机器人仓库工作区无修改。
- `CI=false npm run build` 成功，产生可部署的前端构建。项目已有 lint/CSS 压缩警告，包括 UserManual 原有未使用的 faMinus、原有 Image 1 alt 提示和项目 CSS 的 cqw/calc 压缩提示。构建成功不表示警告已修复。
- 初次依赖安装受沙箱网络限制；启用允许的网络权限后，chromedriver 安装脚本又因外部下载域名被拒而失败。改用 `npm ci --ignore-scripts --no-audit --no-fund --cache /tmp/rwc-npm-cache` 安装测试/构建所需依赖，未绕过域名策略或改动 package/lock 文件。浏览器驱动不属于本轮 Jest/React 构建需要的依赖。
- 初次内容核对脚本把正文中的 basemap 示例 ID 也计为章节，导致检查断言失败；限定为导航常量后通过，属于核对脚本范围错误，没有因此修改页面章节。
- 限制：未进行生产部署、线上账号操作、实时数据工具或 Pinecone 请求；未做浏览器截图/版式验收。组件测试验证渲染和交互入口，功能事实主要由当前源码核实。后续接入页面读取仍需测试逐章采集、过滤 demo 和版本同步。
