import type { NodeSystemInfo } from "@/pages/node/system-info";

import { ArrowDown, ArrowUp } from "lucide-react";

function bytes(v: number): string {
  const units = ["B", "K", "M", "G", "T", "P"];
  let i = 0;

  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }

  return `${v >= 100 || i === 0 ? Math.round(v) : v.toFixed(1)}${units[i]}`;
}

function rate(v?: number): string {
  return v === undefined ? "—" : `${bytes(v)}/s`;
}

function tone(v: number): string {
  return v >= 85 ? "bg-danger" : v >= 60 ? "bg-warning" : "bg-primary/70";
}

function Meter({ label, value }: { label: string; value?: number }) {
  return (
    <div className="min-w-0 space-y-1">
      <div className="flex items-baseline justify-between gap-1 text-[11px] leading-none">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono font-semibold">
          {value === undefined ? "—" : `${Math.round(value)}%`}
        </span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-muted">
        {value !== undefined && (
          <div
            className={`h-full rounded-full ${tone(value)}`}
            style={{ width: `${Math.min(100, Math.max(2, value))}%` }}
          />
        )}
      </div>
    </div>
  );
}

/**
 * A node's live resources on its list row: CPU, memory and disk, speed
 * and this month's traffic. "row" sits at the end of a wide row, "footer"
 * under the name on narrow screens, "card" in a node card at any width.
 */
export function NodeLiveStats({
  info,
  month,
  variant,
}: {
  info: NodeSystemInfo | null;
  /** This month's [in, out] bytes. */
  month?: [number, number];
  variant: "row" | "footer" | "card";
}) {
  const up = info ? (info.netOutSpeed ?? info.uploadSpeed) : undefined;
  const down = info ? (info.netInSpeed ?? info.downloadSpeed) : undefined;
  const rate = (v?: number) => (v === undefined ? "—" : `${bytes(v)}/s`);
  const upIcon = <ArrowUp className="h-3 w-3 shrink-0 text-muted-foreground" />;
  const downIcon = (
    <ArrowDown className="h-3 w-3 shrink-0 text-muted-foreground" />
  );
  const total = month ? bytes(month[0] + month[1]) : "—";
  const split = month ? `↑${bytes(month[1])} ↓${bytes(month[0])}` : "";

  if (variant !== "row") {
    return (
      <div
        className={`space-y-2 ${variant === "footer" ? "mt-2 lg:hidden" : ""}`}
      >
        <NodeMeters info={info} />
        <div className="grid grid-cols-2 divide-x divide-divider rounded-lg bg-muted/60 py-1.5 text-[11px] tabular-nums">
          <div className="min-w-0 px-2.5">
            <div className="text-[10px] text-muted-foreground">网速</div>
            <div className="flex flex-wrap items-center gap-x-2 font-medium">
              <span className="flex items-center gap-1 whitespace-nowrap">
                {upIcon}
                {rate(up)}
              </span>
              <span className="flex items-center gap-1 whitespace-nowrap">
                {downIcon}
                {rate(down)}
              </span>
            </div>
          </div>
          <div className="min-w-0 px-2.5" title={split}>
            <div className="text-[10px] text-muted-foreground">本月流量</div>
            <div className="flex flex-wrap items-baseline gap-x-1.5">
              <span className="font-semibold">{total}</span>
              <span className="whitespace-nowrap text-[10px] text-muted-foreground">
                {split}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="hidden items-center gap-5 lg:flex">
      <div className="w-60">
        <NodeMeters info={info} />
      </div>
      <div className="w-24">
        <NodeSpeed info={info} />
      </div>
      <div className="w-28">
        <NodeMonth month={month} />
      </div>
    </div>
  );
}

/** CPU / memory / disk meters, as one row. */
export function NodeMeters({ info }: { info: NodeSystemInfo | null }) {
  return (
    <div className="grid grid-cols-3 gap-3">
      <Meter label="CPU" value={info?.cpuUsage} />
      <Meter label="内存" value={info?.memoryUsage} />
      <Meter label="磁盘" value={info?.diskUsage} />
    </div>
  );
}

/** Up/down rate, two lines. */
export function NodeSpeed({ info }: { info: NodeSystemInfo | null }) {
  const up = info ? (info.netOutSpeed ?? info.uploadSpeed) : undefined;
  const down = info ? (info.netInSpeed ?? info.downloadSpeed) : undefined;

  return (
    <div className="space-y-0.5 text-[11px] font-medium leading-tight tabular-nums">
      <div className="flex items-center gap-1">
        <ArrowUp className="h-3 w-3 shrink-0 text-muted-foreground" />
        {rate(up)}
      </div>
      <div className="flex items-center gap-1">
        <ArrowDown className="h-3 w-3 shrink-0 text-muted-foreground" />
        {rate(down)}
      </div>
    </div>
  );
}

/** This month's traffic, total plus the up/down split. */
export function NodeMonth({ month }: { month?: [number, number] }) {
  return (
    <div className="space-y-0.5 leading-tight tabular-nums">
      <div className="flex items-baseline gap-1.5 text-[11px]">
        <span className="text-[10px] text-muted-foreground">本月</span>
        <span className="font-semibold">
          {month ? bytes(month[0] + month[1]) : "—"}
        </span>
      </div>
      <div className="text-[10px] text-muted-foreground">
        {month ? `↑${bytes(month[1])} ↓${bytes(month[0])}` : ""}
      </div>
    </div>
  );
}
