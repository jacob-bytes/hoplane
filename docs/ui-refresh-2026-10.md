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

## 下一阶段（按价值排序）

1. **P3 页面批次**：节点 / 隧道 / 订阅 / 用户 / 分组 / 限速 → 入站 / 中转 / 配置 / 监控 / 我的订阅
2. **H5 移动端**：`layouts/h5.tsx` 底栏与页面内边距；顺带修 390px 宽度下指标卡右侧被裁掉的问题（这是改造前就存在的）
3. **弹窗批次**：`dialog/modal` 的头尾间距、表单栅格、危险操作确认样式
4. **图表**：recharts 的轴/网格/tooltip 统一到 muted-foreground + border
5. **动效清单**：列表 stagger、骨架屏、数字 tabular、空态插画

## 验收方式

`VITE_DEMO=true` 构建后用 headless Chrome 截图（1280/1440 桌面 + 390 手机，亮/暗各一遍）。改版前的基线图在本地 `.screenshots/`（不提交）。
