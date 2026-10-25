import type { InboundProbe } from "@/api/types";
import type { Node } from "@/pages/node/types";

import { Suspense, lazy, useMemo, useState } from "react";
import { Crosshair, Loader2, RefreshCw, X } from "lucide-react";

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
import { Badge } from "@/components/ui/badge";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Toggle } from "@/components/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
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
  const hasLoss = points.some((p) => (p.lossPct ?? 0) > 0);
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
  const badgeVariant = (tone: keyof typeof TONE) =>
    tone === "success"
      ? "success"
      : tone === "warning"
        ? "warning"
        : "destructive";

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
              {tab === "overview" && (
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
              )}
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
                <div className="ml-auto flex items-center gap-1.5">
                  <ToggleGroup
                    size="sm"
                    type="single"
                    value={sort ?? ""}
                    variant="outline"
                    onValueChange={(v) => setSort((v || null) as SortKey)}
                  >
                    <ToggleGroupItem aria-label="按延迟升序" value="asc">
                      延迟 ↑
                    </ToggleGroupItem>
                    <ToggleGroupItem aria-label="按延迟降序" value="desc">
                      延迟 ↓
                    </ToggleGroupItem>
                  </ToggleGroup>
                  <Toggle
                    aria-label={`只看异常，共 ${badCount} 个`}
                    pressed={onlyBad}
                    size="sm"
                    variant="outline"
                    onPressedChange={setOnlyBad}
                  >
                    只看异常 {badCount}
                  </Toggle>
                </div>
              </div>
            )}

            {points.length === 0 ? (
              probing ? (
                <div aria-busy="true" className="flex flex-col gap-2">
                  {[0, 1, 2].map((i) => (
                    <Skeleton key={i} className="h-9 w-full rounded-md" />
                  ))}
                </div>
              ) : (
                <Empty className="border border-dashed py-8 md:py-10">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <Crosshair />
                    </EmptyMedia>
                    <EmptyTitle>还没有延迟结果</EmptyTitle>
                    <EmptyDescription>
                      选几个测试点后，每 3 分钟自动检测一次。
                    </EmptyDescription>
                  </EmptyHeader>
                  <EmptyContent>
                    <Button
                      size="sm"
                      variant="outline"
                      onPress={() => setTab("targets")}
                    >
                      添加测试点
                    </Button>
                  </EmptyContent>
                </Empty>
              )
            ) : (
              <div className="overflow-hidden rounded-lg border border-border">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="h-8">测试点</TableHead>
                      <TableHead className="h-8">线路</TableHead>
                      <TableHead className="h-8 text-right">延迟</TableHead>
                      {hasLoss && (
                        <TableHead className="h-8 w-16 text-right">
                          丢包
                        </TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visible.map((p) => {
                      const tone = pointTone(p);
                      const bad = isBad(p);
                      const slowest = p.ok && p === worst;
                      const loss = p.lossPct ?? 0;

                      return (
                        <TableRow
                          key={p.name}
                          aria-label={`${p.name} ${p.ok ? `${p.latencyMs} 毫秒` : p.error || "连不上"}，丢包 ${loss}%`}
                        >
                          <TableCell className="py-1.5">
                            <span className="flex items-center gap-2">
                              <span
                                className={cn(
                                  "size-1.5 shrink-0 rounded-full",
                                  TONE[tone][1],
                                )}
                              />
                              <span className="min-w-0 truncate">{p.name}</span>
                              {bad && <Badge variant="destructive">异常</Badge>}
                              {slowest && !bad && (
                                <Badge variant="warning">最慢</Badge>
                              )}
                            </span>
                          </TableCell>
                          <TableCell className="py-1.5">
                            <RouteTag short route={p.route} />
                          </TableCell>
                          <TableCell className="py-1.5 text-right">
                            <Badge
                              className="font-mono tabular-nums"
                              variant={badgeVariant(tone)}
                            >
                              {p.ok ? `${p.latencyMs} ms` : p.error || "连不上"}
                            </Badge>
                          </TableCell>
                          {hasLoss && (
                            <TableCell
                              className={cn(
                                "py-1.5 text-right text-xs tabular-nums",
                                loss >= 5 ? "text-destructive" : "text-warning",
                              )}
                            >
                              {p.ok && loss > 0 ? `${loss}%` : ""}
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                {visible.length === 0 && (
                  <p className="px-3 py-8 text-center text-sm text-muted-foreground">
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

          <TabsContent value="trend">
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

          <TabsContent value="route">
            <RoutePanel nodeId={node?.id ?? null} />
          </TabsContent>

          <TabsContent value="targets">
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
