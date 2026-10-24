# 改名与标识符记录

Hoplane 是 [FLYX](https://github.com/kure29/flyx) 的 fork，从 FLYX 3.3.41（commit `993cbab`）分出，之后独立演进，不再跟上游同步。

改名分了两步：**0.1.0** 换品牌（文档、页面、仓库地址），**0.2.0** 换标识符（环境变量、容器、路径、nft 表、发布资产）。这份文件记录现在叫什么、哪些故意没改、旧部署靠什么活下来。

## 一、现在的名字

| 类别 | 现在 | 以前 |
|---|---|---|
| 面板镜像 / 容器 | `hoplane-panel-backend` | `flux-panel-backend` |
| 数据库容器 | `hoplane-panel-postgres` | `flux-panel-postgres` |
| 前端镜像 / 容器 | `hoplane-frontend` | `vite-frontend` |
| agent 镜像 | `hoplane-agent` | `flux-agent` |
| agent 容器 / 服务 / 二进制 | `hoplane_agent` | `flux_agent` |
| agent 安装目录 | `/etc/hoplane_agent` | `/etc/flux_agent` |
| 部署目录（容器内挂载点） | `/opt/hoplane-panel` | `/opt/flvx-panel` |
| 发布资产 | `hoplane-agent-amd64` / `-arm64` | `gost-amd64` / `-arm64` |
| nftables 表 | `inet hoplane`、`inet hoplane_kernel` | `inet flvx`、`inet flvx_kernel` |
| 内核配置里的 tag | `hoplane-u<id>`、`hoplane-ipv4-resolver` 等 | `flvx-*` |
| 浏览器本地键 | `hoplane:theme`、`hoplane_login_rows_*` 等 | `flvx:*`、`flyx_*` |
| sysctl 调优文件 | `/etc/sysctl.d/99-hoplane-tuning.conf` | `99-flyx-tuning.conf` |
| 临时文件 | `/tmp/hoplane-nft-*`、`hoplane-upgrade-helper-*`、`hoplane-github-cache` | `flvx-*` |

环境变量：

| 现在 | 以前 |
|---|---|
| `HOPLANE_WEBAUTHN_ORIGIN` | `FLVX_WEBAUTHN_ORIGIN` |
| `HOPLANE_KERNEL_DIR` | `FLVX_KERNEL_DIR` |
| `HOPLANE_DUMP`（内核配置导出，测试用） | `FLVX_DUMP` |
| `HOPLANE_POSTGRES_TEST_DSN`（CI） | `FLVX_POSTGRES_TEST_DSN` |
| `HOPLANE_AGENT_ADDR` / `_SECRET` / `_CONTAINER` / `_IMAGE_VERSION` | `FLUX_AGENT_*` |
| `HOPLANE_VERSION`（compose 镜像标签） | `FLUX_VERSION` |
| `HOPLANE_BASE_URL` / `HOPLANE_USERNAME` / `HOPLANE_PASSWORD` / `HOPLANE_TOKEN`（AI skill） | `FLVX_*` |

## 二、故意没改

| 保持原样 | 原因 |
|---|---|
| Go module 路径 `go-backend`、`go-gost`、`github.com/go-gost/x` | 最后一个是 GOST fork 的模块，改它要同步改 `replace` 和几百处 import，收益为零 |
| 数据库表名 / 列名（`user`、`forward`、`vite_config` 等） | 改了要做数据迁移，而表名对用户不可见 |
| `app_name` 迁移规则里的 `flux`、`FLVX` 字面值 | 这是**历史数据**的取值，不是标识符；改了就认不出老面板的旧配置 |
| `plans/`、`docs/superpowers/`、`doc/changelog.md`、`NOTICE` 里的 FLVX / flux-panel | 历史文档与上游版权声明，改了会失真，也不符合 GPL 的保留要求 |
| `go-gost/x/internal/util/grpc/proto/*.pb.go` | 生成代码 |

## 三、旧部署靠什么活下来

0.1.0 只活了一天，但这几处兼容代价很小，且覆盖真实场景（容器里就地升级的 agent、写死旧环境变量的 compose、按旧 header 对接的集成）：

- **环境变量**：`HOPLANE_WEBAUTHN_ORIGIN` 为空时读 `FLVX_WEBAUTHN_ORIGIN`；`HOPLANE_KERNEL_DIR` 为空时读 `FLVX_KERNEL_DIR`；agent 的 `HOPLANE_AGENT_ADDR` / `_SECRET` 为空时读 `FLUX_AGENT_*`；`InContainer()` 同时认 `FLUX_AGENT_CONTAINER=1`（旧容器里就地升级的 agent 仍会走容器路径）
- **API header**：`X-HOPLANE-API-Client` 优先，回落到 `X-FLVX-API-Client`
- **nftables**：agent 每次同步前删掉 `inet flvx` / `inet flvx_kernel`（面板经 SSH 应用转发规则时同样先删），避免旧表继续计数或拦端口
- **安装脚本**：agent 安装/升级时停用并删除旧的 `flux_agent` 服务、OpenRC 脚本和 `/etc/flux_agent`；面板安装/更新时删除旧的 `flux-panel-*` / `vite-frontend` 容器。named volume 用的是显式 `name:`（`sqlite_data`、`postgres_data`），不随 Compose 项目名变化，所以数据不会丢
- **面板给节点生成的 docker 安装命令**：先 `docker rm -f flux_agent` 再建新容器，旧容器不会占着端口

**不支持的就地升级**：0.1.0 的 agent 建议重装（重新生成安装命令），因为安装目录、服务名、容器名都变了；systemd 部署就地替换二进制仍可用（配置就在工作目录的 `config.json` 里）。

## 四、改名时做过的验证

- `go-backend`：`go build ./...`、`go vet ./...`、`go test ./...`（含 `tests/contract`）
- `go-gost`、`go-gost/x`：`go build ./...`、`go test ./kernel/... ./socket/...`
- `vite-frontend`：`pnpm build`（tsc + rolldown-vite）、`pnpm lint`
- `doc`：`npm ci && npm run build`
- `bash test-install-scripts-proxy.sh`（安装脚本回归）
- 冒烟：起后端 → 登录 → 读 `app_name` / `system/version` → `/flow/test` 200
