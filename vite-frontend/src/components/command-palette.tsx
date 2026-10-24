import * as React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Download,
  Globe,
  LayoutDashboard,
  Link2,
  Plus,
  Search,
  Rss,
  Server,
  Settings,
  Share2,
  Users,
  Wifi,
} from "lucide-react";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { getNodeList, getSubscriptions } from "@/api";
import { cn } from "@/lib/utils";

type Command = {
  id: string;
  label: string;
  group: string;
  path: string;
  icon: React.ReactNode;
  keywords?: string;
};

const COMMANDS: Command[] = [
  {
    id: "dashboard",
    label: "概览",
    group: "页面",
    path: "/dashboard",
    icon: <LayoutDashboard className="h-4 w-4" />,
    keywords: "dashboard home",
  },
  {
    id: "node",
    label: "服务器",
    group: "页面",
    path: "/node",
    icon: <Server className="h-4 w-4" />,
    keywords: "server agent",
  },
  {
    id: "inbound",
    label: "节点",
    group: "页面",
    path: "/inbound",
    icon: <Globe className="h-4 w-4" />,
    keywords: "inbound 入站",
  },
  {
    id: "relay",
    label: "中转",
    group: "页面",
    path: "/relay",
    icon: <Link2 className="h-4 w-4" />,
    keywords: "relay 线路",
  },
  {
    id: "forward",
    label: "转发规则",
    group: "页面",
    path: "/forward",
    icon: <Wifi className="h-4 w-4" />,
    keywords: "forward 规则",
  },
  {
    id: "tunnel",
    label: "隧道",
    group: "页面",
    path: "/tunnel",
    icon: <Share2 className="h-4 w-4" />,
    keywords: "tunnel",
  },
  {
    id: "subscription",
    label: "订阅",
    group: "页面",
    path: "/subscription",
    icon: <Download className="h-4 w-4" />,
    keywords: "subscription 订阅",
  },
  {
    id: "user",
    label: "用户",
    group: "页面",
    path: "/user",
    icon: <Users className="h-4 w-4" />,
    keywords: "user 用户",
  },
  {
    id: "config",
    label: "设置",
    group: "页面",
    path: "/config",
    icon: <Settings className="h-4 w-4" />,
    keywords: "config settings",
  },
  {
    id: "new-node",
    label: "新建服务器",
    group: "操作",
    path: "/node?new=1",
    icon: <Plus className="h-4 w-4" />,
  },
  {
    id: "new-inbound",
    label: "新建入站",
    group: "操作",
    path: "/inbound?new=1",
    icon: <Plus className="h-4 w-4" />,
  },
  {
    id: "new-tunnel",
    label: "新建隧道",
    group: "操作",
    path: "/tunnel?new=1",
    icon: <Plus className="h-4 w-4" />,
  },
];

/** ⌘K / Ctrl+K: jump between pages or start a create flow. */
export function CommandPalette() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const [entities, setEntities] = useState<Command[]>([]);
  const loadedRef = useRef(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };

    window.addEventListener("keydown", onKey);

    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) {
      const timer = window.setTimeout(() => inputRef.current?.focus(), 20);

      return () => window.clearTimeout(timer);
    }
    setQuery("");
    setActive(0);

    return undefined;
  }, [open]);

  // Load nodes and subscriptions once, so "⌘K 香港" jumps straight there.
  useEffect(() => {
    if (!open || loadedRef.current) return;
    loadedRef.current = true;

    void (async () => {
      try {
        const [nodes, subs] = await Promise.all([
          getNodeList(),
          getSubscriptions(),
        ]);
        const items: Command[] = [];

        if (nodes.code === 0 && nodes.data) {
          for (const n of nodes.data.slice(0, 50)) {
            items.push({
              id: `node-${n.id}`,
              label: n.name,
              group: "服务器",
              path: `/node?q=${encodeURIComponent(n.name)}`,
              icon: <Server className="h-4 w-4" />,
            });
          }
        }
        const subList = subs.code === 0 ? (subs.data?.items ?? []) : [];

        if (subList.length > 0) {
          for (const sub of subList.slice(0, 50)) {
            items.push({
              id: `sub-${sub.id}`,
              label: sub.name,
              group: "订阅",
              path: `/subscription?q=${encodeURIComponent(sub.name)}`,
              icon: <Rss className="h-4 w-4" />,
            });
          }
        }
        setEntities(items);
      } catch {
        // The palette keeps working with the static commands.
      }
    })();
  }, [open]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const all = [...COMMANDS, ...entities];

    if (!q) return all;

    return all.filter((c) =>
      `${c.label} ${c.group} ${c.keywords ?? ""}`.toLowerCase().includes(q),
    );
  }, [entities, query]);

  const run = (command: Command) => {
    setOpen(false);
    const [path, search] = command.path.split("?");

    navigate({ pathname: path, search: search ? `?${search}` : "" });
  };

  return (
    <>
      <button
        aria-label="搜索或跳转（⌘K）"
        className="hidden shrink-0 items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground sm:flex"
        type="button"
        onClick={() => setOpen(true)}
      >
        <Search className="h-3.5 w-3.5" />
        <span>搜索</span>
        <kbd className="rounded border border-border bg-muted px-1 font-mono text-[10px]">
          ⌘K
        </kbd>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="max-w-lg gap-0 overflow-hidden p-0"
          showCloseButton={false}
        >
          <DialogTitle className="sr-only">搜索或跳转</DialogTitle>
          <div className="flex items-center gap-2 border-b border-border px-3">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              ref={inputRef}
              aria-label="搜索或跳转"
              className="h-11 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              placeholder="搜索页面或操作…"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setActive((i) => Math.min(i + 1, results.length - 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setActive((i) => Math.max(i - 1, 0));
                } else if (e.key === "Enter" && results[active]) {
                  e.preventDefault();
                  run(results[active]);
                }
              }}
            />
          </div>

          <div className="max-h-[50vh] overflow-y-auto p-1.5">
            {results.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                没有匹配的页面或操作
              </p>
            ) : (
              results.map((c, i) => (
                <button
                  key={c.id}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left text-sm",
                    i === active
                      ? "bg-accent text-foreground"
                      : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                  )}
                  type="button"
                  onClick={() => run(c)}
                  onMouseEnter={() => setActive(i)}
                >
                  <span className="text-muted-foreground">{c.icon}</span>
                  <span className="min-w-0 flex-1 truncate">{c.label}</span>
                  <span className="shrink-0 text-[11px] text-muted-foreground/80">
                    {c.group}
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 opacity-0" />
                </button>
              ))
            )}
          </div>

          <div className="flex items-center gap-3 border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
            <span>↑↓ 选择</span>
            <span>↵ 打开</span>
            <span>esc 关闭</span>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
