# Hoplane 前端设计规范

> 一页版。新代码必须遵守；迁移旧页面时以此为准。
> Token 的真实值在 `src/styles/globals.css`，映射在 `src/styles/tailwind-theme.pcss`。
> 本文只做**决策**，不复述 Tailwind 文档。

## 1. 原则

1. **一个页面只有一个主操作**（`variant="default"`），其余用 `outline` / `ghost`。
2. **只用语义 token**：`bg-card`、`text-muted-foreground`、`border-border`。禁止 `bg-blue-500`、`#fff`、`rgba(...)`。
3. **先定密度再画页面**：同一个视图里字号不超过 3 种，间距只用 4/8 的倍数。
4. **组件优先**：Table / Badge / Empty / Skeleton / Alert / Separator / ToggleGroup 已装，不要手写等价物。
5. **暗色是另一套设计，不是反色**：每个页面改完必须单独看暗色。

> **迁移期例外**：仓库当前约定是「只从 `src/shadcn-bridge/heroui/*` 导入」。
> 已经迁完的页面直接在 `src/components/ui/*` 之上组合；未迁页面继续走 bridge。
> 等全部路由迁完，再删除 bridge 并同步修改 `AGENTS.md` / `vite-frontend/AGENTS.md`。

## 2. 颜色

| Token | 浅色 | 暗色 | 用途 |
|---|---|---|---|
| `background` | `#fafafa` | `#09090b` | 页面底色 |
| `card` | `#ffffff` | `#121214` | 卡片、表格容器 |
| `popover` | `#ffffff` | `#131316` | 弹窗、下拉、Tooltip |
| `foreground` | `#09090b` | `#fafafa` | 主文字 |
| `muted-foreground` | `#71717a` | `#a1a1aa` | 次要文字、说明 |
| `muted` | `#f4f4f5` | `#18181b` | 弱背景、轨道、hover 底 |
| `accent` | `#f4f4f5` | `#1f1f23` | hover / 选中底 |
| `border` | `#e4e4e7` | `#26262a` | 分隔线、卡片描边 |
| `input` | `#e4e4e7` | `#2f2f35` | 输入框描边 |
| `ring` | `#2563eb` | `#3b82f6` | 焦点环 |
| `primary` | `#1d4ed8` | `#2563eb` | 主操作 |
| `success` | `#059669` | `#34d399` | 在线、健康、成功 |
| `warning` | `#d97706` | `#fbbf24` | 偏高、待处理 |
| `destructive` | `#dc2626` | `#ef4444` | 异常、删除、不可恢复 |

**图表**：`--chart-1…6` = 蓝 / 青 / 琥珀 / 绿 / 紫 / 红，浅暗各一套。图表只在 `ChartContainer` 内用这些变量。

**用法约束**

- 状态不能只靠颜色：在线要同时有文字/图标；丢包要写 `丢7%`，不能只标红。
- 危险操作永远用 `variant="destructive"` 或独立的 danger 区块，且与普通操作分开。
- 图标颜色跟随文字（`currentColor`），不要单独给图标上色。

## 3. 字体与字号

字体：`Geist`（正文）/ `Geist Mono`（数字、IP、版本、延迟）。数字列必须 `tabular-nums`。

| 级别 | 字号 / 行高 | 用途 |
|---|---|---|
| 页面标题 | 20 / 28，`font-semibold` | 每页一个（`PageHeader`） |
| 区块标题 | 16 / 24，`font-medium` | 卡片标题、弹窗标题 |
| 正文 | 14 / 20 | 按钮、输入、表格内容、菜单 |
| 次要 | 13 / 18 | 说明、表格表头、meta |
| 辅助 | 12 / 16 | 徽章、时间戳、脚注、图例 |
| 图表刻度 | 11 / 14 | **仅**坐标轴与图表标注 |

规则：

- 页面里**不要出现 15px / 13.5px / 任意 `text-[13.5px]`**。
- 表格正文 13（密集）或 14（常规），同一张表只能选一个。
- 说明文字用 `text-muted-foreground`，不要降低父级 opacity。
- 中文文案避免中英混排空格；版本号、IP 用 mono。

## 4. 间距与密度

只允许这组值：`1`(4px) `1.5`(6) `2`(8) `3`(12) `4`(16) `6`(24) `8`(32) `10`(40)。

| 场景 | 值 |
|---|---|
| 图标与文字 | `gap-1.5` / `gap-2` |
| 表单字段之间 | `gap-4`（`FieldGroup`） |
| 卡片内边距 | `p-4`，紧凑卡片 `p-3` |
| 卡片之间 | `gap-3`（列表）/ `gap-4`（区块） |
| 页面区块之间 | `gap-4` ~ `gap-6` |
| 页面内边距 | `p-4`，≥lg `p-6` |
| 弹窗内边距 | `p-4`，`DialogContent` 默认间距 |
| 表格行 | 表头 `h-8`，单元格 `py-1.5`（密集）/ `py-2.5`（常规） |
| 列表行 | 36px（密集）/ 44px（常规） |

**控制高度**

| 控件 | 高度 |
|---|---|
| `Button size="sm"` / 图例 chip | 28 / 24 |
| `Button`（默认） | 36 |
| `Button size="lg"` | 40 |
| `Input` / `Select` | 36 |
| `TabsList` | 36 |
| 图标按钮 | 36×36；表格内 28×28 |

移动端输入框高度 ≥44（`h-11`），桌面可 36。触摸目标最小 24×24。

## 5. 圆角与层级

| Token | 值 | 用途 |
|---|---|---|
| `rounded-sm` | 6px | 小徽章、chip |
| `rounded-md` | 8px | 按钮、输入、菜单项 |
| `rounded-lg` | 12px | 卡片、弹窗、表格容器 |
| `rounded-xl` | 16px | 大型面板、空态容器 |

层级只用三档：卡片 `shadow-none border`；浮层 `shadow-md`；弹窗 `shadow-lg`。不要出现 `shadow-2xl` 或彩色阴影。

## 6. 组件规范

### Button

- 变体：`default`（主）/ `outline`（次）/ `ghost`（表内、图标）/ `destructive`（危险）/ `link`。
- 一屏最多一个 `default`；表格行内用 `ghost` 或 `outline size="sm"`。
- 加载中：`disabled` + `Loader2 animate-spin`，不换文案；`motion-reduce:animate-none`。
- 图标：`<Icon data-icon="inline-start" />`，不加 `size-4`（组件负责尺寸）。

### Badge

- 状态：`success` / `warning` / `destructive` / `outline` / `secondary`。
- 数字型数据（延迟、流量）**优先等宽文字 + 数据条**，不要整列药丸。
- 线路标签统一 `variant="outline"`，同一种线路同一种颜色。

### Table

- 容器：`rounded-lg border`，表头无底色，行分隔 `border-border`。
- 表头 `h-8`、`text-xs text-muted-foreground font-normal`；正文 `text-[13px]`。
- 数字列右对齐 + `tabular-nums`；空值显示 `-`，不要空白。
- 列数 ≤6；超过就合并或做成详情。
- 空态用 `Empty`，加载用 `Skeleton` 行（3 行），不要转圈。

### Dialog

- 一律居中 `Dialog`；**禁止底部 ActionSheet**（移动端除外，且需 `Drawer`）。
- 结构：`DialogHeader`（标题 + 一句说明）→ 内容 → `DialogFooter`。
- 危险确认用 `AlertDialog`；表单弹窗宽度 `max-w-lg`，详情 `max-w-2xl`。
- 标题必须存在；视觉隐藏时用 `sr-only`，不能没有。

### Tabs / ToggleGroup

- 2–5 个互斥选项用 `Tabs`（页面级）或 `ToggleGroup type="single"`（筛选级）。
- 多选筛选（图例、标签）用 `ToggleGroup type="multiple"`，选中态用 `bg-muted`，不要描边堆叠。
- 图例类控件高度 24、字号 12，视觉重量不能超过它控制的内容。

### 空态 / 加载 / 错误

- 空：`Empty` + 一句为什么 + 一个动作。
- 加载：`Skeleton` 保持最终布局尺寸，避免跳动。
- 错误：`Alert variant="destructive"` + 重试按钮；不要用 toast 代替页面级错误。

### 图表

- 必须包在 `ChartContainer` 里；颜色用 `--chart-*`。
- 必须有：单位、图例（可点）、Tooltip、空态、加载骨架。
- 阈值线用 `ReferenceLine`，异常区间用 `ReferenceArea`（阈值 ≥20% 丢包或超时，避免满屏条纹）。
- Tooltip 用 `bg-popover` + `border` + `shadow-lg`，不透明、不跟随动画。

## 7. 页面模板

```
PageHeader
  标题（20/semibold） + 一句说明（13/muted）
  右侧：唯一主操作 [+ 次级操作]
────────────────────────────────
筛选行：Search / Select / ToggleGroup   （右对齐：视图切换）
────────────────────────────────
内容：Table 或 Card 列表
  空态 / 加载 / 错误 三态齐全
```

详情页：面包屑 → 标题 + 状态 Badge → 事实网格（2–4 列，label 12 / value 14）→ 分区卡片 → 危险区（单独卡片，底部）。

设置页：左侧分区导航（或 Tabs）+ 右侧 `FieldGroup`，保存按钮固定在底部右侧。

## 8. 文案

- 用动词开头：「保存」「重新检测」「从面板移除」。
- 说明写后果，不写实现：「从面板移除；agent 留在机器上」。
- 单位与数字之间加空格：`54 ms`、`1.2 GB`、`3 个入站`。
- 不用「点击这里」「请稍等」；加载态由组件表达。
- 中文标点用全角，英文/数字两侧不加空格（`CN2 GIA` 这类专有名词除外）。

## 9. 动效

- 只动 `transform` / `opacity`；时长 150–200ms；退出比进入快（≈60%）。
- 弹窗从触发位置缩放淡入；不要从屏幕边缘滑入（除移动端 Drawer）。
- 全部加 `motion-reduce:animate-none`；图表默认关闭入场动画。

## 10. 无障碍

- 焦点环必须可见（`focus-visible:ring-2 ring-ring`），不能 `outline-none` 了事。
- 图标按钮必须有 `aria-label`；纯装饰图标 `aria-hidden`。
- 状态变化用 `role="status"`；错误用 `role="alert"`。
- 颜色对比：正文 ≥4.5:1，大字/图形 ≥3:1；暗色单独测。
- 表格要有表头语义；排序加 `aria-sort`。
- 弹窗打开后焦点进入内容，关闭后回到触发元素（Radix 默认，别破坏）。

## 11. Do / Don't

| ✅ Do | ❌ Don't |
|---|---|
| `flex flex-col gap-3` | `space-y-3` |
| `bg-muted` / `text-muted-foreground` | `bg-zinc-100` / `text-gray-500` |
| `<Badge variant="success">在线</Badge>` | `<span className="text-green-600">在线</span>` |
| `<Empty …>` | 手写居中 div + 图标 |
| `<Skeleton className="h-6 w-full" />` | `animate-pulse` 自造块 |
| `<Separator />` | `<div className="border-t" />` |
| 每页一个 `default` 按钮 | 三个蓝色主按钮并排 |
| 表格数字右对齐 + 等宽 | 数字居中、比例字体 |
| 弹窗标题 + 说明 | 只有标题、说明塞进 placeholder |

## 12. 交付前自检

- [ ] 该文件不再 import `@/shadcn-bridge/heroui/*`（仅当该页标记为"已迁移"）
- [ ] 没有 `space-y-*`、没有裸色值、没有手写 badge/empty/skeleton
- [ ] 字号只用了 12/13/14/16/20（图表 11 除外）
- [ ] 间距全部来自 4/8 体系
- [ ] 浅色 + 暗色都截图看过
- [ ] 375 / 768 / 1440 三档不横向滚动
- [ ] 空 / 加载 / 错误 三态齐全
- [ ] Tab 顺序正确，焦点环可见，图标按钮有 label
- [ ] `pnpm run lint` + `pnpm run build` 通过
