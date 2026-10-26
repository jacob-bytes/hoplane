# 前端开发手册

> 配合 `DESIGN.md`（v2「仪器」方向）使用。规范回答"长什么样"，本手册回答"怎么写、怎么评审、怎么合并"。
> 适用于 `vite-frontend/` 全部新代码与迁移代码。

## 1. 范围与基本原则

- 技术栈：React 18 + TypeScript + rolldown-vite + Tailwind v4 + shadcn/radix。
- 一个页面一个主操作；一个组件一个职责；一个状态一个来源。
- **不引入新的 UI 依赖**（组件库、图标库、动画库）除非手册更新并说明理由。
- 先改 token / 基座，再改页面；禁止在页面里发明颜色、字号、圆角。
- 小步提交：一次提交只做一件事（一个页面、一个组件、一次 codemod）。

## 2. 目录与依赖边界

```
src/
  api/            请求与类型（唯一数据出口）
  components/
    ui/           shadcn 原子组件（可改 cva，不改 API）
    kit/          业务基座：Page、DataTable、Toolbar、Field、Dialog…
  pages/          路由页面（只做组合，不写基础样式）
  layouts/        壳：admin / h5 / h5-simple
  hooks/          可复用状态与实时逻辑
  styles/         globals.css + tailwind-theme.pcss（唯一 token 源）
  shadcn-bridge/  HeroUI 兼容层（迁移期保留，禁止新增引用）
```

规则：

- 页面只能 import `components/kit`、`components/ui`、`api`、`hooks`。
- 页面之间不互相 import；共享逻辑下沉到 `hooks` 或 `kit`。
- 组件不直接 `fetch`，数据由页面/hook 传入。
- 迁移期：新代码直接组合 `ui/*`；未迁页面继续走 bridge，**不得新增 bridge 组件**。

## 3. 样式规则

### Token 映射（v2 落地后）

| 语义 | Tailwind | 用途 |
|---|---|---|
| 页面底 | `bg-canvas` | body |
| 卡片/侧栏 | `bg-surface` | 卡片、表格容器 |
| 浮层 | `bg-raised` | 弹窗、下拉、输入 |
| 主文字 | `text-ink` | 标题、正文 |
| 次级 | `text-ink-2` | 说明 |
| 弱化 | `text-muted` | 表头、单位、meta |
| 线 | `border-hairline` | 1px 分隔 |
| 强线 | `border-hairline-strong` | hover、输入框 |
| 信号 | `text-signal` / `ring-signal` | 链接、焦点、选中 |
| 状态 | `text-success` / `text-warning` / `text-danger` | 状态文字与点 |

### 允许 / 禁止

| ✅ | ❌ |
|---|---|
| `bg-surface`、`border-hairline` | `bg-zinc-50`、`border-[#e5e5e5]` |
| `text-ink`、`text-muted` | `text-black/70`、`opacity-70` |
| `gap-2`、`p-4` | `space-y-3`、`mt-[7px]` |
| `rounded`（4）、`rounded-md`（6） | `rounded-2xl`、`rounded-full`（除计数） |
| `cn()` 组合条件类 | 模板字符串三元表达式 |
| 语义变体（`variant`） | 页面里覆盖组件颜色 |

例外：仅允许为网格模板写 arbitrary value，如 `[grid-template-columns:var(--list-cols)]`；必须加注释。

### 密度与尺寸

- 控件：32 / 36 / 40；行：36（密集）/ 44（常规）。
- 图标：16（默认）/ 14（行内）/ 20（空态）；`stroke-width: 1.5`。
- 一屏最多 4 种字号（见 DESIGN §3）。
- 数字必须 `font-mono tabular-nums`；单位小一号 `text-muted`。

## 4. 组件写法

### 4.1 原子组件（`components/ui`）

- 用 `cva` 管理变体，不写 `className` 条件拼接。
- 变体只增加**语义**（default/outline/ghost/destructive），不增加颜色名。
- 新增变体前先问：能否用现有变体 + 布局类解决？能就不加。
- 改 `ui/*` 必须全站截图（至少 dashboard / node / table / dialog）。

### 4.2 业务组件（`components/kit`）

一个组件只接受"数据 + 回调"：

```tsx
<DataTable
  rows={rows}
  columns={columns}
  loading={loading}
  error={error}
  empty={<EmptyState … />}
  onRetry={refetch}
/>
```

- 不接收 `children` 当万能插槽；槽位要具名（`empty`、`toolbar`、`footer`）。
- 不在组件内部发请求。
- 组件超过 **250 行**就拆；页面超过 **400 行**就拆子组件。

### 4.3 组合规则

- `SelectItem` 必须在 `SelectGroup`；`DropdownMenuItem` 在 `DropdownMenuGroup`。
- 弹窗必须有 `DialogTitle`；视觉隐藏用 `sr-only`。
- 空态用 `Empty`，加载用 `Skeleton`，错误用 `Alert` + 重试。
- 图标按钮必须有 `aria-label`；装饰图标 `aria-hidden`。

## 5. 页面骨架

```tsx
<Page>
  <PageHeader
    eyebrow="SERVERS / 01"          // 可选，仅拉丁
    title="服务器"
    description="装了 agent 的机器…"
    action={<Button>新建服务器</Button>}
  />
  <MetricStrip items={[…]} />       // 可选
  <Toolbar search={…} filters={…} view={…} />
  <DataTable … />
</Page>
```

- `Page` 负责最大宽度与内边距；页面不自己写 `px-6 py-6`。
- 列表页必须有：工具栏、表头、空/加载/错误。
- 详情页用 `<Facts items={[…]} />`（label 11 / value 14），不堆卡片。
- 设置页：左侧分区（Tabs 或锚点）+ 右侧 `FieldGroup`，保存固定在底部右对齐。

## 6. 数据与异步

- 所有请求走 `src/api`，统一 envelope `{code,msg,data,ts}`；`code !== 0` 当错误。
- 页面状态四件套：`data / loading / error / empty`，缺一不可。
- 初次加载用 `Skeleton`（保持最终布局尺寸）；超过 8s 显示"加载较慢 + 重新加载"。
- 刷新用局部 loading，不清空已有数据（避免闪烁）。
- 实时数据（WebSocket）断线要有提示与轮询兜底；不要在组件里裸连 WS。
- 乐观更新只用于低风险操作（开关、排序），失败要回滚并 toast。

## 7. 表单

- 使用 `Field` / `FormField`：`label` + 控件 + `description` + `error`，错误用 `aria-describedby` 关联。
- 校验时机：失焦校验；提交时聚焦第一个错误字段。
- 危险操作：`AlertDialog` 二次确认，说明后果，最终按钮 `danger`。
- 表单弹窗宽度 `max-w-lg`；字段超过 8 个改为整页或分步。
- 移动端输入 ≥44 高；键盘类型用 `type="email"` / `inputMode="numeric"`。
- 提交中：按钮 `disabled` + 文案不变；成功 toast + 关闭；失败保留输入。

## 8. 动效

- 只允许 DESIGN §6 的四种时刻；新增动效需在 PR 说明"表达什么状态变化"。
- 统一用 `motion` tokens；不写裸 `duration-300`。
- 位移动画只动 `transform` / `opacity`；不动 `width/height/top/left`。
- 页面切换：`opacity + translateY(6px)`，200ms；列表 stagger ≤6 项、24ms。
- 一律尊重 `prefers-reduced-motion`；关闭后不得有位移或缩放。

```tsx
const reduce = useReducedMotion();
<motion.div
  animate={{ opacity: 1, y: 0 }}
  initial={reduce ? false : { opacity: 0, y: 6 }}
  transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
/>
```

## 9. 无障碍契约

- 焦点环：2px `signal` + offset 2，禁止 `outline-none` 无替代。
- 图标按钮 `aria-label`；切换控件 `aria-pressed`；展开 `aria-expanded`。
- 状态 `role="status"`；错误 `role="alert"`；表格排序 `aria-sort`。
- 弹窗焦点进入内容、Esc 关闭、关闭后回到触发元素（Radix 默认，不破坏）。
- 对比度：正文 ≥4.5:1，大字/图形 ≥3:1；暗色单独测。
- 触控目标 ≥24×24（桌面）、≥44（移动主操作）。

## 10. 响应式

- 断点 375 / 768 / 1024 / 1440；先写移动端，再增强。
- 工具栏允许折行，但主操作不能掉到第二屏。
- 表格在 <1024 变列表行（`DataTable` 负责），不在移动端横向滚动。
- 弹窗 `max-h: calc(100dvh - 32px)`，内容区滚动，底部操作可见。
- 320 / 375 / 768 / 1440 四档截图；320 不允许逐字换行或数字重叠。

## 11. 代码风格

- 组件 `PascalCase`，hook `useXxx`，工具 `camelCase`。
- 一个文件一个导出组件；子组件同文件时不超过 3 个。
- import 顺序：react → 第三方 → `@/`（类型 → 组件 → 工具）。
- 不写 `any`；不确定时用 `unknown` + 收窄。
- 不写 `console.log`；调试用完删除。
- 注释只解释"为什么"，不解释"是什么"。

## 12. 评审清单（每个 PR 自查）

- [ ] 只改了一个主题，diff 可读
- [ ] 没有新增颜色/字号/圆角/阴影
- [ ] 没有 `space-y-*`、裸色值、手写 badge/empty/skeleton
- [ ] 空/加载/错误三态齐全
- [ ] 浅色 + 暗色截图
- [ ] 375 / 768 / 1440 无横向滚动；320 数字不重叠
- [ ] 键盘走查：Tab、Enter、Esc、焦点返回
- [ ] 图标按钮有 label；状态不只靠颜色
- [ ] `pnpm run lint` + `pnpm run build` 通过
- [ ] 行为与原来一致（请求次数、参数、缓存）

## 13. 迁移与弃用

- 迁移一页一提交，提交信息：`refactor(ui): migrate <page> to shadcn`。
- 迁移完成的页面禁止再 import `shadcn-bridge/heroui/*`。
- 新组件只加到 `components/ui` 或 `components/kit`，不新增 bridge 文件。
- 全部路由迁完后：删除 `src/shadcn-bridge/heroui/`、同步根 `AGENTS.md` 与本手册。
- 删除 bridge 前必须 `grep -rn "shadcn-bridge" src` 为 0，且 CI 绿。

## 14. 完成定义（DoD）

- [ ] 视觉符合 DESIGN.md v2（去 AI 化清单逐条通过）
- [ ] 组件 API 与命名符合本手册；无新增依赖
- [ ] 四档宽度 + 双主题验证
- [ ] 三态齐全，错误可恢复
- [ ] 动效 ≤200ms 且尊重 reduced-motion
- [ ] 无 console 报错；lint/build 通过
- [ ] 演示站数据与实际字段一致（若涉及 demo）

## 15. 提交与发布

- 作者：`jacob-bytes <jlthzy123@gmail.com>`；不加 `Co-Authored-By`。
- 提交信息用英文、祈使句、说明"为什么"。
- **未经明确批准，不打 tag、不触发 release**。
- 发版前在 `doc/changelog.md` 增加版本段（中文、日期、升级说明）。
