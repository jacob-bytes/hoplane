import type { SubscriptionItem } from "@/api";
import type {
  ForwardApiItem,
  InboundApiItem,
  InboundRelayApiItem,
  KernelApiItem,
  NodeApiItem,
  TunnelApiItem,
} from "@/api/types";

import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRightLeft,
  CalendarClock,
  ChevronRight,
  CircleAlert,
  Globe,
  Rss,
  Server,
  TriangleAlert,
} from "lucide-react";

import {
  getForwardList,
  getInboundList,
  getInboundRelays,
  getKernelList,
  getNodeList,
  getSubscriptions,
  getTunnelList,
} from "@/api";
import { AnimatedPage } from "@/components/animated-page";
import { PageLoadingState } from "@/components/page-state";
import {
  markPageCached,
  pageCached,
  useCachedState,
} from "@/hooks/use-cached-state";
import { formatTraffic } from "@/utils/traffic";

const DAY = 86400000;
const SOON = 3 * DAY;

function daysLeft(ms: number): string {
  const d = Math.ceil((ms - Date.now()) / DAY);

  return d <= 0 ? "已到期" : `剩 ${d} 天`;
}

/** One problem; problems of the same kind are shown as one group. */
interface Issue {
  kind: IssueKind;
  level: "danger" | "warning";
  /** What the problem is about, shown as a chip, e.g. a node's name. */
  name: string;
  /** Extra detail on the chip's tooltip. */
  detail: string;
}

type IssueKind =
  | "offline"
  | "expired"
  | "expiring"
  | "kernel"
  | "inbound"
  | "probe"
  | "subflow"
  | "subexpire";

const KINDS: Record<
  IssueKind,
  { label: (n: number) => string; hint: string; path: string }
> = {
  offline: {
    label: (n) => `${n} 个服务器离线`,
    hint: "agent 没有连接面板，检查服务器上的 agent 是否在运行",
    path: "/node",
  },
  expired: {
    label: (n) => `${n} 个服务器已到期`,
    hint: "续费后在服务器里更新到期时间",
    path: "/node",
  },
  expiring: {
    label: (n) => `${n} 个服务器即将到期`,
    hint: "3 天内到期",
    path: "/node",
  },
  kernel: {
    label: (n) => `${n} 个内核出错`,
    hint: "在服务器 → 内核里查看日志",
    path: "/node",
  },
  inbound: {
    label: (n) => `${n} 个节点未运行`,
    hint: "内核已停止或等待下发，服务器上线后会自动补上",
    path: "/inbound",
  },
  probe: {
    label: (n) => `${n} 个节点连不上`,
    hint: "从面板服务器检测",
    path: "/inbound",
  },
  subflow: {
    label: (n) => `${n} 个分享订阅流量快用完`,
    hint: "用到 90% 以上；用完后自动断开",
    path: "/subscription",
  },
  subexpire: {
    label: (n) => `${n} 个分享订阅即将到期`,
    hint: "3 天内到期或已到期",
    path: "/subscription",
  },
};

/** A headline figure, in the upstream metric card style. */

type KpiKey = "online" | "running" | "forwards" | "subs";
type KpiHistory = Record<KpiKey, number[]>;

const KPI_HISTORY_KEY = "hoplane:dashboard:kpi-history";
const KPI_KEYS: KpiKey[] = ["online", "running", "forwards", "subs"];

function readKpiHistory(): KpiHistory {
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(KPI_HISTORY_KEY) || "{}",
    ) as Partial<KpiHistory>;

    return Object.fromEntries(
      KPI_KEYS.map((key) => [
        key,
        Array.isArray(parsed[key])
          ? parsed[key]!.filter((value) => Number.isFinite(value)).slice(-12)
          : [],
      ]),
    ) as KpiHistory;
  } catch {
    return { online: [], running: [], forwards: [], subs: [] };
  }
}

/** Keeps a short client-side history so KPI cards can show a sparkline. */
function useKpiHistory(values: Record<KpiKey, number>, ready: boolean) {
  const [history, setHistory] = useState(readKpiHistory);
  const latest = useRef(values);

  latest.current = values;

  useEffect(() => {
    if (!ready) return;

    const append = () => {
      setHistory((prev) => {
        const next = Object.fromEntries(
          KPI_KEYS.map((key) => [
            key,
            [...prev[key], latest.current[key]].slice(-12),
          ]),
        ) as KpiHistory;

        try {
          window.localStorage.setItem(KPI_HISTORY_KEY, JSON.stringify(next));
        } catch {
          // Private mode: keep the in-memory history.
        }

        return next;
      });
    };

    append();
    const timer = window.setInterval(append, 30000);

    return () => window.clearInterval(timer);
  }, [ready]);

  return history;
}

function kpiDelta(values: number[]) {
  if (values.length < 2) return 0;

  return values[values.length - 1] - values[values.length - 2];
}

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 3) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const points = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * 60;

      return `${x.toFixed(1)},${(18 - ((value - min) / span) * 16).toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg
      aria-hidden
      className="h-5 w-14 shrink-0 text-primary/60"
      viewBox="0 0 60 20"
    >
      <polyline
        fill="none"
        points={points}
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function Metric({
  label,
  icon: Icon,
  value,
  total,
  foot,
  footTone,
  footRight,
  onClick,
  spark,
  delta,
}: {
  label: string;
  icon: typeof Server;
  value: number;
  spark?: number[];
  delta?: number;
  /** Shown as "value / total" with a bar, when set. */
  total?: number;
  foot: string;
  footTone?: "danger" | "warning" | "success";
  footRight?: string;
  onClick: () => void;
}) {
  const pct = total ? Math.round((value / total) * 100) : 0;

  return (
    <button
      className="rounded-xl border border-hairline bg-raised p-4 text-left transition-colors duration-150 hover:border-hairline-strong"
      type="button"
      onClick={onClick}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[12px] text-muted-foreground">
          {label}
        </span>
        <Icon
          aria-hidden
          className="h-4 w-4 flex-shrink-0 text-muted-foreground"
        />
      </div>
      <div className="mt-1.5 flex items-end justify-between gap-2">
        <div className="font-mono text-2xl font-medium tabular-nums tracking-tight">
          {value}
          {total !== undefined && (
            <span className="ml-1 font-sans text-xs font-normal text-muted-foreground">
              / {total}
            </span>
          )}
          {delta ? (
            <span
              className={`ml-1.5 font-sans text-[11px] font-normal ${delta > 0 ? "text-success-600" : "text-destructive"}`}
            >
              {delta > 0 ? `+${delta}` : delta}
            </span>
          ) : null}
        </div>
        {spark ? <Sparkline values={spark} /> : null}
      </div>
      <div className="mt-3 h-1 overflow-hidden rounded-full bg-muted">
        {total !== undefined && total > 0 && (
          <div
            className="h-full rounded-full bg-primary"
            style={{ width: `${pct}%` }}
          />
        )}
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px]">
        <span
          className={`truncate ${
            footTone === "danger"
              ? "text-destructive"
              : footTone === "warning"
                ? "text-warning-600"
                : footTone === "success"
                  ? "text-muted-foreground"
                  : "text-muted-foreground"
          }`}
        >
          {foot}
        </span>
        {footRight && (
          <span className="shrink-0 text-muted-foreground">{footRight}</span>
        )}
      </div>
    </button>
  );
}

function Panel({
  title,
  badge,
  action,
  className,
  contentClassName,
  children,
}: {
  title: string;
  badge?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  /** Lets a list stretch to fill a card that the grid made taller. */
  contentClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`flex flex-col rounded-xl border border-hairline bg-raised p-4 lg:p-5 ${className ?? ""}`}
    >
      <div className="mb-3 flex shrink-0 items-center gap-2">
        <h2 className="text-[15px] font-medium">{title}</h2>
        {badge}
        {action && <div className="ml-auto">{action}</div>}
      </div>
      <div className={contentClassName ?? "min-w-0"}>{children}</div>
    </section>
  );
}

const PAGE = "admin-overview";

/** The admin's overview: health of nodes → landings → relays → subscriptions. */
export function AdminOverview() {
  const navigate = useNavigate();
  // A revisit shows the last data at once and reloads in the background.
  const [loading, setLoading] = useState(() => !pageCached(PAGE));
  const [nodes, setNodes] = useCachedState<NodeApiItem[]>(PAGE, "nodes", []);
  const [kernels, setKernels] = useCachedState<KernelApiItem[]>(
    PAGE,
    "kernels",
    [],
  );
  const [inbounds, setInbounds] = useCachedState<InboundApiItem[]>(
    PAGE,
    "inbounds",
    [],
  );
  const [relays, setRelays] = useCachedState<InboundRelayApiItem[]>(
    PAGE,
    "relays",
    [],
  );
  const [subs, setSubs] = useCachedState<SubscriptionItem[]>(PAGE, "subs", []);
  const [forwards, setForwards] = useCachedState<ForwardApiItem[]>(
    PAGE,
    "forwards",
    [],
  );
  const [tunnels, setTunnels] = useCachedState<TunnelApiItem[]>(
    PAGE,
    "tunnels",
    [],
  );

  const load = useCallback(async () => {
    try {
      const [n, k, i, r, s, f, t] = await Promise.all([
        getNodeList(),
        getKernelList(),
        getInboundList(),
        getInboundRelays(0),
        getSubscriptions(),
        getForwardList(),
        getTunnelList(),
      ]);

      if (n.code === 0) setNodes(n.data ?? []);
      if (k.code === 0) setKernels(k.data ?? []);
      if (i.code === 0) setInbounds(i.data ?? []);
      if (r.code === 0) setRelays(r.data ?? []);
      if (s.code === 0) setSubs(s.data?.items ?? []);
      if (f.code === 0) setForwards(f.data ?? []);
      if (t.code === 0) setTunnels(t.data ?? []);
      markPageCached(PAGE);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 30000);

    return () => window.clearInterval(timer);
  }, [load]);

  const now = Date.now();
  const online = nodes.filter((n) => n.status === 1).length;
  const kernelDown = (i: InboundApiItem) =>
    i.enabled && !i.external && i.kernelStatus !== "running";
  // A stopped kernel is reported as such, not as a failed probe.
  const probeDown = (i: InboundApiItem) =>
    i.enabled &&
    !kernelDown(i) &&
    Boolean(i.probe && !i.probe.skipped && !i.probe.ok);
  const badInbound = (i: InboundApiItem) => kernelDown(i) || probeDown(i);
  const enabledInbounds = inbounds.filter((i) => i.enabled);
  const runningInbounds = enabledInbounds.filter((i) => !badInbound(i));
  const relaysUp = relays.filter(
    (r) => r.forwardExists && r.forwardStatus === 1,
  );
  const forwardsUp = forwards.filter((f) => f.status === 1);
  const tunnelsUp = tunnels.filter((t) => t.status === 1);
  const shares = subs.filter((s) => s.kind === "share");
  const activeSubs = subs.filter((s) => s.active);

  const issues: Issue[] = [];

  for (const n of nodes) {
    if (n.status !== 1) {
      issues.push({
        kind: "offline",
        level: "danger",
        name: n.name,
        detail: "agent 没有连接面板",
      });
    }
    if (
      n.expiryTime &&
      n.expiryTime - now <= SOON &&
      !n.expiryReminderDismissed
    ) {
      const expired = n.expiryTime <= now;

      issues.push({
        kind: expired ? "expired" : "expiring",
        level: expired ? "danger" : "warning",
        name: n.name,
        detail: daysLeft(n.expiryTime),
      });
    }
  }
  for (const k of kernels) {
    if (k.status === "error") {
      issues.push({
        kind: "kernel",
        level: "danger",
        name: `${k.nodeName} · ${k.kernelType}`,
        detail: k.lastError || "查看内核日志",
      });
    }
  }
  for (const i of inbounds) {
    // Kernel errors are listed per kernel above.
    if (kernelDown(i) && i.kernelStatus !== "error") {
      issues.push({
        kind: "inbound",
        level: "warning",
        name: i.name,
        detail: `${i.nodeName} · ${i.kernelStatus}`,
      });
    }
    if (probeDown(i)) {
      issues.push({
        kind: "probe",
        level: "warning",
        name: i.name,
        detail: i.probe?.error || "连不上",
      });
    }
  }
  for (const s of shares) {
    const used = s.uploadBytes + s.downloadBytes;

    if (s.enabled && s.trafficLimit && used >= s.trafficLimit * 0.9) {
      issues.push({
        kind: "subflow",
        level: s.overQuota ? "danger" : "warning",
        name: s.name,
        detail: `${formatTraffic(used)} / ${formatTraffic(s.trafficLimit)}`,
      });
    }
    if (s.enabled && s.expireTime && s.expireTime - now <= SOON) {
      issues.push({
        kind: "subexpire",
        level: s.expireTime <= now ? "danger" : "warning",
        name: s.name,
        detail: daysLeft(s.expireTime),
      });
    }
  }
  const groups = (Object.keys(KINDS) as IssueKind[])
    .map((kind) => {
      const items = issues.filter((i) => i.kind === kind);

      return {
        kind,
        items,
        level: items.some((i) => i.level === "danger") ? "danger" : "warning",
      };
    })
    .filter((g) => g.items.length > 0)
    .sort((a, b) => (a.level === b.level ? 0 : a.level === "danger" ? -1 : 1));

  const up = inbounds.reduce((t, i) => t + i.uploadBytes, 0);
  const down = inbounds.reduce((t, i) => t + i.downloadBytes, 0);
  const top = [...inbounds]
    .filter((i) => !i.external && i.uploadBytes + i.downloadBytes > 0)
    .sort(
      (a, b) =>
        b.uploadBytes + b.downloadBytes - (a.uploadBytes + a.downloadBytes),
    )
    .slice(0, 4);
  const topMax = top[0] ? top[0].uploadBytes + top[0].downloadBytes : 1;

  const expiring = [
    ...nodes
      .filter(
        (n) =>
          n.expiryTime &&
          n.expiryTime - now <= 30 * DAY &&
          !n.expiryReminderDismissed,
      )
      .map((n) => ({
        key: `n${n.id}`,
        kind: "服务器",
        name: n.name,
        at: n.expiryTime ?? 0,
        path: "/node",
      })),
    ...shares
      .filter(
        (s) => s.enabled && s.expireTime && s.expireTime - now <= 30 * DAY,
      )
      .map((s) => ({
        key: `s${s.id}`,
        kind: "订阅",
        name: s.name,
        at: s.expireTime,
        path: "/subscription",
      })),
  ]
    .sort((a, b) => a.at - b.at)
    .slice(0, 5);

  const attention = [
    ...groups.map((g) => {
      const danger = g.level === "danger";
      const meta = KINDS[g.kind];
      const hint =
        g.kind === "probe" && g.items[0].detail
          ? `${meta.hint}：${g.items[0].detail}`
          : meta.hint;

      return {
        key: `issue:${g.kind}`,
        icon: danger ? CircleAlert : TriangleAlert,
        danger,
        title: meta.label(g.items.length),
        hint,
        meta: "去处理",
        path: meta.path,
      };
    }),
    ...expiring.map((e) => ({
      key: `expiry:${e.key}`,
      icon: CalendarClock,
      danger: false,
      title: `${e.kind} · ${e.name}`,
      hint: "订阅即将到期",
      meta: daysLeft(e.at),
      path: e.path,
    })),
  ];

  const shownNodes = [...nodes].sort((a, b) => a.status - b.status).slice(0, 6);
  const kpiHistory = useKpiHistory(
    {
      online,
      running: runningInbounds.length,
      forwards: forwardsUp.length,
      subs: activeSubs.length,
    },
    !loading,
  );

  if (loading) return <PageLoadingState message="正在加载..." />;

  return (
    <AnimatedPage className="mx-auto w-full max-w-[1440px] flex flex-col gap-4 px-6 py-6">
      <div>
        <h1 className="text-lg font-semibold">概览</h1>
        <p className="text-xs text-muted-foreground">
          {new Date().toLocaleDateString("zh-CN", {
            month: "long",
            day: "numeric",
            weekday: "long",
          })}
          {" · 每 30 秒自动刷新"}
        </p>
      </div>

      {nodes.length === 0 && (
        <section className="rounded-xl border border-hairline bg-raised p-4 lg:p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-[15px] font-medium">开始使用</h2>
            <span className="text-xs text-muted-foreground">
              按顺序完成下面四步
            </span>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["1", "添加服务器", "填写 IP、端口和备注", "/node"],
              ["2", "安装 agent", "在服务器执行安装命令", "/node"],
              ["3", "配置节点", "创建入站和协议", "/inbound"],
              ["4", "创建订阅", "选择节点组并分发给用户", "/subscription"],
            ].map(([step, title, hint, path]) => (
              <button
                key={step}
                className="flex min-w-0 items-start gap-3 rounded-lg border border-hairline bg-surface/50 p-3 text-left transition-colors hover:border-hairline-strong hover:bg-surface"
                type="button"
                onClick={() => navigate(path)}
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 font-mono text-xs text-primary">
                  {step}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">
                    {title}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {hint}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <Metric
          delta={kpiDelta(kpiHistory.online)}
          foot={
            nodes.length === 0
              ? "还没有服务器"
              : `${online === nodes.length ? "全部在线" : `${nodes.length - online} 个离线`}${
                  kernels.length ? ` · 内核 ${kernels.length} 个` : ""
                }`
          }
          footRight={
            nodes.length
              ? `${Math.round((online / nodes.length) * 100)}%`
              : undefined
          }
          footTone={
            nodes.length > online
              ? "danger"
              : nodes.length
                ? "success"
                : undefined
          }
          icon={Server}
          label="服务器在线"
          spark={kpiHistory.online}
          total={nodes.length}
          value={online}
          onClick={() => navigate("/node")}
        />
        <Metric
          delta={kpiDelta(kpiHistory.running)}
          foot={
            enabledInbounds.length === 0
              ? inbounds.length === 0
                ? "还没有节点"
                : "全部停用"
              : `${
                  runningInbounds.length === enabledInbounds.length
                    ? "全部正常"
                    : `${enabledInbounds.length - runningInbounds.length} 个异常`
                }${relays.length ? ` · 中转 ${relaysUp.length}/${relays.length}` : ""}`
          }
          footRight={
            inbounds.length > enabledInbounds.length
              ? `${inbounds.length - enabledInbounds.length} 个停用`
              : undefined
          }
          footTone={
            runningInbounds.length < enabledInbounds.length
              ? "warning"
              : enabledInbounds.length
                ? "success"
                : undefined
          }
          icon={Globe}
          label="节点运行"
          spark={kpiHistory.running}
          total={enabledInbounds.length}
          value={runningInbounds.length}
          onClick={() => navigate("/inbound")}
        />
        <Metric
          delta={kpiDelta(kpiHistory.forwards)}
          foot={
            forwards.length === 0
              ? "还没有转发规则"
              : `${
                  forwardsUp.length === forwards.length
                    ? "全部运行"
                    : `${forwards.length - forwardsUp.length} 条已暂停`
                }${tunnels.length ? ` · 隧道 ${tunnelsUp.length}/${tunnels.length}` : ""}`
          }
          footTone={
            forwards.length > forwardsUp.length
              ? "warning"
              : forwards.length
                ? "success"
                : undefined
          }
          icon={ArrowRightLeft}
          label="转发运行"
          spark={kpiHistory.forwards}
          total={forwards.length || undefined}
          value={forwardsUp.length}
          onClick={() => navigate("/forward")}
        />
        <Metric
          delta={kpiDelta(kpiHistory.subs)}
          foot={
            subs.length === 0
              ? "还没有订阅"
              : activeSubs.length === subs.length
                ? "全部有效"
                : `${subs.length - activeSubs.length} 个失效`
          }
          footRight={shares.length ? `分享 ${shares.length} 个` : undefined}
          footTone={
            activeSubs.length < subs.length
              ? "warning"
              : subs.length
                ? "success"
                : undefined
          }
          icon={Rss}
          label="有效订阅"
          spark={kpiHistory.subs}
          total={subs.length}
          value={activeSubs.length}
          onClick={() => navigate("/subscription")}
        />
      </div>

      <Panel
        badge={
          attention.length > 0 && (
            <span className="rounded-full bg-destructive/10 px-2 text-xs font-semibold text-destructive">
              {attention.length}
            </span>
          )
        }
        title="需要处理"
      >
        {attention.length === 0 ? (
          <p className="py-3 text-sm text-success-600">一切正常</p>
        ) : (
          <div className="max-h-[320px] divide-y divide-border overflow-y-auto">
            {attention.map((item) => {
              const Icon = item.icon;

              return (
                <button
                  key={item.key}
                  className="flex w-full items-center gap-3 py-2.5 text-left transition-colors hover:text-foreground"
                  type="button"
                  onClick={() => navigate(item.path)}
                >
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center ${item.danger ? "text-destructive" : "text-warning"}`}
                  >
                    <Icon aria-hidden className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {item.title}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {item.hint}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {item.meta}
                  </span>
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
                </button>
              );
            })}
          </div>
        )}
      </Panel>

      <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-2">
        <Panel
          action={
            <span className="text-xs text-muted-foreground">
              {formatTraffic(up + down)}
            </span>
          }
          className="h-full"
          contentClassName="flex min-h-0 flex-1 flex-col"
          title="节点流量"
        >
          <div className="mb-2 flex shrink-0 items-center gap-5 text-sm">
            <span className="text-muted-foreground">
              ↑ <span className="text-foreground">{formatTraffic(up)}</span>
            </span>
            <span className="text-muted-foreground">
              ↓ <span className="text-foreground">{formatTraffic(down)}</span>
            </span>
          </div>
          {top.length === 0 ? (
            <p className="py-1 text-center text-xs text-muted-foreground">
              还没有流量数据（导入的节点不统计流量）
            </p>
          ) : (
            <>
              <div className="grid min-h-0 flex-1 auto-rows-fr">
                {top.map((i) => {
                  const total = i.uploadBytes + i.downloadBytes;
                  const share =
                    up + down > 0 ? Math.round((total / (up + down)) * 100) : 0;

                  return (
                    <div
                      key={i.id}
                      className="grid min-h-0 grid-cols-[minmax(0,1fr)_minmax(48px,1fr)_92px_40px] items-center gap-3 py-1.5"
                    >
                      <span className="truncate text-sm">{i.name}</span>
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{
                            width: `${Math.max(3, (total / topMax) * 100)}%`,
                          }}
                        />
                      </div>
                      <span className="text-right font-mono text-[11px] text-muted-foreground">
                        {formatTraffic(total)}
                      </span>
                      <span className="text-right text-[11px] tabular-nums text-muted-foreground">
                        {share}%
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="mt-2 shrink-0 border-t border-border pt-2 text-[11px] text-muted-foreground">
                合计 {formatTraffic(up + down)} · 前 {top.length} 个节点
              </div>
            </>
          )}
        </Panel>

        {nodes.length > 0 && (
          <Panel
            action={
              <button
                className="flex items-center text-xs text-primary"
                type="button"
                onClick={() => navigate("/node")}
              >
                查看全部
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            }
            className="h-full"
            contentClassName="flex min-h-0 flex-1 flex-col"
            title="服务器状态"
          >
            <div className="grid min-h-0 flex-1 auto-rows-fr grid-cols-1">
              {shownNodes.map((n) => {
                const onlineNode = n.status === 1;
                const ip = String(n.serverIpV4 || n.serverIp || "");

                return (
                  <button
                    key={n.id}
                    className="flex min-w-0 items-center gap-2.5 py-1.5 text-left transition-colors hover:text-foreground"
                    type="button"
                    onClick={() => navigate("/node")}
                  >
                    <span
                      className={`h-1.5 w-1.5 shrink-0 rounded-full ${onlineNode ? "bg-success" : "bg-destructive"}`}
                    />
                    <span className="min-w-0 flex-1 truncate text-sm">
                      {n.name}
                    </span>
                    <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                      {ip || (onlineNode ? "在线" : "离线")}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="mt-2 shrink-0 border-t border-border pt-2 text-[11px] text-muted-foreground">
              共 {nodes.length} 台 · 在线{" "}
              {nodes.filter((n) => n.status === 1).length} 台
            </div>
          </Panel>
        )}
      </div>
    </AnimatedPage>
  );
}
