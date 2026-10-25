import type { InboundProbe } from "@/api/types";
import type { Node } from "@/pages/node/types";

import { Suspense, lazy, useMemo, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";

import { RouteTag } from "@/components/route-modal";
import { RoutePanel } from "@/components/route-modal";
import { LatencyTargetsPanel } from "@/pages/node/latency-targets-modal";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/shadcn-bridge/heroui/button";
import { Spinner } from "@/shadcn-bridge/heroui/spinner";

// recharts is heavy: keep it out of the page bundle until this tab is used.
const LatencyTrendPanel = lazy(() =>
  import("@/components/latency-trend-modal").then((m) => ({
    default: m.LatencyTrendPanel,
  })),
);

import { TONE, pointTone, probePoints } from "@/components/latency-cell";

type TabKey = "overview" | "trend" | "route" | "targets";

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
  const [sortAsc, setSortAsc] = useState<boolean | null>(null);
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
  const badCount = points.filter((p) => !p.ok || (p.lossPct ?? 0) >= 5).length;
  const visible = useMemo(() => {
    const list = onlyBad
      ? points.filter((p) => !p.ok || (p.lossPct ?? 0) >= 5)
      : [...points];

    if (sortAsc !== null) {
      list.sort(
        (a, b) =>
          (a.latencyMs ?? Number.MAX_SAFE_INTEGER) -
          (b.latencyMs ?? Number.MAX_SAFE_INTEGER),
      );
      if (!sortAsc) list.reverse();
    }

    return list;
  }, [points, onlyBad, sortAsc]);
  const checkedAgo = probe?.checkedAt
    ? (() => {
        const m = Math.max(
          0,
          Math.round((Date.now() - probe.checkedAt) / 60000),
        );

        return m < 1 ? "刚刚检测" : `${m} 分钟前检测`;
      })()
    : null;

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
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-start justify-between gap-3 pr-8">
            <div className="min-w-0">
              <DialogTitle>延迟 · {node?.name}</DialogTitle>
              <DialogDescription>
                {points.length > 0
                  ? `${points.length} 个测试点 · 平均 ${avg ?? "—"} ms${
                      checkedAgo ? ` · ${checkedAgo}` : ""
                    }`
                  : "这台服务器还没有延迟结果，每 3 分钟检测一次"}
              </DialogDescription>
            </div>
            <Button
              isIconOnly
              aria-label="重新检测"
              className="mt-0.5 shrink-0"
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
            </Button>
          </div>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
          <TabsList className="w-full">
            <TabsTrigger className="flex-1" value="overview">
              概览
            </TabsTrigger>
            <TabsTrigger className="flex-1" value="trend">
              趋势
            </TabsTrigger>
            <TabsTrigger className="flex-1" value="route">
              回程
            </TabsTrigger>
            <TabsTrigger className="flex-1" value="targets">
              测试点
            </TabsTrigger>
          </TabsList>

          <TabsContent
            className="flex min-h-[464px] flex-col gap-3"
            value="overview"
          >
            {points.length > 0 && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span>
                  最快{" "}
                  <span className="font-mono font-medium text-foreground">
                    {best?.latencyMs ?? "—"} ms
                  </span>
                  {best && ` · ${best.name}`}
                </span>
                <span>
                  最慢{" "}
                  <span className="font-mono font-medium text-foreground">
                    {worst?.latencyMs ?? "—"} ms
                  </span>
                  {worst && ` · ${worst.name}`}
                </span>
                <span className="ml-auto flex items-center gap-1">
                  <button
                    className={`rounded-md px-1.5 py-0.5 text-[11px] transition-colors ${
                      sortAsc !== null
                        ? "bg-muted font-medium text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                    type="button"
                    onClick={() =>
                      setSortAsc(
                        sortAsc === null ? true : sortAsc ? false : null,
                      )
                    }
                  >
                    延迟 {sortAsc === null ? "排序" : sortAsc ? "↑" : "↓"}
                  </button>
                  <button
                    className={`rounded-md px-1.5 py-0.5 text-[11px] transition-colors ${
                      onlyBad
                        ? "bg-danger/10 font-medium text-danger"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                    type="button"
                    onClick={() => setOnlyBad((v) => !v)}
                  >
                    只看异常{badCount > 0 ? ` ${badCount}` : ""}
                  </button>
                </span>
              </div>
            )}
            {points.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                还没有结果，点下方按钮检测
              </p>
            ) : (
              <div
                aria-label="测试点延迟"
                className="grid flex-1 auto-rows-fr divide-y divide-border overflow-hidden rounded-lg border border-border"
                role="list"
              >
                {visible.map((p) => {
                  const [pill, dot] = TONE[pointTone(p)];
                  const bad = !p.ok || (p.lossPct ?? 0) >= 5;
                  const slowest = p.ok && p === worst;

                  return (
                    <div
                      key={p.name}
                      aria-label={`${p.name} ${p.ok ? `${p.latencyMs} 毫秒` : p.error || "连不上"}，丢包 ${p.lossPct ?? 0}%`}
                      className="relative flex flex-wrap items-center gap-x-2 gap-y-1 px-3 py-2 text-sm"
                      role="listitem"
                    >
                      {(bad || slowest) && (
                        <span
                          aria-hidden
                          className={`absolute inset-y-1.5 left-0 w-0.5 rounded-full ${bad ? "bg-danger" : "bg-warning"}`}
                        />
                      )}
                      <span
                        className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot}`}
                      />
                      <span className="min-w-0 truncate">{p.name}</span>
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
                      {p.route && p.route !== "未识别" && (
                        <RouteTag short route={p.route} />
                      )}
                      <span
                        className={`ml-auto whitespace-nowrap rounded-full px-2 py-0.5 font-mono text-xs font-medium ${pill}`}
                      >
                        {p.ok ? `${p.latencyMs} ms` : p.error || "连不上"}
                      </span>
                      <span className="w-14 shrink-0 text-right text-[11px] text-muted-foreground">
                        {p.ok ? `丢包 ${p.lossPct ?? 0}%` : ""}
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
