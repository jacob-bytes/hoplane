import * as React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Globe,
  LayoutDashboard,
  Link2,
  Plus,
  Rss,
  Search,
  Server,
  Settings,
  Share2,
  Users,
  Wifi,
} from "lucide-react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { getNodeList, getSubscriptions } from "@/api";

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
    icon: <Rss className="h-4 w-4" />,
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

const GROUPS = ["页面", "操作", "服务器", "订阅"] as const;

/** ⌘K / Ctrl+K: jump between pages, start a create flow, find a node. */
export function CommandPalette() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
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

        for (const sub of subList.slice(0, 50)) {
          items.push({
            id: `sub-${sub.id}`,
            label: sub.name,
            group: "订阅",
            path: `/subscription?q=${encodeURIComponent(sub.name)}`,
            icon: <Rss className="h-4 w-4" />,
          });
        }

        setEntities(items);
      } catch {
        // The palette keeps working with the static commands.
      }
    })();
  }, [open]);

  const grouped = useMemo(() => {
    const all = [...COMMANDS, ...entities];

    return GROUPS.map((group) => ({
      group,
      items: all.filter((c) => c.group === group),
    })).filter((g) => g.items.length > 0);
  }, [entities]);

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

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="搜索页面、服务器或订阅…" />
        <CommandList>
          <CommandEmpty>没有匹配的页面或操作</CommandEmpty>
          {grouped.map(({ group, items }) => (
            <CommandGroup key={group} heading={group}>
              {items.map((c) => (
                <CommandItem
                  key={c.id}
                  value={`${c.label} ${c.keywords ?? ""} ${c.group}`}
                  onSelect={() => run(c)}
                >
                  <span className="text-muted-foreground">{c.icon}</span>
                  <span className="min-w-0 flex-1 truncate">{c.label}</span>
                  <span className="shrink-0 text-[11px] text-muted-foreground/80">
                    {c.group}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
        </CommandList>
        <div className="flex items-center gap-3 border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
          <span>↑↓ 选择</span>
          <span>↵ 打开</span>
          <span>esc 关闭</span>
        </div>
      </CommandDialog>
    </>
  );
}
