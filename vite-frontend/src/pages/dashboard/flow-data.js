/**
 * Build chart points for the dashboard traffic card.
 *
 * Kept as plain JS so the aggregation can be tested with Node's built-in
 * test runner without adding a frontend test framework.
 */
function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function buildFlowChartData(statisticsFlows, range, formatFlow, now = new Date()) {
  if (range === "24h") {
    const hours = [];

    for (let i = 23; i >= 0; i--) {
      const time = new Date(now.getTime() - i * 60 * 60 * 1000);

      hours.push(time.getHours().toString().padStart(2, "0") + ":00");
    }

    const flowMap = new Map();

    statisticsFlows.forEach((item) => {
      flowMap.set(item.time, {
        flow: item.flow || 0,
        in: item.inFlow || 0,
        out: item.outFlow || 0,
      });
    });

    return hours.map((hour) => {
      const point = flowMap.get(hour);

      return {
        time: hour,
        flow: point?.flow || 0,
        in: point?.in || 0,
        out: point?.out || 0,
        formattedFlow: formatFlow(point?.flow || 0),
      };
    });
  }

  const days = range === "7d" ? 7 : 30;
  const buckets = new Map();
  const keys = [];
  const labels = [];

  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(now);

    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() - i);
    const key = dateKey(day);

    buckets.set(key, { flow: 0, in: 0, out: 0 });
    keys.push(key);
    labels.push(
      `${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`,
    );
  }

  statisticsFlows.forEach((item, index) => {
    const stamp =
      item.createdTime ??
      now.getTime() - (statisticsFlows.length - 1 - index) * 3600_000;
    const key = dateKey(new Date(stamp));
    const bucket = buckets.get(key);

    if (!bucket) return;
    bucket.flow += item.flow || 0;
    bucket.in += item.inFlow || 0;
    bucket.out += item.outFlow || 0;
  });

  return labels.map((time, index) => {
    const bucket = buckets.get(keys[index]) || { flow: 0, in: 0, out: 0 };

    return {
      time,
      flow: bucket.flow,
      in: bucket.in,
      out: bucket.out,
      formattedFlow: formatFlow(bucket.flow),
    };
  });
}
