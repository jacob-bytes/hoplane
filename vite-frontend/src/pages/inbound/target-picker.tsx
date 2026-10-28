import type { InboundApiItem } from "@/api/types";

import { useState } from "react";
import {
  Ban,
  Check,
  ChevronLeft,
  ChevronRight,
  Search,
  Waypoints,
} from "lucide-react";

import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
} from "@/components/dialog";

/** Where traffic goes: "direct", "block" or an inbound id. */
export type TargetKey = string;

const SEARCH_FROM = 8;

export function targetSource(i: InboundApiItem): string {
  if (!i.external) return i.nodeName || "服务器";

  return i.sourceName ? `订阅源 · ${i.sourceName}` : "导入";
}

function TargetIcon({ k }: { k: TargetKey }) {
  if (k === "block") return <Ban className="h-4 w-4 text-destructive" />;
  if (k === "direct") return <Waypoints className="h-4 w-4 text-success" />;

  return null;
}

/** The current choice, shown as a tappable row. */
export function TargetButton({
  value,
  targets,
  missing,
  onClick,
}: {
  value: TargetKey;
  targets: InboundApiItem[];
  missing?: boolean;
  onClick: () => void;
}) {
  const t = targets.find((i) => String(i.id) === value);
  const title =
    value === "direct"
      ? "直连"
      : value === "block"
        ? "阻断"
        : missing
          ? "已删除的节点"
          : (t?.name ?? "选择出站节点");

  return (
    <button
      className={`flex w-full items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors active:bg-muted ${
        missing ? "border-destructive/50" : "border-hairline bg-raised"
      }`}
      type="button"
      onClick={onClick}
    >
      <TargetIcon k={value} />
      <span className="min-w-0 flex-1">
        <span
          className={`block truncate text-sm ${
            !value ? "text-muted-foreground" : missing ? "text-destructive" : ""
          }`}
        >
          {title}
        </span>
        {t && (
          <span className="block truncate text-xs text-muted-foreground">
            {targetSource(t)}
          </span>
        )}
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </button>
  );
}

/** A list of exits to pick from, opened over the 分流 dialog. */
export function TargetPicker({
  isOpen,
  title,
  value,
  targets,
  withBlock,
  onPick,
  onClose,
}: {
  isOpen: boolean;
  title: string;
  value: TargetKey;
  targets: InboundApiItem[];
  withBlock?: boolean;
  onPick: (k: TargetKey) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const shown = q
    ? targets.filter((t) =>
        `${t.name} ${targetSource(t)}`.toLowerCase().includes(q),
      )
    : targets;
  const groups = [...new Set(shown.map(targetSource))];

  const close = () => {
    setQuery("");
    onClose();
  };

  const row = (k: TargetKey, name: string, sub?: string) => (
    <button
      key={k}
      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left active:bg-muted"
      type="button"
      onClick={() => {
        onPick(k);
        close();
      }}
    >
      <TargetIcon k={k} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm">{name}</span>
        {sub && (
          <span className="block truncate text-xs text-muted-foreground">
            {sub}
          </span>
        )}
      </span>
      {value === k && <Check className="h-4 w-4 shrink-0 text-primary" />}
    </button>
  );

  return (
    <Dialog
      backdrop="blur"
      classNames={{
        base: "!w-[calc(100%-32px)] !mx-auto sm:!w-full rounded-xl overflow-hidden",
      }}
      open={isOpen}
      placement="center"
      scrollBehavior="inside"
      size="md"
      onOpenChange={(open) => !open && close()}
    >
      <DialogContent>
        {/* The list can outgrow a phone screen: keep a way back and the
            search box above it, not inside the scrolled body. */}
        <DialogHeader className="flex items-center gap-2">
          <button
            aria-label="返回"
            className="rounded-lg p-1 text-muted-foreground hover:bg-muted"
            type="button"
            onClick={close}
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h2 className="text-lg font-bold">{title}</h2>
        </DialogHeader>
        {targets.length >= SEARCH_FROM && (
          <label className="flex shrink-0 items-center gap-2 rounded-xl border border-hairline bg-raised px-3 py-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              className="min-w-0 flex-1 bg-transparent text-sm outline-none"
              placeholder="搜索节点"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
        )}
        <DialogBody className="flex flex-col gap-1 pb-4">
          {!q && (
            <div className="rounded-xl bg-raised">
              {row("direct", "直连", "从本服务器出去")}
              {withBlock && row("block", "阻断", "丢弃匹配的流量")}
            </div>
          )}
          {groups.map((g) => (
            <div key={g} className="pt-2">
              <p className="px-3 pb-1 text-xs text-muted-foreground">{g}</p>
              <div className="rounded-xl bg-raised">
                {shown
                  .filter((t) => targetSource(t) === g)
                  .map((t) => row(String(t.id), t.name))}
              </div>
            </div>
          ))}
          {q && shown.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              没有匹配的节点
            </p>
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
