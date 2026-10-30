export interface FlowChartPoint {
  time: string;
  flow: number;
  in: number;
  out: number;
  formattedFlow: string;
}

export function buildFlowChartData(
  statisticsFlows: Array<{
    time: string;
    flow?: number;
    inFlow?: number;
    outFlow?: number;
    createdTime?: number;
  }>,
  range: "24h" | "7d" | "30d",
  formatFlow: (value: number) => string,
  now?: Date,
): FlowChartPoint[];
