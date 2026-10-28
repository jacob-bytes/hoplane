import type { RowStatus } from "@/components/page-kit";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";

import { copyWithToast } from "@/utils/clipboard";
import { Button } from "@/components/ui/button";
import { Badge, badgeTone } from "@/components/ui/badge";
import { AnimatedPage } from "@/components/animated-page";
import { ActionsDialog } from "@/components/action-dialog";
import { PageLoadingState } from "@/components/page-state";
import {
  EmptyHint,
  ListGroup,
  ListRow,
  PageHeader,
  PageTabs,
  formatDate,
} from "@/components/page-kit";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TrafficLimitField } from "@/components/traffic-limit-field";
import {
  formatTraffic,
  MIB,
  parseTrafficInput,
  preferredTrafficUnit,
  TRAFFIC_UNIT_MIB,
  type TrafficUnit,
} from "@/utils/traffic";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
} from "@/components/dialog";
import { SelectField } from "@/components/select-native";
import {
  getNodeList,
  createPeerShare,
  getPeerShareList,
  deletePeerShare,
  resetPeerShareFlow,
  getPeerRemoteUsageList,
  importRemoteNode,
  updatePeerShare,
} from "@/api";

interface Node {
  id: number;
  name: string;
  isRemote?: number;
}

interface PeerShare {
  id: number;
  name: string;
  token: string;
  maxBandwidth: number;
  currentFlow: number;
  expiryTime: number;
  portRangeStart: number;
  portRangeEnd: number;
  isActive: number;
  allowedDomains?: string;
  allowedIps?: string;
  usedPorts?: number[];
  usedPortDetails?: Array<{
    runtimeId: number;
    port: number;
    role: string;
    protocol: string;
    resourceKey: string;
    applied: number;
    updatedTime: number;
  }>;
  activeRuntimeNum?: number;
}

interface RemoteUsageBinding {
  bindingId: number;
  tunnelId: number;
  tunnelName: string;
  chainType: number;
  hopInx: number;
  allocatedPort: number;
  resourceKey: string;
  remoteBindingId: string;
  updatedTime: number;
}

interface RemoteUsageNode {
  nodeId: number;
  nodeName: string;
  remoteUrl: string;
  shareId: number;
  portRangeStart: number;
  portRangeEnd: number;
  maxBandwidth: number;
  currentFlow: number;
  usedPorts: number[];
  bindings: RemoteUsageBinding[];
  activeBindingNum: number;
  syncError?: string;
}

const MAX_SAFE_BANDWIDTH_MIB = Math.floor(Number.MAX_SAFE_INTEGER / MIB);

export default function PanelSharingPage() {
  const [selectedTab, setSelectedTab] = useState<"my-shares" | "remote-nodes">(
    "my-shares",
  );
  const [sheetShareId, setSheetShareId] = useState<number | null>(null);
  const [sheetRemoteId, setSheetRemoteId] = useState<number | null>(null);
  const [shares, setShares] = useState<PeerShare[]>([]);
  const [remoteUsageNodes, setRemoteUsageNodes] = useState<RemoteUsageNode[]>(
    [],
  );
  const [nodes, setNodes] = useState<Node[]>([]);
  const [loading, setLoading] = useState(true);
  const [remoteUsageLoading, setRemoteUsageLoading] = useState(false);

  // Modals
  const [createShareOpen, setCreateShareOpen] = useState(false);
  const [editShareOpen, setEditShareOpen] = useState(false);
  const [importNodeOpen, setImportNodeOpen] = useState(false);

  // Forms
  const [shareForm, setShareForm] = useState({
    name: "",
    nodeId: "",
    maxBandwidth: 0,
    expiryDays: 30,
    portRangeStart: 10000,
    portRangeEnd: 20000,
    allowedDomains: "",
    allowedIps: "",
  });
  const [shareUnit, setShareUnit] = useState<TrafficUnit>("GB");

  const [importForm, setImportForm] = useState({
    remoteUrl: "",
    token: "",
  });

  const [editForm, setEditForm] = useState({
    id: 0,
    name: "",
    maxBandwidth: 0,
    expiryTime: 0,
    portRangeStart: 10000,
    portRangeEnd: 20000,
    allowedDomains: "",
    allowedIps: "",
  });
  const [editUnit, setEditUnit] = useState<TrafficUnit>("GB");
  const [editOriginalMaxBandwidth, setEditOriginalMaxBandwidth] = useState(0);
  const [editBandwidthChanged, setEditBandwidthChanged] = useState(false);

  const loadShares = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getPeerShareList();

      if (res.code === 0) {
        setShares(
          Array.isArray(res.data) ? (res.data as unknown as PeerShare[]) : [],
        );
      } else {
        toast.error(res.msg || "加载分享列表失败");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const loadNodes = useCallback(async () => {
    try {
      const res = await getNodeList();

      if (res.code === 0) {
        const localNodes: Node[] = (
          Array.isArray(res.data) ? (res.data as Node[]) : []
        ).filter((node: Node) => (node?.isRemote ?? 0) !== 1);

        setNodes(localNodes);
        setShareForm((prev) => {
          if (!prev.nodeId) {
            return prev;
          }
          const hasSelectedNode = localNodes.some(
            (node: Node) => String(node.id) === prev.nodeId,
          );

          return hasSelectedNode ? prev : { ...prev, nodeId: "" };
        });
      }
    } catch {
      // ignore
    }
  }, []);

  const loadRemoteUsage = useCallback(async () => {
    setRemoteUsageLoading(true);
    try {
      const res = await getPeerRemoteUsageList();

      if (res.code === 0) {
        setRemoteUsageNodes(
          Array.isArray(res.data)
            ? (res.data as unknown as RemoteUsageNode[])
            : [],
        );
      } else {
        toast.error(res.msg || "加载远程占用端口失败");
      }
    } finally {
      setRemoteUsageLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedTab === "my-shares") {
      loadShares();
      loadNodes();

      return;
    }
    if (selectedTab === "remote-nodes") {
      loadRemoteUsage();
    }
  }, [selectedTab, loadShares, loadNodes, loadRemoteUsage]);

  const handleCreateShare = async () => {
    if (!shareForm.name || !shareForm.nodeId) {
      toast.error("请填写必要信息");

      return;
    }
    const nodeId = parseInt(shareForm.nodeId, 10);

    if (Number.isNaN(nodeId) || !nodes.some((node) => node.id === nodeId)) {
      toast.error("仅可选择本地服务器");

      return;
    }
    const limitMiB =
      shareForm.maxBandwidth === 0
        ? 0
        : parseTrafficInput(String(shareForm.maxBandwidth), shareUnit);

    if (
      limitMiB === null ||
      limitMiB > MAX_SAFE_BANDWIDTH_MIB ||
      shareForm.maxBandwidth < 0
    ) {
      toast.error("请输入有效的流量上限，0 表示不限流量");

      return;
    }
    try {
      const expiryTime =
        Date.now() + shareForm.expiryDays * 24 * 60 * 60 * 1000;
      const res = await createPeerShare({
        name: shareForm.name,
        nodeId,
        maxBandwidth: limitMiB * MIB,
        expiryTime: shareForm.expiryDays === 0 ? 0 : expiryTime,
        portRangeStart: shareForm.portRangeStart,
        portRangeEnd: shareForm.portRangeEnd,
        allowedDomains: shareForm.allowedDomains,
        allowedIps: shareForm.allowedIps,
      });

      if (res.code === 0) {
        toast.success("创建成功");
        setCreateShareOpen(false);
        loadShares();
      } else {
        toast.error(res.msg || "创建失败");
      }
    } catch {
      toast.error("网络错误");
    }
  };

  const handleDeleteShare = async (id: number) => {
    try {
      const res = await deletePeerShare(id);

      if (res.code === 0) {
        toast.success("删除成功");
        loadShares();
      } else {
        toast.error(res.msg || "删除失败");
      }
    } catch {
      toast.error("网络错误");
    }
  };

  const handleResetShareFlow = async (id: number) => {
    try {
      const res = await resetPeerShareFlow(id);

      if (res.code === 0) {
        toast.success("共享流量已重置");
        loadShares();
      } else {
        toast.error(res.msg || "重置流量失败");
      }
    } catch {
      toast.error("网络错误");
    }
  };

  const openEditShare = (share: PeerShare) => {
    const mib = share.maxBandwidth / MIB;
    const unit = preferredTrafficUnit(mib);

    setEditUnit(unit);
    setEditOriginalMaxBandwidth(share.maxBandwidth);
    setEditBandwidthChanged(false);
    setEditForm({
      id: share.id,
      name: share.name,
      maxBandwidth: share.maxBandwidth > 0 ? mib / TRAFFIC_UNIT_MIB[unit] : 0,
      expiryTime: share.expiryTime,
      portRangeStart: share.portRangeStart,
      portRangeEnd: share.portRangeEnd,
      allowedDomains: share.allowedDomains || "",
      allowedIps: share.allowedIps || "",
    });
    setEditShareOpen(true);
  };

  const handleEditShare = async () => {
    if (!editForm.name) {
      toast.error("名称不能为空");

      return;
    }
    const limitMiB =
      editForm.maxBandwidth === 0
        ? 0
        : parseTrafficInput(String(editForm.maxBandwidth), editUnit);

    if (
      editBandwidthChanged &&
      (limitMiB === null ||
        limitMiB > MAX_SAFE_BANDWIDTH_MIB ||
        editForm.maxBandwidth < 0)
    ) {
      toast.error("请输入有效的流量上限，0 表示不限流量");

      return;
    }
    try {
      const res = await updatePeerShare({
        id: editForm.id,
        name: editForm.name,
        maxBandwidth: editBandwidthChanged
          ? (limitMiB as number) * MIB
          : editOriginalMaxBandwidth,
        expiryTime: editForm.expiryTime,
        portRangeStart: editForm.portRangeStart,
        portRangeEnd: editForm.portRangeEnd,
        allowedDomains: editForm.allowedDomains,
        allowedIps: editForm.allowedIps,
      });

      if (res.code === 0) {
        toast.success("编辑成功");
        setEditShareOpen(false);
        loadShares();
      } else {
        toast.error(res.msg || "编辑失败");
      }
    } catch {
      toast.error("网络错误");
    }
  };

  const handleImportNode = async () => {
    if (!importForm.remoteUrl || !importForm.token) {
      toast.error("请填写完整信息");

      return;
    }
    try {
      // Automatically add http/https if missing
      let url = importForm.remoteUrl.trim();

      if (!url.startsWith("http")) {
        url = "http://" + url;
      }

      const res = await importRemoteNode({
        remoteUrl: url,
        token: importForm.token.trim(),
      });

      if (res.code === 0) {
        toast.success("导入成功，请前往服务器列表查看");
        setImportNodeOpen(false);
        setImportForm({ remoteUrl: "", token: "" });
        loadRemoteUsage();
      } else {
        toast.error(res.msg || "导入失败");
      }
    } catch {
      toast.error("网络错误");
    }
  };

  const copyToken = (token: string) => {
    void copyWithToast(token, "Token已复制");
  };

  const formatFlowGB = formatTraffic;

  const formatChainType = (chainType: number, hopInx: number) => {
    if (chainType === 1) {
      return "入口服务器";
    }
    if (chainType === 2) {
      return `中继跳点 #${hopInx}`;
    }
    if (chainType === 3) {
      return "出口服务器";
    }

    return "未知链路";
  };

  const isShareExpired = (share: PeerShare) =>
    share.expiryTime > 0 && share.expiryTime < Date.now();

  const shareStatus = (share: PeerShare): [RowStatus, string] => {
    if (share.isActive !== 1) return ["off", "已停用"];
    if (isShareExpired(share)) return ["bad", "已过期"];

    return ["ok", "生效中"];
  };

  const formatSyncError = (syncError: string) =>
    syncError === "provider_share_deleted"
      ? "提供方已删除该分享"
      : syncError === "provider_share_disabled"
        ? "提供方已禁用该分享"
        : syncError === "provider_share_expired"
          ? "提供方分享已过期"
          : `远程同步失败: ${syncError}`;

  const formatPortRange = (start: number, end: number) =>
    start > 0 && end > 0 ? `${start}-${end}` : "-";

  const formatFlowUsage = (current: number, max: number) =>
    `${formatFlowGB(current || 0)} / ${max > 0 ? formatFlowGB(max) : "不限"}`;

  const sheetShare = shares.find((item) => item.id === sheetShareId) ?? null;
  const sheetRemote =
    remoteUsageNodes.find((item) => item.nodeId === sheetRemoteId) ?? null;

  const renderDetails = (rows: Array<[string, React.ReactNode]>) => (
    <div className="flex flex-col gap-2 text-sm">
      {rows.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-3">
          <span className="shrink-0 text-muted-foreground">{k}</span>
          <span className="min-w-0 break-all text-right font-mono text-xs leading-5">
            {v}
          </span>
        </div>
      ))}
    </div>
  );

  return (
    <AnimatedPage className="mx-auto w-full max-w-[1440px] px-6 py-6">
      <PageHeader
        description="分享本地服务器给其他面板，或导入别人的服务器"
        primary={
          selectedTab === "my-shares"
            ? {
                key: "create",
                label: "新建分享",
                onClick: () => setCreateShareOpen(true),
              }
            : {
                key: "import",
                label: "导入远程服务器",
                onClick: () => setImportNodeOpen(true),
              }
        }
        title="面板共享"
      />
      <PageTabs
        tabs={[
          { key: "my-shares", label: "我分享的" },
          { key: "remote-nodes", label: "远程服务器" },
        ]}
        value={selectedTab}
        onChange={setSelectedTab}
      />

      {selectedTab === "my-shares" &&
        (loading ? (
          <PageLoadingState message="正在加载..." />
        ) : shares.length === 0 ? (
          <EmptyHint text="还没有分享。新建一个分享，把本地服务器开放给其他面板使用" />
        ) : (
          <ListGroup>
            {shares.map((share) => {
              const [status, statusTitle] = shareStatus(share);

              return (
                <ListRow
                  key={share.id}
                  badges={
                    status !== "ok" && (
                      <Badge
                        className="shrink-0"
                        variant={badgeTone(
                          status === "bad" ? "danger" : "default",
                        )}
                      >
                        {statusTitle}
                      </Badge>
                    )
                  }
                  meta={[
                    `端口 ${formatPortRange(share.portRangeStart, share.portRangeEnd)}`,
                    formatFlowUsage(share.currentFlow, share.maxBandwidth),
                    share.expiryTime === 0
                      ? "永久"
                      : `${formatDate(share.expiryTime)} 到期`,
                  ].join(" · ")}
                  status={status}
                  statusTitle={statusTitle}
                  title={share.name}
                  onClick={() => setSheetShareId(share.id)}
                />
              );
            })}
          </ListGroup>
        ))}

      {selectedTab === "remote-nodes" &&
        (remoteUsageLoading ? (
          <PageLoadingState message="正在加载..." />
        ) : remoteUsageNodes.length === 0 ? (
          <EmptyHint text="还没有远程服务器。导入其他面板分享的服务器并创建隧道后，这里会显示端口占用" />
        ) : (
          <ListGroup>
            {remoteUsageNodes.map((node) => (
              <ListRow
                key={node.nodeId}
                meta={[
                  `绑定 ${node.activeBindingNum || 0} 条`,
                  `端口 ${formatPortRange(node.portRangeStart, node.portRangeEnd)}`,
                  formatFlowUsage(node.currentFlow, node.maxBandwidth),
                ].join(" · ")}
                status={node.syncError ? "warn" : "ok"}
                statusTitle={
                  node.syncError ? formatSyncError(node.syncError) : "同步正常"
                }
                title={node.nodeName}
                onClick={() => setSheetRemoteId(node.nodeId)}
              />
            ))}
          </ListGroup>
        ))}

      <ActionsDialog
        actions={
          sheetShare
            ? [
                {
                  key: "copy",
                  label: "复制 Token",
                  color: "primary",
                  onClick: () => copyToken(sheetShare.token),
                },
                {
                  key: "edit",
                  label: "编辑",
                  onClick: () => openEditShare(sheetShare),
                },
                {
                  key: "reset",
                  label: "重置流量",
                  onClick: () => handleResetShareFlow(sheetShare.id),
                },
                {
                  key: "delete",
                  label: "删除",
                  color: "danger",
                  onClick: () => handleDeleteShare(sheetShare.id),
                },
              ]
            : []
        }
        open={Boolean(sheetShare)}
        subtitle={sheetShare ? shareStatus(sheetShare)[1] : undefined}
        title={sheetShare?.name ?? ""}
        onClose={() => setSheetShareId(null)}
      >
        {sheetShare && (
          <>
            {renderDetails([
              ["Token", sheetShare.token],
              [
                "端口范围",
                formatPortRange(
                  sheetShare.portRangeStart,
                  sheetShare.portRangeEnd,
                ),
              ],
              [
                "流量",
                formatFlowUsage(
                  sheetShare.currentFlow,
                  sheetShare.maxBandwidth,
                ),
              ],
              [
                "到期",
                sheetShare.expiryTime === 0
                  ? "永久"
                  : formatDate(sheetShare.expiryTime, true),
              ],
              [
                "已占用端口",
                sheetShare.usedPorts && sheetShare.usedPorts.length > 0
                  ? sheetShare.usedPorts.join(", ")
                  : "无",
              ],
              ...(sheetShare.allowedDomains
                ? ([["允许域名", sheetShare.allowedDomains]] as Array<
                    [string, React.ReactNode]
                  >)
                : []),
              ...(sheetShare.allowedIps
                ? ([["允许 API IP", sheetShare.allowedIps]] as Array<
                    [string, React.ReactNode]
                  >)
                : []),
            ])}
            {sheetShare.usedPortDetails &&
              sheetShare.usedPortDetails.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {sheetShare.usedPortDetails.map((item) => (
                    <Badge key={item.runtimeId} variant="outline">
                      {item.port} / {item.role || "预留"}
                    </Badge>
                  ))}
                </div>
              )}
          </>
        )}
      </ActionsDialog>

      <ActionsDialog
        actions={
          sheetRemote?.remoteUrl
            ? [
                {
                  key: "copy",
                  label: "复制地址",
                  onClick: () =>
                    void copyWithToast(sheetRemote.remoteUrl, "地址已复制"),
                },
              ]
            : []
        }
        open={Boolean(sheetRemote)}
        subtitle={
          sheetRemote &&
          (sheetRemote.syncError ? "同步异常" : "远程服务器 · 同步正常")
        }
        title={sheetRemote?.nodeName ?? ""}
        onClose={() => setSheetRemoteId(null)}
      >
        {sheetRemote && (
          <>
            {sheetRemote.syncError && (
              <p className="rounded-lg bg-warning-50 px-2 py-1.5 text-xs text-warning-700 dark:bg-warning-100/10 dark:text-warning-400">
                {formatSyncError(sheetRemote.syncError)}
              </p>
            )}
            {renderDetails([
              ["远程地址", sheetRemote.remoteUrl || "-"],
              ["分享 ID", sheetRemote.shareId || "-"],
              [
                "端口范围",
                formatPortRange(
                  sheetRemote.portRangeStart,
                  sheetRemote.portRangeEnd,
                ),
              ],
              [
                "共享流量",
                formatFlowUsage(
                  sheetRemote.currentFlow,
                  sheetRemote.maxBandwidth,
                ),
              ],
              [
                "已占用端口",
                sheetRemote.usedPorts && sheetRemote.usedPorts.length > 0
                  ? sheetRemote.usedPorts.join(", ")
                  : "无",
              ],
            ])}
            {sheetRemote.bindings && sheetRemote.bindings.length > 0 && (
              <div className="flex flex-col gap-1 border-t border-hairline pt-2">
                {sheetRemote.bindings.map((binding) => (
                  <p
                    key={binding.bindingId}
                    className="text-xs text-muted-foreground"
                  >
                    隧道 {binding.tunnelName || `#${binding.tunnelId}`}
                    {" · "}
                    端口 {binding.allocatedPort}
                    {" · "}
                    {formatChainType(binding.chainType, binding.hopInx)}
                  </p>
                ))}
              </div>
            )}
          </>
        )}
      </ActionsDialog>

      {/* Create Share Dialog */}
      <Dialog
        backdrop="blur"
        classNames={{
          base: "!w-[calc(100%-32px)] !mx-auto sm:!w-full rounded-xl overflow-hidden",
        }}
        open={createShareOpen}
        scrollBehavior="inside"
        onClose={() => setCreateShareOpen(false)}
      >
        <DialogContent>
          <DialogHeader>创建分享</DialogHeader>
          <DialogBody>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="share-name">名称</Label>
              <Input
                id="share-name"
                placeholder="备注名称"
                value={shareForm.name}
                onChange={(e) =>
                  setShareForm({ ...shareForm, name: e.target.value })
                }
              />
            </div>
            <SelectField
              label="选择服务器"
              options={nodes.map((node) => ({
                value: String(node.id),
                label: node.name,
              }))}
              placeholder="选择要分享的本地服务器"
              value={shareForm.nodeId}
              onValueChange={(nodeId) => setShareForm({ ...shareForm, nodeId })}
            />
            <div className="flex gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="share-port-start">起始端口</Label>
                <Input
                  id="share-port-start"
                  type="number"
                  value={shareForm.portRangeStart.toString()}
                  onChange={(e) =>
                    setShareForm({
                      ...shareForm,
                      portRangeStart: parseInt(e.target.value),
                    })
                  }
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="share-port-end">结束端口</Label>
                <Input
                  id="share-port-end"
                  type="number"
                  value={shareForm.portRangeEnd.toString()}
                  onChange={(e) =>
                    setShareForm({
                      ...shareForm,
                      portRangeEnd: parseInt(e.target.value),
                    })
                  }
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="share-expiry">有效期 (天)</Label>
              <Input
                id="share-expiry"
                type="number"
                value={shareForm.expiryDays.toString()}
                onChange={(e) =>
                  setShareForm({
                    ...shareForm,
                    expiryDays: parseInt(e.target.value),
                  })
                }
              />
              <p className="text-xs text-muted-foreground">0 表示永久</p>
            </div>
            <TrafficLimitField
              description="0 表示不限流量"
              label="流量上限"
              unit={shareUnit}
              value={shareForm.maxBandwidth.toString()}
              onChange={(value, unit) => {
                setShareForm((prev) => ({
                  ...prev,
                  maxBandwidth: Number(value) || 0,
                }));
                setShareUnit(unit);
              }}
            />
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="share-domains">允许的域名 (可选)</Label>
              <Input
                id="share-domains"
                placeholder="example.com, panel.test.com"
                value={shareForm.allowedDomains}
                onChange={(e) =>
                  setShareForm({ ...shareForm, allowedDomains: e.target.value })
                }
              />
              <p className="text-xs text-muted-foreground">
                限制使用此Token的来源面板域名，多个域名用逗号分隔，留空不限制
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="share-ips">允许的API IP (可选)</Label>
              <Input
                id="share-ips"
                placeholder="203.0.113.10, 2001:db8::10, 198.51.100.0/24"
                value={shareForm.allowedIps}
                onChange={(e) =>
                  setShareForm({ ...shareForm, allowedIps: e.target.value })
                }
              />
              <p className="text-xs text-muted-foreground">
                仅白名单IP可导入此分享，支持IPv4/IPv6/CIDR，多个用逗号分隔
              </p>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateShareOpen(false)}>
              取消
            </Button>
            <Button onClick={handleCreateShare}>创建</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Share Dialog */}
      <Dialog
        backdrop="blur"
        classNames={{
          base: "!w-[calc(100%-32px)] !mx-auto sm:!w-full rounded-xl overflow-hidden",
        }}
        open={editShareOpen}
        scrollBehavior="inside"
        onClose={() => setEditShareOpen(false)}
      >
        <DialogContent>
          <DialogHeader>编辑分享</DialogHeader>
          <DialogBody>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-share-name">名称</Label>
              <Input
                id="edit-share-name"
                placeholder="备注名称"
                value={editForm.name}
                onChange={(e) =>
                  setEditForm({ ...editForm, name: e.target.value })
                }
              />
            </div>
            <div className="flex gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="edit-share-port-start">起始端口</Label>
                <Input
                  id="edit-share-port-start"
                  type="number"
                  value={editForm.portRangeStart.toString()}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      portRangeStart: parseInt(e.target.value) || 0,
                    })
                  }
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="edit-share-port-end">结束端口</Label>
                <Input
                  id="edit-share-port-end"
                  type="number"
                  value={editForm.portRangeEnd.toString()}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      portRangeEnd: parseInt(e.target.value) || 0,
                    })
                  }
                />
              </div>
            </div>
            <TrafficLimitField
              description="0 表示不限流量"
              label="流量上限"
              unit={editUnit}
              value={editForm.maxBandwidth.toString()}
              onChange={(value, unit) => {
                setEditForm((prev) => ({
                  ...prev,
                  maxBandwidth: Number(value) || 0,
                }));
                setEditUnit(unit);
                setEditBandwidthChanged(true);
              }}
            />
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-share-expiry">过期时间</Label>
              <Input
                id="edit-share-expiry"
                type="datetime-local"
                value={
                  editForm.expiryTime > 0
                    ? new Date(editForm.expiryTime).toISOString().slice(0, 16)
                    : ""
                }
                onChange={(e) =>
                  setEditForm({
                    ...editForm,
                    expiryTime: e.target.value
                      ? new Date(e.target.value).getTime()
                      : 0,
                  })
                }
              />
              <p className="text-xs text-muted-foreground">
                留空或清除表示永久有效
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-share-domains">允许的域名 (可选)</Label>
              <Input
                id="edit-share-domains"
                placeholder="example.com, panel.test.com"
                value={editForm.allowedDomains}
                onChange={(e) =>
                  setEditForm({ ...editForm, allowedDomains: e.target.value })
                }
              />
              <p className="text-xs text-muted-foreground">
                限制使用此Token的来源面板域名，多个域名用逗号分隔，留空不限制
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-share-ips">允许的API IP (可选)</Label>
              <Input
                id="edit-share-ips"
                placeholder="203.0.113.10, 2001:db8::10, 198.51.100.0/24"
                value={editForm.allowedIps}
                onChange={(e) =>
                  setEditForm({ ...editForm, allowedIps: e.target.value })
                }
              />
              <p className="text-xs text-muted-foreground">
                仅白名单IP可导入此分享，支持IPv4/IPv6/CIDR，多个用逗号分隔
              </p>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditShareOpen(false)}>
              取消
            </Button>
            <Button onClick={handleEditShare}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Node Dialog */}
      <Dialog
        backdrop="blur"
        classNames={{
          base: "!w-[calc(100%-32px)] !mx-auto sm:!w-full rounded-xl overflow-hidden",
        }}
        open={importNodeOpen}
        onClose={() => setImportNodeOpen(false)}
      >
        <DialogContent>
          <DialogHeader>导入远程服务器</DialogHeader>
          <DialogBody>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="import-remote-url">远程面板地址</Label>
              <Input
                id="import-remote-url"
                placeholder="http://panel.example.com:8088"
                value={importForm.remoteUrl}
                onChange={(e) =>
                  setImportForm({ ...importForm, remoteUrl: e.target.value })
                }
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="import-token">Token</Label>
              <Input
                id="import-token"
                placeholder="对方面板分享的 Token"
                value={importForm.token}
                onChange={(e) =>
                  setImportForm({ ...importForm, token: e.target.value })
                }
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setImportNodeOpen(false)}>
              取消
            </Button>
            <Button onClick={handleImportNode}>导入</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AnimatedPage>
  );
}
