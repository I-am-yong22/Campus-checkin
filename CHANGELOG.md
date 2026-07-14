# Changelog

本文件记录 Campus Check-in 的版本更新。格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)。

---

## [0.2.0] - 2026-07-14

### 概述

本次为**请假与工时**重大功能更新：支持按小时请假、堂主/管理员请假核销，以及基于「签到签退 − 有效请假重叠」的工时计算。**未修改任何数据库表结构**，按小时时段与核销记录通过 `AuditLog` 扩展字段存储。

### Added（新增）

#### 后端

- **按小时请假**：单日可选「整天 / 按小时」；按小时最少 1 小时，支持「X 小时 Y 分钟」；不可跨自然日、不可用于多日请假。
- **请假核销 API**：`POST /api/leave/:id/write-off`（堂主 / 管理员）；学员不可操作。
- **时段元数据模块** [`backend/src/common/leave-time.ts`](backend/src/common/leave-time.ts)：读写 `AuditLog`（`action = LEAVE_TIME`）。
- **核销与有效时段模块** [`backend/src/common/leave-writeoff.ts`](backend/src/common/leave-writeoff.ts)：读写 `AuditLog`（`action = LEAVE_WRITEOFF`）；计算有效请假区间与重叠分钟数。
- **工时聚合模块** [`backend/src/common/work-hours-aggregation.ts`](backend/src/common/work-hours-aggregation.ts)：月度工时、导出、排行榜统一走重叠扣除逻辑。
- **`/checkin/mine?month=`** 返回每日 `effectiveWorkMinutes`（扣除请假重叠后的有效工时）。

#### 前端

- **请假申请页**：单日支持切换「整天 / 按小时」，填写开始时刻与时长。
- **请假审核页**：已通过且未核销的记录显示「请假核销」按钮（堂主 / 管理员）。
- **我的签到页**：汇总与明细展示有效工时；若与原始 `workMinutes` 不同则标注 `(原XXX)`。
- 类型扩展：`LeaveTimeMeta`、`LeaveWriteOff`、`effectiveWorkMinutes`。

### Changed（变更）

#### 工时计算规则（Breaking Behavior）

- **旧规则**：工时 ≈ 签退 − 签到；请假可能折算进工时。
- **新规则**：
  ```
  有效工时 = 签退时间 − 签到时间 − 与「有效请假时段」的重叠分钟数
  ```
- 仅 **已通过（APPROVED）** 的请假参与计算；待审 / 已拒绝不计。
- 未签退的当日有效工时为 **0**。
- 休息日（`CalendarExemption`）仍跳过不计。

#### 按小时请假 — 有效时段与核销

| 状态 | 有效请假区间 |
|------|-------------|
| 已通过，未核销 | `[申请开始, 计划结束]` |
| 已核销 | `[申请开始, 核销时刻 writeOffAt]`（核销 = 实际返岗；可长于计划） |

**示例**（08:00 签到，21:00 签退，08:30 起请 2 小时）：

| 核销时刻 | 有效工时 |
|----------|----------|
| 09:00（提前回来） | 750 分钟 |
| 10:30（准时） | 660 分钟 |
| 12:30（晚 2 小时回来） | 540 分钟 |

#### 整天请假 — 核销

- 核销日前：请假覆盖的每一天按整天计。
- 核销日当天：仅 `00:00` 至 `writeOffAt` 计为请假。
- 核销日之后：不再计为请假。

#### 出勤状态

- 有签到记录时优先显示签到状态（不因按小时请假标为整天请假）。
- 仅 **整天有效请假** 且无签到时显示 `ON_LEAVE`。

#### 其他

- 统计排行榜、CSV 导出、个人月报均使用扣除重叠后的工时。
- 新建请假时与待审/已通过请假的**有效时段**做重叠校验（含已核销截断后的区间）。

### 数据存储（无表结构变更）

| 内容 | 存储 |
|------|------|
| 请假主记录 | `LeaveRequest`（不变） |
| 按小时时段 | `AuditLog.detail` JSON，`action = LEAVE_TIME` |
| 核销记录 | `AuditLog.detail` JSON，`action = LEAVE_WRITEOFF` |

### API 变更摘要

| 方法 | 路径 | 角色 | 说明 |
|------|------|------|------|
| POST | `/leave` | USER/LEADER | 请求体新增 `leaveMode`、`startTime`、`durationHours`、`durationMinutes` |
| POST | `/leave/:id/write-off` | LEADER/ADMIN | 核销已通过请假 |
| GET | `/checkin/mine?month=` | 登录 | 响应含 `effectiveWorkMinutes` |

### 验证

- 17 个现实生活请假场景（含提前/准时/延后核销、整天次日核销、两段按小时等）纯函数验证通过。
- `backend` / `frontend` 生产构建通过。

---

## [0.1.0] - 2026-03（初版）

- 人脸签到 Kiosk（本地可信写入）
- 主站：用户/团队、请假审批、统计导出
- Docker Compose 部署
- 平台统一出勤规则与按日任务

[0.2.0]: https://github.com/I-am-yong22/Campus-checkin/compare/1d1d040...v0.2.0
[0.1.0]: https://github.com/I-am-yong22/Campus-checkin/releases/tag/v0.1.0
