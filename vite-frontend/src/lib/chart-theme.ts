/**
 * Chart palette and shared props.
 *
 * Series colours are CSS variables so charts follow the theme (and any
 * theme package) without re-reading computed styles. They stay categorical
 * — a metric keeps its colour across ranges — but the set is deliberately
 * small: accent, second accent, and the three status colours.
 *
 * Recharts renders these into SVG attributes; `var(--x)` works in current
 * browsers, and in the demo screenshots.
 */
export const CHART_SERIES = {
  primary: "var(--primary)",
  secondary: "var(--chart-2)",
  success: "var(--success)",
  warning: "var(--warning)",
  danger: "var(--danger)",
} as const;

/** Axis ticks: muted, small, no tick lines. */
export const CHART_AXIS = {
  tick: { fill: "var(--muted-foreground)", fontSize: 11 },
  tickLine: false as const,
  axisLine: false as const,
};

/** Grid: horizontal hairlines only, so the data stays in front. */
export const CHART_GRID = {
  stroke: "var(--border)",
  strokeDasharray: "3 3",
  vertical: false as const,
};

/** Tooltip card matching the panel's popover. */
export const CHART_TOOLTIP = {
  contentStyle: {
    background: "var(--popover)",
    border: "1px solid var(--border)",
    borderRadius: 10,
    padding: "8px 10px",
    fontSize: 12,
    color: "var(--popover-foreground)",
    boxShadow: "0 4px 16px rgb(0 0 0 / 0.08)",
  },
  labelStyle: { color: "var(--muted-foreground)", fontSize: 11 },
  itemStyle: { color: "var(--popover-foreground)", fontSize: 12 },
  cursor: { fill: "var(--muted)" },
} as const;
