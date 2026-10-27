import type { NodeRoute } from "@/api/types";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ChevronDown, Info, RefreshCw } from "lucide-react";

import { getNodeRoute, probeNodeRoute } from "@/api";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalHeader,
} from "@/components/modal";

// Short tag per return route.
const ROUTES: Record<string, string> = {
  "电信 CN2 GIA": "CN2 GIA",
  "电信 CN2 GT": "CN2 GT",
  "电信 163": "163",
  "联通 9929": "9929",
  "联通 4837": "4837",
  "移动 CMIN2": "CMIN2",
  "移动 CMI": "CMI",
};

const ROUTE_TEXT: Record<string, string> = {
  "电信 CN2 GIA": "text-warning-700 dark:text-warning-400",
  "电信 CN2 GT": "text-warning-700 dark:text-warning-400",
  "电信 163": "text-muted-foreground",
  "联通 9929": "text-violet-700 dark:text-violet-300",
  "联通 4837": "text-primary",
  "移动 CMIN2": "text-success-700 dark:text-success-400",
  "移动 CMI": "text-success-700 dark:text-success-400",
};

const NET_CLASS: Record<string, string> = {
  CN2: "text-warning",
  "163": "text-muted-foreground",
  "4837": "text-primary",
  "9929": "text-violet-600 dark:text-violet-300",
  CMIN2: "text-success",
  CMI: "text-success",
  CT: "text-muted-foreground",
};

// IPv6 hops in AS4134 may be the 163 backbone or provincial ChinaNet.
const NET_LABEL: Record<string, string> = { CT: "电信" };

/** A return route as a small colored tag; short form for tight spaces. */
export function RouteTag({
  route,
  short,
}: {
  route?: string;
  short?: boolean;
}) {
  if (!route || route === "未识别") return null;

  return (
    <Badge
      className={cn(
        "shrink-0 rounded-md border-hairline font-sans text-[11px] font-normal",
        ROUTE_TEXT[route] ?? "text-muted-foreground",
      )}
      title={`回程 ${route}`}
      variant="outline"
    >
      {short ? (ROUTES[route] ?? route) : route}
    </Badge>
  );
}

/** Standalone dialog for the return routes (other pages use it). */
export function RouteModal({
  nodeId,
  nodeName,
  onClose,
}: {
  nodeId: number | null;
  nodeName?: string;
  onClose: () => void;
}) {
  return (
    <Modal
      backdrop="blur"
      classNames={{
        base: "!w-[calc(100%-32px)] !mx-auto sm:!w-full rounded-xl overflow-hidden",
      }}
      isOpen={nodeId !== null}
      placement="center"
      scrollBehavior="inside"
      size="lg"
      onOpenChange={(v) => !v && onClose()}
    >
      <ModalContent>
        <ModalHeader closable className="flex flex-col gap-0.5">
          <h2 className="text-lg font-bold">回程路由</h2>
          <p className="text-xs font-normal text-muted-foreground">
            {nodeName ? `${nodeName} → 各测试点` : "服务器 → 各测试点"}
          </p>
        </ModalHeader>
        <ModalBody>
          <RoutePanel nodeId={nodeId} />
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}

const LEGEND =
  "按经过的骨干网识别：59.43 段为 CN2（不经过 202.97 即 GIA），202.97 为 163，219.158 为联通 4837，218.105 / 210.51 为联通 9929，223.118–223.121 为移动 CMI，其中归属 AS58807 的为 CMIN2；IPv6 回程按每一跳的归属网络（AS4809 为 CN2，AS4134 为电信 163）识别。每天自动检测一次。";

/** The route legs (v4/v6) and a re-probe button, usable inside a dialog. */
export function RoutePanel({ nodeId }: { nodeId: number | null }) {
  const [route, setRoute] = useState<NodeRoute | null>(null);
  const [loading, setLoading] = useState(false);
  const [probing, setProbing] = useState(false);

  useEffect(() => {
    if (nodeId === null) return;
    setRoute(null);
    setLoading(true);
    getNodeRoute(nodeId)
      .then((res) => setRoute(res.code === 0 ? (res.data ?? null) : null))
      .catch(() => setRoute(null))
      .finally(() => setLoading(false));
  }, [nodeId]);

  const probe = async () => {
    if (nodeId === null) return;
    setProbing(true);
    try {
      const res = await probeNodeRoute(nodeId);

      if (res.code !== 0) {
        toast.error(res.msg || "检测失败");

        return;
      }
      setRoute(res.data ?? null);
    } catch {
      toast.error("检测失败");
    } finally {
      setProbing(false);
    }
  };

  const legsOf = (p: NonNullable<NodeRoute["points"]>[number]) =>
    p.ipv6
      ? [
          { key: `${p.name}/v4`, label: "IPv4", leg: p },
          { key: `${p.name}/v6`, label: "IPv6", leg: p.ipv6 },
        ]
      : [{ key: p.name, label: p.family, leg: p }];

  return (
    <div className="flex flex-col gap-3">
      {loading ? (
        <div aria-busy="true" className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-10 w-full rounded-lg" />
          ))}
        </div>
      ) : !route || route.points.length === 0 ? (
        <Empty className="border border-dashed border-border py-6 md:py-8">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <RefreshCw />
            </EmptyMedia>
            <EmptyTitle>还没有回程路由</EmptyTitle>
            <EmptyDescription>
              检测一次，就能看到每个测试点的回程线路。
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button
              disabled={probing || nodeId === null}
              size="sm"
              onClick={probe}
            >
              <RefreshCw className="size-3.5" />
              {probing ? "检测中…" : "开始检测"}
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <Accordion collapsible className="flex flex-col gap-2" type="single">
          {route.points.map((p) => {
            const legs = legsOf(p);
            const hops = Math.max(...legs.map((l) => l.leg.hops?.length ?? 0));
            const failed = legs.some((l) => l.leg.error);

            return (
              <AccordionItem
                key={p.name}
                className="rounded-lg border border-border"
                value={p.name}
              >
                <AccordionTrigger className="items-center gap-2 px-3 py-2 hover:no-underline">
                  <span className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                    <span className="font-medium">{p.name}</span>
                    {legs.map(({ key, leg }) =>
                      leg.route && leg.route !== "未识别" ? (
                        <RouteTag key={key} short route={leg.route} />
                      ) : null,
                    )}
                    {failed && (
                      <span className="text-xs font-normal text-destructive">
                        检测失败
                      </span>
                    )}
                  </span>
                  <span className="ml-auto shrink-0 text-xs font-normal tabular-nums text-muted-foreground">
                    {hops} 跳
                  </span>
                </AccordionTrigger>
                <AccordionContent className="pb-2">
                  {legs.map(({ key, label, leg }) => (
                    <div key={key} className="px-3">
                      {legs.length > 1 && (
                        <div className="flex items-center gap-2 pb-1 pt-1">
                          <Badge variant="secondary">{label}</Badge>
                          {leg.route && <RouteTag short route={leg.route} />}
                          {leg.error && (
                            <span className="text-xs text-destructive">
                              {leg.error}
                            </span>
                          )}
                        </div>
                      )}
                      {!leg.error && leg.hops && leg.hops.length > 0 && (
                        <Table>
                          <TableHeader>
                            <TableRow className="hover:bg-transparent">
                              <TableHead className="h-7 w-8 px-1 text-[11px]">
                                #
                              </TableHead>
                              <TableHead className="h-7 px-1 text-[11px]">
                                地址
                              </TableHead>
                              <TableHead className="h-7 px-1 text-[11px]">
                                网络
                              </TableHead>
                              <TableHead className="h-7 px-1 text-right text-[11px]">
                                RTT
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {leg.hops.map((hop) => (
                              <TableRow key={hop.ttl}>
                                <TableCell className="px-1 py-1 text-xs tabular-nums text-muted-foreground">
                                  {hop.ttl}
                                </TableCell>
                                <TableCell className="px-1 py-1 font-mono text-xs [overflow-wrap:anywhere]">
                                  {hop.ip || "*"}
                                </TableCell>
                                <TableCell className="px-1 py-1">
                                  {hop.net && (
                                    <Badge
                                      className={NET_CLASS[hop.net]}
                                      variant="outline"
                                    >
                                      {NET_LABEL[hop.net] ?? hop.net}
                                    </Badge>
                                  )}
                                </TableCell>
                                <TableCell className="px-1 py-1 text-right font-mono text-xs tabular-nums text-muted-foreground">
                                  {hop.rttMs
                                    ? `${hop.rttMs.toFixed(1)} ms`
                                    : ""}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                      {!leg.reached && !leg.error && (
                        <p className="pt-1 text-xs text-muted-foreground">
                          目标没有回应，只显示到最后一个有回应的路由器
                        </p>
                      )}
                    </div>
                  ))}
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}

      <Collapsible>
        <CollapsibleTrigger className="group flex w-full items-center gap-1.5 rounded-md py-1 text-xs text-muted-foreground transition-colors hover:text-foreground">
          <Info className="size-3.5" />
          线路识别规则
          <ChevronDown className="ml-auto size-3.5 transition-transform group-data-[state=open]:rotate-180" />
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-1 text-xs leading-5 text-muted-foreground">
          {LEGEND}
        </CollapsibleContent>
      </Collapsible>

      <Separator />

      <div className="flex justify-end">
        <Button
          disabled={probing || nodeId === null}
          size="sm"
          variant="outline"
          onClick={probe}
        >
          <RefreshCw className="size-3.5" />
          {probing ? "检测中…" : "重新检测回程"}
        </Button>
      </div>
    </div>
  );
}
