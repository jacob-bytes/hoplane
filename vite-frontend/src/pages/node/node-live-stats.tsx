import type { NodeSystemInfo } from "@/pages/node/system-info";

import * as React from "react";
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
  return v >= 85 ? "bg-destructive" : v >= 60 ? "bg-warning" : "bg-primary/70";
}

function Meter({ label, value }: { label: string; value?: number }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div className="flex items-baseline justify-between gap-1 text-[11px] leading-none">
        <span className="shrink-0 whitespace-nowrap text-muted-foreground">
          {label}
        </span>
        <span className="shrink-0 whitespace-nowrap font-mono font-semibold tabular-nums">
          {value === undefined ? "—" : `${Math.round(value)}%`}
        </span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-muted">
        {value !== undefined && (
          <div
            className={`h-full rounded-full transition-[width] duration-500 ${tone(value)}`}
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

function useHistory(value?: number) {
  const [values, setValues] = React.useState<number[]>([]);

  React.useEffect(() => {
    if (value === undefined) return;

    setValues((prev) =>
      prev.length > 0 && prev[prev.length - 1] === value
        ? prev
        : [...prev, value].slice(-16),
    );
  }, [value]);

  return values;
}

function MiniSpark({ values }: { values: number[] }) {
  if (values.length < 3) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const points = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * 40;

      return `${x.toFixed(1)},${(10 - ((value - min) / span) * 8).toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg
      aria-hidden
      className="h-3 w-10 shrink-0 text-primary/50"
      viewBox="0 0 40 12"
    >
      <polyline
        fill="none"
        points={points}
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.2"
      />
    </svg>
  );
}

function ResourceMetric({
  label,
  value,
  detail,
  spark,
}: {
  label: string;
  value?: number;
  detail?: string;
  spark?: number[];
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11px] text-muted-foreground">{label}</span>
        <span className="flex items-center gap-1">
          {spark ? <MiniSpark values={spark} /> : null}
          <span className="font-mono text-sm font-semibold tabular-nums">
            {value === undefined ? "—" : `${Math.round(value)}%`}
          </span>
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        {value !== undefined && (
          <div
            className={`h-full rounded-full transition-[width] duration-500 ${tone(value)}`}
            style={{ width: `${Math.min(100, Math.max(2, value))}%` }}
          />
        )}
      </div>
      {detail ? (
        <div className="truncate text-[11px] tabular-nums text-muted-foreground">
          {detail}
        </div>
      ) : null}
    </div>
  );
}
export const NodeLiveStats = React.memo(function NodeLiveStats({
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
  const cpuHistory = useHistory(info?.cpuUsage);
  const memoryHistory = useHistory(info?.memoryUsage);
  const diskHistory = useHistory(info?.diskUsage);

  if (variant === "card") {
    const load =
      info &&
      [info.load1, info.load5, info.load15].every(
        (value) => value !== undefined,
      )
        ? [info.load1!, info.load5!, info.load15!]
            .map((value) => value.toFixed(2))
            .join(" ")
        : undefined;

    return (
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          <ResourceMetric
            detail={
              [
                info?.cpuCores ? `${info.cpuCores} 核` : "",
                load ? `负载 ${load}` : "",
              ]
                .filter(Boolean)
                .join(" · ") || undefined
            }
            label="CPU"
            spark={cpuHistory}
            value={info?.cpuUsage}
          />
          <ResourceMetric
            detail={
              info?.memoryTotal
                ? `${bytes(info.memoryUsed ?? 0)} / ${bytes(info.memoryTotal)}`
                : undefined
            }
            label="内存"
            spark={memoryHistory}
            value={info?.memoryUsage}
          />
          <ResourceMetric
            detail={
              info?.diskTotal
                ? `${bytes(info.diskUsed ?? 0)} / ${bytes(info.diskTotal)}`
                : undefined
            }
            label="磁盘"
            spark={diskHistory}
            value={info?.diskUsage}
          />
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[11px] text-muted-foreground">
                本月流量
              </span>
              <span className="font-mono text-sm font-semibold tabular-nums">
                {total}
              </span>
            </div>
            <div
              aria-hidden
              className="flex h-1.5 overflow-hidden rounded-full bg-muted"
              title="上行 / 下行占本月流量的比例"
            >
              {month && month[0] + month[1] > 0 ? (
                <>
                  <span
                    className="h-full bg-success/70"
                    style={{
                      width: `${(month[1] / (month[0] + month[1])) * 100}%`,
                    }}
                  />
                  <span
                    className="h-full bg-primary/60"
                    style={{
                      width: `${(month[0] / (month[0] + month[1])) * 100}%`,
                    }}
                  />
                </>
              ) : null}
            </div>
            <div className="flex items-center gap-2 text-[11px] tabular-nums text-muted-foreground">
              <span className="flex items-center gap-0.5">
                <ArrowUp className="h-3 w-3" />
                {month ? bytes(month[1]) : "—"}
              </span>
              <span className="flex items-center gap-0.5">
                <ArrowDown className="h-3 w-3" />
                {month ? bytes(month[0]) : "—"}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-hairline pt-2 text-[11px] tabular-nums text-muted-foreground">
          <span>实时网速</span>
          <span className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <ArrowDown className="h-3 w-3" />
              {rate(down)}
            </span>
            <span className="flex items-center gap-1">
              <ArrowUp className="h-3 w-3" />
              {rate(up)}
            </span>
          </span>
        </div>
      </div>
    );
  }

  if (variant !== "row") {
    return (
      <div
        className={`flex flex-col gap-2 ${variant === "footer" ? "mt-2 lg:hidden" : ""}`}
      >
        <NodeMeters info={info} />
        <div className="grid grid-cols-2 divide-x divide-divider rounded-lg bg-muted/60 py-1.5 text-[11px] tabular-nums">
          <div className="min-w-0 px-2.5">
            <div className="text-[11px] text-muted-foreground">网速</div>
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
            <div className="text-[11px] text-muted-foreground">本月流量</div>
            <div className="flex flex-wrap items-baseline gap-x-1.5">
              <span className="font-semibold">{total}</span>
              <span className="whitespace-nowrap text-[11px] text-muted-foreground">
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
});

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
export function NodeSpeed({
  info,
  align = "start",
}: {
  info: NodeSystemInfo | null;
  align?: "start" | "end";
}) {
  const up = info ? (info.netOutSpeed ?? info.uploadSpeed) : undefined;
  const down = info ? (info.netInSpeed ?? info.downloadSpeed) : undefined;

  return (
    <div
      className={`flex flex-col gap-0.5 text-[11px] font-medium leading-tight tabular-nums ${align === "end" ? "text-right" : ""}`}
    >
      <div
        className={`flex items-center gap-1 ${align === "end" ? "justify-end" : ""}`}
      >
        <ArrowUp className="h-3 w-3 shrink-0 text-muted-foreground" />
        {rate(up)}
      </div>
      <div
        className={`flex items-center gap-1 ${align === "end" ? "justify-end" : ""}`}
      >
        <ArrowDown className="h-3 w-3 shrink-0 text-muted-foreground" />
        {rate(down)}
      </div>
    </div>
  );
}

/** This month's traffic, total plus the up/down split. */
export function NodeMonth({
  month,
  align = "start",
}: {
  month?: [number, number];
  align?: "start" | "end";
}) {
  return (
    <div
      className={`flex flex-col gap-0.5 leading-tight tabular-nums ${align === "end" ? "text-right" : ""}`}
    >
      <div
        className={`flex items-baseline gap-1.5 text-[11px] ${align === "end" ? "justify-end" : ""}`}
      >
        <span className="text-[11px] text-muted-foreground">本月</span>
        <span className="font-semibold">
          {month ? bytes(month[0] + month[1]) : "—"}
        </span>
      </div>
      <div className="text-[11px] text-muted-foreground">
        {month ? `↑${bytes(month[1])} ↓${bytes(month[0])}` : ""}
      </div>
    </div>
  );
}
