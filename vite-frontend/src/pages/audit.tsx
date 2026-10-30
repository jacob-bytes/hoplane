import { useState } from "react";
import { useEffect } from "react";

import { useDebouncedValue } from "@/hooks/use-debounced-value";
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
import { Button } from "@/components/ui/button";

export default function AuditPage() {
  const [items, setItems] = useState<AuditLogApiItem[]>([]);
  const [query, setQuery] = useState("");
  const [failedOnly, setFailedOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 50;
  const debouncedQuery = useDebouncedValue(query, 300);

  useEffect(() => {
    setLoading(true);
    getAuditLogs(page, pageSize, debouncedQuery, failedOnly)
      .then((res) => {
        if (res.code === 0) {
          setItems(res.data.items || []);
          setTotal(res.data.total || 0);
        }
      })
      .catch(() => {
        setItems([]);
        setTotal(0);
      })
      .finally(() => setLoading(false));
  }, [debouncedQuery, failedOnly, page]);

  useEffect(() => {
    setPage(1);
  }, [debouncedQuery, failedOnly]);

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
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <Button
          aria-pressed={failedOnly}
          size="sm"
          variant={failedOnly ? "secondary" : "outline"}
          onClick={() => setFailedOnly((value) => !value)}
        >
          仅失败
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            const rows = [
              ["时间", "用户", "操作", "IP", "状态", "结果"],
              ...items.map((item) => [
                formatDate(item.createdAt, true),
                item.username || `#${item.userId}`,
                item.action,
                item.ip,
                String(item.status),
                item.code === 0 && item.status < 400 ? "成功" : "失败",
              ]),
            ];
            const csv = rows
              .map((row) =>
                row
                  .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
                  .join(","),
              )
              .join("\n");
            const url = URL.createObjectURL(
              new Blob([csv], { type: "text/csv;charset=utf-8" }),
            );
            const link = document.createElement("a");

            link.href = url;
            link.download = "hoplane-audit.csv";
            link.click();
            URL.revokeObjectURL(url);
          }}
        >
          导出当前页 CSV
        </Button>
      </div>

      {loading ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          正在加载审计日志…
        </p>
      ) : items.length === 0 ? (
        <EmptyHint text={query ? "没有匹配的日志" : "还没有审计记录"} />
      ) : (
        <ListGroup
          className="audit-list"
          columns="170px minmax(0,0.8fr) minmax(0,1.2fr) 140px 80px"
          head={["时间", "用户", "操作", "IP", "状态"]}
        >
          {items.map((item) => (
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
                  variant={
                    item.code === 0 && item.status < 400
                      ? "success"
                      : "destructive"
                  }
                >
                  {item.code === 0 && item.status < 400 ? "成功" : "失败"}
                </Badge>,
              ]}
              meta={`${item.username || `#${item.userId}`} · ${formatDate(item.createdAt, true)} · ${item.action} · ${item.ip}`}
              title={item.action}
              onClick={() => undefined}
            />
          ))}
        </ListGroup>
      )}

      {!loading && total > pageSize && (
        <div className="mt-3 flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>
            共 {total} 条 · 第 {page} / {Math.ceil(total / pageSize)} 页
          </span>
          <div className="flex gap-2">
            <Button
              disabled={page <= 1}
              size="sm"
              variant="outline"
              onClick={() => setPage((value) => Math.max(1, value - 1))}
            >
              上一页
            </Button>
            <Button
              disabled={page >= Math.ceil(total / pageSize)}
              size="sm"
              variant="outline"
              onClick={() => setPage((value) => value + 1)}
            >
              下一页
            </Button>
          </div>
        </div>
      )}
    </AnimatedPage>
  );
}
