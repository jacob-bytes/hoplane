// Checks the built online demo the way a visitor sees it: serves the build
// under /hoplane/demo/, opens every page in headless Chrome (as admin, then as
// the demo user) and fails on page errors, pages that bounce to the login
// screen, and API calls the recording doesn't answer ("[demo] not
// recorded", see README.md). No dependencies: Chrome DevTools Protocol over
// Node's built-in WebSocket.
//
//   node scripts/demo/check.mjs <demo build dir>
//   CHROME=/path/to/chrome to pick the browser.
import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";

const dir = path.resolve(process.argv[2] || "dist-demo");
const BASE = "/hoplane/demo/";
// Admins' 监控 redirects to 节点, which is already on the list.
const ADMIN_PAGES = ["dashboard", "node", "inbound", "relay", "forward", "tunnel", "subscription", "limit", "user", "group", "config", "audit", "profile"];
const USER_PAGES = ["dashboard", "my-subscriptions", "forward", "profile"];
const SETTLE_MS = 2500;

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon", ".json": "application/json", ".webmanifest": "application/manifest+json", ".woff2": "font/woff2" };
const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split("?")[0]);
  if (!url.startsWith(BASE)) return res.writeHead(404).end();
  let file = path.join(dir, url.slice(BASE.length));
  if (!file.startsWith(dir)) return res.writeHead(403).end();
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
  if (!fs.existsSync(file)) return res.writeHead(404).end();
  res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const origin = `http://127.0.0.1:${server.address().port}`;

const onPath = (bin) => (process.env.PATH || "").split(path.delimiter).some((d) => fs.existsSync(path.join(d, bin)));
const chromeBin = process.env.CHROME || ["google-chrome", "chromium", "chromium-browser"].find(onPath) || "google-chrome";
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "demo-check-"));
const chrome = spawn(chromeBin, ["--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage",
  "--remote-debugging-port=0", `--user-data-dir=${profile}`, "--window-size=1366,900", "about:blank"]);
const wsURL = await new Promise((resolve, reject) => {
  let err = "";
  chrome.stderr.on("data", (d) => {
    err += d;
    const m = err.match(/DevTools listening on (ws:\/\/\S+)/);
    if (m) resolve(m[1]);
  });
  chrome.on("exit", (code) => reject(new Error(`chrome exited (${code}): ${err}`)));
  setTimeout(() => reject(new Error("chrome did not start")), 30000);
});

const ws = new WebSocket(wsURL);
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
let nextId = 0;
const pending = new Map();
const listeners = [];
ws.addEventListener("message", (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
  } else if (msg.method) {
    for (const l of listeners) l(msg);
  }
});
const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
  const id = ++nextId;
  pending.set(id, { resolve, reject });
  ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const { targetId } = await send("Target.createTarget", { url: "about:blank" });
const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
const page = (method, params) => send(method, params, sessionId);
await page("Page.enable");
await page("Runtime.enable");

let current = "";
const problems = [];
const notes = [];
listeners.push((msg) => {
  if (msg.sessionId !== sessionId) return;
  if (msg.method === "Runtime.exceptionThrown") {
    const d = msg.params.exceptionDetails;
    problems.push(`${current}: page error: ${d.exception?.description?.split("\n")[0] || d.text}`);
  }
  if (msg.method === "Runtime.consoleAPICalled") {
    const text = msg.params.args.map((a) => a.value ?? a.description ?? "").join(" ");
    if (text.startsWith("[demo] not recorded")) problems.push(`${current}: ${text}`);
    else if (msg.params.type === "error") notes.push(`${current}: console.error: ${text.slice(0, 200)}`);
  }
});
const evaluate = async (expression) => (await page("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true })).result.value;

async function visit(role, route) {
  current = `${role} #/${route}`;
  await page("Page.navigate", { url: `${origin}${BASE}#/${route}` });
  await sleep(SETTLE_MS);
  const state = await evaluate(`({ hash: location.hash, text: document.body.innerText.length })`);
  if (!state.hash.startsWith(`#/${route}`)) problems.push(`${current}: ended up at ${state.hash} (signed out?)`);
  else if (state.text < 40) problems.push(`${current}: blank page`);

  if (route === "config") {
    await evaluate(
      `(() => { const b = [...document.querySelectorAll("button")].find((x) => x.textContent.includes("外观")); b?.click(); return Boolean(b); })()`,
    );
    await sleep(500);
    const text = await evaluate("document.body.innerText");
    if (text.includes("背景壁纸") || text.includes("赛博朋克")) {
      problems.push(`${current}: removed appearance controls are still visible`);
    }
    if (!text.includes("显示模式")) {
      problems.push(`${current}: appearance mode picker missing`);
    }
    const rootClass = await evaluate("document.documentElement.className");
    if (rootClass.includes("has-custom-bg") || rootClass.includes("has-wallpaper-bg")) {
      problems.push(`${current}: legacy background class is active`);
    }
  }

  if (route === "audit") {
    const text = await evaluate("document.body.innerText");
    if (!text.includes("forward/update")) {
      problems.push(`${current}: audit rows missing`);
    }
    if (!text.includes("xiaoming")) {
      problems.push(`${current}: audit user missing`);
    }
  }

  if (route === "subscription") {
    const hasEdit = await evaluate(
      `[...document.querySelectorAll("button")].some((b) => (b.getAttribute("aria-label") || "").startsWith("编辑 "))`,
    );
    if (!hasEdit) problems.push(`${current}: subscription edit action missing`);
    const opened = await evaluate(
      `(() => { const b = [...document.querySelectorAll("button")].find((x) => (x.getAttribute("aria-label") || "").startsWith("编辑 ")); if (!b) return false; b.click(); return true; })()`,
    );
    await sleep(500);
    if (!opened) {
      problems.push(`${current}: subscription edit button did not click`);
    } else {
      const dialog = await evaluate(
        `Boolean(document.querySelector('[role="dialog"]'))`,
      );
      if (!dialog) problems.push(`${current}: subscription editor did not open`);
      await evaluate(
        `(() => { const b = [...document.querySelectorAll("button")].find((x) => ["取消", "关闭"].includes(x.textContent.trim())); b?.click(); return true; })()`,
      );
    }
  }

  if (route === "node") {
    await evaluate(`document.querySelector('[data-slot="list-row"] button')?.click()`);
    await sleep(350);
    await evaluate(
      `(() => { const b = [...document.querySelectorAll("button")].find((x) => x.textContent.includes("详情")); b?.click(); return Boolean(b); })()`,
    );
    await sleep(450);
    const detail = await evaluate(`document.body.innerText.includes("实时资源")`);
    if (!detail) problems.push(`${current}: node detail dialog missing`);
    await evaluate(
      `(() => { const b = [...document.querySelectorAll("button")].find((x) => x.textContent.trim() === "关闭"); b?.click(); return true; })()`,
    );
  }
}

// Login screen: a non-expiring but malformed demo token keeps the demo
// adapter from auto-signing in, so the real login form renders.
fs.writeFileSync(
  path.join(dir, "login-check.html"),
  `<script>localStorage.clear();localStorage.setItem("token","demo.invalid.demo");location.replace("${BASE}")</script>`,
);
current = "login";
await page("Page.navigate", { url: `${origin}${BASE}login-check.html` });
await sleep(1800);
const loginText = await evaluate("document.body.innerText");
if (!loginText.includes("登录以管理你的网络")) {
  problems.push(`${current}: login form missing`);
}
const passwordType = await evaluate(
  `document.querySelector("#login-password")?.getAttribute("type")`,
);
if (passwordType !== "password") {
  problems.push(`${current}: password field is not masked`);
}
await evaluate(
  `(() => { const b = document.querySelector('button[aria-label="显示密码"]'); b?.click(); return Boolean(b); })()`,
);
const revealed = await evaluate(
  `document.querySelector("#login-password")?.getAttribute("type")`,
);
if (revealed !== "text") {
  problems.push(`${current}: password visibility toggle failed`);
}

current = "admin (first load)";
await page("Page.navigate", { url: `${origin}${BASE}` });
await evaluate("localStorage.clear()");
await page("Page.navigate", { url: `${origin}${BASE}` });
await sleep(SETTLE_MS);
for (const r of ADMIN_PAGES) await visit("admin", r);

// Empty overview shows the four-step setup guide.
current = "admin #/dashboard (empty)";
await evaluate(`localStorage.setItem("demo-empty", "1")`);
await page("Page.navigate", { url: `${origin}${BASE}#/dashboard` });
await sleep(SETTLE_MS);
const emptyText = await evaluate("document.body.innerText");
if (!emptyText.includes("开始使用") || !emptyText.includes("添加服务器")) {
  problems.push(`${current}: setup guide missing`);
}
await evaluate(`localStorage.removeItem("demo-empty")`);
await page("Page.navigate", { url: `${origin}${BASE}#/dashboard` });
await sleep(500);

// The demo note starts collapsed; open it, then switch to the demo user.
// Both are rendered on the next frame, so poll instead of relying on a fixed wait.
const clickButton = async (predicate) => {
  for (let i = 0; i < 30; i += 1) {
    const clicked = await evaluate(
      `(() => { const b = [...document.querySelectorAll("button")].find(${predicate}); if (!b) return false; b.click(); return true; })()`,
    );

    if (clicked) return true;
    await sleep(100);
  }

  return false;
};

await clickButton(`(b) => b.textContent.trim() === "演示站"`);
await clickButton(`(b) => b.textContent.includes("普通用户视角")`);
for (let i = 0; i < 40; i += 1) {
  const switched = await evaluate(
    `[...document.querySelectorAll("button")].some((b) => b.textContent.includes("回到管理员视角"))`,
  );

  if (switched) break;
  await sleep(100);
}
await sleep(SETTLE_MS);
for (const r of USER_PAGES) await visit("user", r);

// 90% traffic shows the quota warning.
current = "user #/dashboard (90% flow)";
await evaluate(`localStorage.setItem("demo-flow", "high")`);
await page("Page.navigate", { url: `${origin}${BASE}#/dashboard` });
await sleep(SETTLE_MS);
const flowText = await evaluate("document.body.innerText");
if (!flowText.includes("流量已使用")) {
  problems.push(`${current}: quota warning missing`);
}
await evaluate(`localStorage.removeItem("demo-flow")`);

for (const n of notes) console.log(`note  ${n}`);
for (const p of problems) console.log(`FAIL  ${p}`);
console.log(problems.length
  ? `\n${problems.length} problem(s). Recording missing for new pages? See scripts/demo/README.md.`
  : `demo ok: ${ADMIN_PAGES.length} admin + ${USER_PAGES.length} user pages`);

// Chrome keeps writing its profile until it has exited; clean up after
// that, and never let cleanup decide the result.
ws.close();
server.close();
await new Promise((r) => {
  chrome.once("exit", r);
  chrome.kill();
  setTimeout(r, 5000);
});
try {
  fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
} catch {
  // a leftover temp directory is harmless
}
process.exit(problems.length ? 1 : 0);
