# Agent 仓与控制仓分离：可行性与方案

结论：**可行，代码层面几乎没有阻力**——`go-backend` 不 import `go-gost`，反过来也没有，两边只通过 WebSocket 上的 JSON 契约通信。真正绑在一起的是**版本号与发布产物**。因此建议先做"单仓双发布线"，把发布解耦；只有在 agent 需要独立演进节奏或独立维护者时，再拆成两个仓库。

## 一、现状：耦合到底在哪

| 维度 | 现状 | 是否阻碍拆分 |
|---|---|---|
| 代码 | 两个独立 Go module，零 import；只有注释互相引用 | 否 |
| 协议 | WS + JSON，同一份源码演进，**没有协议版本号** | **是（最大隐患）** |
| 版本号 | 面板与 agent 共用一个版本；节点安装时取"面板仓库的最新 release" | 是 |
| 发布产物 | 一个 workflow 产出：两个镜像 + 三个镜像 + agent 二进制 + install.sh + compose | 是 |
| 仓库地址 | `handler.githubRepo` 一个变量，**17 处引用**，同时服务面板自升级与 agent 安装/升级 | 是 |
| 安装脚本 | `install.sh` 在仓库根目录，随面板 release 一起上传；脚本从 `${REPO}` 取 `hoplane-agent-<arch>` | 是 |
| 文档/变更日志 | `doc/changelog.md` 同时写面板与 agent（用 **升级** 一行区分） | 轻 |

具体到代码：

- `node_mutations.go:361/364/375`：生成节点安装命令、拼接 agent 镜像名，用的是 `githubRepo` + `resolveLatestReleaseByChannel()`（查的是**面板仓库**的 release）。
- `system_upgrade.go:401/414`：面板自升级拉 compose，也用同一个 `githubRepo`。
- `install.sh:200`：`https://github.com/${REPO}/releases/download/${VERSION}/hoplane-agent-${ARCH}`。
- `docker-build.yml`：`build-gost`（两个架构 + UPX，最慢）→ `build-agent-image` → `build-vite` → `build-go-backend` → `create-release`。

## 二、三种方案

| | A. 单仓、双发布线 | B. 双仓（panel / agent） | C. 三仓（+ installer） |
|---|---|---|---|
| 做法 | 同一仓库两个 tag 前缀：`v0.4.0` 只出面板，`agent-v0.4.0` 只出 agent；两套 workflow | `go-gost` + `install.sh` + agent 测试拆到新仓；面板固定 agent 版本 | 再把安装脚本/部署清单单独抽一仓 |
| 版本 | 各自版本，面板内固定"建议 agent 版本" | 完全独立 | 完全独立 |
| 改动量 | **1.5–2.5 人周** | **3.5–5 人周** | 再加 1–2 人周 |
| 收益 | agent 单独发补丁（GOST 安全更新、内核版本）不用动面板；CI 时间减半 | 边界最清晰，可给 agent 单独权限/贡献者/issue | 部署逻辑复用 |
| 代价 | 仍共享 history/CI 文件，靠 tag 约定纪律 | 跨仓 e2e、双 issue 区、发布顺序 | 维护三个仓的同步 |
| 适用 | 单人/小团队、两边经常一起改 | agent 有独立节奏或外部维护者 | 有多套部署形态时 |

> 关键认知：拆分**不会**消除 0.2.0 那类"改环境变量/改 nft 表名"的痛苦——那是协议耦合，只能靠协议版本号 + 兼容窗口解决。拆仓只是让"发布节奏"解耦。

## 三、无论选哪种，都要补的 5 件事

1. **协议版本与能力协商**
   agent 在 WS 握手里上报 `protocol=2` 与 `capabilities=[...]`；面板维护"支持的协议区间"，不匹配就拒绝下发对应命令并在 UI 提示"请升级 agent"。目前只上报 `version` 字符串，用于展示。

2. **面板固定 agent 版本**
   把"节点安装版本 = 面板最新 release"改为读一个显式配置（`agent_version` 配置项或构建期常量）。`resolveLatestReleaseByChannel()` 之后要能查**指定仓库**的 release。

3. **拆开 `githubRepo`**
   变成 `panelRepo` / `agentRepo` 两个变量（ldflags 或配置），17 处逐一归类：节点安装/升级/镜像名 → agentRepo；面板自升级/备份下载 → panelRepo。

4. **安装脚本归属**
   脚本由 agent 仓拥有（它知道自己要装什么）；面板生成的命令直接指向 agent 仓的 `releases/download/<agent-version>/install.sh`。为了不弄坏 0.3.x 用户手里存下的旧命令，面板仓可以在接下来 2 个版本里继续镜像一份资产。

5. **跨仓 e2e**
   面板仓加一个定时/发版前 workflow：按面板里固定的 agent 版本 checkout agent 仓（公开仓可直接 clone），起面板 + agent 跑安装、升级、订阅、转发四条主链路。

## 四、工作量（人周）

| 工作项 | A | B |
|---|---|---|
| tag 前缀路由 + 两套 workflow | 0.5 | 1 |
| `githubRepo` 拆分 + 固定 agent 版本 | 0.5–1 | 0.5–1 |
| 协议版本 + 能力协商（两仓都要改） | 0.5–1 | 0.5–1 |
| 安装脚本/资产归属 + 旧命令兼容 | — | 0.5 |
| 仓库拆分与历史保留（subtree split） | — | 0.5–1 |
| 跨仓 e2e + 文档 + 变更日志拆分 | 0.5 | 1–1.5 |
| **合计** | **1.5–2.5** | **3.5–5** |

## 五、如果走 B：迁移步骤

1. `git subtree split -P go-gost` 保留 agent 历史 → 新仓 `hoplane-agent`，同时迁走 `install.sh`、`test-install-scripts-*.sh`、`go-gost/docker/`。
2. 新仓 CI：gofmt/vet/test + 双架构 UPX + agent 镜像 + installer 回归（几乎照搬现有 job）。
3. 新仓首个 release：`agent-v1.0.0`，资产 `hoplane-agent-amd64/arm64` + `install.sh` + checksums。
4. 面板仓删掉 `go-gost/` 与相关 job；`agentRepo` 指向新仓，`agent_version` 默认 `1.0.0`。
5. 面板发布时在 changelog 写清"需要 agent ≥ 1.0.0"；UI 上把面板版本与 agent 版本分开显示。
6. 连续两个版本镜像旧安装资产，之后移除。

## 六、风险

| 风险 | 影响 | 缓解 |
|---|---|---|
| 版本错配（新面板配旧 agent） | 命令解析失败、静默不生效 | 协议版本 + 能力协商 + 面板显式提示 |
| 改动跨两仓（环境变量、nft 表名） | 需要两次 PR、两次发布，回滚更麻烦 | 兼容窗口：agent 先支持新旧两套，面板下个版本再切 |
| 发布顺序 | 面板先发但 agent 未发 | 面板固定的 `agent_version` 必须已发布；CI 校验该 tag 存在 |
| 旧安装命令失效 | 用户手里的 curl 命令 404 | 镜像资产两个版本 / 文档给出新命令 |
| 跨仓测试脆弱 | CI 偶发失败 | e2e 用固定 tag，不用 main |

## 七、建议

1. **先做 A（1.5–2.5 人周）**：立刻拿到"agent 单独发安全补丁"和"CI 时间减半"的收益，改动面小、可回滚。
2. 观察一个季度，如果出现以下任一情况再拆 B：
   - agent 需要独立的发布节奏（例如跟进 GOST 上游安全修复，一月数次）
   - 有人只维护 agent（外部贡献者/另一个团队）
   - 面板与 agent 的版本矩阵复杂到需要独立 issue 区
3. 无论 A/B，**协议版本号与能力协商要先落地**——这是所有拆分方案的前置条件，也是 0.2.0 那次"env/nft 改名"痛的根因。
