# 本地测试环境

[en-US](LOCAL_TESTING.md) · [es-ES](LOCAL_TESTING.es-ES.md) · [zh-CN](LOCAL_TESTING.zh-CN.md)

注册或数据负载测试前，请使用此隔离环境。测试数据库是 `127.0.0.1:5433` 上的 `livingatlas_test`。本地数据库文件和密码均被 Git 忽略。

## 初始设置（Windows PowerShell）

在仓库根目录运行：

```powershell
& .\LivingAtlas1-main\backend\scripts\create_local_postgres.ps1
```

脚本会创建空的 PostgreSQL 17 集群、测试数据库及其 schema、`backend/.env.local` 和 `client/.env.development.local`，且不会覆盖现有本地数据或设置。如果 PostgreSQL 安装在其他位置，运行前修改脚本中的 `$pgBin`。

前端开发环境设置 `REACT_APP_API_URL=http://localhost:8000`。后端在连接数据库前加载 `backend/.env.local`，并检查本地测试模式是否仅指向回环地址和 `livingatlas_test`。

## 启动后端

在 `LivingAtlas1-main/backend` 中创建 Python 3.12 虚拟环境、安装依赖并启动 API：

```powershell
py -3.12 -m venv .venv-local
& .\.venv-local\Scripts\python.exe -m pip install -r requirements.txt
& .\.venv-local\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000
```

检查 `http://127.0.0.1:8000/` 和 `http://127.0.0.1:8000/allCards`。仅访问根路由不足以验证数据库；`/allCards` 会实际执行查询。

## 启动前端

在 `LivingAtlas1-main/client` 中运行 `npm start`，然后打开 `http://localhost:3000`。修改环境文件后需重启开发服务器。

聊天机器人使用独立服务，不属于此本地数据库配置。地图功能仍可能访问外部 ArcGIS 和 Mapbox 服务。

## 停止并重启 PostgreSQL

```powershell
& 'C:\Program Files\PostgreSQL\17\bin\pg_ctl.exe' -D .\LivingAtlas1-main\backend\.local-postgres\data stop
& 'C:\Program Files\PostgreSQL\17\bin\pg_ctl.exe' -D .\LivingAtlas1-main\backend\.local-postgres\data -l .\LivingAtlas1-main\backend\.local-postgres\server.log -o '-p 5433 -h 127.0.0.1' -w start
```

不要将负载脚本指向生产环境。测试注册记录会留在本地数据库中，直到明确清理。
