import type { InboundProbe } from "@/api/types";
import type { Node } from "@/pages/node/types";

import { Suspense, lazy, useMemo, useState } from "react";
import { Loader2, RefreshCw, X } from "lucide-react";

import { RouteTag } from "@/components/route-modal";
import { RoutePanel } from "@/components/route-modal";
import { LatencyTargetsPanel } from "@/pages/node/latency-targets-modal";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/shadcn-bridge/heroui/button";
import { Spinner } from "@/shadcn-bridge/heroui/spinner";
import { TONE, pointTone, probePoints } from "@/components/latency-cell";

// recharts is heavy: keep it out of the page bundle until this tab is used.
const LatencyTrendPanel = lazy(() =>
  import("@/components/latency-trend-modal").then((m) => ({
    default: m.LatencyTrendPanel,
  })),
);

type TabKey = "overview" | "trend" | "route" | "targets";
type SortKey = "asc" | "desc" | null;

const isBad = (p: ReturnType<typeof probePoints>[number]) =>
  !p.ok || (p.lossPct ?? 0) >= 5;

/**
 * Everything about one node's latency in one dialog: the current results,
 * the trend, the return routes and the reference points it measures.
 */
export function LatencyDialog({
  node,
  probe,
  probing,
  onProbe,
  onClose,
  onTargetsSaved,
}: {
  node: Node | null;
  probe?: InboundProbe;
  probing?: boolean;
  onProbe: () => void;
  onClose: () => void;
  onTargetsSaved: () => void;
}) {
  const [tab, setTab] = useState<TabKey>("overview");
  const [sort, setSort] = useState<SortKey>(null);
  const [onlyBad, setOnlyBad] = useState(false);
  const points = probePoints(probe);
  const okPoints = points.filter((p) => p.ok);
  const avg = okPoints.length
    ? Math.round(
        okPoints.reduce((sum, p) => sum + (p.latencyMs ?? 0), 0) /
          okPoints.length,
      )
    : null;
  const best = okPoints.reduce<(typeof okPoints)[number] | null>(
    (b, p) => (!b || (p.latencyMs ?? 0) < (b.latencyMs ?? 0) ? p : b),
    null,
  );
  const worst = okPoints.reduce<(typeof okPoints)[number] | null>(
    (w, p) => (!w || (p.latencyMs ?? 0) > (w.latencyMs ?? 0) ? p : w),
    null,
  );
  const badCount = points.filter(isBad).length;
  const visible = useMemo(() => {
    const list = onlyBad ? points.filter(isBad) : [...points];

    if (sort !== null) {
      list.sort(
        (a, b) =>
          (a.latencyMs ?? Number.MAX_SAFE_INTEGER) -
          (b.latencyMs ?? Number.MAX_SAFE_INTEGER),
      );
      if (sort === "desc") list.reverse();
    }

    return list;
  }, [points, onlyBad, sort]);
  const checkedAgo = probe?.checkedAt
    ? (() => {
        const m = Math.max(
          0,
          Math.round((Date.now() - probe.checkedAt) / 60000),
        );

        return m < 1 ? "刚刚检测" : `${m} 分钟前检测`;
      })()
    : null;
  const chip = (active: boolean) =>
    `rounded-md border px-2 py-0.5 text-xs transition-colors ${
      active
        ? "border-primary/40 bg-primary/10 font-medium text-primary"
        : "border-border text-muted-foreground hover:text-foreground"
    }`;

  return (
    <Dialog
      open={node !== null}
      onOpenChange={(open) => {
        if (!open) {
          setTab("overview");
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-2xl" showCloseButton={false}>
        <DialogHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <DialogTitle>延迟 · {node?.name}</DialogTitle>
              <DialogDescription>
                {points.length > 0
                  ? `${points.length} 个测试点${checkedAgo ? ` · ${checkedAgo}` : ""}`
                  : "这台服务器还没有延迟结果，每 3 分钟检测一次"}
              </DialogDescription>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <Button
                aria-label="重新检测延迟"
                className="h-8 gap-1.5 px-2.5 text-xs"
                isDisabled={probing}
                size="sm"
                variant="outline"
                onPress={onProbe}
              >
                {probing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
                <span className="hidden sm:inline">重新检测</span>
              </Button>
              <DialogClose
                aria-label="关闭"
                className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
              >
                <X className="h-4 w-4" />
              </DialogClose>
            </div>
          </div>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
          <TabsList className="h-8 w-full overflow-x-auto">
            <TabsTrigger
              className="min-w-fit flex-1 px-3 text-[13px]"
              value="overview"
            >
              概览
              {badCount > 0 && (
                <span
                  aria-hidden
                  className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-danger"
                />
              )}
              {badCount > 0 && (
                <span className="sr-only">，{badCount} 个异常</span>
              )}
            </TabsTrigger>
            <TabsTrigger
              className="min-w-fit flex-1 px-3 text-[13px]"
              value="trend"
            >
              趋势
            </TabsTrigger>
            <TabsTrigger
              className="min-w-fit flex-1 px-3 text-[13px]"
              value="route"
            >
              回程
            </TabsTrigger>
            <TabsTrigger
              className="min-w-fit flex-1 px-3 text-[13px]"
              value="targets"
            >
              测试点
            </TabsTrigger>
          </TabsList>

          <TabsContent className="flex flex-col gap-3" value="overview">
            {points.length > 0 && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
                <span>
                  平均{" "}
                  <span className="font-mono font-medium tabular-nums text-foreground">
                    {avg ?? "—"} ms
                  </span>
                </span>
                <span>
                  最快{" "}
                  <span className="font-mono font-medium tabular-nums text-foreground">
                    {best?.latencyMs ?? "—"} ms
                  </span>
                </span>
                <span>
                  最慢{" "}
                  <span className="font-mono font-medium tabular-nums text-foreground">
                    {worst?.latencyMs ?? "—"} ms
                  </span>
                </span>
                <div className="ml-auto flex items-center gap-1">
                  <button
                    aria-pressed={sort === "asc"}
                    className={chip(sort === "asc")}
                    type="button"
                    onClick={() => setSort(sort === "asc" ? null : "asc")}
                  >
                    延迟 ↑
                  </button>
                  <button
                    aria-pressed={sort === "desc"}
                    className={chip(sort === "desc")}
                    type="button"
                    onClick={() => setSort(sort === "desc" ? null : "desc")}
                  >
                    延迟 ↓
                  </button>
                  <button
                    aria-pressed={onlyBad}
                    className={chip(onlyBad) + " ml-1"}
                    type="button"
                    onClick={() => setOnlyBad((v) => !v)}
                  >
                    只看异常 {badCount}
                  </button>
                </div>
              </div>
            )}

            {points.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10">
                {probing ? (
                  <Skeleton className="h-9 w-full rounded-md" />
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground">
                      这台服务器还没有延迟结果
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      onPress={() => setTab("targets")}
                    >
                      添加测试点
                    </Button>
                  </>
                )}
              </div>
            ) : (
              <div
                aria-label="测试点延迟"
                className="divide-y divide-border overflow-hidden rounded-lg border border-border"
                role="list"
              >
                {visible.map((p) => {
                  const [pill, dot] = TONE[pointTone(p)];
                  const bad = isBad(p);
                  const slowest = p.ok && p === worst;
                  const loss = p.lossPct ?? 0;

                  return (
                    <div
                      key={p.name}
                      aria-label={`${p.name} ${p.ok ? `${p.latencyMs} 毫秒` : p.error || "连不上"}，丢包 ${loss}%`}
                      className="relative flex flex-wrap items-center gap-x-2 gap-y-1 px-3 py-2 text-sm"
                      role="listitem"
                    >
                      {(bad || slowest) && (
                        <span
                          aria-hidden
                          className={`absolute inset-y-1 left-0 w-0.5 rounded-full ${bad ? "bg-danger" : "bg-warning"}`}
                        />
                      )}
                      <span
                        className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot}`}
                      />
                      <span className="min-w-0 truncate">{p.name}</span>
                      <RouteTag plain short route={p.route} />
                      <span className="ml-auto flex items-center gap-2">
                        <span
                          className={`whitespace-nowrap rounded-full px-2 py-0.5 font-mono text-xs font-medium tabular-nums ${pill}`}
                        >
                          {p.ok ? `${p.latencyMs} ms` : p.error || "连不上"}
                        </span>
                        <span
                          className={`w-16 text-right text-xs tabular-nums ${
                            loss >= 5
                              ? "text-danger"
                              : loss > 0
                                ? "text-warning-700 dark:text-warning-400"
                                : "text-muted-foreground"
                          }`}
                        >
                          {p.ok && loss > 0 ? `丢包 ${loss}%` : ""}
                        </span>
                        {bad && (
                          <span className="rounded bg-danger/10 px-1 text-[10px] font-medium text-danger">
                            异常
                          </span>
                        )}
                        {slowest && !bad && (
                          <span className="rounded bg-warning/10 px-1 text-[10px] font-medium text-warning-700 dark:text-warning-400">
                            最慢
                          </span>
                        )}
                      </span>
                    </div>
                  );
                })}
                {visible.length === 0 && (
                  <p className="flex items-center justify-center px-3 py-8 text-sm text-muted-foreground">
                    没有异常的测试点
                  </p>
                )}
              </div>
            )}

            {points.length > 0 && points.length < 3 && (
              <button
                className="rounded-lg border border-dashed border-border py-2 text-center text-xs text-muted-foreground transition-colors hover:text-foreground"
                type="button"
                onClick={() => setTab("targets")}
              >
                只有 {points.length} 个测试点，去添加更多
              </button>
            )}
          </TabsContent>

          <TabsContent className="min-h-[464px]" value="trend">
            {tab === "trend" && (
              <Suspense
                fallback={
                  <div className="flex h-52 items-center justify-center">
                    <Spinner />
                  </div>
                }
              >
                <LatencyTrendPanel compact nodeId={node?.id ?? null} />
              </Suspense>
            )}
          </TabsContent>

          <TabsContent className="min-h-[464px]" value="route">
            <RoutePanel nodeId={node?.id ?? null} />
          </TabsContent>

          <TabsContent className="min-h-[464px]" value="targets">
            {node && (
              <LatencyTargetsPanel
                nodes={[node]}
                onClose={onClose}
                onSaved={onTargetsSaved}
              />
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
