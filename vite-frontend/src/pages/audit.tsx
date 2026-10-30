import { useMemo, useState } from "react";
import { useEffect } from "react";

import { getAuditLogs, type AuditLogApiItem } from "@/api";
import { AnimatedPage } from "@/components/animated-page";
import {
  EmptyHint,
  ListGroup,
  ListRow,
  PageHeader,
  PageToolbar,
  formatDate,
} from "@/components/page-kit";
import { Badge } from "@/components/ui/badge";

export default function AuditPage() {
  const [items, setItems] = useState<AuditLogApiItem[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAuditLogs()
      .then((res) => {
        if (res.code === 0) setItems(res.data || []);
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();

    if (!keyword) return items;

    return items.filter((item) =>
      [item.username, item.action, item.ip, item.userAgent]
        .join(" ")
        .toLowerCase()
        .includes(keyword),
    );
  }, [items, query]);

  return (
    <AnimatedPage className="mx-auto w-full max-w-[1440px] px-6 py-6">
      <PageHeader
        description="管理员和用户对面板的关键写操作"
        title="审计日志"
      />
      <PageToolbar
        placeholder="搜索用户、操作或 IP"
        search={query}
        onSearch={setQuery}
      />

      {loading ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          正在加载审计日志…
        </p>
      ) : filtered.length === 0 ? (
        <EmptyHint text={query ? "没有匹配的日志" : "还没有审计记录"} />
      ) : (
        <ListGroup
          columns="170px minmax(0,0.8fr) minmax(0,1.2fr) 140px 80px"
          head={["时间", "用户", "操作", "IP", "状态"]}
        >
          {filtered.map((item) => (
            <ListRow
              key={item.id}
              cells={[
                <span
                  key="time"
                  className="font-mono text-xs text-muted-foreground"
                >
                  {formatDate(item.createdAt, true)}
                </span>,
                <span key="user" className="truncate text-sm font-medium">
                  {item.username || `#${item.userId}`}
                </span>,
                <div key="action" className="min-w-0">
                  <div className="truncate text-sm">{item.action}</div>
                  <div className="truncate text-[11px] text-muted-foreground">
                    {item.method} {item.path}
                  </div>
                </div>,
                <span
                  key="ip"
                  className="truncate font-mono text-xs text-muted-foreground"
                >
                  {item.ip || "—"}
                </span>,
                <Badge
                  key="status"
                  variant={item.status >= 400 ? "destructive" : "success"}
                >
                  {item.status || 200}
                </Badge>,
              ]}
              meta={`${item.username || `#${item.userId}`} · ${formatDate(item.createdAt, true)} · ${item.action} · ${item.ip}`}
              title={item.action}
              onClick={() => undefined}
            />
          ))}
        </ListGroup>
      )}
    </AnimatedPage>
  );
}
