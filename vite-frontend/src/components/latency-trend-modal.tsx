import type { LatencyTrend } from "@/api/types";

import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceDot,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  type ChartConfig,
} from "@/components/ui/chart";
import { getNodeLatencyHistory } from "@/api";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalHeader,
} from "@/shadcn-bridge/heroui/modal";

const RANGES = [
  { hours: 24, label: "24 小时" },
  { hours: 72, label: "3 天" },
  { hours: 168, label: "7 天" },
];

const COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
];

type TooltipRow = {
  dataKey?: string | number;
  name?: string;
  value?: number | null;
  color?: string;
  payload?: Record<string, unknown>;
};

/** One card per hovered timestamp, series sorted fastest to slowest. */
function LatencyTooltip({
  active,
  payload,
  label,
  hours,
}: {
  active?: boolean;
  payload?: TooltipRow[];
  label?: number;
  hours: number;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const rows = [...payload].sort(
    (a, b) => Number(b.value ?? 0) - Number(a.value ?? 0),
  );

  return (
    <div className="pointer-events-none min-w-44 max-w-56 rounded-lg border border-border bg-popover p-2 text-xs text-popover-foreground shadow-lg">
      <div className="mb-1 font-medium">{timeLabel(Number(label), hours)}</div>
      <div className="flex flex-col gap-1">
        {rows.map((row) => {
          const loss = Number(
            row.payload?.[`${String(row.name)}\u0000loss`] ?? 0,
          );

          return (
            <div key={String(row.dataKey)} className="flex items-center gap-2">
              <span
                className="size-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: row.color }}
              />
              <span className="min-w-0 flex-1 truncate">{row.name}</span>
              <span className="font-mono tabular-nums">
                {row.value === null || row.value === undefined
                  ? "超时"
                  : `${Math.round(Number(row.value))} ms`}
              </span>
              {loss > 0 && <span className="text-destructive">丢{loss}%</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function timeLabel(t: number, hours: number) {
  const d = new Date(t);
  const hm = `${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes(),
  ).padStart(2, "0")}`;

  return hours > 24 ? `${d.getMonth() + 1}/${d.getDate()} ${hm}` : hm;
}

/** A node's latency to each reference point over time, one line per point. */
export function LatencyTrendModal({
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
      size="2xl"
      onOpenChange={(v) => !v && onClose()}
    >
      <ModalContent>
        <ModalHeader closable className="flex flex-col gap-0.5">
          <h2 className="text-lg font-bold">延迟趋势</h2>
          <p className="text-xs font-normal text-muted-foreground">
            {nodeName ? `${nodeName} → 各测试点` : "服务器 → 各测试点"}
            ，每 3 分钟一次
          </p>
        </ModalHeader>
        <ModalBody>
          <LatencyTrendContent nodeId={nodeId} />
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}

/** The trend chart and per-point summary, usable inside another dialog. */
export function LatencyTrendPanel({
  nodeId,
  compact,
}: {
  nodeId: number | null;
  /** Shorter chart, so the panel fits a tab without the dialog resizing. */
  compact?: boolean;
}) {
  return <LatencyTrendContent compact={compact} nodeId={nodeId} />;
}

function LatencyTrendContent({
  nodeId,
  compact,
}: {
  nodeId: number | null;
  compact?: boolean;
}) {
  const [hours, setHours] = useState(24);
  const [trend, setTrend] = useState<LatencyTrend | null>(null);
  const [loading, setLoading] = useState(false);
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (nodeId === null) return;
    setLoading(true);
    getNodeLatencyHistory(nodeId, hours)
      .then((res) => setTrend(res.code === 0 ? (res.data ?? null) : null))
      .catch(() => setTrend(null))
      .finally(() => setLoading(false));
  }, [nodeId, hours]);

  useEffect(() => {
    if (nodeId === null) setHours(24);
  }, [nodeId]);

  // One row per time with each point's latency and loss.
  const rows = useMemo(() => {
    const byTime = new Map<number, Record<string, number | null>>();

    for (const p of trend?.points ?? []) {
      for (const s of p.samples) {
        const row = byTime.get(s.t) ?? { t: s.t };

        row[p.name] = s.ms;
        row[`${p.name}\u0000loss`] = s.lossPct;
        byTime.set(s.t, row);
      }
    }

    return [...byTime.values()].sort((a, b) => Number(a.t) - Number(b.t));
  }, [trend]);

  const points = trend?.points ?? [];
  const visible = points.filter((p) => !hidden.has(p.name));
  const chartConfig = useMemo(() => {
    const config: ChartConfig = {};

    points.forEach((p, i) => {
      config[p.name] = {
        label: p.name,
        color: COLORS[i % COLORS.length],
      };
    });

    return config;
  }, [points]);

  // The single worst sample across the visible series.
  const peak = useMemo(() => {
    let best: { name: string; t: number; ms: number } | null = null;

    for (const p of visible) {
      for (const s of p.samples) {
        if (s.ms != null && (!best || s.ms > best.ms)) {
          best = { name: p.name, t: s.t, ms: s.ms };
        }
      }
    }

    return best;
  }, [visible]);

  // Time bands where a visible point timed out or lost ≥5%.
  const bands = useMemo(() => {
    const out: Array<{ x1: number; x2: number }> = [];
    let start: number | null = null;
    let last = 0;

    for (const row of rows) {
      const t = Number(row.t);
      const bad = visible.some((p) => {
        if (!(p.name in row)) return false;

        // Only timeouts and severe loss, otherwise the chart is striped.
        return (
          row[p.name] === null || Number(row[`${p.name}\u0000loss`] ?? 0) >= 20
        );
      });

      if (bad && start === null) start = t;
      if (!bad && start !== null) {
        out.push({ x1: start, x2: last });
        start = null;
      }
      last = t;
    }

    if (start !== null) out.push({ x1: start, x2: last });

    return out;
  }, [rows, visible]);

  const chartHeight = compact ? "h-52" : "h-52 sm:h-64";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <ToggleGroup
          className="w-fit"
          size="sm"
          type="single"
          value={String(hours)}
          variant="outline"
          onValueChange={(v) => v && setHours(Number(v))}
        >
          {RANGES.map((r) => (
            <ToggleGroupItem key={r.hours} value={String(r.hours)}>
              {r.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      {loading && !trend ? (
        <div aria-busy="true" className="flex flex-col gap-2">
          <Skeleton className={`w-full ${chartHeight}`} />
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-6 w-full" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p
          className={`flex items-center justify-center text-sm text-muted-foreground ${chartHeight}`}
        >
          这段时间还没有记录
        </p>
      ) : (
        <>
          <ToggleGroup
            className="flex flex-wrap justify-start gap-1"
            size="sm"
            type="multiple"
            value={visible.map((p) => p.name)}
            variant="outline"
            onValueChange={(names) =>
              setHidden(
                new Set(
                  points
                    .filter((p) => !names.includes(p.name))
                    .map((p) => p.name),
                ),
              )
            }
          >
            {points.map((p, i) => (
              <ToggleGroupItem key={p.name} className="gap-1.5" value={p.name}>
                <span
                  className="size-2 rounded-full"
                  style={{ background: COLORS[i % COLORS.length] }}
                />
                {p.name}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>

          <div
            aria-label={`延迟趋势图，共 ${visible.length} 个测试点、${rows.length} 个采样点`}
            role="img"
          >
            <ChartContainer
              className={`aspect-auto w-full ${chartHeight}`}
              config={chartConfig}
            >
              <LineChart data={rows}>
                <CartesianGrid
                  stroke="var(--border)"
                  strokeDasharray="3 3"
                  vertical={false}
                />
                <XAxis
                  dataKey="t"
                  fontSize={11}
                  minTickGap={32}
                  tickFormatter={(t: number) => timeLabel(t, hours)}
                />
                <YAxis
                  fontSize={11}
                  tickFormatter={(v: number) => `${Math.round(v)}ms`}
                  width={52}
                />
                <ReferenceLine
                  ifOverflow="extendDomain"
                  label={{
                    value: "良好阈值 100 ms",
                    position: "insideTopRight",
                    fill: "var(--muted-foreground)",
                    fontSize: 10,
                  }}
                  stroke="var(--border)"
                  strokeDasharray="4 4"
                  y={100}
                />
                {bands.map((band) => (
                  <ReferenceArea
                    key={band.x1}
                    fill="var(--destructive)"
                    fillOpacity={0.08}
                    stroke="none"
                    x1={band.x1}
                    x2={band.x2}
                  />
                ))}
                <ChartTooltip
                  content={<LatencyTooltip hours={hours} />}
                  cursor={{ stroke: "var(--border)", strokeDasharray: "3 3" }}
                  isAnimationActive={false}
                  wrapperStyle={{
                    outline: "none",
                    pointerEvents: "none",
                    zIndex: 40,
                  }}
                />
                {points.map((p, i) => (
                  <Line
                    key={p.name}
                    activeDot={{ r: 3, strokeWidth: 0 }}
                    connectNulls={false}
                    dataKey={p.name}
                    dot={false}
                    hide={hidden.has(p.name)}
                    isAnimationActive={false}
                    name={p.name}
                    stroke={COLORS[i % COLORS.length]}
                    strokeWidth={1.5}
                    type="monotone"
                  />
                ))}
                {peak && (
                  <ReferenceDot
                    fill="var(--destructive)"
                    ifOverflow="extendDomain"
                    label={{
                      value: `${Math.round(peak.ms)} ms`,
                      position: "top",
                      fill: "var(--muted-foreground)",
                      fontSize: 10,
                    }}
                    r={3}
                    stroke="var(--background)"
                    strokeWidth={2}
                    x={peak.t}
                    y={peak.ms}
                  />
                )}
              </LineChart>
            </ChartContainer>
          </div>
        </>
      )}

      {points.length > 0 && (
        <div className="max-h-64 overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="h-7 text-[11px]">测试点</TableHead>
                <TableHead className="h-7 text-right text-[11px]">
                  平均
                </TableHead>
                <TableHead className="h-7 text-right text-[11px]">
                  最高
                </TableHead>
                <TableHead className="h-7 text-right text-[11px]">
                  平均丢包
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {points.map((p, i) => (
                <TableRow
                  key={p.name}
                  className={hidden.has(p.name) ? "opacity-40" : undefined}
                >
                  <TableCell className="py-1.5">
                    <span className="flex items-center gap-2">
                      <span
                        className="size-2 shrink-0 rounded-full"
                        style={{ background: COLORS[i % COLORS.length] }}
                      />
                      {p.name}
                    </span>
                  </TableCell>
                  <TableCell className="py-1.5 text-right font-mono text-xs tabular-nums">
                    {p.avgMs ? `${Math.round(p.avgMs)} ms` : "-"}
                  </TableCell>
                  <TableCell className="py-1.5 text-right font-mono text-xs tabular-nums">
                    {p.maxMs ? `${p.maxMs} ms` : "-"}
                  </TableCell>
                  <TableCell
                    className={`py-1.5 text-right font-mono text-xs tabular-nums ${p.lossPct >= 5 ? "text-destructive" : ""}`}
                  >
                    {p.lossPct}%
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
