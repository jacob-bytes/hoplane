# UI 刷新（2026-10）

方向 **B：中性底 + 靛蓝点缀**。目标是把 0.x 的"液态玻璃"换成 shadcn 语汇：中性灰面、一像素描边、单一强调色，灵动来自交互而不是阴影和渐变。

## 已落地（第一阶段）

### 1. 设计令牌

`src/styles/globals.css` 重写为两套完整 token（亮/暗），`src/styles/tailwind-theme.pcss` 把它们接进 Tailwind v4：

| 令牌 | 亮色 | 暗色 | 用途 |
|---|---|---|---|
| `--background` | `#fafafa` | `#09090b` | 页面底 |
| `--card` | `#ffffff` | `#121214` | 卡片、面板 |
| `--muted` | `#f4f4f5` | `#18181b` | 次级底色、空态 |
| `--accent` | `#f4f4f5` | `#1f1f23` | hover / 选中底 |
| `--border` / `--input` | `#e4e4e7` | `#26262a` / `#2f2f35` | 描边 |
| `--primary` | `#4f46e5` | `#6366f1` | 强调色（靛蓝） |
| `--secondary` | `#7c3aed` | `#a78bfa` | 第二强调（紫罗兰，少量） |
| `--success` / `--warning` / `--danger` | `#059669` / `#d97706` / `#dc2626` | 更亮的对应值 | 只表示状态 |

同时补上了原先缺失的 `--card-foreground`、`--popover`、`--muted-foreground`、`--accent-foreground`、`--destructive`，并把 radius 收敛成一套（6 / 8 / 12 / 16 / 20 px）。数字色阶（`--default-*`、`--primary-*` …）保留并重新取色，HeroUI facade 和旧页面继续可用。

`themes/default` 由脚本从 `globals.css` 生成，两处不会再漂移；`themes/types.ts` 补齐了新 token 的类型。

### 2. 原语层

`components/ui/*`：

- **Card**：去掉内联渐变 + `backdrop-filter: blur(24px)`，改成 `bg-card border border-border shadow-xs`，圆角 12px
- **Button**：shadcn 四态（default / outline / ghost / destructive）+ 150ms 过渡、`active:scale-.98`、`focus-visible:ring-2 ring-ring/40`
- **Input / Textarea**：`bg-card border-input` + hover 加深描边 + 聚焦 ring
- **Badge / Tabs / Progress / Table**：统一到语义 token，表头 12px muted，行 hover 用 `bg-muted/50`
- **bridge**：`solid` 按钮从"10% tint"改成真正的实心主色；彩色阴影全部去掉；`backdrop-blur` 清零

### 3. 壳层与共享件

- `layouts/admin.tsx`：侧栏从悬浮玻璃卡片改成齐边面板（`bg-card border-r`），导航项 40px 高、`text-muted-foreground`，选中态 `bg-accent` + 靛蓝图标（保留 `layoutId` 滑动）
- `components/page-kit.tsx`：页标题 20px/600，描述 13px muted；页签改成下划线式（2px 靛蓝，滑动）；搜索框从灰药丸改成描边输入框；列表行从白色药丸改成 `rounded-lg border` + hover 浅底
- `pages/dashboard`：四张指标卡统一成中性图标块 + 靛蓝进度条，只有超额时才升到 warning/danger；"需要处理"从琥珀渐变卡改成 `bg-warning/5 + border-warning/20`

## 量化

| 指标 | 之前 | 现在 |
|---|---|---|
| 直接调色板类 | 320 | 151（剩余多为延迟/协议等语义色，见下阶段） |
| 语义 token 使用 | 378 | 1172 |
| `backdrop-blur` | 45 | 0 |

## 进度

- ✅ 阶段一：令牌 + 原语 + 壳层 + 概览页
- ✅ 批次二：服务器 / 隧道 / 订阅 / 用户（颜色纪律：计量条、类型标签、延迟色、开关）
- ✅ 批次三：节点 / 中转 / 配置（弹窗、Select、Dropdown 换成 flat 面；行内动作按钮降级为描边/文字；配置分组收紧）
- ✅ 批次四：H5 与图表（底栏从玻璃改实底、卡片允许收缩；recharts 轴线/tooltip/线条改用 token，并关掉线条动画）

> 截图方法备注：`--window-size=390` 的 headless 截图不会应用移动端 viewport，
> 看起来像溢出；用 CDP 的 `Emulation.setDeviceMetricsOverride` 实测
> `scrollWidth == clientWidth == 390`，页面本身没有横向溢出。

- ✅ 收尾：监控图表系列色进 `lib/chart-theme.ts`；公告横幅去渐变；空状态带图标；列表行 hover 有描边回馈

## 阶段二：对齐 shadcn dashboard 骨架

参考外部项目的排版后新增的一轮，目标是"齐边侧栏 + 顶栏面包屑 + 表格化列表"：

- ✅ 侧栏改为齐边通栏（`bg-card border-r`），去掉外描边与圆角；内容区不再整体内缩
- ✅ 新增 48px 顶栏，左侧面包屑 `后台 › 分组 › 当前页`（移动端带菜单按钮）
- ✅ `ListGroup` 在桌面变成"一个描边容器 + 分隔线行"，手机端仍是独立卡片
- ✅ 服务器页作为样板：桌面表格 + 列头（名称 / CPU·内存·磁盘 / 网速 / 本月流量 / 延迟），手机回退卡片
- ✅ `ListTable` + `ListRow cells`：桌面端表头与行共用一套 `grid-template-columns`，对齐不再靠手调宽度
- ✅ 服务器页改用 grid 行（CPU/内存/磁盘、网速、本月流量各自独立成列），手机端仍走标题/元信息/右侧卡槽
- ⏳ 其余列表页（节点 / 隧道 / 转发 / 订阅 / 用户）迁列头

## UX / 无障碍修复（对照 ui-ux-pro-max 清单）

- 弹窗遮罩原来用 `foreground/25`，暗色下其实是**白色蒙层**，改为 `black/40`（暗色 60%）
- 弹窗高度不受限时会把底部按钮挤出视口：正文改为最大 60vh 滚动、页脚固定并加分隔线
- 状态点只有颜色：补 `sr-only` 文本；侧栏折叠按钮补 `aria-label`；搜索框补可读名称
- 导航项加 `aria-current="page"`；新增"跳到主内容"链接与 `main` 地标
- Toast 从硬编码绿/红改成 token（popover 面板 + success/destructive 图标色）
- 低对比文本（`muted-foreground/70`，约 3:1）统一为 `muted-foreground`（4.8:1）
- 移动端图标按钮补到 44px 触控区（`max-sm:min-h-11/min-w-11`）
- 拖拽手柄补 `role="button"` 与 `aria-label`

## 一致性打磨（P1/P2）

- ✅ 页面容器统一：列表页 `max-w-[1440px]`、设置页 `max-w-3xl`，内边距一律 `px-6 py-6`
- ✅ 字号收敛：去掉 9/10/13/13.5/15px 半档，只留 11 / 12 / 14 / 16 / 20
- ✅ 调色板清空：约 110 处 raw palette 与 2 处彩色阴影映射到语义 token
- ✅ 账户页：头像改主色实心，退出登录改描边危险样式
- ✅ 设置页：从"多条独立卡片"改为"一张卡 + 分隔线"
- ✅ 密度切换：顶栏按钮切换舒适/紧凑，`data-density` 落 localStorage
- ✅ 表头 sticky，数字列右对齐（服务器页）

## 交互批次（P3/P4/P5）

- ✅ `⌘K` / `Ctrl+K` 命令面板：页面跳转 + 新建操作，↑↓ 选择、回车打开
- ✅ 面包屑「后台」可点回概览；侧栏折叠后悬停显示名称
- ✅ 列表骨架屏（列表页首屏），替代转圈
- ✅ 列表入场动画（20ms 递进、`prefers-reduced-motion` 关闭）
- ✅ 订阅空态补主行动按钮
- ✅ 服务器表头可排序（名称 / CPU / 内存 / 磁盘 / 网速 / 本月流量），拖拽时自动取消排序
- ✅ 行结构重构：行不再是 `role=button`，主操作改为铺满整行的底层按钮，开关/拖拽/复制等控件浮在其上
- ✅ 表格语义：列表容器 `role=table`、表头 `role=row` + `role=columnheader`、行 `role=row` + `role=cell`（node/relay/tunnel/user/forward）；订阅与入站用 `role=list/listitem`

## 密度与中转列宽修正

- 密度 CSS 之前只作用在行容器上，而表格行的高度在内部的栅格层，所以切换没有效果；
  现在行高统一读 `--row-py`（舒适 12px / 紧凑 6px），表格页 88px → 76px 生效
- 密度按钮增加选中态与提示文字（`当前：紧凑间距`）
- 中转页列宽从 `1fr / 34rem` 改为 `minmax(14rem,18rem) / 1fr`，
  每条线路补上入口地址（`192.0.2.21:31001`），不再是大段空白

## 顶栏折叠按钮

- 侧栏折叠按钮从底部移到顶栏最左，与面包屑之间用 1px 竖线分隔
- 侧栏底部只保留版本号；折叠后版本号自动隐藏
- 移动端沿用 H5 布局，不受影响

## 第三轮扫描的 10 个问题

| # | 问题 | 结果 |
|---|---|---|
| 1 | 弹窗尺寸不统一 | 默认宽度 `max-w-lg` → `max-w-xl`，长表单不再挤 |
| 2 | 图标两套 | 侧栏与移动端底栏的内联填充 SVG 全部换成 lucide 线性图标 |
| 3 | 排序只覆盖服务器 | 抽出 `SortHeader`，用户（名称/用量）、订阅（名称/用量）、节点（名称/流量）也支持排序 |
| 4 | 图表不可访问 | 流量/监控/隧道/延迟图表补 `role="img"` 与 `aria-label`，标题图标换 lucide |
| 5 | 命令面板是静态清单 | 打开时拉取服务器与订阅，支持直接跳到某个实体的搜索结果（`?q=`） |
| 6 | 删除/操作无撤销 | 新增 `toastUndo`，节点启用/停用可一键撤销 |
| 7 | 空态无插画 | `EmptyHint` 增加内联线稿插图，全部列表页继承 |
| 8 | 移动端无密度入口 | H5 顶栏加密度切换按钮（与桌面同一份偏好） |
| 9 | 内联样式与魔法数字 | 列模板从 5 处内联 `style` 迁到 `[data-list]` CSS 变量 |
| 10 | 图表体积 | 图表已是独立懒加载 chunk（`lazy-charts`）；rolldown 不支持 vendor 手工分包，未强拆 |

## 侧栏字号与中转线路信息

- 侧栏导航标签 14px → 13px（只作用于导航 chrome，正文仍是 14）
- 中转行补全链路：`入口 → 目标`、转发/隧道名、端口/隧道类型标签；无线路的行右侧补一个占位破折号，
  中间不再是大段空白

## 组件层 shadcn 化（第三轮）

- 新增 `ui/sheet`（Radix Dialog + side 变体），移动端 ActionSheet 改为底部抽屉，桌面端浮在底部居中
- Badge 改为 shadcn 变体（default/secondary/outline/destructive/success/warning），90 处调用点按原色映射重写
- Chip 保留为 Badge 的薄包装（旧代码兼容）
- 新增 `ui/tooltip`、`ui/avatar`、`ui/skeleton`、`ui/command`(cmdk)
- 设置页分组换成 Radix Accordion；toast 全量迁到 sonner；用户/订阅列表分页

## 下一阶段（按价值排序）

1. **P3 页面批次**：节点 / 隧道 / 订阅 / 用户 / 分组 / 限速 → 入站 / 中转 / 配置 / 监控 / 我的订阅
2. **H5 移动端**：`layouts/h5.tsx` 底栏与页面内边距；顺带修 390px 宽度下指标卡右侧被裁掉的问题（这是改造前就存在的）
3. **弹窗批次**：`dialog/modal` 的头尾间距、表单栅格、危险操作确认样式
4. **图表**：recharts 的轴/网格/tooltip 统一到 muted-foreground + border
5. **动效清单**：列表 stagger、骨架屏、数字 tabular、空态插画

## 验收方式

`VITE_DEMO=true` 构建后用 headless Chrome 截图（1280/1440 桌面 + 390 手机，亮/暗各一遍）。改版前的基线图在本地 `.screenshots/`（不提交）。
