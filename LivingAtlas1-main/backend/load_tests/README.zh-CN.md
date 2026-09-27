# 本地集成与负载测试

[en-US](README.md) · [es-ES](README.es-ES.md) · [zh-CN](README.zh-CN.md)

这些脚本只针对隔离的 `livingatlas_test` 数据库和本地 HTTP 后端。每次运行结束时都会核对并删除测试创建的记录。结果与限制见 [TEST_REPORT.zh-CN.md](TEST_REPORT.zh-CN.md)。

在 `LivingAtlas1-main/backend` 中打开终端，用两个 worker 启动本地后端：

```powershell
& .\.venv-local\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000 --workers 2
```

## 测试 1：并发注册

在另一终端运行：

```powershell
& .\.venv-local\Scripts\python.exe .\load_tests\01_registration_concurrency.py --distinct 50 --duplicates 20
```

通过条件：不同邮箱的请求全部成功且 `SignupID` 各不相同；相同邮箱的请求中只有一次成功，其余得到预期的重复邮箱拒绝；数据库记录数与响应一致。

## 测试 2–5

按顺序运行以下阶段：

```powershell
& .\.venv-local\Scripts\python.exe .\load_tests\02_baseline_load.py
& .\.venv-local\Scripts\python.exe .\load_tests\03_spike.py
& .\.venv-local\Scripts\python.exe .\load_tests\04_data_volume.py
& .\.venv-local\Scripts\python.exe .\load_tests\05a_soak.py --duration 300
& .\.venv-local\Scripts\python.exe .\load_tests\05b_connection_recovery.py
```

连接恢复脚本只会终止 `livingatlas_test` 中带有 `livingatlas_backend` 标记的 PostgreSQL 会话，不会停止 PostgreSQL 服务。仅在其他本地任务没有使用此后端时运行。持续运行测试默认五分钟。本地结果不能证明生产吞吐量或容量；生产结论需要有代表性的环境和约定的服务目标。

核心读取和注册路由默认每个 worker 使用一条池内连接。测量代表性部署后，可通过 `DB_REQUEST_POOL_SIZE` 在 1–10 范围内调整。其他旧路由仍使用模块级数据库对象，不在连接恢复测试覆盖范围内。

数据量脚本测试至少 1,000 张卡片时，还会核对 `/allCards`、`/getMarkers` 和 `/searchBar` 的前两页。先请求 `limit=100&offset=0`，再请求 `offset=100`；省略 `limit` 时仍返回完整结果。
