import type { Node } from "@/pages/node/types";

import { Pencil } from "lucide-react";
import { useEffect, useState } from "react";

import { getNodeMetrics, type NodeMetricApiItem } from "@/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "@/components/dialog";
import { NodeFlag } from "@/components/node-flag";
import { NodeMeters, NodeMonth, NodeSpeed } from "@/pages/node/node-live-stats";
import {
  formatNodeRenewalTime,
  getNodeRenewalCycleLabel,
} from "@/pages/node/renewal";
import { getNodeFlag } from "@/pages/node/display";
import { formatTraffic } from "@/utils/traffic";

function formatRate(bytesPerSecond: number): string {
  if (!bytesPerSecond) return "0 B/s";
  const units = ["B/s", "KB/s", "MB/s", "GB/s", "TB/s"];
  const index = Math.min(
    units.length - 1,
    Math.floor(Math.log(bytesPerSecond) / Math.log(1024)),
  );

  return `${(bytesPerSecond / 1024 ** index).toFixed(2)} ${units[index]}`;
}

export function NodeDetailDialog({
  node,
  month,
  online,
  onClose,
  onEdit,
}: {
  node: Node | null;
  month?: [number, number];
  online: boolean;
  onClose: () => void;
  onEdit: (node: Node) => void;
}) {
  const info = node?.systemInfo ?? null;
  const [metrics, setMetrics] = useState<NodeMetricApiItem[]>([]);

  useEffect(() => {
    if (!node) {
      setMetrics([]);

      return;
    }
    const end = Date.now();
    const start = end - 24 * 3600_000;

    getNodeMetrics(node.id, start, end)
      .then((res) => setMetrics(res.code === 0 ? res.data || [] : []))
      .catch(() => setMetrics([]));
  }, [node]);
  const expiry =
    node?.expiryTime && node.renewalCycle
      ? formatNodeRenewalTime(node.expiryTime)
      : null;

  return (
    <Dialog open={Boolean(node)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        {node && (
          <>
            <DialogHeader>
              <div className="flex min-w-0 items-center gap-2">
                <NodeFlag
                  className="h-5 w-7 shrink-0"
                  code={node.country || getNodeFlag(node.name)}
                />
                <span className="truncate">{node.name}</span>
                <Badge variant={online ? "success" : "destructive"}>
                  {online ? "在线" : "离线"}
                </Badge>
              </div>
            </DialogHeader>
            <DialogBody className="flex flex-col gap-4">
              <p className="truncate text-xs text-muted-foreground">
                {node.serverIpV4 || node.serverIp} · agent{" "}
                {node.version || "未知"}
              </p>
              <section className="rounded-xl border border-hairline p-3">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-xs font-medium text-muted-foreground">
                    实时资源
                  </h3>
                  <span className="text-[11px] text-muted-foreground">
                    {info?.osName || "等待 agent 上报"}
                  </span>
                </div>
                <NodeMeters info={info} />
                <div className="mt-3 flex items-center justify-between border-t border-hairline pt-3">
                  <NodeSpeed info={info} />
                  <NodeMonth align="end" month={month} />
                </div>
              </section>

              {metrics.length > 2 && (
                <section className="rounded-xl border border-hairline p-3">
                  <div className="mb-2 flex items-baseline justify-between">
                    <h3 className="text-xs font-medium text-muted-foreground">
                      24 小时趋势
                    </h3>
                    <span className="text-[11px] text-muted-foreground">
                      {metrics.length} 个采样
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Spark
                      label="CPU"
                      values={metrics.map((m) => m.cpuUsage)}
                    />
                    <Spark
                      label="内存"
                      values={metrics.map((m) => m.memoryUsage)}
                    />
                    <Spark
                      label="下行"
                      values={metrics.map((m) => m.netInSpeed)}
                    />
                    <Spark
                      label="上行"
                      values={metrics.map((m) => m.netOutSpeed)}
                    />
                  </div>
                </section>
              )}

              <section className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl border border-hairline p-3 text-xs">
                <div>
                  <div className="text-muted-foreground">IPv4</div>
                  <div className="mt-0.5 truncate font-mono">
                    {node.serverIpV4 || "—"}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">IPv6</div>
                  <div className="mt-0.5 truncate font-mono">
                    {node.serverIpV6 || "—"}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Agent 版本</div>
                  <div className="mt-0.5">{node.version || "未知"}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">运行时长</div>
                  <div className="mt-0.5">
                    {info?.uptime
                      ? `${Math.floor(info.uptime / 86400)} 天`
                      : "—"}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">续费</div>
                  <div className="mt-0.5">
                    {expiry
                      ? `${expiry} · ${getNodeRenewalCycleLabel(node.renewalCycle!)}`
                      : "未设置"}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">费用</div>
                  <div className="mt-0.5">
                    {node.price ? `¥${node.price.toFixed(2)}` : "未设置"}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">本月流量</div>
                  <div className="mt-0.5">
                    {month ? formatTraffic(month[0] + month[1]) : "—"}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">实时速率</div>
                  <div className="mt-0.5">
                    {info
                      ? formatRate(
                          (info.netInSpeed ?? 0) + (info.netOutSpeed ?? 0),
                        )
                      : "—"}
                  </div>
                </div>
              </section>
            </DialogBody>
            <DialogFooter>
              <Button size="sm" variant="outline" onClick={() => onEdit(node)}>
                <Pencil className="h-4 w-4" />
                编辑
              </Button>
              <Button size="sm" onClick={onClose}>
                关闭
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Spark({ label, values }: { label: string; values: number[] }) {
  if (values.length < 2) return null;
  const max = Math.max(...values, 1);
  const points = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * 100;
      const y = 28 - (value / max) * 26;

      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div className="min-w-0">
      <div className="mb-1 flex items-baseline justify-between text-[10px] text-muted-foreground">
        <span>{label}</span>
        <span className="font-mono">
          {Math.round(values[values.length - 1])}
        </span>
      </div>
      <svg
        className="h-7 w-full text-primary"
        preserveAspectRatio="none"
        viewBox="0 0 100 30"
      >
        <polyline
          fill="none"
          points={points}
          stroke="currentColor"
          strokeWidth="1.5"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}
