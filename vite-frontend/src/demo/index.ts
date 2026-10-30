import type {
  AxiosAdapter,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from "axios";

import axios from "axios";
import { toast } from "sonner";

/**
 * The online demo (VITE_DEMO=true builds, published with the docs): the
 * panel runs without a backend. Every API call is answered in the browser
 * from responses recorded on a panel seeded with sample data
 * (fixtures.json); changes report success but are not kept.
 */
export const IS_DEMO = import.meta.env.VITE_DEMO === "true";

type Entry = {
  key: string;
  res: { code: number; msg: string; data?: unknown };
};
type Fixtures = {
  recordedAt: number;
  admin: Record<string, Entry[]>;
  user: Record<string, Entry[]>;
};

export type DemoRole = "admin" | "user";

// The panel reads the role and expiry from the JWT payload; the demo's
// tokens carry them unsigned (nothing checks a signature here).
const demoToken = (sub: number, roleId: number, user: string) =>
  `demo.${btoa(JSON.stringify({ sub: String(sub), role_id: roleId, user, exp: 4102444800, iat: 1760000000 }))}.demo`;

const SESSIONS: Record<DemoRole, Record<string, string>> = {
  admin: {
    token: demoToken(1, 0, "admin_user"),
    role_id: "0",
    name: "admin_user",
    admin: "true",
  },
  user: {
    token: demoToken(2, 1, "xiaoming"),
    role_id: "1",
    name: "xiaoming",
    admin: "false",
  },
};

export function demoRole(): DemoRole {
  return localStorage.getItem("role_id") === "0" ? "admin" : "user";
}

/** Signs in as the demo admin or the demo user (and reloads). */
export function switchDemoRole(role: DemoRole) {
  for (const [k, v] of Object.entries(SESSIONS[role]))
    localStorage.setItem(k, v);
  window.location.hash = "#/dashboard";
  window.location.reload();
}

/**
 * Writes report success without a stored result; the first word of the
 * last path segment tells them apart ("latest-results" is a read).
 */
const WRITE_WORDS = new Set(
  "create save update delete remove assign reset toggle import install control regenerate pause resume redeploy batch force run refresh split rollback test dismiss restore export reconcile clear login register finish begin verify".split(
    " ",
  ),
);
const isWrite = (segment: string) =>
  WRITE_WORDS.has(segment.split("-")[0]) || segment === "check-status";

/** Measurements: answered from the recorded lists, by id. */
const PROBES: Record<string, [list: string, field: string]> = {
  "inbound/probe": ["inbound/list", "probe"],
  "node/latency/probe": ["node/list", "latency"],
  "inbound/relay/probe": ["inbound/relay/list", "latency"],
};
const ALIASES: Record<string, string> = { "node/route/probe": "node/route" };

const canon = (body: unknown) => {
  if (body === undefined || body === null || body === "") return "";
  try {
    const value = typeof body === "string" ? JSON.parse(body) : body;

    return JSON.stringify(sortKeys(value));
  } catch {
    return String(body);
  }
};

function sortKeys(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === "object") {
    return Object.fromEntries(
      Object.keys(v as object)
        .sort()
        .map((k) => [k, sortKeys((v as Record<string, unknown>)[k])]),
    );
  }

  return v;
}

/**
 * Moves recorded times (last seen, expiry, chart windows) forward by the
 * time since the recording, so the demo always looks current.
 */
function shiftTimes(v: unknown, recordedAt: number, delta: number): unknown {
  if (typeof v === "number") {
    return v > 1.6e12 && Math.abs(v - recordedAt) < 400 * 86400000
      ? v + delta
      : v;
  }
  if (Array.isArray(v)) return v.map((x) => shiftTimes(x, recordedAt, delta));
  if (v && typeof v === "object") {
    return Object.fromEntries(
      Object.entries(v as object).map(([k, x]) => [
        k,
        shiftTimes(x, recordedAt, delta),
      ]),
    );
  }

  return v;
}

let fixtures: Fixtures | null = null;

// The check is inline so other builds drop the recording entirely.
const loadFixtures = async (): Promise<Fixtures> =>
  import.meta.env.VITE_DEMO === "true"
    ? ((await import("./fixtures.json")).default as Fixtures)
    : { recordedAt: 0, admin: {}, user: {} };
let lastNotice = 0;

async function answer(config: InternalAxiosRequestConfig) {
  fixtures ??= await loadFixtures();
  const raw = (config.url ?? "").replace(/^https?:\/\/[^/]+/, "");
  const path = raw.replace(/^\/?(api\/v1\/)?/, "");
  let bare = path.split("?")[0];

  bare = ALIASES[bare] ?? bare;
  const key = canon(config.data);
  const book = fixtures[demoRole()];
  const entries =
    book[path] ??
    book[bare] ??
    Object.entries(book).find(([p]) => p.split("?")[0] === bare)?.[1];
  const last = bare.split("/").pop() ?? "";
  const write = isWrite(last);
  const delta = Math.max(0, Date.now() - fixtures.recordedAt);

  if (bare === "audit/list") {
    const now = Date.now();

    return {
      code: 0,
      msg: "操作成功",
      data: [
        {
          id: 3,
          userId: 2,
          username: "xiaoming",
          action: "forward/update",
          method: "POST",
          path: "/api/v1/forward/update",
          ip: "203.0.113.20",
          userAgent: navigator.userAgent,
          status: 200,
          createdAt: now - 12 * 60_000,
        },
        {
          id: 2,
          userId: 1,
          username: "admin_user",
          action: "node/create",
          method: "POST",
          path: "/api/v1/node/create",
          ip: "198.51.100.10",
          userAgent: navigator.userAgent,
          status: 200,
          createdAt: now - 2 * 3600_000,
        },
        {
          id: 1,
          userId: 1,
          username: "admin_user",
          action: "user/session/revoke-others",
          method: "POST",
          path: "/api/v1/user/session/revoke-others",
          ip: "198.51.100.10",
          userAgent: navigator.userAgent,
          status: 200,
          createdAt: now - 26 * 3600_000,
        },
      ],
      ts: now,
    };
  }

  if (bare === "node/list" && localStorage.getItem("demo-empty") === "1") {
    return { code: 0, msg: "操作成功", data: [], ts: Date.now() };
  }

  if (bare === "user/session/list") {
    const now = Date.now();

    return {
      code: 0,
      msg: "操作成功",
      data: [
        {
          id: 1,
          ip: "127.0.0.1",
          userAgent: navigator.userAgent,
          createdAt: now - 3600_000,
          lastSeenAt: now,
          expiresAt: now + 7 * 86400_000,
          current: true,
        },
      ],
      ts: now,
    };
  }

  // The latency point pool is a config value; the demo ships a small one so
  // the 测试点 tab can be opened and edited.
  if (bare === "config/get" || bare === "public/config/get") {
    const body = JSON.parse(String(config.data || "{}")) as { name?: string };

    if (body.name === "latency_targets") {
      return {
        code: 0,
        msg: "操作成功",
        data: {
          name: "latency_targets",
          value: JSON.stringify([
            {
              name: "北京电信",
              host: "219.141.140.10",
              port: 80,
              enabled: true,
              pinned: true,
            },
            { name: "上海联通", host: "210.22.97.1", port: 80, enabled: true },
            {
              name: "广东移动",
              host: "211.136.192.6",
              port: 80,
              enabled: true,
            },
            { name: "北京联通", host: "123.125.99.1", port: 80, enabled: true },
            {
              name: "上海电信",
              host: "202.96.209.133",
              port: 80,
              enabled: true,
            },
            {
              name: "广东电信",
              host: "202.96.128.86",
              port: 80,
              enabled: true,
            },
          ]),
        },
        ts: Date.now(),
      };
    }
  }
  // 调优 is a live sysctl probe; the demo answers with a plausible state so
  // the dialog can be explored (and its apply/restore buttons feel real).
  if (bare === "node/tune") {
    const body = JSON.parse(String(config.data || "{}")) as {
      action?: "status" | "apply" | "restore";
      groups?: string[];
    };
    const groups = [
      {
        id: "congestion",
        name: "拥塞控制",
        desc: "启用 BBR，提高高延迟链路的吞吐",
        applied: true,
        settings: [
          {
            key: "net.ipv4.tcp_congestion_control",
            current: "cubic",
            target: "bbr",
            supported: true,
            ok: false,
          },
        ],
      },
      {
        id: "buffer",
        name: "收发缓冲区",
        desc: "提高 TCP 读写缓冲区上限，减少丢包重传",
        applied: false,
        settings: [
          {
            key: "net.core.rmem_max",
            current: "212992",
            target: "16777216",
            supported: true,
            ok: false,
          },
          {
            key: "net.core.wmem_max",
            current: "212992",
            target: "16777216",
            supported: true,
            ok: false,
          },
        ],
      },
      {
        id: "fastopen",
        name: "TCP Fast Open",
        desc: "减少重复握手的往返次数",
        applied: false,
        settings: [
          {
            key: "net.ipv4.tcp_fastopen",
            current: "0",
            target: "3",
            supported: true,
            ok: false,
          },
        ],
      },
    ];

    if (body.action === "apply" || body.action === "restore") {
      const chosen = new Set(body.groups ?? []);

      for (const group of groups) {
        group.applied = body.action === "apply" ? chosen.has(group.id) : false;
      }
    }

    await new Promise((r) => setTimeout(r, 500));

    return {
      code: 0,
      msg: "操作成功",
      data: {
        kernel: "6.1.0-13-amd64",
        congestion: "bbr",
        available: "bbr, cubic",
        hasBackup: true,
        groups,
        warnings: [],
      },
      ts: Date.now(),
    };
  }
  if (PROBES[bare]) {
    const [list, field] = PROBES[bare];
    const ids: number[] = JSON.parse(String(config.data || "{}")).ids ?? [];
    const items = (book[list]?.[0]?.res.data ?? []) as Array<
      Record<string, unknown>
    >;
    const data = Object.fromEntries(
      items
        .filter((i) => ids.length === 0 || ids.includes(Number(i.id)))
        .filter((i) => i[field])
        .map((i) => [String(i.id), i[field]]),
    );

    await new Promise((r) => setTimeout(r, 600));

    return shiftTimes(
      { code: 0, msg: "操作成功", data },
      fixtures.recordedAt,
      delta,
    );
  }
  if (entries?.length && !write) {
    const hit = entries.find((e) => e.key === key) ?? entries[0];

    return shiftTimes(structuredClone(hit.res), fixtures.recordedAt, delta);
  }
  if (write) {
    if (Date.now() - lastNotice > 4000) {
      lastNotice = Date.now();
      toast("演示站不会保存修改，刷新后还原", { icon: "ℹ️", id: "demo-write" });
    }
    let echo: unknown = null;

    if (/^(save|create|update)$/.test(last)) {
      try {
        const body =
          typeof config.data === "string"
            ? JSON.parse(config.data)
            : config.data;

        echo = { id: Date.now() % 100000, ...body };
      } catch {
        echo = null;
      }
    }

    return { code: 0, msg: "操作成功", data: echo, ts: Date.now() };
  }

  // Not recorded: an empty answer most pages render as "nothing yet". The
  // CI check (scripts/demo/check.mjs) fails on this warning, so new pages
  // get recorded (scripts/demo/README.md).
  // eslint-disable-next-line no-console
  console.warn(`[demo] not recorded: ${bare}`);

  return { code: 0, msg: "操作成功", data: [], ts: Date.now() };
}

const demoAdapter: AxiosAdapter = async (config) => {
  const data = await answer(config);

  return {
    data,
    status: 200,
    statusText: "OK",
    headers: {},
    config,
    request: {},
  } as AxiosResponse;
};

/** Answers the API in the browser and signs in as the demo admin. */
export function installDemo() {
  axios.defaults.adapter = demoAdapter;
  if (!localStorage.getItem("token")?.startsWith("demo")) {
    for (const [k, v] of Object.entries(SESSIONS.admin)) {
      localStorage.setItem(k, v);
    }
  }
}

/**
 * The node page and monitoring get live metrics over a WebSocket; the demo
 * plays plausible ones for the demo nodes instead.
 */
export function startDemoRealtime(
  onMessage: (m: Record<string, unknown>) => void,
) {
  let stopped = false;
  let timer = 0;
  const totals: Record<number, [number, number]> = {};

  void (async () => {
    fixtures ??= await loadFixtures();
    const nodes = (fixtures.admin["node/list"]?.[0]?.res.data ?? []) as Array<{
      id: number;
    }>;
    const tick = () => {
      if (stopped) return;
      const t = Date.now() / 1000;

      for (const n of nodes) {
        const wave = 0.5 + 0.5 * Math.sin(t / 40 + n.id);
        const inSpeed = Math.round(
          (8 + 40 * wave + 6 * Math.random()) * 131072,
        );
        const outSpeed = Math.round(inSpeed * (0.9 + 0.2 * Math.random()));
        const [inTotal, outTotal] = totals[n.id] ?? [
          n.id * 7.3e11,
          n.id * 6.9e11,
        ];

        totals[n.id] = [inTotal + inSpeed * 3, outTotal + outSpeed * 3];
        onMessage({ id: n.id, type: "status", data: 1 });
        onMessage({
          id: n.id,
          type: "metric",
          data: {
            cpuUsage: Math.round((6 + 30 * wave + 5 * Math.random()) * 10) / 10,
            cpuCores: n.id % 2 === 0 ? 4 : 2,
            memoryUsage: Math.round((32 + 12 * wave) * 10) / 10,
            memoryTotal: 8 * 1024 ** 3,
            memoryUsed: Math.round(8 * 1024 ** 3 * (0.32 + 0.12 * wave)),
            diskUsage: 23.5,
            diskTotal: 80 * 1024 ** 3,
            diskUsed: Math.round(80 * 1024 ** 3 * 0.235),
            osName: "Debian",
            osVersion: "12",
            arch: "x86_64",
            virt: "qemu",
            netInBytes: totals[n.id][0],
            netOutBytes: totals[n.id][1],
            netInSpeed: inSpeed,
            netOutSpeed: outSpeed,
            load1: Math.round((0.2 + 1.2 * wave) * 100) / 100,
            load5: Math.round((0.3 + wave) * 100) / 100,
            load15: Math.round((0.4 + 0.8 * wave) * 100) / 100,
            tcpConns: Math.round(120 + 500 * wave),
            udpConns: Math.round(12 + 50 * wave),
            uptime: 86400 * 21 + Math.round(t % 86400),
          },
        });
      }
      timer = window.setTimeout(tick, 3000);
    };

    tick();
  })();

  return () => {
    stopped = true;
    window.clearTimeout(timer);
  };
}
