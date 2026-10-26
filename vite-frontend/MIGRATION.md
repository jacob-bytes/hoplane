# 前端迁移清单：HeroUI 桥 → 纯 shadcn

> **方向更新（v2）**：`DESIGN.md` 已改为 v3「白底深蓝」方向，并决定整体重写。
> 下面的渐进阶段只保留作工作量参考，不再按"逐页改样式"执行；重写按 DESIGN v3 + `FRONTEND-HANDBOOK.md` 进行。

> 配套文档：`vite-frontend/DESIGN.md`（设计规范）。
> 目标：18 条路由全部直接使用 `src/components/ui/*`，删除 `src/shadcn-bridge/heroui/*`。
> 方式：**渐进替换，不另起仓库**。API 层（`src/api`，200 个导出）与业务 hooks 全部复用。

## 0. 目标 / 非目标

**目标**
- 视觉与交互完全由 `DESIGN.md` 决定，不再有"就地发明"的样式
- 每个页面不再 import `@/shadcn-bridge/heroui/*`
- 删除 24 个 bridge 文件（2,600 行）与 HeroUI 语义（`isDisabled` / `onPress` / `startContent`）

**非目标**
- 不改后端、不改 API、不新增功能
- 不重写业务逻辑与实时数据层（只重写 JSX + 组件）
- 不做多语言、不做信息架构大改

## 1. 现状盘点

| 路由 | 文件 | 行数 | bridge 引用 | 现状 | 阶段 | 估时 |
|---|---|---:|---:|---|---|---:|
| 应用壳 | `App.tsx` + layout | 382 | 3 | 部分 | P0 | 1.5d |
| 设计 token | `styles/*` | — | — | 已完成 | P0 | 1d |
| 共享 kit | `components/*` | 7,419 | — | 未开始 | P0 | 1.5d |
| `/` 登录 | `pages/index.tsx` | 395 | 3 | 未开始 | P3 | 1d |
| `/github-callback` | `pages/github-callback.tsx` | 64 | 0 | 未开始 | P3 | 0.5d |
| `/change-password` | `pages/change-password.tsx` | 216 | 3 | 未开始 | P3 | 0.25d |
| `/dashboard` | `pages/dashboard.tsx` | 1,211 | 4 | 部分 | P1 | 2d |
| `/monitor` | `pages/monitor.tsx` | 313 | 0 | 未开始 | P3 | 1d |
| `/node` | `pages/node.tsx` + `pages/node/*` | 2,791 + 5,000+ | 6 | 部分 | P1 | 5d |
| `/inbound` | `pages/inbound.tsx` + `inbound/*` | 1,580 + 1,158 | 6 | 部分 | P1 | 3d |
| `/tunnel` | `pages/tunnel.tsx` + `node/tunnel-monitor-view` | 1,847 + 1,553 | 3 | 未开始 | P2 | 3d |
| `/forward` | `pages/forward.tsx` | 3,347 | 4 | 未开始 | P2 | 3d |
| `/subscription` | `pages/subscription.tsx` | 1,964 | 6 | 部分 | P2 | 2.5d |
| `/panel-sharing` | `pages/panel-sharing.tsx` | 991 | 5 | 未开始 | P2 | 1d |
| `/my-subscriptions` | `pages/my-subscriptions.tsx` | 379 | 2 | 未开始 | P2 | 0.5d |
| `/user` | `pages/user.tsx` | 2,475 | 11 | 未开始 | P3 | 2d |
| `/group` | `pages/group.tsx` | 1,058 | 4 | 未开始 | P3 | 1.5d |
| `/limit` | `pages/limit.tsx` | 436 | 3 | 未开始 | P3 | 0.5d |
| `/config` | `pages/config.tsx` | 2,075 | 8 | 未开始 | P3 | 2d |
| `/profile` | `pages/profile.tsx` | 656 | 3 | 未开始 | P3 | 0.5d |
| `/relay` | `pages/relay.tsx` | 530 | 2 | 未开始 | P3 | 0.5d |
| 收尾 | bridge 删除、QA | 2,600 | — | 未开始 | P4 | 5d |

> "部分"指已经做过局部 shadcn 化（弹窗、表格、延迟面板等），但仍依赖 bridge、仍有旧样式。

**已安装可用的 shadcn 组件（28 个）**：accordion、alert、avatar、badge、button、card、chart、checkbox、collapsible、command、dialog、dropdown-menu、empty、input、label、progress、radio-group、select、separator、sheet、skeleton、switch、table、tabs、textarea、toggle、toggle-group、tooltip。

**还缺、按需补的**：`field`（表单）、`form`（react-hook-form 集成）、`alert-dialog`（危险确认）、`calendar` + `popover`（日期）、`spinner`（如 registry 提供）、`scroll-area`（长列表）、`sonner`（toast，当前用 bridge）。

## 2. 依赖顺序（为什么不能乱）

```
token ─→ 应用壳 ─→ 共享 kit ─→ 页面（按域）
                        │
                        ├─ 认证（登录后才能验收页面）
                        ├─ 服务器 / 入站（最复杂、定义 kit 的边界）
                        ├─ 隧道 / 转发（复用 kit 的表单与状态）
                        └─ 账户 / 设置（表单密集，最后收口）
```

1. **token 先行**：不先定密度/字号，页面会各写各的，重写也没用。
2. **壳其次**：侧栏、页头、面包屑、路由守卫决定所有页面的外边距与层级。
3. **kit 第三**：`PageHeader`、`DataTable`、`FilterBar`、`ActionDialog`、`FormField`、`StatCard` 一旦定稿，页面只剩组合。
4. **页面按域**：线路（node → inbound → tunnel）→ 分发（forward → subscription → share）→ 账户（user/group/limit/config）。
5. **bridge 最后删**：删除前所有页面必须零引用，否则构建直接失败。

## 3. P0 共享基座（必须先做）

| 组件 | 职责 | 关键约束 |
|---|---|---|
| `PageHeader` | 标题 + 说明 + 右侧操作 | 一个主操作；说明 13px muted |
| `DataTable` | 表头、行、空/加载/错误三态、分页 | 数字右对齐；行高 36/44；`aria-sort` |
| `FilterBar` | 搜索 + 下拉 + ToggleGroup 筛选 | 移动端折叠；不清空已选 |
| `ActionDialog` | 详情/操作弹窗（原 `node-actions-sheet` 泛化） | 居中 Dialog；分组 + 危险区 |
| `FormField` | label + control + description + error | `data-invalid` + `aria-invalid` |
| `StatCard` | KPI 数字 + 单位 + 趋势 | 等宽数字；不用彩色阴影 |
| `EmptyState` / `TableSkeleton` | 统一空态与骨架 | 保持最终布局尺寸 |
| `ConfirmDialog` | 危险操作确认 | `AlertDialog`；主按钮 destructive |

## 4. 分阶段计划

| 阶段 | 周期 | 范围 | 验收 |
|---|---|---|---|
| **P0** | 第 1 周 | token 校准、8 个 kit 组件、参考页（服务器列表 + 内核操作弹窗） | 参考页浅/暗/三档宽度通过；kit 已在真实页面使用 |
| **P1** | 第 2–3 周 | 概览、服务器（列表/详情/监控/内核/表单）、入站（列表/表单/监控） | 这三个域零 bridge；实时指标、内核操作、入站表单回归通过 |
| **P2** | 第 4–5 周 | 隧道、转发、订阅、面板分享、我的订阅 | 暂停/恢复、批量操作、分享链接回归通过 |
| **P3** | 第 6–7 周 | 用户、分组、限额、设置、个人中心、改密、登录/Passkey/GitHub、监控、中转 | 权限相关操作回归；表单错误态齐全 |
| **P4** | 第 7–8 周 | 删 bridge、codemod 清理、全量 QA、更新 `AGENTS.md`、演示站适配 | `grep -r shadcn-bridge src` 为 0；CI 绿；演示站可用 |

**合计：约 38 人日（单人 7–8 周；两人按线路/分发拆分 4–5 周）。**
对照：另起仓库全量重写约 55–75 人日（11–15 周单人）。

## 5. 单页迁移步骤（每页照做）

1. 读该页当前实现，列出：bridge 引用、手写 badge/empty/skeleton、`space-y-*`、裸色值。
2. 用 kit 重写 JSX；**不碰** API 调用、hooks、表单校验逻辑。
3. 替换 bridge 组件（见 §6 映射表）。
4. 三态补齐：空、加载、错误。
5. 浅色 + 暗色 + 375/768/1440 截图。
6. 键盘走一遍：Tab 顺序、Enter 提交、Esc 关闭、焦点返回。
7. `pnpm run lint` + `pnpm run build`。
8. 单独提交（一页一 commit），提交信息写清"迁移 X 页到 shadcn"。

## 6. Bridge → shadcn 映射

| Bridge | shadcn | 属性变化 |
|---|---|---|
| `Button` | `ui/button` | `isDisabled`→`disabled`；`onPress`→`onClick`；`color`→`variant`；`startContent/endContent`→children + `data-icon`；`isLoading`→`disabled` + `Loader2` |
| `Input` / `Textarea` | `ui/input` / `ui/textarea` | `onValueChange`→`onChange(e.target.value)`；`isInvalid`→`aria-invalid` + `Field data-invalid` |
| `Select` | `ui/select` | `selectedKeys`→`value`；`onSelectionChange`→`onValueChange`；`SelectItem` 必须在 `SelectGroup` 内 |
| `Checkbox` / `Switch` / `Radio` | `ui/checkbox` / `ui/switch` / `ui/radio-group` | `isSelected`→`checked`；`onValueChange`→`onCheckedChange` |
| `Modal` | `ui/dialog` | `isOpen`→`open`；`onOpenChange`→`onOpenChange`；`ModalContent`→`DialogContent`；`ModalHeader`→`DialogHeader` + `DialogTitle`（必需） |
| `Card` | `ui/card` | `CardBody`→`CardContent`；必须完整组合 Header/Title/Description |
| `Tabs` | `ui/tabs` | `selectedKey`→`value`；`onSelectionChange`→`onValueChange`；`Tab`→`TabsTrigger`；`TabPanel`→`TabsContent` |
| `Table` | `ui/table` | `TableColumn`→`TableHead`；`TableCell` 同名 |
| `Chip` | `ui/badge` | `color`→`variant`；`size`→默认/sm 样式 |
| `Divider` | `ui/separator` | `orientation` 同名 |
| `Progress` | `ui/progress` | 值域都是 0–100；`isIndeterminate`→无值 + 骨架 |
| `Accordion` | `ui/accordion` | `items`→`AccordionItem` + `Trigger` + `Content` |
| `Dropdown` | `ui/dropdown-menu` | `onAction`→item `onSelect`；`DropdownItem`→`DropdownMenuItem`，必须在 `DropdownMenuGroup` 内 |
| `Link` | react-router `Link` / `button variant="link"` | — |
| `Spinner` | `Loader2` + `animate-spin motion-reduce:animate-none` | 图标按钮需 `aria-label` |
| `DatePicker` | `ui/popover` + `ui/calendar` | 需先 `add calendar popover` |
| `use-theme` | 现有 theme hook / `next-themes` | 保持 `dark` class 策略 |

## 7. 完成定义（每页）

- [ ] 零 `@/shadcn-bridge/heroui/*` 引用
- [ ] 零 `space-y-*`、零裸色值、零手写 badge/empty/skeleton
- [ ] 只用 `DESIGN.md` 的字号/间距/圆角
- [ ] 空 / 加载 / 错误 三态齐全
- [ ] 浅色 + 暗色截图；375 / 768 / 1440 无横向滚动
- [ ] Tab 顺序正确，焦点环可见，图标按钮有 `aria-label`
- [ ] 不改业务行为（接口调用次数、参数、缓存与迁移前一致）
- [ ] `pnpm run lint` + `pnpm run build` 通过
- [ ] 演示站 fixture 同步（如该页有 demo 数据）

## 8. 风险与应对

| 风险 | 概率 | 应对 |
|---|---|---|
| 实时监控重写丢联动 | 中 | 先抽数据 hook，再换视图；用同一份 mock 对比渲染结果 |
| 入站/转发复杂表单校验错位 | 中 | 只换控件不换校验；逐字段对照旧表单 |
| 权限/角色差异（管理员 vs 用户端） | 中 | 每个页面用 admin + 普通用户两个账号各走一遍 |
| 演示站 fixture 与真实字段脱节 | 高 | 每页迁移时同步 `src/demo/index.ts` |
| 迁移期功能冻结 | 高 | 每阶段结束合并回 `main`，阶段内小步提交 |
| 暗色回归 | 高 | DoD 强制双主题截图 |
| bridge 提前删除导致构建失败 | 低 | P4 才删；删除前 `grep -rn shadcn-bridge src` 必须为 0 |

**回滚**：一页一提交，出问题直接 revert 该提交；bridge 全程保留，不影响未迁页面。

## 9. 排期建议

- **单人**：P0 一周 → P1 两周 → P2 两周 → P3 两周 → P4 一周，共 **7–8 周**；建议每阶段结束发一个 patch 版本。
- **两人**：A 负责线路域（P1 的 node/inbound + P2 的 tunnel），B 负责分发与账户域（forward/subscription/user/config），P0 共同做，**4–5 周**。
- 期间不接新 UI 需求；纯后端改动不受影响。

## 9.1 v3 落地进度

| 项 | 状态 | 提交 |
|---|---|---|
| token 层（白底 / 深蓝 / 圆角 / 图表色） | 已完成 | 9d4e841 |
| 桌面壳（56px header、折叠、面包屑、分组侧栏） | 已完成 | 9d4e841 |
| 移动壳（logo │ 当前页、底部 5 项） | 已完成 | 9d4e841 |
| 服务器列表（页面标题、表格、延迟列、线路标签） | 已完成 | 058b9ff |
| 概览（KPI、面板、待处理） | 已完成 | 28048da |
| 入站（容器、分组、筛选） | 已完成 | 28048da |
| 订阅（列表、用量条、复制操作） | 已完成 | 本轮 |
| 转发（继承 kit；行内信息待补） | 部分 | 4d2a9e0 |
| 用户 / 分组 / 限额（列表与工具栏） | 已完成 | db93679 |
| 隧道（表格、类型标签、拖拽把手） | 已完成 | 本轮 |
| 设置（结构已 v3；表单控件待统一） | 部分 | c0007eb |
| 登录页（白底、深蓝、中文文案） | 已完成 | 本轮 |
| 表单控件（Input/Textarea/Select/Dialog） | 已完成 | c4cdd25 |
| 改密页（白底卡片、深蓝主操作、警示块） | 已完成 | 本轮 |
| 账户与登录 / 面板共享 / 我的订阅 | 已完成（列表与空态） | 本轮 |
| 转发详情 / 订阅弹窗 / 用户弹窗 / 隧道弹窗 | 待开始 | — |

## 10. 跟踪表

| 阶段 | 页面 | 状态 | 负责人 | 备注 |
|---|---|---|---|---|
| P0 | token / 壳 / kit | 已完成 | — | 598ed14：kit + 内核操作弹窗 + 375/768/1440 验证 |
| P1 | 概览 | 待开始 | — | 部分已 shadcn 化 |
| P1 | 服务器 | 部分 | — | 列表与内核弹窗已迁移；监控、详情表单待迁 |
| P1 | 入站 | 待开始 | — | 含表单弹窗 |
| P2 | 隧道 | 待开始 | — | 含隧道监控 |
| P2 | 转发 | 待开始 | — | 最大单页 3,347 行 |
| P2 | 订阅 | 待开始 | — | 含分享 |
| P2 | 面板分享 / 我的订阅 | 待开始 | — | — |
| P3 | 用户 / 分组 / 限额 | 待开始 | — | 权限相关 |
| P3 | 设置 / 个人中心 / 改密 | 待开始 | — | 表单密集 |
| P3 | 登录 / Passkey / GitHub | 待开始 | — | 认证流 |
| P3 | 监控 / 中转 | 待开始 | — | — |
| P4 | 删除 bridge / QA / 文档 | 待开始 | — | 同步 AGENTS.md |
