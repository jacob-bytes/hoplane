# 方案 B 展开：panel 仓 / agent 仓分离

> **决策记录（2026-10-25）**
> - agent 长期保持 Go，不做 Rust 重写（相关分析已归档为 `docs/agent-rust-rewrite.md`，状态：暂缓）
> - `hoplane` 仓的后端后续会重写为 Rust，当前保持不变
> - 因此：**按角色拆**（panel / agent），不按语言拆；拆仓应发生在后端 Rust 重写**之前**
>
> 这三条不改变下面的方案，只影响两处：agent 仓不需要为双语言做准备；panel 仓的语言重写要等契约层稳定之后再动。

## 一、目标仓库边界

```
hoplane/                      # 控制面
├── go-backend/               # 后端（将来可换成 rust-backend，目录替换）
├── vite-frontend/            # 前端
├── doc/                      # 用户文档站（VitePress）
├── panel_install.sh          # 只负责装面板
├── docker-compose-v4/v6.yml  # 只含面板与 PG
└── .github/workflows/{ci,docker-build,deploy-docs}.yml

hoplane-agent/                # 节点端
├── go-gost/                  # 当前实现（gost fork）
├── install.sh                # agent 安装脚本
├── test-install-scripts-*.sh # 安装脚本回归
├── protocol/                 # ★ 新增：跨仓契约
│   ├── README.md             # 信封、命令、版本、能力名
│   ├── schema/*.json         # 每条命令的 JSON Schema
│   └── fixtures/*.jsonl      # 录制好的请求/响应对
└── .github/workflows/{ci,docker-build}.yml
```

移动清单（一次性）：`go-gost/**`（572 文件）、`install.sh`、`test-install-scripts-alpine.sh`、`test-install-scripts-proxy.sh`、`.github/workflows` 里的 `build-gost` / `build-agent-image` 两个 job。

留在 panel：`doc/**`（用户文档继续写，链接改成 agent 仓）、`panel_install.sh`、compose、`skills/`。

## 二、跨仓契约：protocol/

这是拆仓后**唯一**的编译期无关依赖，值得单独投入。

**1. 版本协商**（现有握手扩展）

```
/system-info?type=1&secret=…&version=1.4.2&protocol=2&caps=kcp,mws,proxyproto…
```

- `protocol`：整数，agent 支持的最高协议版本
- `caps`：逗号分隔的能力名，面板据此禁用不支持的选项（KCP、端口跳跃、白名单…）
- 面板侧维护 `agent_min`（建议版本）与 `protocol_supported`（区间），不匹配时 UI 直接提示"该节点的 agent 需升级到 ≥1.4"，而不是下发命令后静默失败

**2. 兼容规则**

- agent 同时支持 `protocol N` 与 `N-1`，至少跨一个大版本
- panel 支持 `protocol N` 与 `N-1`
- 破坏性改动（例如 0.2.0 那次环境变量 / nft 表改名）：agent 先发（新旧都认），panel 下个 minor 再切换默认值，最后 agent 移除旧路径

**3. 契约测试**

- `fixtures/*.jsonl`：每条命令一组「请求 → 响应」，由 agent 仓在 CI 里回放（Go/Rust 都能跑）
- panel 仓 e2e 用同一批 fixtures 校验自己生成的 payload 合法（JSON Schema 校验）
- 这样两边语言怎么换都不影响契约

## 三、版本与发布

| 项 | 规则 |
|---|---|
| panel 版本 | `v0.4.0`（tag 在 panel 仓） |
| agent 版本 | `v1.4.2`（tag 在 agent 仓，独立演进） |
| 面板固定的 agent 版本 | 配置项 `agent_version`（默认值随面板 release 更新），节点页可单独覆盖 |
| 兼容矩阵 | panel 0.4.x ↔ agent 1.0–1.9（写在 panel 仓 `docs/compat.md`，发版时校验 tag 存在） |
| 镜像 | `ghcr.io/jacob-bytes/hoplane-agent:1.4.2`（agent 仓推）；面板镜像仍由 panel 仓推 |
| 安装命令 | `https://github.com/jacob-bytes/hoplane-agent/releases/download/v1.4.2/install.sh` |

### 面板里要改的地方（17 处 `githubRepo`）

| 用途 | 改成 |
|---|---|
| 节点安装命令、agent 镜像名、agent 升级 | `agentRepo` + `agent_version` |
| 面板自升级（拉 compose）、面板备份 | `panelRepo` |
| GitHub 加速镜像白名单 | 两个都加 |

`resolveLatestReleaseByChannel()` 目前查"面板仓库的最新 release"，拆仓后要能查询**指定仓库**（agent 仓），并区分 channel（stable/dev）与 agent 明确版本。

### 旧命令兼容

0.3.x 的面板给用户生成过指向 panel 仓的 `install.sh` 链接。拆仓后：
- 方案一（推荐）：panel 仓在接下来 2 个版本里继续镜像一份 agent 资产（CI 从 agent release 下载再上传，约 +17 MB/版本）
- 方案二：直接切，文档给新命令（省事，但手里存了旧命令的人会 404）

## 四、CI 与 e2e

**agent 仓**

```
ci.yml:      gofmt / vet / go test ./... / installer 回归（alpine + systemd 代理测试）
docker.yml:  tag 触发 → amd64/arm64 构建 + UPX → 镜像 → release（二进制、install.sh、checksums）
```

**panel 仓**

```
ci.yml:          go test / pnpm build / lint / compose 镜像名校验
e2e.yml:         发版前 + 每晚
                 1) 读 agent_min → clone agent 仓对应 tag（公开仓，无需 token）
                 2) 构建 agent（或直接拉镜像）
                 3) 起面板（docker compose）
                 4) 用面板生成的安装命令装 agent
                 5) 跑四条主链路：节点上线、新建入站、建立隧道、订阅拉取
```

**漂移检测**：每周一次 `panel main + agent main` 的 e2e，提前发现协议漂移，而不是等发版。

## 五、工作量（人周）—— 修正之前的估算

之前给的 3.5–5 人周偏乐观，漏了协议层与 e2e 的真实成本。按可直接执行的粒度重估：

| 工作项 | 人周 |
|---|---|
| 仓库拆分与历史保留（`git subtree split -P go-gost`）、移动 installer 与测试 | 0.5–1 |
| agent 仓骨架：README/AGENTS、CI、release workflow、镜像、installer 回归 | 1–1.5 |
| panel 仓清理：移除 go-gost 与两个 job、调整 ci-build | 0.5 |
| **协议层**：版本/能力协商、schema、fixtures、panel 侧校验与 UI 提示 | 1.5–2 |
| `githubRepo` 拆分（17 处）、`agent_version` 配置、安装/升级链路 | 1 |
| 双仓发布流水线、兼容矩阵校验、changelog 拆分 | 1–1.5 |
| 旧命令兼容 + 文档改造（install/agent/upgrade 三篇） | 0.5–1 |
| 跨仓 e2e + 夜间漂移检测 | 1–1.5 |
| 真实演练：切一个 agent release + 一个 panel release，在测试 VPS 装一遍 | 1 |
| **合计** | **8–11** |

单人约 2–2.5 个月（含评审与演练）；两人并行 3–4 周。

## 六、迁移顺序（可回滚）

1. **协议先行**（不改仓库）：加 `protocol` / `caps` 参数、`agent_min` 配置、UI 提示。这一步独立可发。
2. `git subtree split -P go-gost` → 建 `hoplane-agent` 仓，推历史；`install.sh` 等一起搬。
3. agent 仓配 CI + 打第一个 tag `v1.0.0`，产物齐全（两个架构、install.sh、checksums、镜像）。
4. 用这个 tag 在测试 VPS 上装 agent，连**当前面板**（面板仍指向旧逻辑）——验证 agent 单独可用。
5. panel 仓：删 `go-gost/`，加 `agentRepo` + `agent_version=1.0.0`，改 17 处调用的归类；本地跑 e2e。
6. panel 发一个 minor，节点安装命令改指 agent 仓；同时镜像一份旧资产。
7. 观察两个版本后移除镜像；文档收尾。

任何一步出问题都能回退：第 5 步之前 panel 完全没变；第 5 步之后可用 `agentRepo=panel 仓` 的旧行为兜底（保留一个开关）。

## 七、和控制仓 Rust 化的关系

拆仓对 Rust 重写是**加分项**，顺序上建议"先拆仓、后重写"：

| 场景 | 拆仓后的好处 |
|---|---|
| 面板重写 Rust | agent 发版不受影响；用户可以用旧面板 + 新 agent，或新面板 + 旧 agent，靠兼容矩阵兜住 |
| agent 重写 Rust（暂缓） | agent 仓可以同时放 Go 与 Rust 两个二进制，灰度与回滚都在仓内完成，不牵扯面板 |
| 两者都想换语言 | 契约在 `protocol/`，语言无关；JSON Schema 可以直接生成 Rust 类型 |

**不建议同时做两件事**：先拆仓（8–11 人周）→ 协议加固 → 再动面板 Rust。两件事叠在一起，出问题时无法判断是契约问题还是重写问题。

## 八、风险

| 风险 | 缓解 |
|---|---|
| 版本错配 | 协议版本 + 能力协商 + `agent_min` 校验（前置工作，必须先做） |
| 跨仓改动要两次 PR/两次发布 | 兼容窗口：agent 先支持新旧两套，panel 后切；CI 加契约测试 |
| 发布顺序错误 | panel 发版前校验 `agent_min` tag 存在；e2e 用固定 tag |
| 旧安装命令 404 | 镜像资产两个版本 |
| 两个 issue 区 | panel 仓保留 "agent 问题" 模板引导到 agent 仓；或用一个 meta 仓做讨论区 |
| 跨仓 e2e 不稳定 | 固定 tag + 重试 + 只在发版前与夜间跑 |
| 维护成本上升 | 每个跨仓改动约 +1–3 天；用契约测试把"隐性成本"变成"显性红灯" |
