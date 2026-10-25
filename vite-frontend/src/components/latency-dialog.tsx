import type { InboundProbe } from "@/api/types";
import type { Node } from "@/pages/node/types";

import { Suspense, lazy, useState } from "react";
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
  const points = probePoints(probe);

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
          <DialogTitle>延迟 · {node?.name}</DialogTitle>
          <DialogDescription>
            {points.length > 0
              ? `到 ${points.length} 个测试点的结果，每 3 分钟检测一次`
              : "这台服务器还没有延迟结果"}
          </DialogDescription>
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

          <TabsContent className="space-y-2" value="overview">
            {points.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                还没有结果，点下方按钮检测
              </p>
            ) : (
              <div className="divide-y divide-border rounded-lg border border-border">
                {points.map((p) => {
                  const [pill, dot] = TONE[pointTone(p)];

                  return (
                    <div
                      key={p.name}
                      className="flex flex-wrap items-center gap-x-2 gap-y-1 px-3 py-2 text-sm"
                    >
                      <span
                        className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot}`}
                      />
                      <span className="min-w-0 truncate">{p.name}</span>
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
              </div>
            )}

            <div className="flex justify-end">
              <Button
                isDisabled={probing}
                startContent={
                  probing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )
                }
                variant="outline"
                onPress={onProbe}
              >
                {probing ? "检测中…" : "重新检测"}
              </Button>
            </div>
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
                <LatencyTrendPanel nodeId={node?.id ?? null} />
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
