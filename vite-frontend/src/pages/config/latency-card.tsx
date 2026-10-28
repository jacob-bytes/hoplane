import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox, checkboxHandler } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  LATENCY_TARGETS_KEY,
  type LatencyTarget,
  parseLatencyTargets,
} from "@/utils/latency-targets";

export { LATENCY_TARGETS_KEY };

const MAX_TARGETS = 30;
const MAX_PINNED = 3;

// Province × carrier TCP-ping addresses on carrier CDN nodes, port 80.
const CITIES = [
  ["北京", "bj"],
  ["上海", "sh"],
  ["广东", "gd"],
] as const;
const CARRIERS = [
  ["电信", "ct"],
  ["联通", "cu"],
  ["移动", "cm"],
] as const;
const PRESETS: LatencyTarget[] = CITIES.flatMap(([city, c]) =>
  CARRIERS.map(([carrier, k]) => ({
    name: `${city}${carrier}`,
    host: `${c}-${k}-v4.ip.zstaticcdn.com`,
    port: 80,
    enabled: true,
  })),
);
// One point per carrier, spread over regions.
const RECOMMENDED = ["广东电信", "上海联通", "北京移动"];

/** One line for the collapsed section. */
export function latencySummary(configs: Record<string, string>): string {
  const targets = parseLatencyTargets(configs[LATENCY_TARGETS_KEY]);
  const enabled = targets.filter((t) => t.enabled);

  if (targets.length === 0) return "未设置 · 延迟从面板服务器测";
  const pinned = enabled.filter((t) => t.pinned).map((t) => t.name);

  return [
    `${targets.length} 个测试点，默认测 ${enabled.length} 个`,
    pinned.length ? `卡片显示 ${pinned.join("、")}` : "卡片显示最差和最好的",
  ].join(" · ");
}

/** Reference points nodes measure latency to, saved with the page. */
export function LatencySettings({
  configs,
  onChange,
}: {
  configs: Record<string, string>;
  onChange: (key: string, value: string) => void;
}) {
  const targets = parseLatencyTargets(configs[LATENCY_TARGETS_KEY]);
  const pinnedCount = targets.filter((t) => t.pinned).length;
  const names = new Set(targets.map((t) => t.name));

  const save = (next: LatencyTarget[]) =>
    onChange(LATENCY_TARGETS_KEY, next.length ? JSON.stringify(next) : "");
  const update = (i: number, patch: Partial<LatencyTarget>) =>
    save(targets.map((t, j) => (j === i ? { ...t, ...patch } : t)));
  const move = (i: number, by: number) => {
    const next = [...targets];

    [next[i], next[i + by]] = [next[i + by], next[i]];
    save(next);
  };
  const add = (list: LatencyTarget[]) =>
    save(
      [...targets, ...list.filter((t) => !names.has(t.name))].slice(
        0,
        MAX_TARGETS,
      ),
    );

  const full = targets.length >= MAX_TARGETS;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">
        服务器定时用 TCP
        连接测到这些地址的延迟和丢包，代表该地区运营商用户到服务器的延迟。
        打开“默认”的测试点所有服务器都测；某台服务器要测别的，到服务器页的“测试点”单独选或批量设置。
        卡片显示勾选“卡片显示”的测试点（最多 {MAX_PINNED}{" "}
        个，没选够时补最差和最好的）。不设置时，入站延迟仍从面板服务器测。
      </p>

      {targets.length === 0 && (
        <div className="rounded-lg border border-dashed border-hairline px-3 py-4 text-center text-sm text-muted-foreground">
          还没有测试点
          <div className="mt-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() =>
                add(
                  PRESETS.filter((p) => RECOMMENDED.includes(p.name)).map(
                    (p) => ({ ...p, pinned: true }),
                  ),
                )
              }
            >
              添加三网推荐（{RECOMMENDED.join(" / ")}）
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {targets.map((t, i) => (
          <div
            key={i}
            className="flex flex-col gap-2 rounded-lg border border-hairline p-2.5"
          >
            <div className="grid grid-cols-[1fr_5rem] gap-2 sm:grid-cols-[8rem_1fr_5rem]">
              <Input
                aria-label="名称"
                className="order-1 h-8 text-xs"
                placeholder="名称"
                value={t.name}
                onChange={(e) => update(i, { name: e.target.value })}
              />
              <Input
                aria-label="地址"
                className="order-3 col-span-2 h-8 min-w-0 text-xs sm:order-2 sm:col-span-1"
                placeholder="域名或 IP"
                value={t.host}
                onChange={(e) => update(i, { host: e.target.value.trim() })}
              />
              <Input
                aria-label="端口"
                className="order-2 h-8 text-xs sm:order-3"
                inputMode="numeric"
                placeholder="端口"
                value={t.port ? String(t.port) : ""}
                onChange={(e) =>
                  update(i, {
                    port: Number(e.target.value.replace(/\D/g, "")) || 0,
                  })
                }
              />
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5">
                <Switch
                  aria-label="默认"
                  checked={t.enabled}
                  onCheckedChange={(v) => update(i, { enabled: v })}
                />
                默认
              </span>
              <div className="inline-flex items-center gap-2">
                <Checkbox
                  checked={Boolean(t.pinned)}
                  disabled={!t.pinned && pinnedCount >= MAX_PINNED}
                  onCheckedChange={checkboxHandler((v) =>
                    update(i, { pinned: v }),
                  )}
                />
                <span className="text-xs">卡片显示</span>
              </div>
              <span className="ml-auto flex items-center gap-0.5">
                <Button
                  aria-label="上移"
                  disabled={i === 0}
                  size="icon"
                  variant="ghost"
                  onClick={() => move(i, -1)}
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </Button>
                <Button
                  aria-label="下移"
                  disabled={i === targets.length - 1}
                  size="icon"
                  variant="ghost"
                  onClick={() => move(i, 1)}
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </Button>
                <Button
                  aria-label="删除"
                  size="icon"
                  variant="ghost"
                  onClick={() => save(targets.filter((_, j) => j !== i))}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button disabled={full} size="sm" variant="secondary">
              添加预设
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-h-72 w-44">
            {PRESETS.map((p) => (
              <DropdownMenuItem
                key={p.name}
                className={names.has(p.name) ? "opacity-40" : ""}
                onSelect={() => add([p])}
              >
                {p.name}
                {names.has(p.name) ? "（已添加）" : ""}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <Button
          disabled={full}
          size="sm"
          variant="secondary"
          onClick={() =>
            save([...targets, { name: "", host: "", port: 80, enabled: true }])
          }
        >
          {<Plus className="h-3.5 w-3.5" />}
          自定义
        </Button>
        <span className="self-center text-xs text-muted-foreground">
          {targets.length} / {MAX_TARGETS}
        </span>
      </div>
    </div>
  );
}
