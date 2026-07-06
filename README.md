<div align="center">

<img src="frontend/public/favicon.svg" alt="Campus Check-in" width="72" height="72" />

# Campus Check-in · 校园人脸打卡系统

**Face-recognition attendance for summer school programs — secure local kiosk check-in, leave approval, and team analytics.**

*暑期学校团体刷脸签到/签退 · 请假审批 · 团队管理 · 本地可信写入*

</div>

---

## 核心特性

| | |
| --- | --- |
| **本地可信签到** | Kiosk 绑定 `127.0.0.1`，公网主站无法远程代打卡 |
| **浏览器端人脸识别** | face-api.js 本地推理，模型离线加载，无需联网 |
| **三角色 RBAC** | 普通用户 / 项目负责人 / 管理员，JWT + 权限隔离 |
| **团队与请假流程** | 邀请码入团、点对点邀请、多级审批与撤销 |
| **出勤与工时** | 平台统一时间窗、自动补签退、统计图表与 CSV 导出 |
| **Docker 一键部署** | MySQL + NestJS Backend + React Frontend（Nginx） |

---

## 30 秒快速开始

```bash
docker compose up -d mysql
cd backend && cp .env.example .env && npm i && npx prisma migrate deploy && npm run seed
cd ../frontend && npm i && npm run dev
```

主站 → http://localhost:5173 · 默认账号见 [默认账号](#默认账号) · 完整步骤见 [快速开始（本机开发）](#快速开始本机开发)

---

## 目录

- [项目是做什么的](#项目是做什么的)
- [系统架构](#系统架构)
- [技术栈](#技术栈)
- [目录结构](#目录结构)
- [快速开始（本机开发）](#快速开始本机开发)
- [Docker 一键部署](#docker-一键部署)
- [默认账号](#默认账号)
- [功能概览](#功能概览)
- [单机签到 Kiosk](#单机签到-kiosk)
- [人脸识别](#人脸识别)
- [数据模型](#数据模型)
- [API 接口](#api-接口)
- [运维与测试](#运维与测试)
- [设计决策](#设计决策)
- [许可证](#许可证)

---

## 项目是做什么的

| 场景 | 说明 |
| --- | --- |
| 每日打卡 | 学员在**签到机**刷脸完成签到/签退，主站查看记录与工时 |
| 人脸录入 | 登录主站录入，或在签到机「现场录入」（需管理口令） |
| 请假 | 学员/负责人提交，按规则流转至负责人或管理员审批 |
| 团队管理 | 管理员建团队/分配成员；负责人也可申请建团、邀请学员 |
| 数据统计 | 管理员看全平台概览；负责人看本团队出勤与待关注名单 |

**安全原则：** 签到/签退**只能**在签到机本地写入（绑定 `127.0.0.1`），公网主站无法远程代打卡。

---

## 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                        共享 MySQL                            │
│                   localhost:3307 / campus_checkin            │
└────────────▲────────────────────────────────────▲───────────┘
             │                                    │
   ┌─────────┴──────────┐              ┌─────────┴──────────┐
   │   主站（公网可访问）  │              │  单机签到（仅本机）   │
   │                      │              │                      │
   │  frontend :5173      │              │  kiosk/web  :5174   │
   │       ↓              │              │       ↓              │
   │  backend  :3000/api │              │  kiosk/server :4100 │
   │                      │              │  (127.0.0.1 only)   │
   │  录入/请假/管理/统计   │              │  1:N 识别/签到/签退   │
   │  签到记录只读         │              │  未签到看板/待机轮播   │
   └──────────────────────┘              └──────────────────────┘
```

| 组件 | 职责 |
| --- | --- |
| **frontend** | React 主站：登录、人脸录入、请假、管理后台、统计图表 |
| **backend** | NestJS API：认证/RBAC、用户团队、请假、统计、出勤任务；**不**接受远程签到写入 |
| **kiosk/server** | Express 本地 API：人脸库、签到/签退写入、今日出勤看板、现场录入、心跳上报 |
| **kiosk/web** | 签到看板 UI：1:N 自动识别、未签到侧栏、签到成功 overlay、待机模式、现场录入 |

共用出勤判定逻辑：主后端 [`backend/src/common/attendance.ts`](backend/src/common/attendance.ts) 与 kiosk [`kiosk/server/src/attendance-context.ts`](kiosk/server/src/attendance-context.ts) 对齐。

---

## 技术栈

| 层 | 技术 |
| --- | --- |
| 前端 | React 18、Vite、TypeScript、Ant Design、React Router、axios、face-api.js、ECharts |
| 后端 | NestJS、TypeScript、Prisma、MySQL 8、JWT、bcrypt、RBAC |
| 单机签到 | Express、Prisma、face-api.js |
| 部署 | Docker Compose（mysql + backend + frontend/nginx） |

---

## 目录结构

```
campus-checkin/
├─ backend/                NestJS 后端
│  ├─ prisma/schema.prisma 数据模型
│  ├─ prisma/seed.ts       种子数据
│  ├─ src/auth/            认证与 RBAC
│  ├─ src/users/           用户管理
│  ├─ src/teams/           团队与签到规则
│  ├─ src/team-workflow/   团队申请 + 成员邀请
│  ├─ src/face/            人脸录入
│  ├─ src/checkin/         签到查询（只读）
│  ├─ src/attendance/      出勤任务
│  ├─ src/stats/           数据统计
│  ├─ seed-today-checkins.mjs  看板演示：重置今日签到并写入样例数据
│  └─ *-smoke.mjs          API 冒烟测试脚本
├─ frontend/               React 主站
│  ├─ public/models/       face-api.js 模型（约 7MB）
│  └─ src/pages/           各功能页面
├─ kiosk/
│  ├─ server/              单机签到 API（127.0.0.1）
│  │  ├─ src/attendance-board.ts   今日出勤看板（已签到/未签到）
│  │  └─ src/attendance-context.ts 出勤判定（与主后端一致）
│  └─ web/                 签到看板 + 现场录入
├─ docker-compose.yml
└─ README.md               本文档
```

---

## 快速开始（本机开发）

### 前置条件

- Node.js 18+
- Docker Desktop（用于 MySQL；也可使用本机 MySQL，改 `backend/.env` 中的 `DATABASE_URL`）

### 1. 启动 MySQL

```bash
docker compose up -d mysql
```

宿主机端口 **3307**（容器内 3306），避免与本机已有 MySQL 的 3306 冲突。

### 2. 后端

```bash
cd backend
cp .env.example .env
npm install
npx prisma migrate deploy   # 首次建表：npx prisma migrate dev --name init
npm run seed
npm run start:dev           # → http://localhost:3000/api
```

### 3. 前端

```bash
cd frontend
npm install
npm run dev                 # → http://localhost:5173
```

### 4. 单机签到（签到机场景，可选）

```bash
# 终端 A：签到服务
cd kiosk/server
cp .env.example .env
npm install && npm run prisma:generate
npm run dev                 # → http://127.0.0.1:4100

# 终端 B：签到网页（开发模式）
cd kiosk/web
npm install
npm run dev                 # → http://127.0.0.1:5174
```

---

## Docker 一键部署

```bash
docker compose up -d --build
```

| 服务 | 地址 |
| --- | --- |
| 前端 | http://localhost:8080 |
| 后端 | http://localhost:3000/api |
| MySQL | localhost:3307 |

首次启动会自动执行数据库迁移与种子数据。Kiosk 需单独在签到机上部署（见下文）。

---

## 默认账号

种子数据包含 **3 个默认账号**（各角色一个，**均未加入团队**）与 **4 个空演示团队**（含邀请码，便于手动测试入团流程）。`npm run seed` 可重复执行以**补齐**团队、邀请码等平台数据；**已有账号的密码不会在 update 时重置**（仅 `create` 时写入 `passwordHash`）。

| 角色 | 用户名 | 初始密码 | 说明 |
| --- | --- | --- | --- |
| 管理员 | admin | admin123 | 全平台管理 |
| 项目负责人 | leader | leader123 | 无团队，可自行申请建团 |
| 普通用户 | user | user123 | 无团队，可通过邀请码或邀请加入团队 |

**演示团队与邀请码**（团队内无默认成员）

| 团队 | 邀请码 |
| --- | --- |
| 暑期实践一团 | TEAM01 |
| 暑期实践二团 | TEAM02 |
| 创新创业团 | TEAM03 |
| 志愿服务队 | TEAM04 |

若浏览器登录提示密码错误：在「用户管理」重置密码，或清空 `User` 表后重新 `npm run seed`（会按上表恢复初始密码）。

---

## 功能概览

### 认证与权限

- 不开放公开注册，账号由管理员创建
- 首次登录：改密码 →（需打卡角色）录脸 → 进入系统
- JWT + RBAC，越权访问返回 403

### 用户与团队

- 用户：增删改、批量 CSV 导入、重置密码、分配角色/团队
- 团队：增删改、休息日配置（出勤时段由平台统一规则管理）
- 出勤：管理员维护**平台默认规则**，并按日发布**全平台出勤任务**（发布后可覆盖当日时段）

### 签到签退与工时

- **无需加入团队**：已录脸且账号启用的学员/负责人均可签到；有团队时记录关联 `teamId`，无团队时为 `null`
- 时间窗：签到 `[checkInStart, checkInEnd]`、签退 `[checkOutStart, checkOutEnd]`
- 中间时段刷脸 → 提示「不在签退时段」
- 工时 = 签退时间 − 签到时间；忘记签退由主后端 cron 每日 00:05 自动补记
- 补签：负责人/管理员可手动补签（附备注）

### 请假审批

- 学员可选提交给**负责人**或**管理员**；负责人固定提交给管理员
- 日期重叠校验；待审可撤销

### 数据统计

- 管理员：全平台概览、ECharts 图表、待关注名单（缺勤/未录脸）
- 负责人：本团队统计、团队成员日出勤看板
- 导出：团队日报、个人月报、工时 CSV 等

### 团队流程

1. 无团队负责人 → 向管理员申请创建团队
2. 管理员批准 → 自动建团队并绑定负责人
3. 负责人 → **生成团队邀请码**（学员凭码加入）或 **点对点邀请**无团队学员
4. 学员 → 输入邀请码预览并确认加入，或接受/拒绝点对点邀请

> 两种方式并存：邀请码多人可用、不限次数，负责人可随时禁用/重新生成。

### 个人中心

- 修改显示姓名、上传/移除头像
- 「我的团队」查看同组成员

### Kiosk 运维

- 心跳上报、在线状态检测
- 待机轮播/倒计时/生日祝福（主站管理端配置）
- 出勤时段右侧展示**未签到**名单（与左侧摄像头区域等高，超出滚动）

### 主站页面路由

| 路径 | 角色 | 说明 |
| --- | --- | --- |
| `/` | 全角色 | 首页（管理员含全平台统计图表；负责人/学员为个人概览） |
| `/my-checkins` | USER/LEADER | 我的签到（按月日历） |
| `/leave` | USER/LEADER | 请假申请 |
| `/leave-review` | LEADER/ADMIN | 请假审核 |
| `/my-team` | USER/LEADER | 我的团队（成员 / 加入 / 管理 / 出勤 / 统计） |
| `/settings` | 全角色 | 设置（个人资料 / 修改密码 / 人脸录入） |
| `/admin/teams` | ADMIN | 团队管理（创建审核 / 团队列表 / 团队成员） |
| `/admin/attendance-tasks` | ADMIN | 全平台出勤任务 |
| `/admin/work-hours` | ADMIN | 工时排行榜 |
| `/admin/users` | ADMIN | 用户管理（含 CSV 导入、重置密码） |
| `/admin/audit-logs` | ADMIN | 审计日志 |
| `/admin/kiosk-display` | ADMIN | Kiosk 待机轮播 / 倒计时 / 生日祝福等 |

**旧路径重定向（书签兼容）**

| 旧路径 | 跳转至 |
| --- | --- |
| `/profile` | `/settings?tab=profile` |
| `/face-register` | `/settings?tab=face` |
| `/team-invitations` | `/my-team?tab=join` |
| `/leader/team` | `/my-team?tab=manage` |
| `/leader-stats` | `/my-team?tab=stats` |
| `/team-members` | `/admin/teams?tab=members` |
| `/admin/team-applications` | `/admin/teams?tab=applications` |

---

## 单机签到 Kiosk

签到专用机器上运行，**仅监听 127.0.0.1**，直连共享 MySQL。

### 界面与交互

| 区域 | 说明 |
| --- | --- |
| 左侧主区 | 16:9 摄像头预览、人脸框、提示文案；签到/签退成功后全屏 overlay（头像 + 姓名 + 绿色对号） |
| 右侧侧栏 | **未签到（N）** 列表：数据来自数据库实时计算，与左侧区域等高；人数超出时在侧栏内纵向滚动 |
| 待机模式 | 非出勤时段或全局休息日时显示轮播/倒计时/生日祝福等 |
| 现场录入 | 右下角设置图标或 Logo 长按 → 输入管理口令 |

侧栏每 20 秒轮询刷新，刷脸成功后立即刷新。全局休息日显示「今日为休息日，无需打卡」；全员已到岗显示「全员已到岗」。

### 使用方式

| 模式 | 地址 | 说明 |
| --- | --- | --- |
| 开发 | http://127.0.0.1:5174 | Vite 热更新，API 代理到 4100 |
| 生产 | http://127.0.0.1:4100 | server 托管 `kiosk/web/dist` 静态文件 |

- **签到看板**：1:N 自动识别，按平台统一时间窗判定签到或签退
- **未签到侧栏**：展示当日尚未签到成员（含「未录脸」标记）
- **待机模式**：非出勤时段显示轮播/倒计时/生日祝福
- **现场录入**：右下角设置图标或 Logo 长按 → 输入管理口令

### 生产部署

```bash
cd kiosk/web && npm install && npm run build
cd ../server && cp .env.example .env && npm install && npm run prisma:generate && npm run start
```

全屏浏览器打开 `http://127.0.0.1:4100` 即可。

### 环境变量（`kiosk/server/.env`）

| 变量 | 说明 | 示例 |
| --- | --- | --- |
| `DATABASE_URL` | 共享 MySQL | `mysql://root:root123@127.0.0.1:3307/campus_checkin` |
| `KIOSK_HOST` | **务必** `127.0.0.1` | `127.0.0.1` |
| `KIOSK_PORT` | 监听端口 | `4100` |
| `KIOSK_FACE_MATCH_THRESHOLD` | 欧氏距离阈值（越小越严） | `0.45` |
| `KIOSK_ADMIN_TOKEN` | 现场录入口令 | 自行设置 |

> 数据库在远程时，`DATABASE_URL` 填远程地址，但 `KIOSK_HOST` 仍保持 `127.0.0.1`。

### Windows 开机自启

用 [NSSM](https://nssm.cc/) 注册 Windows 服务，再用任务计划程序全屏打开 `http://127.0.0.1:4100`：

```powershell
nssm install CampusCheckinKiosk "C:\Program Files\nodejs\node.exe"
nssm set CampusCheckinKiosk AppDirectory "<你的项目路径>\kiosk\server"
nssm set CampusCheckinKiosk AppParameters "node_modules\tsx\dist\cli.mjs src/index.ts"
nssm set CampusCheckinKiosk AppEnvironmentExtra "DATABASE_URL=..." "KIOSK_ADMIN_TOKEN=..."
nssm start CampusCheckinKiosk
```

### 待机 / 签到切换验收

1. 管理员 → **出勤任务**：确认平台默认规则为 `08:00–10:00` 签到、`17:00–18:00` 签退
2. 若当前处于中间工作时段 → 打开 http://127.0.0.1:5174 应显示**待机**（轮播/倒计时）
3. 发布**今日**全平台任务，将签退窗调到包含当前时刻 → 刷新后切到**签到模式**（摄像头）
4. 任意已录脸学员刷脸 → 签到/签退成功（有团队则记录 `teamId`，无团队则为 `null`）
5. 全局休息日（`CalendarExemption` 且 `teamId=null`）→ 全天待机且刷脸提示无需打卡

### 看板演示数据

在 `backend` 目录可快速写入今日签到样例（便于调试侧栏与滚动）：

```bash
npm run seed:today-checkins   # 清空今日签到，保留 6 人已签、其余未签
npm run reset:today           # 仅清空今日签到（保留人脸）
```

---

## 人脸识别

- 检测与 128 维特征提取在**浏览器端**完成（face-api.js），模型位于 `frontend/public/models/` 与 `kiosk/web/public/models/`，本地加载，无需联网
- **录入**：多帧平均，得到稳定特征模板
- **签到识别流程**（kiosk）：
  1. **1:N 扫描**：在整个人脸库中找最相似用户（连续 2 帧同一人才进入下一步）
  2. **1:1 核验**：多帧采集，与匹配用户模板再次比对
  3. **服务端复核**：`/attendance` 用提交的 `userId + descriptor` 与库中底库再比一次
- 识别结果是「库中最像的那个人」：未录脸用户无法以本人身份签到；长相极相似时存在误识别为另一用户的风险（阈值越严越安全，但可能增加拒识）
- 阈值：主后端 `FACE_MATCH_THRESHOLD`（默认 **0.42**）；kiosk `KIOSK_FACE_MATCH_THRESHOLD`（建议 0.38~0.45，默认 0.45）
- 时间统一按 **Asia/Shanghai (UTC+8)**

---

## 数据模型

| 表 | 说明 |
| --- | --- |
| `User` | 用户（username、role、teamId、seat、mustChangePassword、faceRegistered、avatarUrl） |
| `Team` | 团队 |
| `TeamMembership` | 用户–团队多对多成员关系 |
| `TeamInviteCode` | 团队邀请码（生成/禁用/重新生成） |
| `FaceProfile` | 人脸特征（128 维 JSON，与 User 级联删除） |
| `CheckInRule` | 团队级规则表（保留结构，**不再参与**出勤时间解析） |
| `PlatformCheckInRule` | 平台默认出勤规则（单例 id=1） |
| `AttendanceTask` | 全平台按日出勤任务（发布后可覆盖当日平台默认规则） |
| `CheckIn` | 签到记录（含签退时间、工时、状态 NORMAL/LATE/MAKEUP） |
| `LeaveRequest` | 请假（reviewTarget: LEADER/ADMIN） |
| `CalendarExemption` | 休息日（teamId 为空=全局） |
| `TeamCreationRequest` | 团队创建申请 |
| `TeamInvitation` | 成员邀请 |
| `AuditLog` | 审计日志 |
| `KioskHeartbeat` | 签到机心跳（id 固定为 1） |
| `KioskCarouselSlide` 等 | 待机轮播/倒计时/任务看板 |

完整字段见 `backend/prisma/schema.prisma`。

---

## API 接口

### 主后端（前缀 `/api`，默认 `http://localhost:3000/api`）

| 方法 | 路径 | 角色 | 说明 |
| --- | --- | --- | --- |
| GET | /health | 公开 | 健康检查 |
| POST | /auth/login | 公开 | 登录（响应字段 `token` + `user`） |
| GET | /auth/me | 登录 | 当前用户 |
| PATCH | /auth/profile | 登录 | 修改姓名 |
| POST/DELETE | /auth/avatar | 登录 | 上传/移除头像 |
| POST | /auth/change-password | 登录 | 改密码 |
| GET/POST/PATCH/DELETE | /admin/users | ADMIN | 用户管理 |
| POST | /admin/users/import | ADMIN | CSV 批量导入用户 |
| GET/POST/PATCH/DELETE | /teams | ADMIN | 团队管理 |
| GET/PUT | /admin/platform-attendance-rule | ADMIN | 平台默认出勤规则 |
| GET/POST/PATCH | /admin/attendance-tasks | ADMIN | 全平台出勤任务（含 `POST :id/publish`、`POST :id/cancel`） |
| GET | /attendance/effective-rule | 登录 | 当日平台有效规则 |
| GET | /checkin/today | 登录 | 今日出勤状态 |
| GET | /checkin/mine | 登录 | 我的签到（按月） |
| GET | /checkin/team | LEADER/ADMIN | 团队日出勤记录 |
| GET | /checkin/work-hours/summary | 登录 | 个人月度工时汇总 |
| POST | /checkin/makeup | LEADER/ADMIN | 补签 |
| POST | /face/register | 登录 | 主站人脸录入（128 维 `descriptor`） |
| GET | /face/status | 登录 | 是否已录脸 |
| GET/POST/DELETE | /calendar/exemptions | ADMIN | 休息日（`teamId` 空=全局） |
| GET | /admin/audit-logs | ADMIN | 审计日志 |
| GET | /teams/mine | USER/LEADER | 我的团队列表（含负责/加入） |
| GET | /teams/managed | LEADER | 我负责的团队列表 |
| POST | /teams/active | USER/LEADER | 切换当前活跃团队 |
| GET | /teams/members | LEADER/ADMIN | 团队成员看板 |
| GET | /teams/peers | 登录 | 我的团队 |
| POST | /teams/leave | USER | 退出指定团队（`?teamId=`） |
| POST | /teams/members/:userId/remove | LEADER | 移出团队成员 |
| POST/GET/DELETE | /leave/* | USER/LEADER | 请假 |
| GET/PATCH | /leave/pending, /leave/:id/review | LEADER/ADMIN | 请假审核 |
| GET | /stats/overview | ADMIN | 统计概览 |
| GET | /stats/team, /stats/attention | LEADER/ADMIN | 团队统计 / 待关注名单 |
| GET | /stats/kiosk | ADMIN | 签到机在线状态 |
| GET | /stats/work-hours/leaderboard | ADMIN | 工时排行榜 |
| GET | /export/team-daily | LEADER/ADMIN | 团队日出勤 CSV |
| GET | /export/user-monthly | 登录 | 个人月报 CSV |
| GET | /export/overview | ADMIN | 全平台概览 CSV |
| GET | /export/work-hours | ADMIN | 全员工时 CSV |
| POST/GET/PATCH | /team-applications/* | LEADER/ADMIN | 团队创建申请 |
| POST/GET/PATCH/DELETE | /team-invitations/* | LEADER/USER | 点对点成员邀请 |
| GET/POST | /team-invite-codes/* | LEADER/USER | 团队邀请码（生成/预览/加入） |
| GET/POST/DELETE | /kiosk-display/* | ADMIN | Kiosk 待机内容配置 |

> 主后端 **无** `POST /checkin`（返回 404）。签到/签退写入仅在 kiosk。

### 单机签到（前缀 `/api`，`http://127.0.0.1:4100/api`）

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | /health | 健康检查 + 心跳 |
| GET | /schedule | 当前模式 ATTENDANCE / STANDBY |
| GET | /standby/display | 待机内容 |
| GET | /attendance/today-board | 今日出勤看板（`checked` 已签到、`absent` 未签到；侧栏仅用 `absent`） |
| GET | /faces | 人脸库（1:N） |
| GET | /users | 用户列表（现场录入） |
| POST | /attendance | 签到或签退（兼容 `/checkin`） |
| POST | /admin/verify | 校验管理口令 |
| POST | /face/register | 现场录入（需 `x-admin-token`） |

---

## 运维与测试

### 前置：启动服务

冒烟测试依赖本机服务与 MySQL，请先完成 [快速开始](#快速开始本机开发) 中的 MySQL、backend `start:dev`，以及 Kiosk 相关测试时的 `kiosk/server` `dev`。

### 常用命令（`backend` 目录）

| 命令 | 作用 |
| --- | --- |
| `npm run seed` | 写入/补齐默认账号、团队、邀请码等（**不重置已有用户密码**，见 [默认账号](#默认账号)） |
| `npm run reset:today` | 清空当天签到记录（保留人脸） |
| `npm run seed:today-checkins` | 看板演示：重置今日签到并写入 6 条样例 |
| `npm run build` | 编译 NestJS 生产包 |
| `npm run smoke:leave` | 请假冒烟（20 项） |
| `npm run smoke:stats` | 统计/团队成员（7 项） |
| `npm run smoke:extensions` | 功能扩展（11 项） |
| `npm run smoke:profile` | 个人资料/我的团队（8 项） |
| `npm run smoke:workflow` | 团队申请/点对点邀请/移出成员/多团队（20 项） |
| `npm run smoke:invite-code` | 团队邀请码与退团（17 项） |
| `npm run smoke:attendance` | 签到签退/工时（10 项） |

**一键跑完全部主后端冒烟（93 项）**

```bash
cd backend
npm run smoke:leave && npm run smoke:stats && npm run smoke:extensions \
  && npm run smoke:profile && npm run smoke:workflow && npm run smoke:invite-code \
  && npm run smoke:attendance
```

Kiosk 冒烟（`kiosk/server` 目录，需先 `npm run dev`）：

```bash
npm run smoke    # 17 项（含无团队签到、现场录入、主站代打卡已关闭）
```

### 构建验证

| 目录 | 命令 | 说明 |
| --- | --- | --- |
| `frontend` | `npm run build` | 主站生产构建 |
| `kiosk/web` | `npm run build` | 签到看板生产构建（供 `kiosk/server` 托管） |
| `backend` | `npm run build` | 后端编译 |

### 测试覆盖说明

| 类型 | 覆盖情况 |
| --- | --- |
| API 冒烟 | 主后端 **93** 项 + Kiosk **17** 项，覆盖认证 RBAC、用户团队、请假、统计导出、团队流程、出勤任务、Kiosk 签到写入（含无团队）等 |
| 单元测试 | 暂无 `*.spec.ts`（`npm test` 无用例） |
| 浏览器 E2E | 未纳入自动化；刷脸识别、登录页 UI 需本机摄像头人工验收 |
| Docker 部署 | 需单独 `docker compose up` 验证 |

### 环境变量（`backend/.env`）

| 变量 | 说明 | 默认 |
| --- | --- | --- |
| `DATABASE_URL` | MySQL 连接 | `mysql://root:root123@localhost:3307/campus_checkin` |
| `JWT_SECRET` | JWT 密钥 | 生产务必修改 |
| `PORT` | 后端端口 | `3000` |
| `FACE_MATCH_THRESHOLD` | 人脸比对阈值 | `0.42` |
| `CORS_ORIGIN` | 允许的前端地址 | `http://localhost:5173` |

---

## 设计决策

| 决策 | 原因 |
| --- | --- |
| MySQL 映射到 3307 | 避免与本机已有 MySQL 3306 冲突 |
| 签到单机化 | 防止公网远程代打卡；写入仅 kiosk（127.0.0.1） |
| 管理员无需录脸 | 管理员不打卡，避免首登门控锁死 |
| 人脸阈值 0.42 | 0.5 过松易误识别；网络摄像头建议 0.38~0.45 |
| 多帧平均录入 | 提高特征稳定性，降低误识别 |
| 平台统一出勤规则 | 一台签到机、一套时间窗；按日任务可覆盖默认规则 |
| 时间 UTC+8 | 统一 Asia/Shanghai 判定日期与迟到 |
| 种子 upsert 不覆盖密码 | 避免误跑 `seed` 重置生产/开发中已改密码；需重置时用管理端或删用户后重 seed |

---

## 许可证

本项目采用 [PolyForm Noncommercial License 1.0.0](LICENSE)（非商用许可证）。

- **允许：** 个人学习、研究、修改、非商业场景下的使用与再分发
- **禁止：** 未经授权的商业用途（售卖、SaaS 收费、企业内部生产商用等）

`docker-compose.yml` 与 `npm run seed` 中的默认密码（如 `root123`、`admin123`）**仅用于本地演示**，生产环境务必修改。
