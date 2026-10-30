import assert from "node:assert/strict";
import test from "node:test";

import { buildFlowChartData } from "../src/pages/dashboard/flow-data.js";

const fmt = (value) => String(value);
const now = new Date("2026-10-30T12:00:00Z");
const day = 86400_000;

test("7d/30d aggregate hourly rows by created day", () => {
  const flows = [
    { time: "10:00", flow: 100, inFlow: 40, outFlow: 60, createdTime: now.getTime() },
    { time: "11:00", flow: 200, inFlow: 80, outFlow: 120, createdTime: now.getTime() - 2 * day },
  ];

  const week = buildFlowChartData(flows, "7d", fmt, now);
  const month = buildFlowChartData(flows, "30d", fmt, now);

  assert.equal(week.length, 7);
  assert.equal(month.length, 30);
  assert.equal(week.reduce((sum, p) => sum + p.flow, 0), 300);
  assert.equal(week.reduce((sum, p) => sum + p.in, 0), 120);
  assert.equal(week.reduce((sum, p) => sum + p.out, 0), 180);
});

test("old rows without createdTime still fall back to recent hours", () => {
  const flows = [
    { time: "10:00", flow: 50 },
    { time: "11:00", flow: 70 },
  ];

  const week = buildFlowChartData(flows, "7d", fmt, now);

  assert.equal(week.reduce((sum, p) => sum + p.flow, 0), 120);
});

test("24h keeps 24 hourly points", () => {
  const points = buildFlowChartData([], "24h", fmt, now);

  assert.equal(points.length, 24);
  assert.ok(points.every((point) => point.time.endsWith(":00")));
});
