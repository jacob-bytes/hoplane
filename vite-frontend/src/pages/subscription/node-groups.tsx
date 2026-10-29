import type {
  NodeGroupDraft,
  NodeGroupItem,
  NodeGroupOptions,
  NodeGroupPreview,
  RemoteSourceItem,
} from "@/api";
import type { InboundApiItem } from "@/api/types";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Layers } from "lucide-react";

import { deleteNodeGroup, previewNodeGroup, saveNodeGroup } from "@/api";
import { EmptyHint } from "@/components/page-kit";
import { PROTOCOL_LABELS } from "@/pages/inbound/presets";
import { Button } from "@/components/ui/button";
import { Checkbox, checkboxHandler } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DialogBody, DialogFooter, DialogHeader } from "@/components/dialog";
import { RenameRules } from "@/pages/subscription/rename-rules";
import {
  ChipPicker,
  EditorTabs,
  Section,
  Segmented,
  ToggleRow,
} from "@/pages/subscription/controls";

/** Protocols that can carry per-user credentials (mirrors the backend). */
const MULTI_USER_PROTOCOLS = new Set([
  "vless",
  "vmess",
  "trojan",
  "hysteria2",
  "tuic",
  "anytls",
  "naive",
]);

export const EMPTY_GROUP_OPTIONS: NodeGroupOptions = {
  lines: "",
  regions: [],
  protocols: [],
  include: "",
  exclude: "",
  rename: "",
  addFlag: false,
  prefix: "",
  dedupe: false,
  sort: "",
  script: "",
};

const SCRIPT_EXAMPLE = `// 对处理后的节点再做一遍筛选、改名、排序，返回新的节点数组
// 每个节点：name 名称（可改）、original 原名、server、port、
// protocol 协议、region 地区（如 "🇭🇰 香港"）、line（"direct" 直连 / "relay" 中转）
function operator(nodes) {
  return nodes
    .filter((n) => !/过期|剩余/.test(n.name))
    .map((n) => {
      n.name = n.name.replace("IEPL", "专线");
      return n;
    })
    .sort((a, b) => a.region.localeCompare(b.region));
}
`;

/** Names the filters a group turns on, e.g. "地区 2 个、去重". */
function filterSummary(o: NodeGroupOptions): string {
  const steps: string[] = [];

  if (o.lines)
    steps.push(
      o.lines === "prefer_relay"
        ? "有中转优先显示中转"
        : o.lines === "relay"
          ? "只要中转"
          : "只要直连",
    );
  if (o.regions.length) steps.push(`地区 ${o.regions.length} 个`);
  if (o.protocols.length) steps.push(`协议 ${o.protocols.length} 个`);
  if (o.include || o.exclude) steps.push("名称");
  if (o.dedupe) steps.push("去重");

  return steps.join("、");
}

/** Names the naming steps a group turns on, e.g. "改名 2 条、国旗". */
function namingSummary(o: NodeGroupOptions): string {
  const steps: string[] = [];
  const renames = o.rename
    .split("\n")
    .filter((l) => l.trim() && !l.trim().startsWith("#")).length;

  if (renames) steps.push(`改名 ${renames} 条`);
  if (o.addFlag) steps.push("国旗");
  if (o.prefix) steps.push("前缀");
  if (o.sort === "name") steps.push("按名称排序");

  return steps.join("、");
}

/** Where a group's nodes come from, e.g. "3 个落地 + 1 个订阅源". */
export function groupSourceText(g: NodeGroupItem | NodeGroupDraft): string {
  if (g.sourceAll) return "全部节点";

  return [
    g.inboundIds.length ? `${g.inboundIds.length} 个节点` : "",
    g.sourceIds.length ? `${g.sourceIds.length} 个订阅源` : "",
  ]
    .filter(Boolean)
    .join(" + ");
}

export function groupDraftFrom(g?: NodeGroupItem): NodeGroupDraft {
  if (!g) {
    return {
      name: "",
      sourceAll: true,
      inboundIds: [],
      sourceIds: [],
      options: { ...EMPTY_GROUP_OPTIONS },
    };
  }

  return {
    id: g.id,
    name: g.name,
    sourceAll: g.sourceAll,
    inboundIds: g.inboundIds,
    sourceIds: g.sourceIds,
    options: { ...EMPTY_GROUP_OPTIONS, ...g.options },
  };
}

/** The node groups, in the order subscriptions list them by default. */
export function NodeGroupList({
  groups,
  onEdit,
  onMove,
}: {
  groups: NodeGroupItem[];
  onEdit: (g: NodeGroupItem) => void;
  onMove: (index: number, delta: -1 | 1) => void;
}) {
  if (groups.length === 0) {
    return (
      <EmptyHint text="节点组把自建、导入的节点和订阅源筛选、改名后存成一份列表，多个订阅可以共用；新建订阅前先建一个" />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
      {groups.map((g, i) => {
        const filters = filterSummary(g.options);
        const naming = namingSummary(g.options);

        return (
          <div
            key={g.id}
            className="group flex h-full cursor-pointer flex-col gap-2.5 rounded-xl border border-hairline bg-raised p-3.5 transition-colors hover:border-hairline-strong hover:bg-surface"
            role="button"
            tabIndex={0}
            onClick={() => onEdit(g)}
            onKeyDown={(e) => {
              if (e.target !== e.currentTarget) return;
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onEdit(g);
              }
            }}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-hairline bg-muted text-muted-foreground">
                  <Layers className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-medium">
                      {g.name}
                    </span>
                    {g.subscriptions.length === 0 && (
                      <Badge variant="outline">未使用</Badge>
                    )}
                  </div>
                  <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
                    {groupSourceText(g)}
                  </div>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="font-mono text-lg leading-none">
                  {g.nodeCount}
                </div>
                <div className="mt-0.5 text-[10px] text-muted-foreground">
                  节点
                </div>
              </div>{" "}
            </div>

            {(filters || naming || g.options.script) && (
              <div className="flex flex-wrap gap-1">
                {filters && <Badge variant="secondary">{filters}</Badge>}
                {naming && <Badge variant="secondary">{naming}</Badge>}
                {g.options.script && <Badge variant="secondary">脚本</Badge>}
              </div>
            )}

            <div className="mt-auto flex min-w-0 items-center gap-2 border-t border-hairline pt-2 text-[11px] text-muted-foreground">
              <div className="flex min-w-0 flex-1 items-center gap-1.5">
                <span className="shrink-0">订阅</span>
                {g.subscriptions.length > 0 ? (
                  <span className="flex min-w-0 flex-wrap gap-1">
                    {g.subscriptions.map((sub) => (
                      <span
                        key={sub.id}
                        className="max-w-40 truncate rounded-md bg-muted/70 px-1.5 py-0.5 text-foreground/80"
                        title={sub.name}
                      >
                        {sub.name}
                      </span>
                    ))}
                  </span>
                ) : (
                  <span>未被订阅使用</span>
                )}
              </div>
              <div
                className="flex shrink-0 items-center gap-0.5 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
                role="presentation"
                onClick={(e) => e.stopPropagation()}
              >
                <Button
                  aria-label={`上移 ${g.name}`}
                  className="h-6 w-6"
                  disabled={i === 0}
                  size="icon"
                  variant="ghost"
                  onClick={() => onMove(i, -1)}
                >
                  <ArrowUp className="h-3 w-3" />
                </Button>
                <Button
                  aria-label={`下移 ${g.name}`}
                  className="h-6 w-6"
                  disabled={i === groups.length - 1}
                  size="icon"
                  variant="ghost"
                  onClick={() => onMove(i, 1)}
                >
                  <ArrowDown className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

type GroupPage = "source" | "process" | "preview";

/** Edits a node group: its sources, filters, naming, script; previews it. */
export function NodeGroupEditor({
  draft,
  setDraft,
  inbounds,
  sources,
  regions,
  usedBy,
  onSaved,
  onClose,
}: {
  draft: NodeGroupDraft;
  setDraft: (d: NodeGroupDraft) => void;
  inbounds: InboundApiItem[];
  sources: RemoteSourceItem[];
  regions: string[];
  /** Subscriptions listing this group (an existing one). */
  usedBy: Array<{ id: number; name: string }>;
  onSaved: () => void;
  onClose: () => void;
}) {
  const [page, setPage] = useState<GroupPage>("source");
  const [preview, setPreview] = useState<NodeGroupPreview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const o = draft.options;
  const set = (patch: Partial<NodeGroupDraft>) => {
    setDraft({ ...draft, ...patch });
    setPreview(null);
  };
  const setOpts = (patch: Partial<NodeGroupOptions>) =>
    set({ options: { ...o, ...patch } });

  const protocols = useMemo(
    () =>
      [...new Set(inbounds.map((i) => i.protocol))].map(
        (p) => [p, PROTOCOL_LABELS[p] ?? p] as [string, string],
      ),
    [inbounds],
  );
  const selfBuilt = inbounds.filter((i) => !i.external);
  // Nodes of a remote source are picked as the whole source.
  const imported = inbounds.filter((i) => i.external && !i.sourceId);
  const sharedPicked = inbounds.filter(
    (i) =>
      (draft.sourceAll
        ? i.enabled
        : draft.inboundIds.includes(i.id) ||
          draft.sourceIds.includes(i.sourceId ?? 0)) &&
      (i.external || !MULTI_USER_PROTOCOLS.has(i.protocol)),
  ).length;

  const runPreview = async () => {
    setPreviewing(true);
    try {
      const res = await previewNodeGroup(draft);

      if (res.code !== 0) {
        toast.error(res.msg || "预览失败");

        return;
      }
      setPreview(res.data);
    } catch {
      toast.error("预览失败");
    } finally {
      setPreviewing(false);
    }
  };

  useEffect(() => {
    if (page === "preview" && !preview && !previewing) void runPreview();
  }, [page, preview]);

  const save = async () => {
    setSaving(true);
    try {
      const res = await saveNodeGroup(draft);

      if (res.code !== 0) {
        toast.error(res.msg || "保存失败");

        return;
      }
      if (res.msg && res.msg !== "操作成功") toast(res.msg, { icon: "⚠️" });
      else toast.success(draft.id ? "已保存" : "已创建");
      onSaved();
    } catch {
      toast.error("保存失败");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!draft.id) return;
    setSaving(true);
    try {
      const res = await deleteNodeGroup(draft.id);

      if (res.code !== 0) {
        toast.error(res.msg || "删除失败");

        return;
      }
      toast.success("已删除");
      onSaved();
    } catch {
      toast.error("删除失败");
    } finally {
      setSaving(false);
      setConfirmDelete(false);
    }
  };

  const pickList = (title: string, list: InboundApiItem[]) =>
    list.length > 0 && (
      <div className="flex flex-col gap-1">
        <p className="text-xs text-muted-foreground">{title}</p>
        {list.map((i) => (
          <div key={i.id} className="inline-flex items-center gap-2">
            <Checkbox
              checked={draft.inboundIds.includes(i.id)}
              className="w-full"
              onCheckedChange={checkboxHandler((on) =>
                set({
                  inboundIds: on
                    ? [...draft.inboundIds, i.id]
                    : draft.inboundIds.filter((x) => x !== i.id),
                }),
              )}
            />
            <span className="text-sm">{i.name}</span>
            {!i.enabled && (
              <span className="ml-1 text-xs text-muted-foreground">已停用</span>
            )}
            {(i.external || !MULTI_USER_PROTOCOLS.has(i.protocol)) && (
              <span className="ml-1 text-xs text-warning">共用凭据</span>
            )}
          </div>
        ))}
      </div>
    );

  return (
    <>
      <DialogHeader>
        <h2 className="text-lg font-bold">
          {draft.id ? "编辑节点组" : "新建节点组"}
        </h2>
      </DialogHeader>
      <DialogBody className="min-h-[min(65vh,34rem)] flex flex-col gap-4">
        <div className="sticky top-0 z-10">
          <EditorTabs
            tabs={[
              { key: "source", label: "来源" },
              {
                key: "process",
                label: "处理",
                badge:
                  filterSummary(o) || namingSummary(o) || o.script ? "开" : "",
              },
              {
                key: "preview",
                label: "预览",
                badge: preview ? preview.items.length : "",
              },
            ]}
            value={page}
            onChange={setPage}
          />
        </div>

        {page === "source" && (
          <div className="flex flex-col gap-4">
            <Section title="基本">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="group-name">名称</Label>
                <Input
                  id="group-name"
                  placeholder="例如 香港专线 / 全部自建"
                  value={draft.name}
                  onChange={(e) => set({ name: e.target.value })}
                />
              </div>
              {usedBy.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  订阅{usedBy.map((s) => `「${s.name}」`).join("、")}
                  在用，改动对它们立即生效
                </p>
              )}
            </Section>
            <Section hint="中转线路会跟着它的节点一起出现" title="来源">
              <Segmented
                options={[
                  ["all", "全部节点"],
                  ["pick", "指定节点"],
                ]}
                value={draft.sourceAll ? "all" : "pick"}
                onChange={(v) => set({ sourceAll: v === "all" })}
              />
              {draft.sourceAll ? (
                <p className="text-xs text-muted-foreground">
                  包括以后新增的节点和订阅源；只想要一部分可以在“处理”里筛选
                </p>
              ) : (
                <div className="max-h-56 flex flex-col gap-3 overflow-y-auto rounded-xl border border-hairline p-2">
                  {pickList("自建", selfBuilt)}
                  {pickList("导入", imported)}
                  {sources.length > 0 && (
                    <div className="flex flex-col gap-1">
                      <p className="text-xs text-muted-foreground">
                        订阅源（整个源，更新后的节点自动跟上）
                      </p>
                      {sources.map((src) => (
                        <div
                          key={src.id}
                          className="inline-flex items-center gap-2"
                        >
                          <Checkbox
                            checked={draft.sourceIds.includes(src.id)}
                            className="w-full"
                            onCheckedChange={checkboxHandler((on) =>
                              set({
                                sourceIds: on
                                  ? [...draft.sourceIds, src.id]
                                  : draft.sourceIds.filter((x) => x !== src.id),
                              }),
                            )}
                          />
                          <span className="text-sm">{src.name}</span>
                          <span className="ml-1 text-xs text-muted-foreground">
                            {src.nodeCount} 个节点
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {sharedPicked > 0 && (
                <p className="text-xs text-warning">
                  其中 {sharedPicked} 个是导入的节点或 Shadowsocks /
                  Snell，没法单独分配凭据：对方拿到共用的密码，订阅停用后已导入的配置仍能连接。
                </p>
              )}
            </Section>
          </div>
        )}

        {page === "process" && (
          <div className="flex flex-col gap-4">
            <Section
              collapsible
              defaultOpen={false}
              hint="只保留需要的节点；筛完剩几个可以在“预览”里看"
              summary={filterSummary(o) || "未设置"}
              title="筛选"
            >
              <div className="flex flex-col gap-1.5">
                <p className="text-xs font-medium">线路</p>
                <Segmented
                  columns={2}
                  options={[
                    ["", "全部"],
                    ["relay", "只要中转"],
                    ["direct", "只要直连"],
                    ["prefer_relay", "有中转优先显示中转"],
                  ]}
                  value={o.lines}
                  onChange={(lines) => setOpts({ lines })}
                />
                {o.lines === "prefer_relay" && (
                  <p className="text-xs text-muted-foreground">
                    同一节点有启用的中转时隐藏原直连，保留全部中转线路；没有中转则保留直连。按中转配置判断，不随测速结果变化，其他筛选继续生效。
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <p className="text-xs font-medium">地区</p>
                <ChipPicker
                  emptyText="全部地区"
                  options={regions.map((r) => [r, r])}
                  selected={o.regions}
                  onChange={(regions) => setOpts({ regions })}
                />
              </div>
              {protocols.length > 1 && (
                <div className="flex flex-col gap-1.5">
                  <p className="text-xs font-medium">协议</p>
                  <ChipPicker
                    emptyText="全部协议"
                    options={protocols}
                    selected={o.protocols}
                    onChange={(protocols) => setOpts({ protocols })}
                  />
                </div>
              )}
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="group-include">名称包含</Label>
                  <Input
                    id="group-include"
                    placeholder="例如 IEPL|专线"
                    value={o.include}
                    onChange={(e) => setOpts({ include: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    多个关键词用 | 分隔，或 /正则/
                  </p>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="group-exclude">名称排除</Label>
                  <Input
                    id="group-exclude"
                    placeholder="例如 /过期|剩余/"
                    value={o.exclude}
                    onChange={(e) => setOpts({ exclude: e.target.value })}
                  />
                </div>
              </div>
              <ToggleRow
                hint="地址、端口、协议都相同的只保留第一个"
                id="group-dedupe"
                label="去重"
                value={o.dedupe}
                onChange={(dedupe) => setOpts({ dedupe })}
              />
            </Section>
            <Section
              collapsible
              defaultOpen={false}
              hint="按顺序执行：改名 → 国旗 → 前缀 → 排序"
              summary={namingSummary(o) || "未设置"}
              title="命名"
            >
              <div className="flex flex-col gap-1.5">
                <p className="text-xs font-medium">改名规则</p>
                <p className="text-xs text-muted-foreground">
                  从上到下依次替换，替换为留空就是删除匹配的部分，可用 $1
                  引用分组
                </p>
                <RenameRules
                  value={o.rename}
                  onChange={(rename) => setOpts({ rename })}
                />
              </div>
              <ToggleRow
                hint="按名称识别地区，在前面加上国旗"
                id="group-flag"
                label="自动加国旗"
                value={o.addFlag}
                onChange={(addFlag) => setOpts({ addFlag })}
              />
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="group-prefix">名称前缀</Label>
                <Input
                  id="group-prefix"
                  placeholder="例如 [家宽] "
                  value={o.prefix}
                  onChange={(e) => setOpts({ prefix: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <p className="text-xs font-medium">排序</p>
                <Segmented
                  options={[
                    ["", "面板顺序"],
                    ["name", "按名称"],
                  ]}
                  value={o.sort}
                  onChange={(sort) => setOpts({ sort })}
                />
              </div>
            </Section>
            <Section
              collapsible
              defaultOpen={false}
              hint="在上面的筛选、改名、排序之后运行，可以写任意 JS 来筛选、改名、排序；只取回节点顺序和名称"
              summary={o.script ? "已设置" : "未设置"}
              title="JS 脚本"
            >
              <Textarea
                className="min-h-40 font-mono text-xs"
                placeholder={"function operator(nodes) {\n  return nodes;\n}"}
                value={o.script}
                onChange={(e) => setOpts({ script: e.target.value })}
              />
              <div className="flex flex-wrap gap-2">
                {!o.script && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setOpts({ script: SCRIPT_EXAMPLE })}
                  >
                    插入示例
                  </Button>
                )}
                {o.script && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setPage("preview")}
                  >
                    试运行并预览
                  </Button>
                )}
              </div>
            </Section>
          </div>
        )}

        {page === "preview" && (
          <Section title="预览">
            {previewing && !preview && (
              <p className="py-6 text-center text-xs text-muted-foreground">
                正在生成…
              </p>
            )}
            {preview?.scriptError && (
              <p className="rounded-xl bg-destructive/10 px-3 py-2 text-xs text-destructive dark:bg-destructive/10">
                {preview.scriptError}；节点组会先不经过脚本输出
              </p>
            )}
            {preview && (
              <>
                <p className="text-xs text-muted-foreground">
                  共 {preview.items.length} 个节点
                  {preview.dropped > 0 && `，过滤掉 ${preview.dropped} 个`}
                  <button
                    className="ml-2 text-primary"
                    type="button"
                    onClick={runPreview}
                  >
                    刷新
                  </button>
                </p>
                <div className="max-h-96 overflow-y-auto rounded-xl border border-hairline">
                  {preview.items.length === 0 ? (
                    <p className="p-3 text-xs text-muted-foreground">
                      没有节点
                    </p>
                  ) : (
                    preview.items.map((p, i) => (
                      <div
                        key={`${p.original}-${i}`}
                        className="flex items-center gap-2 border-b border-hairline px-3 py-1.5 text-xs last:border-b-0"
                      >
                        <span className="min-w-0 flex-1 truncate">
                          {p.name}
                          {p.name !== p.original && (
                            <span className="text-muted-foreground">
                              {" "}
                              ← {p.original}
                            </span>
                          )}
                        </span>
                        <span className="shrink-0 text-muted-foreground">
                          {p.line === "relay" ? "中转" : "直连"}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </Section>
        )}
      </DialogBody>
      <DialogFooter className="flex-wrap">
        {draft.id &&
          (confirmDelete ? (
            <>
              <span className="mr-auto self-center text-xs text-destructive">
                删除这个节点组？
              </span>
              <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
                取消
              </Button>
              <Button loading={saving} variant="destructive" onClick={remove}>
                删除
              </Button>
            </>
          ) : (
            <Button
              className="mr-auto"
              disabled={usedBy.length > 0}
              title={usedBy.length > 0 ? "有订阅在用，先在订阅里取消选择" : ""}
              variant="ghost"
              onClick={() => setConfirmDelete(true)}
            >
              删除
            </Button>
          ))}
        {!confirmDelete && (
          <>
            <Button variant="ghost" onClick={onClose}>
              取消
            </Button>
            <Button loading={saving} onClick={save}>
              保存
            </Button>
          </>
        )}
      </DialogFooter>
    </>
  );
}
