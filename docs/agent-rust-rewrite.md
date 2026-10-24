# Agent 用 Rust 重写：可行性与工作量

结论先说：**技术上完全可行，但用 Go 的现状并没有"必须换"的硬伤**——agent 已经是 CGO 关闭的静态二进制，`ldd` 无依赖，musl 上能直接跑。Rust 能换来更小的体积和常驻内存，代价是重写一个成熟转发生态，其中 KCP/FEC/smux 互通是最大的坑。下面给数据、方案和工期。

## 一、现状盘点（实测）

| 项 | 数据 |
|---|---|
| `go-gost/` 总行数 | 74,065（其中 `x/` 73,054） |
| agent 自有部分 | `x/socket` 5,405 行（WS 协议、命令分发、指标、tuning、traceroute）<br>`x/kernel` 2,710 行（内核下载/守护/日志/nft 计数） |
| 转发生态（继承 GOST） | 24 个 dialer、28 个 listener、15 个 connector |
| **面板实际用到的协议** | 隧道：`tls` / `mtls` / `ws` / `wss` / `mws` / `mtcp` / `kcp`<br>转发：`tcp` / `udp` + forwarder（多目标、failover、proxy protocol v1/v2） |
| 这部分对应的 Go 代码 | 约 10,200 行（listener/dialer 的子集 + handler/forward + limiter + service + chain） |
| 共享底层 | `x/internal` 9,387 行（mux、forwarder、tls、sniffing、grpc、pool…） |
| 二进制 | Go 静态链接 `-s -w`：**33.8 MB**；发布用 UPX `--best --lzma`：**约 8.8 MB** |
| 通信加密 | AES-256-GCM，key = SHA-256(secret)，base64(nonce‖ciphertext) |
| nftables | 调 `nft` CLI（不依赖 libnftnl，无 CGO） |

面板下发给 agent 的命令一共 27 种：`AddService/UpdateService/DeleteService/PauseService/ResumeService`、`AddChains/UpdateChains/DeleteChains`、`AddLimiters/UpdateLimiters/DeleteLimiters`、`AddCLimiters/…`、`KernelApply/KernelControl/KernelStatus`、`TuneApply/TuneStatus`、`TcpPing/UdpPing/Traceroute`、`UpgradeAgent/RollbackAgent`、`ServiceMonitorCheck`、`SetProtocol`。

## 二、Rust 能带来什么（去掉幻想）

| 指标 | 现在（Go） | Rust musl 预期 | 说明 |
|---|---|---|---|
| 体积 | 8.8 MB（UPX） | 3–6 MB | strip + LTO + opt-level=z；嵌 rustls 比 OpenSSL 小 |
| 常驻内存 | 估计 20–40 MB | 估计 5–10 MB | 未实测，量级来自同类 tokio 服务 |
| 启动 | 毫秒级 | 毫秒级 | 无差别 |
| 依赖 | 零（静态） | 零（musl 静态） | **这点 Go 已经做到了** |
| 内存安全 | GC + 边界检查 | 编译期保证 | 真实收益，但 GOST 现有代码没有已知 UAF |

也就是说：**"零依赖 musl"不是新增收益**，Go 的静态二进制在 Alpine/scratch 上一样跑。真正的收益是体积、内存和"完全自有代码"（现在 agent 是 gost 的 fork，协议演进跟着上游走）。

## 三、三种方案

### 方案 A：全量 Rust 重写（一个进程）

一次替换：控制面 + 数据面 + 内核管理 + nft + 升级。

```
hoplane-agent (tokio)
├── control   WS 客户端、AES-GCM、命令分发、心跳/重连、指标上报
├── proxy     服务生命周期、TCP/UDP 转发、forwarder、限流、proxy protocol
├── tunnel    chain 拨号/监听：tls/mtls/ws/wss/mws/mtcp/kcp
├── kernel    内核安装/校验/解压、配置写入、进程守护、日志环、geodata
├── net      nftables 计数与白名单、端口跳跃、用户 mark、sysctl 调优
├── host     metrics（/proc）、ICMP/TCP/UDP ping、traceroute
└── update   自升级/回滚（systemd/OpenRC/容器）
```

- 优点：单进程、内存最省、代码完全自有
- 缺点：要重新实现一个转发生态，工期最长，KCP 互通风险最高

### 方案 B：先重写"控制面 + 运维面"，数据面分两步

第一步 Rust 只做 `control / kernel / net / host / update`，TCP/UDP 端口转发也在 Rust 里实现（这部分简单），**隧道链暂时保留一个裁剪版 Go 进程**（只留 chain 相关 7 种协议），由 Rust agent 拉起来当子进程。

- 优点：6 个月内能上线，风险可控；面板协议、nft、内核管理这些"贴合业务"的部分先落地
- 缺点：双进程、部署与排障复杂；跨进程生命周期管理要额外设计

### 方案 C：不重写，先裁剪 Go（强烈建议先做）

面板只用 7 种协议，但二进制里编进了 24 dialers / 28 listeners。用 build tags 或改 `register.go` 只注册用到的协议，再重新 UPX：

- 预期：33.8 MB → 12–16 MB，UPX 后 4–6 MB；RSS 同步下降
- 工作量：**1–2 人周**（改动 + 全协议回归 + 发布链路）
- 风险：低（不动协议实现）

如果目标只是"agent 更小更省"，方案 C 的投入产出比远高于 A。

## 四、工作量分解（方案 A，单位：人周）

按 1 名熟悉 Rust + Linux 网络的资深工程师计，含测试，不含产品/项目管理。

| # | 模块 | 人周 | 风险 |
|---|---|---|---|
| 1 | WS 控制面：AES-GCM、信封、27 种命令、重连退避、心跳、指标上报 | 3–4 | 低（协议简单，可用 Go 抓包对照） |
| 2 | TCP 转发：listener、forwarder 多目标/failover、proxy protocol v1/v2 | 3–4 | 中（半关闭、超时、连接数语义） |
| 3 | UDP 转发：会话表、keepalive、TTL、NAT 语义 | 2–3 | 中（会话老化边界） |
| 4 | 隧道：TCP / TLS / MTLS（rustls） | 3–4 | 低 |
| 5 | 隧道：WS / WSS / MWS（HTTP upgrade、smux 帧兼容） | 4–6 | 中高（与 mux 语义对齐） |
| 6 | 隧道：MTCP | 2–3 | 中 |
| 7 | 隧道：**KCP**（kcp-go 互通：FEC、smux、窗口参数、nodelay 语义） | 6–10 | **最高** |
| 8 | 限流器：流量/连接、热更新、命名与面板对齐 | 2 | 低 |
| 9 | nftables：规则生成、原子应用、计数器读取、状态校准、白名单、端口跳跃、用户 mark | 3–4 | 中高（与旧表/旧计数器的兼容） |
| 10 | 内核管理：下载校验解压、配置写入、进程守护、日志、版本、geodata、重启退避 | 4–5 | 中 |
| 11 | 主机：metrics、ICMP/TCP/UDP ping、traceroute、sysctl 调优 | 2–3 | 中（raw socket/CAP_NET_RAW） |
| 12 | 自升级/回滚：systemd / OpenRC / 容器三种形态 | 2 | 中 |
| 13 | 打包发布：musl 双架构、CI、installer、assets、校验和 | 1–2 | 低 |
| 14 | 测试与灰度：协议互通矩阵、面板契约、3 发行版 × 2 架构、故障注入 | 4–6 | 高（工作量容易被低估） |
| | **合计** | **41–58** | |

换算：单人 **10–14 个月**；3 人并行 **4–5 个月**（KCP 可并行但要有人专职）。首版砍掉 KCP 的话 **35–48 人周**。

方案 B 的第一阶段（1/9/10/11/12/13 + 裁剪 Go 数据面子进程）：**16–22 人周**，3–4 个月可上线灰度。

## 五、兼容性与灰度设计

1. **协议字节级兼容**：先写一个"录制/回放"夹具——用 Go agent 连真实面板录下每个命令的请求/响应，Rust 侧逐条比对；这是最省事的契约测试。
2. **面板加 `agent_engine` 字段**（`go` / `rust`），安装命令按引擎选择 release 资产；未知引擎回落 Go。
3. **能力协商**：Rust agent 在连接参数里上报 `capabilities`（支持哪些隧道协议、是否有 KCP），面板据此禁用不支持的选项，而不是运行时报错。
4. **双跑灰度**：同一台机器先装 Rust agent（换二进制、保留 `/etc/hoplane_agent` 配置），观察 24h 的指标上报、转发计数、nft 表一致性，再批量。
5. **回滚**：release 同时提供两个二进制；`UpgradeAgent` 带引擎参数，回滚即换回 Go 版本。

## 六、风险清单

| 风险 | 影响 | 缓解 |
|---|---|---|
| KCP 与 kcp-go 不互通（FEC/smux 细节） | 隧道全挂 | 第一版不支持 KCP，面板按能力协商禁用；或保留 Go 子进程专跑 KCP |
| nft 计数器语义漂移 | 面板流量统计错、配额误判 | 用同一份 `nft -j list counters` 夹具做黄金测试 |
| 半关闭/超时/背压与 GOST 不一致 | 长连接被提前断开 | 用生产流量回放（tcpreplay + 连接生命周期脚本） |
| 升级路径（容器/systemd/OpenRC）分叉 | 升级变砖 | 三种形态各跑一遍 e2e，二进制替换用 rename + execvp |
| 双份实现长期维护 | 新功能要写两遍 | 灰度期设截止时间，面板侧命令加契约测试，超时未迁完就回滚 |
| Rust 人才与构建环境 | 交付节奏 | musl 交叉编译固定容器镜像，CI 缓存 |

## 七、建议

1. **先花 1–2 人周做方案 C（裁剪 Go）**，量出真实的二进制与 RSS。如果 4–6 MB / 10–15 MB RSS 已经满足目标，全量 Rust 的收益不足以覆盖 40+ 人周。
2. 如果目标里还有"完全自有协议栈、不再跟 gost 上游"，再走**方案 B**：先 Rust 化控制面与运维面，数据面用 Rust 写 TCP/UDP 转发，隧道暂时留 Go 子进程；KCP 最后做，或者永远留在 Go 子进程里。
3. **不要一开始就全量 A**。KCP + mws + proxy protocol 的组合是重写里最容易翻车的部分，先把 80% 的节点（只有端口转发 + tls/ws 隧道）迁到 Rust，收益就能拿到。

一句话总结：**方案可行，但当前收益主要是体积与内存；全量重写约 10–14 人月，分阶段（控制面先行）约 4–5 个月可灰度。先做 Go 裁剪实验再决定，是性价比最高的路径。**

## 八、增量路径：Rust 作为 sidecar 逐步接管

不是"重写"，而是把 agent 拆成两个进程，按能力一块块搬。go 继续当父进程，rust 先当子进程；后期交换父子关系，最后删掉 go。

### 8.1 四种集成方式的取舍

| 方式 | 保持 CGO_ENABLED=0 | 隔离性 | 复杂度 | 结论 |
|---|---|---|---|---|
| cgo 链接 Rust 静态库 | ✗（必须开 CGO） | 差（panic 跨边界即崩） | 高 | 不推荐 |
| purego + cdylib（dlopen） | ✓ | 差（同进程） | 中高（要 embed+释放 .so、ABI 约束） | 备选 |
| **sidecar 子进程 + JSON IPC** | ✓ | **好**（崩溃互不影响） | 中 | **推荐** |
| 协议层拆分（Rust 直连面板） | ✓ | 好 | 高（早期要复刻 WS/加密/命令） | 放到阶段 3 |

### 8.2 缝合线（按耦合度排序）

1. `x/kernel` 2,710 行：入口就是 `handleKernelCommand(cmdType, data) (interface{}, error)`，纯 JSON 请求/响应，无共享状态。
2. `x/socket/{tuning,traceroute,tcp_ping_queue}`：sysctl 写入、ICMP、并发探测，独立。
3. nft 天然分表：agent 只管 `inet hoplane_kernel`，面板经 SSH 管 `inet hoplane`，两边不会写同一张表。
4. 数据面 `service/chain/limiter`：耦合 gost registry，最后搬。

### 8.3 四个阶段

| 阶段 | 谁管什么 | 产出 | 人周 |
|---|---|---|---|
| S0 骨架 | Go 拉起 Rust sidecar，行分帧 JSON，健康检查、崩溃重启、随版本升级/回滚 | 管道跑通，能灰度 | 2–3 |
| S1 内核 | Rust 接管 kernel apply/control/status、下载校验解压、进程守护、日志环；Go 只做透传 | 内核功能完全落在 Rust | 6–9 |
| S2 运维 + 简单转发 | metrics、tuning、ping/traceroute、tcp/udp 端口转发（不含 chain）迁到 Rust | Go 只剩 chain | 6–9 |
| S3 换父进程 | Rust 直连面板（WS + AES-GCM + 27 命令），Go 降级为 chain 子进程 | 面板协议在 Rust | 6–10 |
| S4 收尾 | TLS/WS/MWS/MTCP 移植；KCP 最后或永久留 Go 子进程 | 删除 Go | 12–20 |
| | | **合计** | **32–51** |

比一次性重写（41–58）多花 4–6 人周在 IPC 和双进程运维上，换来的是每一步都能发布、能回滚、能止损。

### 8.4 关键设计

- **单一 owner 矩阵**：每个能力同一时刻只能有一个实现，禁止双写（内核 nft、tuning、升级尤其容易踩）。
- **IPC**：stdin/stdout 行分帧 JSON（零依赖、易调试）；大 payload（内核日志）加长度前缀。数据流量绝不走 IPC——Rust 自己 bind 端口。
- **升级顺序**：先 sidecar 后父进程，失败时两个一起回滚；`hoplane_agent --diag` 暴露 sidecar 版本与状态；握手校验版本，不匹配拒绝启动。
- **打包**：release 里两个二进制；或 `go:embed` + 启动时释放到 `/var/lib/hoplane/bin` 保持"单文件交付"的错觉。
- **容器模式**：两个二进制放进同一镜像，entrypoint 先起 sidecar 再起主进程。

### 8.5 止损条件

S1 做完（约 2 个月）时评估：如果 Rust 侧的内存/体积收益不足以抵消双进程复杂度，就地停住——sidecar 永久保留（内核管理在 Rust），Go 主进程不变。这本身也是一个合理终局。
