import { Activity, Pencil } from "lucide-react";

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
import {
  NodeMeters,
  NodeMonth,
  NodeSpeed,
} from "@/pages/node/node-live-stats";
import {
  formatNodeRenewalTime,
  getNodeRenewalCycleLabel,
} from "@/pages/node/renewal";
import type { Node } from "@/pages/node/types";
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
  onMonitor,
}: {
  node: Node | null;
  month?: [number, number];
  online: boolean;
  onClose: () => void;
  onEdit: (node: Node) => void;
  onMonitor?: (node: Node) => void;
}) {
  const info = node?.systemInfo ?? null;
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
              {onMonitor && !node.isRemote && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onMonitor(node)}
                >
                  <Activity className="h-4 w-4" />
                  监控
                </Button>
              )}
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
