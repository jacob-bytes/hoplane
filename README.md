<div align="center">

<img src="doc/public/logo.png" width="88" alt="Hoplane" />

# Hoplane

转发 + 节点搭建面板

在一个面板里管理服务器、节点与中转：一键部署 Xray / sing-box / Snell 节点，对接中转，生成订阅。

[在线演示](https://jacob-bytes.github.io/hoplane/demo/) · [使用文档](https://jacob-bytes.github.io/hoplane/) · [快速上手](https://jacob-bytes.github.io/hoplane/guide/getting-started) · [下载](https://github.com/jacob-bytes/hoplane/releases) · [讨论区](https://github.com/jacob-bytes/hoplane/discussions)

</div>

## 功能

- **多内核节点**：Xray、sing-box、Snell v4 / v5 按服务器安装；VLESS Reality、Hysteria2（端口跳跃）、TUIC、AnyTLS、NaïveProxy、ShadowTLS 等模板一键创建
- **证书**：自签、服务器上的证书文件，或由 sing-box 自动申请（ACME，HTTP / Cloudflare / 阿里云 DNS 验证）
- **对接中转**：端口转发、隧道转发，或“前置 → IX → 落地”多跳线路；入站白名单、真实客户端 IP
- **导入节点**：粘贴分享链接、Clash / sing-box / Surge 配置或订阅地址，别处搭好的节点也能对接中转
- **订阅**：参考 Sub-Store，节点组统一挑选节点、过滤、改名，多个订阅自由组合、加国旗、按地区分组，可分享给他人（独立凭据、到期自动断开）；按客户端自动返回 Clash / Mihomo、sing-box、Surge 或通用 base64
- **流量转发**：TCP / UDP 端口转发与隧道转发，配额、限速、单向或双向计费
- **面板内升级**：检查更新、一键升级

## 安装

面板（需要 Docker）：

```bash
curl -L https://github.com/jacob-bytes/hoplane/releases/latest/download/panel_install.sh -o panel_install.sh && chmod +x panel_install.sh && ./panel_install.sh
```

选 `1. 安装面板`，完成后访问 `http://服务器IP:6366`，默认账号 `admin_user` / `admin_user`，登录后请立即修改密码。

agent：在面板 **服务器** 页新建服务器，复制生成的安装命令到服务器上执行。

更多说明见 [使用文档](https://jacob-bytes.github.io/hoplane/)：[安装面板](https://jacob-bytes.github.io/hoplane/guide/install) · [安装 agent](https://jacob-bytes.github.io/hoplane/guide/agent) · [内核与协议](https://jacob-bytes.github.io/hoplane/guide/kernels) · [新建入站](https://jacob-bytes.github.io/hoplane/guide/nodes) · [对接中转](https://jacob-bytes.github.io/hoplane/guide/relay) · [延迟与回程](https://jacob-bytes.github.io/hoplane/guide/latency) · [订阅](https://jacob-bytes.github.io/hoplane/guide/subscription) · [升级](https://jacob-bytes.github.io/hoplane/guide/upgrade) · [常见问题](https://jacob-bytes.github.io/hoplane/guide/faq)

## 开发

```bash
# 后端（默认 :6365，SQLite）
(cd go-backend && go run ./cmd/paneld)

# 前端（:3000，代理到后端）
(cd vite-frontend && pnpm install && pnpm run dev)

# agent
(cd go-gost && go run .)

# 文档站
(cd doc && npm ci && npm run dev)
```

约定（JWT 不带 `Bearer`、`{code,msg,data,ts}` 响应信封、Repository 层等）见 [AGENTS.md](AGENTS.md)。

## 许可

以 GPLv3 发布，见 [LICENSE](LICENSE)；所含第三方代码的来源与许可见 [NOTICE](NOTICE)。

本项目 fork 自 [FLYX](https://github.com/kure29/flyx)，其上游为 [FLVX](https://github.com/Sagit-chu/flvx) 与 [flux-panel](https://github.com/bqlpfy/flux-panel)。原项目的版权与许可声明一并保留。

## 免责声明

本项目仅供个人学习与研究使用，仅限合法、合规用途。使用者须确保其使用行为符合所在国家或地区的法律法规，并自行承担使用本项目带来的一切风险。作者不对因使用本项目导致的任何后果承担责任，亦不提供任何形式的担保。禁止将本项目用于网络攻击、数据窃取、非法访问等任何违法或未经授权的行为。
