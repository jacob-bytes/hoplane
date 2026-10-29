import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartPie } from "lucide-react";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageEmptyState } from "@/components/page-state";

interface FlowChartPoint {
  time: string;
  flow: number;
}

interface FlowChartCardProps {
  statisticsFlowsCount: number;
  chartData: FlowChartPoint[];
  formatFlow: (value: number, unit?: string) => string;
}

export const FlowChartCard = ({
  statisticsFlowsCount,
  chartData,
  formatFlow,
}: FlowChartCardProps) => {
  const peak = chartData.reduce<FlowChartPoint | null>(
    (best, point) => (best === null || point.flow > best.flow ? point : best),
    null,
  );
  const average =
    chartData.length > 0
      ? chartData.reduce((sum, point) => sum + point.flow, 0) / chartData.length
      : 0;

  return (
    <Card className="mb-6 lg:mb-8">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <ChartPie aria-hidden="true" className="h-4 w-4 text-primary" />
          <h2 className="text-[15px] font-medium text-foreground">
            24小时流量统计
          </h2>
          {statisticsFlowsCount > 0 && (
            <div className="ml-auto flex items-center gap-3 text-[11px] text-muted-foreground">
              <span>
                峰值{" "}
                <span className="font-mono tabular text-foreground">
                  {formatFlow(peak?.flow ?? 0)}
                </span>
                {peak ? ` · ${peak.time}` : ""}
              </span>
              <span>
                平均{" "}
                <span className="font-mono tabular text-foreground">
                  {formatFlow(average)}
                </span>
              </span>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {statisticsFlowsCount === 0 ? (
          <PageEmptyState className="h-48" message="暂无流量统计数据" />
        ) : (
          <div
            aria-label={`24 小时流量统计，共 ${chartData.length} 个采样点`}
            className="h-56 w-full text-primary lg:h-72"
            role="img"
          >
            <ResponsiveContainer height="100%" width="100%">
              <LineChart
                data={chartData}
                margin={{ top: 20, right: 0, left: -20, bottom: 0 }}
              >
                <XAxis
                  axisLine={false}
                  dataKey="time"
                  tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                  tickLine={false}
                />
                <YAxis
                  axisLine={false}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                  tickFormatter={(value: number | string) => {
                    const v = typeof value === "number" ? value : Number(value);

                    if (!Number.isFinite(v)) return String(value);
                    if (v === 0) return "0";
                    if (v < 1024) return `${v}B`;
                    if (v < 1024 * 1024) return `${(v / 1024).toFixed(1)}K`;
                    if (v < 1024 * 1024 * 1024)
                      return `${(v / (1024 * 1024)).toFixed(1)}M`;

                    return `${(v / (1024 * 1024 * 1024)).toFixed(1)}G`;
                  }}
                  tickLine={false}
                />
                <Tooltip
                  content={({
                    active,
                    payload,
                    label,
                  }: {
                    active?: boolean;
                    payload?: Array<{ value?: number | string }>;
                    label?: string | number;
                  }) => {
                    if (active && payload && payload.length) {
                      const firstValue = payload[0]?.value;
                      const numericValue =
                        typeof firstValue === "number"
                          ? firstValue
                          : Number(firstValue);
                      const flowValue = Number.isFinite(numericValue)
                        ? numericValue
                        : 0;

                      return (
                        <div className="rounded-lg border border-border bg-popover p-3 text-popover-foreground shadow-md">
                          <p className="font-medium text-foreground">{`时间: ${label ?? ""}`}</p>
                          <p className="text-primary font-semibold mt-1">{`流量: ${formatFlow(flowValue)}`}</p>
                        </div>
                      );
                    }

                    return null;
                  }}
                  cursor={{ fill: "var(--muted)" }}
                />
                <Line
                  dataKey="flow"
                  dot={false}
                  isAnimationActive={false}
                  stroke="currentColor"
                  strokeWidth={2}
                  type="monotone"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
