# 靶场平台即服务系统（CRaaS）

面向中国移动的网络安全靶场演示系统。核心思路是把靶场当成一种云服务：**一句话描述场景 → 自动生成拓扑与 IaC 代码 → 沉淀为场景模板 → 按九类业务一键实例化 → 统一监控与调度**。

系统由四个模块组成：

| 模块 | 作用 |
| --- | --- |
| 智能拓扑构建 | 自然语言生成拓扑，代码与图形双向编辑，内置规则校验 |
| 混合资源编排 | 九类业务入口，资源匹配推荐、Workload 编排、提交部署 |
| 资源封装 | 镜像、设备、计算、存储、网络五类资源统一建模 |
| 监控调度中心 | 资源水位观测、调度建议与调整影响评估 |

---

## 一、环境要求

| 依赖 | 版本 | 说明 |
| --- | --- | --- |
| Node.js | 18 及以上（推荐 20 / 22） | 前端构建与开发服务 |
| Python | 3.10 及以上（推荐 3.11） | 后端服务 |
| Docker | 20 及以上（可选） | 只在用容器方式启动时需要 |

> Windows 用户请在 **PowerShell** 中执行下面所有命令。

---

## 二、启动系统（本地方式，约 2 分钟）

需要开**两个终端**，一个跑后端，一个跑前端。

### 1. 启动后端（端口 8000）

```powershell
cd backend

# 首次执行：创建虚拟环境并安装依赖
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt

# 启动服务（每次启动都执行这一条）
python -m uvicorn app.main:app --reload --port 8000
```

macOS / Linux 把激活命令换成 `source .venv/bin/activate` 即可。

看到 `Uvicorn running on http://127.0.0.1:8000` 表示成功。首次启动会自动生成演示数据库 `backend/data/craas.db` 并写入种子数据（12 个场景模板、6 个镜像、7 个计算节点、3 个资源池、4 个场景实例、3 条调度事件），无需手动初始化。

### 2. 启动前端（端口 5173）

另开一个终端：

```powershell
cd frontend

# 首次执行：安装依赖
npm install

# 启动开发服务（每次启动都执行这一条）
npm run dev
```

### 3. 打开网站

| 地址 | 说明 |
| --- | --- |
| **http://localhost:5173** | 系统主界面（从这里进入所有功能） |
| http://127.0.0.1:8000/docs | 后端接口文档，可直接调试接口 |
| http://127.0.0.1:8000/api/health | 健康检查，返回 `{"status":"ok","llm":false}` 说明后端正常 |

前端已配置 `/api` 代理到 `127.0.0.1:8000`，无需改跨域配置。建议用 1600×900 以上的窗口，拓扑页面显示效果最佳。

### 4. 局域网访问（可选）

前端已开启 `server.host`，后端也监听 `0.0.0.0`，同一局域网内的手机、平板、其他电脑可以直接访问本机 IP：

```powershell
# 查看本机 IP
ipconfig | findstr IPv4
```

假设本机 IP 为 `10.249.65.138`，则访问 **http://10.249.65.138:5173**。

如果其他设备打不开，说明被 Windows 防火墙拦截，用管理员身份执行一次放行（只需一次）：

```powershell
New-NetFirewallRule -DisplayName "CRaaS 5173" -Direction Inbound -LocalPort 5173 -Protocol TCP -Action Allow
New-NetFirewallRule -DisplayName "CRaaS 8000" -Direction Inbound -LocalPort 8000 -Protocol TCP -Action Allow
```

### 5. 公网访问（可选）

本地开发服务不适合直接暴露到公网，两种做法：

- **临时演示**：用内网穿透工具（cpolar、natapp、frp、ngrok 等）把 5173 端口映射出去，拿到一个公网链接；
- **正式部署**：把项目放到云服务器，`docker compose up -d --build`，然后用服务器 IP 的 8080 端口访问（见第六节）。

---

## 三、界面怎么用

左侧是导航栏，共五个分组；右上角可切换搜索、通知与账号（演示环境）。

### 1. 控制台总览（`/`）

首页展示四个能力模块入口、平台数据（模板数、运行实例、纳管节点）以及最近模板与实例状态，点任意卡片可进入对应模块。

### 2. 智能拓扑构建（`/topology`）

1. 在左侧「描述场景」输入一段中文描述，例如：

   > 创建一个办公环境，包含办公区、服务器区、运维区三个子网，核心路由器通过边界防火墙接入互联网；办公区部署 6 台办公电脑，服务器区部署 2 台服务器，运维区部署 2 台运维终端。

   也可以点下方「示例场景」快速填入四套预置描述之一。
2. 选择「行业选择」「业务类型」，点击 **生成拓扑图**（约 1 秒）。
3. 右侧在「拓扑预览」与「IaC 代码」之间切换；下方「拓扑校验」显示网段冲突、IP 重复、孤岛节点等检查结果。
4. 点画布上的节点，右下角「节点属性」显示该节点的镜像、规格、IP。
5. 点 **保存为场景模板**，填写名称后自动进入模板编辑器。

> 生成逻辑：后端 `services/topology.py` 从描述中抽取区域、节点数量、IP 网段，按规则产出拓扑；配置大模型后改由模型生成（见第五节）。

### 3. 场景模板构建与编辑（`/templates` → 点某个模板）

三栏布局：

- **左 · 代码编辑器**：完整场景 JSON，可修改后点「应用代码」重新渲染；
- **中 · 图形编辑器**：按区域分组的拓扑，节点可拖拽调整位置；工具栏支持自动布局、添加节点、删除节点；
- **右 · 拓扑检查器**：结构统计（节点数/连接数/区域数/网段数）+ 选中节点的属性编辑（名称、类型、区域、IP、镜像、CPU、内存、磁盘、端口）；底部「镜像 JSON」实时显示该节点的 IaC 描述，一键复制。

改完点右上角 **保存模板**；点 **去部署** 直接跳到实例化控制台。

### 4. 混合资源编排（`/orchestrate`）

- 上方是九类业务入口（安全竞赛演练、渗透测试、漏洞评估、教学课件测评、安全技能评测、攻防虚拟化、事件响应取证、处置策略复盘、漏洞研究复现），点一下按业务筛选模板。
- 下方是场景卡片，每张显示最近更新时间、节点/区域规模、推荐站点与部署模式，点 **立即部署** 进入实例化控制台。

### 5. HRO 场景实例化控制台（`/orchestrate/:id`）

按 1→5 顺序走：

1. **业务与场景模板**：确认业务类型；
2. **部署参数**：选资源池、部署模式（教学实训/竞赛模式等）、实例名称，系统给出「智能部署建议」；
3. **资源匹配推荐**：逐节点展示匹配到的镜像、规格、IP 与匹配状态；
4. **资源拓扑与 Workload**：根据匹配结果生成部署拓扑，下方按区域汇总节点数；
5. **校验与提交**：5 项校验（模板完整性、镜像可用性、拓扑连通性、资源配置、站点亲和性）全部通过后点 **提交部署**。

提交后会跳到实例详情页，部署进度按「资源申请 → 镜像分发 → 网络编排 → 实例启动 → 就绪」自动推进，约 7 秒完成（轮询刷新，无需手点）。

### 6. 场景实例（`/instances`、`/instances/:id`）

- 列表页按状态筛选（全部/运行中/部署中/已销毁），每 4 秒自动刷新，部署中的实例直接显示进度条；
- 详情页展示节点列表：节点名称、IP、端口、账号密码（可一键复制）、状态；
- 状态为「运行中」的节点点 **打开控制台** 会弹出模拟终端窗口（接入真实靶场后换成 WebSSH/VNC）；
- 右侧「资源详情」「镜像与规格」汇总实例规格与成本；
- 右上角可 **销毁实例**。

### 7. 资源封装（`/resources` 及子页）

- **资源总览**：五类资源的数量与行业特有资源统计；
- **镜像管理**：按操作系统/应用镜像/安全工具/网络设备/环境镜像/容器镜像分类筛选，支持搜索与「录入镜像」；
- **计算资源**：节点列表（规格、GPU、单价、状态），点「添加计算资源」按四层字段录入——基础信息 / 规格容量 / 计价信息 / 系统配置；
- **存储资源**、**网络资源**：容量与 IP 使用率监测。

### 8. 资源监控中心（`/monitor`）

- 左侧按资源池（深圳总部/北京边缘/武汉教学）聚合 CPU、内存、存储、网络水位，右侧是单节点卡片；
- 点任意节点弹出监控详情：四项指标 + 近 24 个采样点的趋势曲线；
- 数据每 5 秒刷新一次（演示环境为模拟指标）。

### 9. 调度中心（`/scheduler`）

- 左侧「待处理调度事件」列出内存扩容、降配等建议，含触发条件与建议动作；
- 右侧「资源调整影响评估」用左右对比条展示执行前后的 CPU/内存/存储/网络变化；
- 底部三个操作：暂不处理 / 忽略建议 / 执行建议（执行会弹确认框）；
- 处理过的事件进入「近期处理记录」。

---

## 四、演示脚本（约 4 分钟）

1. 首页介绍四个模块（20 秒）。
2. 进入「智能拓扑构建」，粘一段场景描述 → 生成 → 展示拓扑与 IaC 代码、校验通过 → 保存为模板（60 秒）。
3. 进模板编辑器，拖一个节点改布局，选中节点改镜像/CPU，展示「镜像 JSON」→ 保存（50 秒）。
4. 回「混合资源编排」，选「安全竞赛演练」→ 点场景卡片部署 → 控制台里展示智能建议、资源匹配、部署拓扑 → 提交部署（60 秒）。
5. 实例详情页看部署进度走完，展示节点 IP/账号密码，打开控制台（40 秒）。
6. 资源封装里翻一下镜像与计算资源（20 秒）。
7. 监控中心看水位，调度中心执行一条扩容建议，看影响评估（30 秒）。

---

## 五、接入大模型（可选）

不配置也能完整运行——拓扑由内置规则引擎生成，页面右上角显示「规则引擎」。

在 `backend/` 下复制 `.env.example` 为 `.env`，填入任意 OpenAI 兼容服务的参数：

```ini
LLM_MODE=auto
LLM_BASE_URL=https://api.deepseek.com/v1
LLM_API_KEY=sk-xxxxxxxx
LLM_MODEL=deepseek-chat
LLM_TIMEOUT=45
```

改完重启后端，页面徽标会变成「LLM · deepseek-chat」。

- `LLM_MODE=auto`：有 key 用模型，没 key 用规则引擎；
- `LLM_MODE=on`：强制走模型，失败仍自动降级；
- `LLM_MODE=off`：只用规则引擎。

模型返回的 JSON 会经过结构校验，不合法时自动重试一次并把报错回灌给模型；仍失败则回退规则引擎并标记生成来源，保证演示不中断。

---

## 六、Docker 部署

### 1. 本机验证

```powershell
# 在项目根目录（与 docker-compose.yml 同级）
docker compose up -d --build
```

构建完成后访问 **http://localhost:8080**（Nginx 托管前端并反向代理 `/api` 到后端容器）。

如需带大模型，先在同目录放一个 `.env`：

```ini
LLM_BASE_URL=https://api.deepseek.com/v1
LLM_API_KEY=sk-xxxxxxxx
LLM_MODEL=deepseek-chat
```

数据库存放于 Docker 卷 `craas-data`，`docker compose down -v` 可重置为初始种子数据。

### 2. 上传到云服务器

**传到哪里**：服务器上任意一个目录，惯例放在 `/opt/craas`（需要 sudo）或当前用户家目录 `~/craas`。不要放进 `/var/www/html` 或 Nginx 默认站点目录——本项目用容器运行，跟前端静态目录无关。

**传什么**：整个项目根目录，但排除本机依赖与产物（`node_modules/`、`.venv/`、`dist/`、`backend/data/*.db`、日志）。仓库里已备好 `.gitignore` 与 `.dockerignore`，用下面的方式上传会自动排除。

**方式一：git（推荐，后续更新只需 pull）**

```bash
# 服务器上
mkdir -p /opt && cd /opt
git clone <你的仓库地址> craas
cd craas
```

**方式二：scp（不建仓库，直接传）**

```powershell
# 本机 PowerShell，先排除目录再上传
cd "D:\Program Files\Desktop1\靶场平台即服务系统"
scp -r backend frontend docker-compose.yml README.md root@<服务器公网IP>:/opt/craas/
```

**方式三：图形工具**：WinSCP、Xftp、MobaXterm 直接把项目文件夹拖到 `/opt/craas`。

**服务器上启动**

```bash
cd /opt/craas
docker compose up -d --build     # 首次约 3-5 分钟（拉镜像 + 编译前端）
docker compose ps                # 两个容器都是 Up 即成功
docker compose logs -f backend   # 看后端日志
```

**开放端口**：两个地方都要放行，只放行一处仍然打不开。

1. 云平台安全组：入方向放行 TCP `8080`（推荐把来源限制为自己的 IP）；
2. 服务器防火墙：

```bash
# Ubuntu / Debian
ufw allow 8080/tcp
# CentOS / 欧拉 / 麒麟
firewall-cmd --add-port=8080/tcp --permanent && firewall-cmd --reload
```

**访问**：`http://<服务器公网IP>:8080`

### 3. 不用 Docker 的部署方式

服务器上分别跑前后端，再让 Nginx 反向代理：

```bash
cd /opt/craas/backend && python3 -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
nohup python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 &

cd /opt/craas/frontend && npm install && npm run build   # 产物在 dist/
```

把 `frontend/dist` 作为 Nginx 站点根目录，`location /api/ { proxy_pass http://127.0.0.1:8000/api/; }`，站点监听 80 端口即可。这种方式的配置与容器里的 `frontend/nginx.conf` 完全一致，可以直接照抄。

---

## 七、目录结构

```
backend/
  app/
    main.py                 应用入口、路由注册
    config.py               环境变量与大模型配置
    db.py                   数据库连接与会话
    models.py               数据表模型
    seed.py                 种子数据（模板/资源/事件）
    catalog.py              业务类型、资源池、规格档等字典
    routers/
      topology.py           自然语言生成拓扑、拓扑校验、示例场景
      templates.py          场景模板增删改查
      instances.py          实例化、部署进度、销毁
      resources.py          镜像/计算/存储/网络资源
      monitor.py            监控总览与节点趋势
      scheduler.py          调度事件与执行
    providers/              对接真实环境的驱动（默认 mock，改环境变量切换）
      base.py               驱动协议与数据结构（DeploySpec / DeployState / Alert）
      mock.py               演示实现：状态机 + 模拟指标
      openstack.py          OpenStack Nova：建虚机、轮询、销毁、resize
      prometheus.py         Prometheus：四项指标与历史曲线
      cmdb.py               CMDB / 镜像仓库：资源台账同步
      alertmanager.py       Alertmanager：拉取活跃告警
      __init__.py           驱动注册表与降级逻辑
    services/
      topology.py           拓扑生成与规则校验（核心）
      llm.py                大模型调用、校验重试与降级
      executor.py           实例编排执行器：调驱动创建/销毁资源、轮询回填状态
  data/                     运行时数据库（首次启动自动生成）
  requirements.txt
  Dockerfile
frontend/
  src/
    pages/                  15 个页面
    components/             布局、拓扑画布、代码面板、基础 UI 组件
    lib/                    接口封装、类型定义、拓扑布局算法、工具函数
  vite.config.ts            开发代理配置（/api → 127.0.0.1:8000）
  Dockerfile / nginx.conf   容器构建与反向代理配置
docker-compose.yml
```

---

## 八、常见问题

**端口被占用**：`netstat -ano | findstr :5173` 找到进程号后 `taskkill /PID <进程号> /F`；后端同理换成 8000。

**页面一直转圈或提示加载失败**：先确认后端是否在跑（打开 http://127.0.0.1:8000/api/health），再确认前端是通过 `npm run dev` 启动的（`dist` 目录直接用浏览器打开无法访问接口）。

**想恢复初始数据**：停掉后端，删除 `backend/data/craas.db`，重新启动即可重新写入种子数据。

**实例一直停在部署中**：部署进度由后端内存态推进，后端重启会中断，重新提交一次部署即可。

**生成结果不符合预期**：在描述里把「几个区域、每区域几台设备、网段」写清楚，例如「办公区部署 6 台办公电脑」，数量会被直接采纳。

---

## 九、接入真实靶场

系统把"对接外部平台"的四个动作抽成了**可切换的驱动**，代码在 `backend/app/providers/`：

| 驱动 | 管什么 | 环境变量 | 可选值 | 对应文件 |
| --- | --- | --- | --- | --- |
| 计算 | 创建 / 销毁 / 调整虚机 | `COMPUTE_DRIVER` | `mock` / `openstack` | `providers/openstack.py` |
| 监控 | 节点 CPU、内存、磁盘、网络指标 | `METRICS_DRIVER` | `mock` / `prometheus` | `providers/prometheus.py` |
| 资源 | 镜像、算力、网络、存储台账同步 | `RESOURCE_DRIVER` | `mock` / `cmdb` | `providers/cmdb.py` |
| 告警 | 外部告警接入调度中心 | `ALERT_DRIVER` | `mock` / `alertmanager` | `providers/alertmanager.py` |

**默认全部是 `mock`**，没有真实环境也能完整演示。切换驱动只改环境变量，**业务代码和前端一行都不用动**；配置缺项时会自动退回 mock 并打警告日志，不会导致服务起不来。

改完重启后端即可，`GET /api/health` 与 `GET /api/instances/drivers` 会回显当前真正生效的驱动。

### 0. 接入顺序建议（照这个顺序做最省事）

| 步骤 | 动作 | 怎么验证成了 |
| --- | --- | --- |
| 1 | 先接**资源台账**（镜像 / 算力 / 存储 / 网络） | `POST /api/resources/sync` 返回非 0 条数，页面上能看到自家资源名 |
| 2 | 再接**监控指标** | 页面上节点 CPU/内存值与 Prometheus 控制台查出来的数字对得上 |
| 3 | 再接**告警** | 手工 `POST /api/scheduler/alerts` 能生成事件，再配 Alertmanager → 调度中心出现真实告警 |
| 4 | 最后接**计算**（风险最高） | 用一个 2~3 节点的模板试部署，实例详情里出现真实 IP，能用 SSH 连上 |
| 5 | 全接完后把 `RESOURCE_SYNC_INTERVAL` 打开，之后台账自动更新 | 后端日志里出现"已按计划同步资源" |

**每一步都能单独回滚**：把对应驱动的环境变量改回 `mock` 再重启即可，其它三个不受影响。

### 1. 计算资源：接 OpenStack

```ini
COMPUTE_DRIVER=openstack
OS_AUTH_URL=https://<keystone>/v3
OS_USERNAME=admin
OS_PASSWORD=******
OS_PROJECT_NAME=admin
OS_USER_DOMAIN=Default
OS_PROJECT_DOMAIN=Default
OS_REGION=RegionOne
OS_NETWORK_ID=<虚机接入的网络 UUID>
OS_IMAGE_MAP={"ubuntu-2204-server": "<glance image uuid>", "kali-2024-attacker": "<uuid>"}
COMPUTE_TIMEOUT=900
```

工作流程（`services/executor.py` + `providers/openstack.py`）：

1. 点「提交部署」→ 后端按模板拓扑逐节点调用 Nova `POST /servers`，句柄写进 `instance.profile.handle`；
2. 后台每 1.2 秒轮询 `GET /servers/{id}`，把进度和阶段（资源申请→镜像分发→网络编排→实例启动→就绪）写回实例；
3. 虚机变成 `ACTIVE` 后，把**真实固定 IP、22 端口**回填到实例节点，页面"节点列表与访问方式"里看到的就是真实地址；
4. 点「销毁实例」→ `DELETE /servers/{id}`；点「执行建议」→ Nova resize + confirmResize。

镜像与规格的对应关系：镜像走 `OS_IMAGE_MAP`（名字 → UUID），没配就按名字去 Glance 里找；规格按节点 `cpu / memory` 自动匹配 Nova flavor，找不到精确匹配时取能满足的最小规格。

> 账号密码：真实环境应由 cloud-init / 密钥服务下发，不要像 mock 那样在库里存明文。`_first_ip()`、`poll()` 里的账号字段就是留给大家替换成你们的密钥服务的。

**接 KVM / vSphere / 华为 FusionCompute**：新建一个实现 `ComputeProvider` 协议（`deploy / poll / destroy / resize`）的类，在 `providers/__init__.py` 的 `compute_provider()` 里加一个分支即可，执行器与页面完全不用改。

### 2. 监控指标：接 Prometheus

```ini
METRICS_DRIVER=prometheus
PROM_URL=http://<prometheus>:9090
PROM_NIC=eth0
PROM_NIC_BPS=1000000000     # 网卡带宽，用于把字节速率换算成占用百分比
```

实现说明（`providers/prometheus.py`）：

- 节点与指标的对应：默认用采血管控节点的 IP 去匹配 `instance=~"<ip>:.*"`；如果你们的 node_exporter 用的是主机名标签，改 `_selector()` 一行即可；
- CPU 用 `node_cpu_seconds_total{mode="idle"}` 反算占用，内存用 `MemAvailable/MemTotal`，磁盘取文件系统使用率最大值，网络用 `node_network_*_bytes_total` 速率除以 `PROM_NIC_BPS`；
- 「节点监控」弹窗里的曲线走 `query_range`，按 5 分钟步长取 24 个点；
- **接口失败自动降级**：Prometheus 超时或查不到数据时，`routers/monitor.py` 会打日志并回退到模拟数据，页面不会白屏。

### 3. 资源同步：接 CMDB / 镜像仓库

```ini
RESOURCE_DRIVER=cmdb
CMDB_URL=https://<cmdb>/api
CMDB_TOKEN=<访问令牌>
CMDB_IMAGE_PATH=/v1/images
CMDB_COMPUTE_PATH=/v1/nodes
CMDB_NETWORK_PATH=/v1/networks
CMDB_STORAGE_PATH=/v1/storages
RESOURCE_SYNC_INTERVAL=3600      # 秒；0 表示不定时同步，只手动触发
```

- **手动同步**：`POST /api/resources/sync`，幂等（按名称覆盖），返回各类资源的同步条数；
- **定时同步**：`RESOURCE_SYNC_INTERVAL > 0` 时后端启动一个后台任务按间隔跑，启动日志里能看到；
- **字段映射**：CMDB 字段名和本项目不一致时，只改 `providers/cmdb.py` 里的 `map_image / map_compute / map_network / map_storage` 四个函数，其它代码不动。支持数组或 `{"items": [...]}` 两种返回结构，也兼容 Harbor 那种带 `size`（字节）、`tag` 的镜像清单。

同步完成后，页面「资源封装 → 镜像管理 / 计算资源 / 存储资源 / 网络资源」看到的就是你们台账里的真实数据。

### 4. 调度告警：接 Alertmanager 或自建监控

三种接入方式，可同时用：

| 方式 | 用法 |
| --- | --- |
| Webhook 推送（推荐） | 监控平台把告警推到 `POST /api/scheduler/alerts`，支持单条或数组，字段见下 |
| Alertmanager 拉取 | `ALERT_DRIVER=alertmanager` + `ALERT_URL=http://<am>:9093`，调用 `POST /api/scheduler/evaluate` 前会先读取活跃告警 |
| 阈值巡检 | `POST /api/scheduler/evaluate`，扫描运行中实例的节点指标，超过 `THRESHOLD_CPU / MEMORY / NETWORK` 就自动生成事件 |

告警结构（字段都有默认值，缺省也能建事件）：

```json
{
  "title": "target-01 内存告警",
  "instance_name": "医药广场",
  "node_name": "业务应用服务器",
  "node_ip": "10.0.2.11",
  "metric": "memory",
  "level": "critical",
  "value": 93,
  "threshold": 85,
  "suggestion": "内存占用持续 93%，建议扩容至 8G"
}
```

收到告警后会生成「待处理调度事件」，同时用当前指标算出 `before`，按扩容/降配推算 `after`，"资源调整影响评估"里的对比条就是这两个值。同实例 + 同节点 + 同指标若已有待处理事件则不重复创建。

点「执行建议」时：事件状态置为 executed，并且如果实例有外部句柄，会调用驱动的 `resize()` 真正调整规格，结果记录在 `event.after.applied_to_platform` 字段里（`false` 表示只改了记录没动平台，比如 mock 驱动或节点未匹配）。

### 5. 混合运行与回退

四个驱动互相独立，可以混着用，例如：

```ini
COMPUTE_DRIVER=openstack      # 真实建虚机
METRICS_DRIVER=prometheus     # 真实指标
RESOURCE_DRIVER=mock          # 台账先不动
ALERT_DRIVER=mock             # 告警还没接
```

演示前建议先在测试环境把 `COMPUTE_DRIVER=openstack` 单独打开跑一遍：如果平台连不通，部署会走到"部署失败"状态并在实例详情里显示错误原因（不会卡在进度条上），日志在 `backend` 的控制台输出里。

---

## 十、交付说明

演示版聚焦主链路，其余能力按下表处理：

| 能力 | 当前实现 | 接入位置 |
| --- | --- | --- |
| 虚机创建/销毁/改配 | mock 状态机，已留 OpenStack 驱动 | `providers/openstack.py`、`services/executor.py` |
| 监控指标 | mock 波形，已留 Prometheus 驱动 | `providers/prometheus.py`、`routers/monitor.py` |
| 资源台账 | 种子数据，已留 CMDB 驱动 | `providers/cmdb.py`、`routers/resources.py` |
| 调度事件 | 种子数据 + 告警 webhook + 阈值巡检 | `routers/scheduler.py` |
| 网络下发与专线 | 仅做规则校验，未接 SDN | 新增 provider 后由执行器调用 |
| 登录与权限 | 固定演示账号 | 接入统一认证与 RBAC |

界面配色按中国移动 VI 落地（主色 `#0072CE`），左上角 Logo 为占位图形，替换 `frontend/src/components/Layout.tsx` 中的 `Logo` 组件即可换成正式标识。
