# 这份 fork 改了什么

Hoplane 是 [FLYX](https://github.com/kure29/flyx) 的 fork，从 FLYX 3.3.41（commit `993cbab`）分出，之后独立演进，不再跟上游同步。

本文件记录改名（FLYX → Hoplane）时**动了哪些东西、哪些是故意没动的**，以及接手 GitHub 仓库后要点一次的地方。以后如果又做了一批品牌相关改动，接着往下记。

## 一、已改

### 品牌名与站点

| 位置 | 改动 |
|---|---|
| `README.md`、`NOTICE`、`AGENTS.md` | 品牌名、上游致谢（保留 kure29 / Sagit-chu / bqlpfy 的版权声明） |
| `doc/**` | VitePress 标题、`base: "/hoplane/"`、导航链接、示例里的 `app_name`、`99-flyx-tuning.conf` → `99-hoplane-tuning.conf` |
| `vite-frontend/index.html`、`src/config/site.ts`、`src/components/version-footer.tsx`、`src/demo/banner.tsx`、`src/pages/config.tsx`、`src/themes/**` | 页面标题、PWA 名称、页脚、主题作者、版权开关文案 |
| `doc/public/logo.png` | **未改**，还是上游的图；换 logo 时直接替换这个文件 |

### 仓库地址与镜像

| 位置 | 改动 |
|---|---|
| `install.sh`、`panel_install.sh` | `REPO="jlthzy/hoplane"` |
| `docker-compose-v4.yml`、`-v6.yml` | `ghcr.io/jlthzy/...`（镜像名仍是 `flux-panel-backend` / `vite-frontend`，见下文） |
| `go-backend/internal/http/handler/upgrade.go` | `githubRepo` 默认值（发版时 CI 还会用 `-ldflags` 覆盖成实际仓库） |
| `vite-frontend/.env.production`、`src/config/site.ts`、`src/components/version-footer.tsx` | `VITE_GITHUB_REPO` 与兜底地址 |
| `.github/workflows/*`、`.github/ISSUE_TEMPLATE/*`、`doc/.vitepress/config.mts` | 演示站 base、issue 模板、讨论区链接（原 Telegram 群换成本仓库 Discussions） |
| `skills/flvx-api` → `skills/hoplane-api` | 目录名、npm 包名 `@jlthzy/hoplane-api`、安装路径 `~/.agents/skills/hoplane-api` |

### 后端/agent 里的默认值

| 位置 | 改动 |
|---|---|
| `go-backend/internal/store/repo/repository.go` | 默认 `app_name` = `Hoplane`；迁移规则仍认旧的 `flux`、`FLVX` 值 |
| `go-backend/internal/http/handler/{notify,passkey}.go` | 通知默认标题、WebAuthn RP Display Name |
| `go-backend/internal/runtime/nftables/runner.go` | 报错文案 |
| `go-gost/x/kernel/*`、`x/socket/*` | 内核日志前缀 `[flyx]` → `[hoplane]`、traceroute 载荷、sysctl 文件名 |

## 二、故意没改（改名只做了一半，是有意的）

下面这些标识符出现在**存储、进程、容器、系统路径或环境变量契约**里，改动会和"改名"这种纯文案改动混在一起，风险大于收益。等自己的发版流程跑通一轮后再单独做一次破坏性变更。

| 保持原样 | 原因 |
|---|---|
| 环境变量 `FLVX_WEBAUTHN_ORIGIN`、`FLVX_POSTGRES_TEST_DSN`、`FLVX_BASE_URL` / `FLVX_USERNAME` / `FLVX_PASSWORD`、`FLUX_*` | 和部署配置、AI skill 的调用方式绑定，改名要同步改 compose、文档、skill 和测试 |
| `localStorage` 键 `flvx:*`、`flyx_login_rows_*`、`flyx_github_state` | 只影响浏览器本地缓存，改不改都能跑；要改就单独提交，免得和业务改动混在一起 |
| 容器名 `flux-panel-backend`、镜像名 `flux-panel-backend` / `vite-frontend` / `flux-agent`、Compose 项目名 `flvx-panel`、部署目录 `/opt/flvx-panel` | 面板自升级靠这些名字定位容器，改名要连 `upgrade.go`、`panel_install.sh` 一起改并验证升级路径 |
| agent 安装目录 `/etc/flux_agent`、systemd 单元 `flux_agent.service`、二进制 `flux_agent`、发布资产 `gost-<arch>` | 已装机器上的升级/回滚依赖这些路径 |
| nft 表 `inet flvx`、`inet flvx_kernel` | 规则同步与计数读取的契约 |
| Go module 路径 `go-backend`、`github.com/go-gost/x` | 后者来自 GOST fork，改它要同步改 `replace` 和几百处 import |
| `plans/`、`docs/superpowers/`、`doc/changelog.md` 里的历史记录 | 历史文档，改了就失真 |

## 三、接手 GitHub 仓库要做的

1. 建空仓库 `jlthzy/hoplane`（**不要**勾选自动生成 README），然后推送；`main` 分支要允许 Actions 写入（Settings → Actions → General → Workflow permissions 选 *Read and write*）。
2. Pages：Settings → Pages → Source 选 *Deploy from a branch* → `gh-pages` / `(root)`，第一次 `deploy-docs.yml` 跑完才有这个分支。
3. Discussions：Settings → Features 里打开，issue 模板里指向它。
4. 发版：Actions → *Build and Push Images* → Run workflow，填版本号（如 `0.1.0`）。构建前记得在 `doc/changelog.md` 加上 `## 0.1.0` 段，release notes 会取那一段。镜像推到 `ghcr.io/jlthzy/*`，需要在个人设置里给这个仓库放开 `packages: write`（默认的 `GITHUB_TOKEN` 通常够用）。
5. `publish-skill.yml` 会在打 `v*` tag 时把 skill 发到 npm：没打算发就先把这个 workflow 停掉，或者配上 `NPM_TOKEN`。
6. 如果 GitHub 用户名不是 `jlthzy`：`grep -rl 'jlthzy' --exclude-dir=.git . | xargs sed -i '' 's|jlthzy|你的用户名|g'`，然后 `gofmt -l` 与 CI 各跑一遍。

## 四、改名时做过的验证

- `cd go-backend && go build ./...`、`go vet ./...`、`go test ./...`（见提交说明里的结果）
- `cd go-gost && go build ./...`
- `cd vite-frontend && pnpm install && pnpm run build`、`pnpm run lint`
- `grep -rn 'kure29'` 只剩历史文档与版权声明（这是对的，GPL 要求保留）
