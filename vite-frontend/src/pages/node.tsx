import { useSearchParams } from "react-router-dom";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { toast } from "sonner";
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  type DragEndEvent,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import {
  Activity,
  BellOff,
  Bot,
  Crosshair,
  GitBranch,
  Globe2,
  Monitor,
  GripVertical,
  Pencil,
  Settings2,
  SlidersHorizontal,
  Terminal,
  Trash2,
} from "lucide-react";

import { formatTraffic } from "@/utils/traffic";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Checkbox, checkboxHandler } from "@/components/ui/checkbox";
import { Badge, badgeTone } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ProgressBar as Progress } from "@/components/progress-bar";
import {
  createNode,
  getNodeList,
  updateNode,
  deleteNode,
  getNodeInstallCommand,
  updateNodeOrder,
  batchDeleteNodes,
  upgradeNode,
  batchUpgradeNodes,
  getNodeReleases,
  rollbackNode,
  getPeerRemoteUsageList,
  dismissNodeExpiryReminder,
  probeNodeLatency,
  getNodeMonthTraffic,
  type ReleaseChannel,
} from "@/api";
import { LatencyCell, probePoints } from "@/components/latency-cell";
import { NodeFlag } from "@/components/node-flag";
import { LatencyDialog } from "@/components/latency-dialog";
import { LatencyTargetsModal } from "@/pages/node/latency-targets-modal";
import { ListPageSkeleton } from "@/components/page-state";
import { ActionsDialog } from "@/components/action-dialog";
import {
  EmptyHint,
  ListRow,
  STATUS_DOT,
  PageHeader,
  PageShell,
  PageTabs,
  PageToolbar,
  ToolbarButton,
  SelectionBar,
} from "@/components/page-kit";
import { CARD_GRID } from "@/components/info-card";
import { useViewMode } from "@/components/view-mode";
import {
  getConnectionStatusMeta,
  getNodeFlag,
  getRemoteSyncErrorMessage,
} from "@/pages/node/display";
import { NodeTuneModal } from "@/pages/node/tune-modal";
import { copyWithToast } from "@/utils/clipboard";
import {
  formatNodeRenewalTime,
  getNodeRenewalCycleLabel,
} from "@/pages/node/renewal";
import { buildNodeSystemInfo } from "@/pages/node/system-info";
import { useNodeOfflineTimers } from "@/pages/node/use-node-offline-timers";
import { useNodeRealtime } from "@/pages/node/use-node-realtime";
import {
  markPageCached,
  pageCached,
  useCachedState,
} from "@/hooks/use-cached-state";
import { useVisiblePolling } from "@/hooks/use-visible-polling";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useWindowedList } from "@/hooks/use-windowed-list";
import { latestProbe } from "@/utils/latest-probe";
import { useLocalStorageState } from "@/hooks/use-local-storage-state";
import { loadStoredOrder, saveOrder } from "@/utils/order-storage";
import {
  Node,
  NodeForm,
  NodeTab,
  RemoteUsageNode,
  NodeFilterMode,
} from "@/pages/node/types";
import {
  getNodeReminderEnabled,
  getNodeExpiryMeta,
  mergeNodeRealtimeState,
  SortableItem,
} from "@/pages/node/helpers";
import { NodeFormModal } from "@/pages/node/node-form-modal";
import {
  BatchDeleteNodesModal,
  DeleteNodeModal,
  RollbackNodeModal,
} from "@/pages/node/confirm-modals";
import {
  InstallCommandModal,
  type InstallCommands,
  UpgradeNodeModal,
} from "@/pages/node/agent-modals";
import { NodeFilterModal } from "@/pages/node/filter-modal";
import {
  NodeLiveStats,
  NodeMeters,
  NodeMonth,
  NodeSpeed,
} from "@/pages/node/node-live-stats";

function withMetric(node: Node, metric: Record<string, unknown>): Node {
  const incomingUptime = Number(metric.uptime ?? 0);

  return {
    ...node,
    connectionStatus: "online",
    systemInfo: {
      cpuUsage: Number(metric.cpuUsage ?? metric.cpu_usage ?? 0),
      cpuCores: Number(metric.cpuCores ?? metric.cpu_cores ?? 0) || undefined,
      memoryUsage: Number(metric.memoryUsage ?? metric.memory_usage ?? 0),
      memoryTotal: Number(metric.memoryTotal ?? metric.memory_total ?? 0),
      memoryUsed: Number(metric.memoryUsed ?? metric.memory_used ?? 0),
      uploadTraffic: Number(
        metric.netOutBytes ?? metric.bytes_transmitted ?? 0,
      ),
      downloadTraffic: Number(metric.netInBytes ?? metric.bytes_received ?? 0),
      uploadSpeed: Number(metric.netOutSpeed ?? metric.net_out_speed ?? 0),
      downloadSpeed: Number(metric.netInSpeed ?? metric.net_in_speed ?? 0),
      uptime: incomingUptime || node.systemInfo?.uptime || 0,
      diskUsage: Number(metric.diskUsage ?? metric.disk_usage ?? 0),
      diskTotal: Number(metric.diskTotal ?? metric.disk_total ?? 0),
      diskUsed: Number(metric.diskUsed ?? metric.disk_used ?? 0),
      osName: String(metric.osName ?? metric.os_name ?? ""),
      osVersion: String(metric.osVersion ?? metric.os_version ?? ""),
      arch: String(metric.arch ?? ""),
      virt: String(metric.virt ?? ""),
      load1: Number(metric.load1 ?? 0),
      load5: Number(metric.load5 ?? 0),
      load15: Number(metric.load15 ?? 0),
      tcpConns: Number(metric.tcpConns ?? metric.tcp_conns ?? 0),
      udpConns: Number(metric.udpConns ?? metric.udp_conns ?? 0),
      netInSpeed: Number(metric.netInSpeed ?? metric.net_in_speed ?? 0),
      netOutSpeed: Number(metric.netOutSpeed ?? metric.net_out_speed ?? 0),
    },
  };
}

const PAGE = "node";

export default function NodePage({
  embedded = false,
  addRequest = 0,
  onOpenMonitor,
}: {
  embedded?: boolean;
  /** Bumped by the 节点 page header's 新建节点 when embedded. */
  addRequest?: number;
  /** Opens a node's history charts and service monitors. */
  onOpenMonitor?: (nodeId: number) => void;
}) {
  // A revisit shows the last data at once and reloads in the background;
  // live metrics then arrive over the WebSocket as usual.
  const [nodeList, setNodeList] = useCachedState<Node[]>(PAGE, "nodes", []);
  const [nodeOrder, setNodeOrder] = useCachedState<number[]>(PAGE, "order", []);
  const [loading, setLoading] = useState(() => !pageCached(PAGE));
  const [localSearchKeyword, setLocalSearchKeyword] = useLocalStorageState(
    "node-search-keyword-local",
    "",
  );
  const [remoteSearchKeyword, setRemoteSearchKeyword] = useLocalStorageState(
    "node-search-keyword-remote",
    "",
  );

  // ⌘K passes ?q=name; apply it once, then drop it from the URL.
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    const q = searchParams.get("q");

    if (!q) return;
    setLocalSearchKeyword(q);
    const next = new URLSearchParams(searchParams);

    next.delete("q");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, setLocalSearchKeyword]);
  const [activeTab, setActiveTab] = useLocalStorageState<NodeTab>(
    "node-active-tab",
    "local",
  );

  // Backward-compat: older versions stored extra tab values.
  useEffect(() => {
    if (activeTab !== "local" && activeTab !== "remote") {
      setActiveTab("local");
    }
  }, [activeTab, setActiveTab]);
  const [remoteUsageMap, setRemoteUsageMap] = useState<
    Record<number, RemoteUsageNode>
  >({});
  const [nodeFilterMode, setNodeFilterMode, resetNodeFilterMode] =
    useLocalStorageState<NodeFilterMode>("node-expiry-filter-mode", "all");
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [dialogVisible, setDialogVisible] = useState(false);
  const [dialogTitle, setDialogTitle] = useState("");
  const [isEdit, setIsEdit] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [rollbackModalOpen, setRollbackModalOpen] = useState(false);
  const [tuneNode, setTuneNode] = useState<Node | null>(null);
  const [nodeToRollback, setNodeToRollback] = useState<Node | null>(null);
  const [nodeToDelete, setNodeToDelete] = useState<Node | null>(null);
  const [protocolDisabled, setProtocolDisabled] = useState(false);
  const [protocolDisabledReason, setProtocolDisabledReason] = useState("");
  const [form, setForm] = useState<NodeForm>({
    id: null,
    name: "",
    remark: "",
    country: "",
    price: "",
    expiryTime: 0,
    renewalCycle: "",
    serverHost: "",
    serverIpV4: "",
    serverIpV6: "",
    port: "10000-65535",
    tcpListenAddr: "[::]",
    udpListenAddr: "[::]",
    interfaceName: "",
    extraIPs: "",
    forwardMode: "agent",
    sshHost: "",
    sshPort: "22",
    sshUsername: "",
    sshAuthType: "private_key",
    sshPassword: "",
    sshPrivateKey: "",
    sshPassphrase: "",
    sshSudoMode: "none",
    http: 0,
    tls: 0,
    socks: 0,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const isNftablesMode = form.forwardMode === "nftables";
  const protocolControlsDisabled = protocolDisabled || isNftablesMode;
  const protocolControlsReason = isNftablesMode
    ? "nftables 模式不支持 agent 协议开关"
    : protocolDisabledReason || "等待服务器上线后再设置";

  const [selectMode, setSelectMode] = useState(false);
  const [viewMode, setViewMode] = useViewMode("node");
  const card = viewMode === "card";
  const [infoPopoverPlacement, setInfoPopoverPlacement] = useState<
    Record<number, "left" | "bottom">
  >({});

  const updateInfoPopoverPlacement = useCallback(
    (nodeId: number, triggerElement: HTMLElement | null) => {
      if (!triggerElement) {
        return;
      }

      const rect = triggerElement.getBoundingClientRect();
      const cardElement = triggerElement.closest("[data-node-card='true']");
      const cardRect =
        cardElement instanceof HTMLElement
          ? cardElement.getBoundingClientRect()
          : null;
      const estimatedPanelWidth = 288;
      const containerPadding = 16;
      const availableLeftSpace = cardRect
        ? rect.left - cardRect.left
        : rect.left;
      const nextPlacement: "left" | "bottom" =
        availableLeftSpace >= estimatedPanelWidth + containerPadding
          ? "left"
          : "bottom";

      setInfoPopoverPlacement((prev) =>
        prev[nodeId] === nextPlacement
          ? prev
          : { ...prev, [nodeId]: nextPlacement },
      );
    },
    [],
  );

  const [sheetNodeId, setSheetNodeId] = useState<number | null>(null);
  const [probingIds, setProbingIds] = useState<Set<number>>(new Set());
  const [latencyNode, setLatencyNode] = useState<Node | null>(null);
  const pendingMetricsRef = useRef<Map<number, Record<string, unknown>>>(
    new Map(),
  );
  const metricTimerRef = useRef<number | null>(null);
  const [targetNodes, setTargetNodes] = useState<Node[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [batchDeleteModalOpen, setBatchDeleteModalOpen] = useState(false);
  const [batchLoading, setBatchLoading] = useState(false);

  // 安装命令相关状态
  const [installCommandModal, setInstallCommandModal] = useState(false);
  const [installCommands, setInstallCommands] = useState<InstallCommands>({
    script: "",
    docker: "",
  });
  const [currentNodeName, setCurrentNodeName] = useState("");

  // 升级相关状态
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [upgradeTarget, setUpgradeTarget] = useState<"single" | "batch">(
    "single",
  );
  const [upgradeTargetNodeId, setUpgradeTargetNodeId] = useState<number | null>(
    null,
  );
  const [releases, setReleases] = useState<
    Array<{
      version: string;
      name: string;
      publishedAt: string;
      prerelease: boolean;
      channel: ReleaseChannel;
    }>
  >([]);
  const [releasesLoading, setReleasesLoading] = useState(false);
  const [releaseChannel, setReleaseChannel] =
    useState<ReleaseChannel>("stable");
  const [selectedVersion, setSelectedVersion] = useState("");
  const [batchUpgradeLoading, setBatchUpgradeLoading] = useState(false);
  // This month's traffic per node, for the rows.
  const [monthTraffic, setMonthTraffic] = useState<
    Record<string, [number, number]>
  >({});

  useEffect(() => {
    let active = true;
    const load = async () => {
      const res = await getNodeMonthTraffic();

      if (active && res.code === 0 && res.data) setMonthTraffic(res.data);
    };

    void load();
    const timer = window.setInterval(load, 60_000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  const [upgradeProgress, setUpgradeProgress] = useState<
    Record<number, { stage: string; percent: number; message: string }>
  >({});

  const handleNodeOffline = useCallback((nodeId: number) => {
    setNodeList((prev) =>
      prev.map((node) => {
        if (node.id !== nodeId) return node;
        if (node.connectionStatus === "offline" && node.systemInfo === null) {
          return node;
        }

        return { ...node, connectionStatus: "offline", systemInfo: null };
      }),
    );
  }, []);

  const { clearOfflineTimer, scheduleNodeOffline } = useNodeOfflineTimers({
    delayMs: 3000,
    onNodeOffline: handleNodeOffline,
  });

  const loadRemoteUsage = useCallback(async () => {
    try {
      const res = await getPeerRemoteUsageList();

      if (res.code === 0 && Array.isArray(res.data)) {
        const nextMap: Record<number, RemoteUsageNode> = {};

        (res.data as unknown as RemoteUsageNode[]).forEach((item) => {
          if (!item || typeof item.nodeId !== "number") return;
          nextMap[item.nodeId] = item;
        });

        setRemoteUsageMap(nextMap);
      }
    } catch {
      // ignore remote usage errors in node page
    }
  }, []);

  // 加载节点列表
  const nodesLoadingRef = useRef(false);
  // A reload asked for during a silent poll (after an edit) runs after it.
  const nodesReloadRef = useRef(false);
  const loadNodes = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;

    if (nodesLoadingRef.current) {
      if (!silent) nodesReloadRef.current = true;

      return;
    }
    nodesLoadingRef.current = true;

    if (!silent) {
      setLoading(true);
    }

    try {
      const res = await getNodeList();

      if (res.code === 0) {
        const nodesData: Node[] = (res.data || []).map((node: any) => ({
          ...node,
          inx: node.inx ?? 0,
          connectionStatus: node.syncError
            ? "offline"
            : node.status === 1
              ? "online"
              : "offline",
          syncError: node.syncError || undefined,
          systemInfo: null,
          copyLoading: false,
        }));

        markPageCached(PAGE);
        setNodeList((prev) => {
          const previousById = new Map(prev.map((node) => [node.id, node]));

          return nodesData.map((node) =>
            mergeNodeRealtimeState(node, previousById.get(node.id)),
          );
        });

        // 优先使用数据库中的 inx 字段进行排序，否则回退到本地排序
        const hasDbOrdering = nodesData.some(
          (n) => n.inx !== undefined && n.inx !== 0,
        );

        if (hasDbOrdering) {
          const dbOrder = [...nodesData]
            .sort((a, b) => (a.inx ?? 0) - (b.inx ?? 0))
            .map((n) => n.id);

          setNodeOrder(dbOrder);
        } else {
          setNodeOrder(
            loadStoredOrder(
              "node-order",
              nodesData.map((n) => n.id),
            ),
          );
        }
      } else {
        if (!silent) {
          toast.error(res.msg || "加载服务器列表失败");
        }
      }
    } catch {
      if (!silent) {
        toast.error("网络错误，请重试");
      }
    } finally {
      nodesLoadingRef.current = false;
      if (!silent) {
        setLoading(false);
      }
      if (nodesReloadRef.current) {
        nodesReloadRef.current = false;
        void loadNodes({ silent: true });
      }
    }
  }, []);

  // 处理WebSocket消息
  const handleWebSocketMessage = (data: any) => {
    const { id, type, data: messageData } = data;
    const nodeId = Number(id);

    if (Number.isNaN(nodeId)) return;

    if (type === "status") {
      if (messageData === 1) {
        clearOfflineTimer(nodeId);
        setNodeList((prev) =>
          prev.map((node) => {
            if (node.id !== nodeId) return node;
            if (node.connectionStatus === "online") return node;

            return { ...node, connectionStatus: "online" };
          }),
        );
      } else {
        // 离线事件做延迟处理，避免短抖动导致频繁闪烁
        scheduleNodeOffline(nodeId);
      }
    } else if (type === "info") {
      clearOfflineTimer(nodeId);
      setNodeList((prev) =>
        prev.map((node) => {
          if (node.id === nodeId) {
            const systemInfo = buildNodeSystemInfo(
              messageData,
              node.systemInfo,
            );

            if (!systemInfo) {
              return node;
            }

            return {
              ...node,
              connectionStatus: "online",
              systemInfo,
            };
          }

          return node;
        }),
      );
    } else if (type === "upgrade_progress") {
      try {
        const progressData =
          typeof messageData === "string"
            ? JSON.parse(messageData)
            : messageData;

        if (progressData?.data) {
          setUpgradeProgress((prev) => ({
            ...prev,
            [nodeId]: {
              stage: progressData.data.stage || "",
              percent: progressData.data.percent || 0,
              message: progressData.message || "",
            },
          }));
        }
      } catch {
        // ignore parse errors
      }
    } else if (type === "metric") {
      clearOfflineTimer(nodeId);

      const metric =
        typeof messageData === "string" ? JSON.parse(messageData) : messageData;

      if (!metric || typeof metric !== "object") return;

      pendingMetricsRef.current.set(nodeId, metric as Record<string, unknown>);

      if (metricTimerRef.current === null) {
        metricTimerRef.current = window.setTimeout(() => {
          const pending = pendingMetricsRef.current;

          pendingMetricsRef.current = new Map();
          metricTimerRef.current = null;
          setNodeList((prev) =>
            prev.map((node) => {
              const next = pending.get(node.id);

              return next ? withMetric(node, next) : node;
            }),
          );
        }, 400);
      }
    }
  };

  const { wsConnected, wsConnecting, usingPollingFallback } = useNodeRealtime({
    onMessage: handleWebSocketMessage,
  });

  useEffect(() => {
    return () => {
      if (metricTimerRef.current !== null) {
        window.clearTimeout(metricTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    // With cached data on screen, reload without the loading state.
    loadNodes({ silent: pageCached(PAGE) });
    loadRemoteUsage();
  }, [loadNodes, loadRemoteUsage]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [activeTab]);

  // Metrics arrive over WebSocket, but cached latency is only in node/list.
  useVisiblePolling(
    useCallback(() => loadNodes({ silent: true }), [loadNodes]),
  );

  // 格式化速度
  const formatSpeed = (bytesPerSecond: number): string => {
    if (bytesPerSecond === 0) return "0 B/s";

    const k = 1024;
    const sizes = ["B/s", "KB/s", "MB/s", "GB/s", "TB/s"];
    const i = Math.floor(Math.log(bytesPerSecond) / Math.log(k));

    return (
      parseFloat((bytesPerSecond / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
    );
  };

  // 格式化开机时间
  const formatUptime = (seconds: number): string => {
    if (seconds === 0) return "-";

    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (days > 0) {
      return `${days}天${hours}小时`;
    } else if (hours > 0) {
      return `${hours}小时${minutes}分钟`;
    } else {
      return `${minutes}分钟`;
    }
  };

  // 格式化流量

  const formatFlow = (bytes: number): string => {
    return formatTraffic(bytes);
  };

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

  // IPv4/IPv6 格式验证（仅用于判定地址族）
  const ipv4Regex =
    /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  const ipv6Regex =
    /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;

  const validateIpv4Literal = (ip: string): boolean =>
    ipv4Regex.test(ip.trim());
  const validateIpv6Literal = (ip: string): boolean =>
    ipv6Regex.test(ip.trim());

  // Hostname/domain validation (no scheme/port)
  const hostnameRegex =
    /^(?=.{1,253}$)(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)(?:\.(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?))*$/;
  const validateHostname = (host: string): boolean => {
    const v = host.trim();

    if (!v) return false;
    if (v === "localhost") return true;

    return hostnameRegex.test(v);
  };

  // 验证端口格式：支持 80,443,100-600
  const validatePort = (
    portStr: string,
  ): { valid: boolean; error?: string } => {
    if (!portStr || !portStr.trim()) {
      return { valid: false, error: "请输入端口" };
    }

    const trimmed = portStr.trim();
    const parts = trimmed
      .split(",")
      .map((p) => p.trim())
      .filter((p) => p);

    if (parts.length === 0) {
      return { valid: false, error: "请输入有效的端口" };
    }

    for (const part of parts) {
      // 检查是否是端口范围 (如 100-600)
      if (part.includes("-")) {
        const range = part.split("-").map((p) => p.trim());

        if (range.length !== 2) {
          return { valid: false, error: `端口范围格式错误: ${part}` };
        }

        const start = parseInt(range[0]);
        const end = parseInt(range[1]);

        if (isNaN(start) || isNaN(end)) {
          return { valid: false, error: `端口必须是数字: ${part}` };
        }

        if (start < 1 || start > 65535 || end < 1 || end > 65535) {
          return {
            valid: false,
            error: `端口范围必须在 1-65535 之间: ${part}`,
          };
        }

        if (start >= end) {
          return { valid: false, error: `起始端口必须小于结束端口: ${part}` };
        }
      } else {
        // 单个端口
        const port = parseInt(part);

        if (isNaN(port)) {
          return { valid: false, error: `端口必须是数字: ${part}` };
        }

        if (port < 1 || port > 65535) {
          return { valid: false, error: `端口必须在 1-65535 之间: ${part}` };
        }
      }
    }

    return { valid: true };
  };

  // 表单验证
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!form.name.trim()) {
      newErrors.name = "请输入服务器名称";
    } else if (form.name.trim().length < 2) {
      newErrors.name = "服务器名称长度至少2位";
    } else if (form.name.trim().length > 50) {
      newErrors.name = "服务器名称长度不能超过50位";
    }

    if (
      (form.renewalCycle && !form.expiryTime) ||
      (!form.renewalCycle && form.expiryTime)
    ) {
      newErrors.expiryTime = "请同时设置续费周期和续费基准时间";
    }

    const v4 = form.serverIpV4.trim();
    const v6 = form.serverIpV6.trim();
    const host = form.serverHost.trim();

    if (!v4 && !v6 && !host) {
      const msg = "请至少填写一个 IPv4/IPv6 地址或域名";

      newErrors.serverIpV4 = msg;
      newErrors.serverIpV6 = msg;
      newErrors.serverHost = msg;
    } else {
      if (v4 && !validateIpv4Literal(v4)) {
        newErrors.serverIpV4 = "请输入有效的IPv4地址";
      }
      if (v6 && !validateIpv6Literal(v6)) {
        newErrors.serverIpV6 = "请输入有效的IPv6地址";
      }
      if (host && !validateHostname(host)) {
        newErrors.serverHost = "请输入有效的域名/主机名";
      }
    }

    const portValidation = validatePort(form.port);

    if (!portValidation.valid) {
      newErrors.port = portValidation.error || "端口格式错误";
    }

    if (form.forwardMode === "nftables") {
      if (!form.sshHost.trim()) {
        newErrors.sshHost = "请输入 SSH 主机";
      }
      const sshPort = Number(form.sshPort);

      if (!Number.isInteger(sshPort) || sshPort < 1 || sshPort > 65535) {
        newErrors.sshPort = "SSH 端口必须为 1-65535";
      }
      if (!form.sshUsername.trim()) {
        newErrors.sshUsername = "请输入 SSH 用户名";
      }
      if (form.sshAuthType === "password") {
        if (!isEdit && !form.sshPassword.trim()) {
          newErrors.sshPassword = "请输入 SSH 密码";
        }
      } else if (!isEdit && !form.sshPrivateKey.trim()) {
        newErrors.sshPrivateKey = "请输入 SSH 私钥";
      }
    }

    setErrors(newErrors);

    return Object.keys(newErrors).length === 0;
  };

  // 新增节点
  const handleAdd = () => {
    setDialogTitle("新增服务器");
    setIsEdit(false);
    setDialogVisible(true);
    resetForm();
    setProtocolDisabled(true);
    setProtocolDisabledReason("服务器未在线，等待服务器上线后再设置");
  };

  useEffect(() => {
    if (addRequest > 0) handleAdd();
    // Only a new request opens the dialog.
  }, [addRequest]);

  // 编辑节点
  const handleEdit = (node: Node) => {
    setDialogTitle("编辑服务器");
    setIsEdit(true);

    const legacy = (node.serverIp || "").trim();
    const normalizedV4 =
      node.serverIpV4?.trim() || (validateIpv4Literal(legacy) ? legacy : "");
    const normalizedV6 =
      node.serverIpV6?.trim() || (validateIpv6Literal(legacy) ? legacy : "");
    const normalizedHost =
      !normalizedV4 && !normalizedV6 && legacy ? legacy : "";

    setForm({
      id: node.id,
      name: node.name,
      remark: node.remark || "",
      country: node.country || "",
      price: node.price ? String(node.price) : "",
      expiryTime: node.expiryTime || 0,
      renewalCycle: node.renewalCycle || "",
      serverHost: normalizedHost,
      serverIpV4: normalizedV4,
      serverIpV6: normalizedV6,
      port: node.port || "10000-65535",
      tcpListenAddr: node.tcpListenAddr || "[::]",
      udpListenAddr: node.udpListenAddr || "[::]",
      interfaceName: (node as any).interfaceName || "",
      extraIPs: node.extraIPs || "",
      forwardMode: node.forwardMode === "nftables" ? "nftables" : "agent",
      sshHost: node.sshConfig?.host || normalizedHost || legacy,
      sshPort: String(node.sshConfig?.port || 22),
      sshUsername: node.sshConfig?.username || "",
      sshAuthType: node.sshConfig?.authType || "private_key",
      sshPassword: node.sshConfig?.password || "",
      sshPrivateKey: node.sshConfig?.privateKey || "",
      sshPassphrase: node.sshConfig?.passphrase || "",
      sshSudoMode: node.sshConfig?.sudoMode || "none",
      http: typeof node.http === "number" ? node.http : 1,
      tls: typeof node.tls === "number" ? node.tls : 1,
      socks: typeof node.socks === "number" ? node.socks : 1,
    });
    const offline = node.connectionStatus !== "online";

    setProtocolDisabled(offline || node.forwardMode === "nftables");
    setProtocolDisabledReason(
      node.forwardMode === "nftables"
        ? "nftables 模式不支持 agent 协议开关"
        : offline
          ? "服务器未在线，等待服务器上线后再设置"
          : "",
    );
    setDialogVisible(true);
  };

  // 删除节点
  const handleDelete = (node: Node) => {
    setNodeToDelete(node);
    setDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!nodeToDelete) return;

    setDeleteLoading(true);
    try {
      const res = await deleteNode(nodeToDelete.id);

      if (res.code === 0) {
        toast.success("删除成功");
        setNodeList((prev) => prev.filter((n) => n.id !== nodeToDelete.id));
        setDeleteModalOpen(false);
        setNodeToDelete(null);
      } else {
        toast.error(res.msg || "删除失败");
      }
    } catch {
      toast.error("网络错误，请重试");
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleDismissExpiryReminder = async (nodeId: number) => {
    try {
      const res = await dismissNodeExpiryReminder(nodeId);

      if (res.code === 0) {
        setNodeList((prev) =>
          prev.map((n) =>
            n.id === nodeId ? { ...n, expiryReminderDismissed: 1 } : n,
          ),
        );
      } else {
        toast.error(res.msg || "操作失败");
      }
    } catch {
      toast.error("网络错误，请重试");
    }
  };

  // Only the stable channel is published, so there is nothing to choose.
  const openInstallSelector = (node: Node) =>
    handleCopyInstallCommand(node, "stable");

  // 复制安装命令
  const handleCopyInstallCommand = async (
    node: Node,
    channel: ReleaseChannel,
  ) => {
    setNodeList((prev) =>
      prev.map((n) => (n.id === node.id ? { ...n, copyLoading: true } : n)),
    );

    try {
      const [res, dockerRes] = await Promise.all([
        getNodeInstallCommand(node.id, channel),
        getNodeInstallCommand(node.id, channel, "docker").catch(() => null),
      ]);

      if (res.code === 0 && res.data) {
        setInstallCommands({
          script: res.data,
          docker: dockerRes?.code === 0 ? dockerRes.data || "" : "",
        });
        setCurrentNodeName(node.name);
        setInstallCommandModal(true);
      } else {
        toast.error(res.msg || "获取安装命令失败");
      }
    } catch {
      toast.error("获取安装命令失败");
    } finally {
      setNodeList((prev) =>
        prev.map((n) => (n.id === node.id ? { ...n, copyLoading: false } : n)),
      );
    }
  };

  const handleCopyCommand = async (command: string) => {
    if (await copyWithToast(command, "安装命令已复制到剪贴板")) {
      setInstallCommandModal(false);
    }
  };

  const loadReleasesByChannel = useCallback(async (channel: ReleaseChannel) => {
    setReleasesLoading(true);
    try {
      const res = await getNodeReleases(channel);

      if (res.code === 0 && Array.isArray(res.data)) {
        setReleases(res.data);
      } else {
        toast.error(res.msg || "获取版本列表失败");
      }
    } catch {
      toast.error("获取版本列表失败");
    } finally {
      setReleasesLoading(false);
    }
  }, []);

  // 打开版本选择弹窗
  const openUpgradeModal = async (
    target: "single" | "batch",
    nodeId?: number,
  ) => {
    const defaultChannel: ReleaseChannel = "stable";

    setUpgradeTarget(target);
    setUpgradeTargetNodeId(nodeId || null);
    setReleaseChannel(defaultChannel);
    setSelectedVersion("");
    setUpgradeModalOpen(true);
    await loadReleasesByChannel(defaultChannel);
  };

  // 确认升级（从版本弹窗）
  const handleConfirmUpgrade = async () => {
    const version = selectedVersion || undefined;

    if (upgradeTarget === "single" && upgradeTargetNodeId) {
      setUpgradeModalOpen(false);
      // Find the node
      const node = nodeList.find((n) => n.id === upgradeTargetNodeId);

      if (!node) return;
      setNodeList((prev) =>
        prev.map((n) =>
          n.id === upgradeTargetNodeId ? { ...n, upgradeLoading: true } : n,
        ),
      );
      try {
        const res = await upgradeNode(
          upgradeTargetNodeId,
          version,
          releaseChannel,
        );

        if (res.code === 0) {
          toast.success(`服务器升级命令已发送，服务器将自动重启`);
        } else {
          toast.error(res.msg || "升级失败");
        }
      } catch {
        toast.error("网络错误，请重试");
      } finally {
        setNodeList((prev) =>
          prev.map((n) =>
            n.id === upgradeTargetNodeId ? { ...n, upgradeLoading: false } : n,
          ),
        );
      }
    } else if (upgradeTarget === "batch") {
      const selectedLocalIds = Array.from(selectedIds).filter((id) => {
        const matchedNode = nodeList.find((node) => node.id === id);

        return matchedNode?.isRemote !== 1;
      });

      if (selectedLocalIds.length === 0) {
        toast.error("请选择本地服务器进行升级");
        setUpgradeModalOpen(false);

        return;
      }

      setBatchUpgradeLoading(true);
      setUpgradeModalOpen(false);
      try {
        const res = await batchUpgradeNodes(
          selectedLocalIds,
          version,
          releaseChannel,
        );

        if (res.code === 0) {
          toast.success(
            `批量升级命令已发送到 ${selectedLocalIds.length} 个服务器`,
          );
        } else {
          toast.error(res.msg || "批量升级失败");
        }
      } catch {
        toast.error("网络错误，请重试");
      } finally {
        setBatchUpgradeLoading(false);
      }
    }
  };

  // 回退节点
  const handleRollbackNode = (node: Node) => {
    setNodeToRollback(node);
    setRollbackModalOpen(true);
  };

  const confirmRollback = async () => {
    if (!nodeToRollback) return;
    const node = nodeToRollback;

    setRollbackModalOpen(false);
    setNodeList((prev) =>
      prev.map((n) => (n.id === node.id ? { ...n, rollbackLoading: true } : n)),
    );
    try {
      const res = await rollbackNode(node.id);

      if (res.code === 0) {
        toast.success(`服务器 ${node.name} 回退命令已发送，服务器将自动重启`);
      } else {
        toast.error(res.msg || "回退失败");
      }
    } catch {
      toast.error("网络错误，请重试");
    } finally {
      setNodeList((prev) =>
        prev.map((n) =>
          n.id === node.id ? { ...n, rollbackLoading: false } : n,
        ),
      );
      setNodeToRollback(null);
    }
  };

  // 提交表单
  const handleSubmit = async () => {
    if (!validateForm()) return;

    setSubmitLoading(true);

    try {
      const apiCall = isEdit ? updateNode : createNode;
      const { serverHost, ...rest } = form;
      const sshConfig =
        form.forwardMode === "nftables"
          ? {
              host: form.sshHost.trim(),
              port: Number(form.sshPort || 22),
              username: form.sshUsername.trim(),
              authType: form.sshAuthType,
              password:
                form.sshAuthType === "password"
                  ? form.sshPassword.trim()
                  : undefined,
              privateKey:
                form.sshAuthType === "private_key"
                  ? form.sshPrivateKey
                  : undefined,
              passphrase: form.sshPassphrase,
              sudoMode: form.sshSudoMode,
            }
          : null;
      const data = {
        ...rest,
        remark: form.remark.trim(),
        country: form.country,
        price: Number(form.price) || 0,
        expiryTime: form.expiryTime,
        renewalCycle: form.renewalCycle,
        extraIPs: form.extraIPs,
        forwardMode: form.forwardMode,
        sshConfig,
        serverIp:
          form.serverIpV4?.trim() ||
          form.serverIpV6?.trim() ||
          serverHost?.trim() ||
          "",
      };

      const res = await apiCall(data);

      if (res.code === 0) {
        toast.success(isEdit ? "更新成功" : "创建成功");
        setDialogVisible(false);

        if (isEdit) {
          setNodeList((prev) =>
            prev.map((n) =>
              n.id === form.id
                ? {
                    ...n,
                    name: form.name,
                    remark: form.remark.trim(),
                    country: form.country,
                    price: Number(form.price) || 0,
                    expiryTime: form.expiryTime,
                    renewalCycle: form.renewalCycle,
                    serverIp:
                      form.serverIpV4?.trim() ||
                      form.serverIpV6?.trim() ||
                      form.serverHost?.trim() ||
                      "",
                    serverIpV4: form.serverIpV4,
                    serverIpV6: form.serverIpV6,
                    port: form.port,
                    tcpListenAddr: form.tcpListenAddr,
                    udpListenAddr: form.udpListenAddr,
                    interfaceName: form.interfaceName,
                    forwardMode: form.forwardMode,
                    sshConfig,
                    http: form.http,
                    tls: form.tls,
                    socks: form.socks,
                  }
                : n,
            ),
          );
        } else {
          loadNodes();
        }
      } else {
        toast.error(res.msg || (isEdit ? "更新失败" : "创建失败"));
      }
    } catch {
      toast.error("网络错误，请重试");
    } finally {
      setSubmitLoading(false);
    }
  };

  // 重置表单
  const resetForm = () => {
    setForm({
      id: null,
      name: "",
      remark: "",
      country: "",
      price: "",
      expiryTime: 0,
      renewalCycle: "",
      serverHost: "",
      serverIpV4: "",
      serverIpV6: "",
      port: "10000-65535",
      tcpListenAddr: "[::]",
      udpListenAddr: "[::]",
      interfaceName: "",
      extraIPs: "",
      forwardMode: "agent",
      sshHost: "",
      sshPort: "22",
      sshUsername: "",
      sshAuthType: "password",
      sshPassword: "",
      sshPrivateKey: "",
      sshPassphrase: "",
      sshSudoMode: "none",
      http: 0,
      tls: 0,
      socks: 0,
    });
    setErrors({});
  };

  // 处理拖拽结束
  // Probes one node's latency again and patches its result in place.
  const probeNode = async (id: number) => {
    setProbingIds((prev) => new Set(prev).add(id));
    try {
      const res = await probeNodeLatency([id]);
      const latency = res.code === 0 ? res.data?.[String(id)] : undefined;

      if (!latency) {
        toast.error(res.msg || "检测失败");

        return;
      }
      setNodeList((prev) =>
        prev.map((n) =>
          n.id === id ? { ...n, latency: latestProbe(latency, n.latency) } : n,
        ),
      );
    } catch {
      toast.error("检测失败");
    } finally {
      setProbingIds((prev) => {
        const next = new Set(prev);

        next.delete(id);

        return next;
      });
    }
  };

  const renderLatency = (node: Node, variant: "card" | "list") =>
    node.isRemote !== 1 && node.connectionStatus === "online" ? (
      node.latencyTargets?.points.length === 0 ? (
        <button
          className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground"
          title="这台服务器没选测试点，点此设置"
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setTargetNodes([node]);
          }}
        >
          不测延迟
        </button>
      ) : probePoints(node.latency).length === 0 ? null : (
        // Nothing until the first round (every 3 minutes) has a result;
        // re-probing is in the result's menu.
        <LatencyCell
          note={node.latencyTargets ? "自定义" : undefined}
          probe={node.latency}
          probing={probingIds.has(node.id)}
          variant={variant}
          onEditTargets={() => setTargetNodes([node])}
          onOpenDetails={() => setLatencyNode(node)}
          onProbe={() => probeNode(node.id)}
        />
      )
    ) : null;

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    // A manual reorder only makes sense on the unsorted list.
    if (sort) setSort(null);

    if (!active || !over || active.id === over.id) return;
    if (!nodeOrder || nodeOrder.length === 0) return;

    const activeId = Number(active.id);
    const overId = Number(over.id);

    if (isNaN(activeId) || isNaN(overId)) return;

    const displayNodeIds = displayNodes.map((node) => node.id);
    const oldIndex = displayNodeIds.indexOf(activeId);
    const newIndex = displayNodeIds.indexOf(overId);

    if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;

    const reorderedDisplayIds = arrayMove(displayNodeIds, oldIndex, newIndex);
    const displayIdSet = new Set(displayNodeIds);
    let reorderedDisplayIndex = 0;

    const newOrder = nodeOrder.map((id) => {
      if (!displayIdSet.has(id)) {
        return id;
      }

      const nextId = reorderedDisplayIds[reorderedDisplayIndex];

      reorderedDisplayIndex += 1;

      return nextId;
    });

    setNodeOrder(newOrder);

    saveOrder("node-order", newOrder);

    // 持久化到数据库
    try {
      const nodesToUpdate = newOrder.map((id, index) => ({ id, inx: index }));
      const response = await updateNodeOrder({ nodes: nodesToUpdate });

      if (response.code === 0) {
        setNodeList((prev) =>
          prev.map((node) => {
            const updated = nodesToUpdate.find((n) => n.id === node.id);

            return updated ? { ...node, inx: updated.inx } : node;
          }),
        );
      } else {
        toast.error("保存排序失败：" + (response.msg || "未知错误"));
      }
    } catch {
      toast.error("保存排序失败，请重试");
    }
  };

  // 批量操作处理函数
  const toggleSelectMode = () => {
    setSelectMode((prev) => {
      if (prev) {
        setSelectedIds(new Set());
      }

      return !prev;
    });
  };

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(displayNodes.map((n) => n.id)));
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;
    setBatchLoading(true);
    try {
      const res = await batchDeleteNodes(Array.from(selectedIds));

      if (res.code === 0) {
        toast.success(`成功删除 ${selectedIds.size} 个服务器`);
        setNodeList((prev) => prev.filter((n) => !selectedIds.has(n.id)));
        setSelectedIds(new Set());
        setBatchDeleteModalOpen(false);
        setSelectMode(false);
      } else {
        toast.error(res.msg || "删除失败");
      }
    } catch {
      toast.error("网络错误，请重试");
    } finally {
      setBatchLoading(false);
    }
  };

  // 传感器配置
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const nodeExpiryStats = useMemo(() => {
    return nodeList.reduce(
      (acc, node) => {
        if (node.isRemote === 1) {
          return acc;
        }

        const meta = getNodeExpiryMeta(node.expiryTime, node.renewalCycle);

        if (meta.state === "expired") acc.expired += 1;
        if (meta.state === "expiringSoon") acc.expiringSoon += 1;
        if (getNodeReminderEnabled(node)) {
          acc.withExpiry += 1;
        }

        return acc;
      },
      { expired: 0, expiringSoon: 0, withExpiry: 0 },
    );
  }, [nodeList]);

  // 根据排序顺序获取节点列表
  const sortedNodes = useMemo((): Node[] => {
    if (!nodeList || nodeList.length === 0) return [];

    const sortedByDb = [...nodeList].sort((a, b) => {
      const aInx = a.inx ?? 0;
      const bInx = b.inx ?? 0;

      return aInx - bInx;
    });

    // 如果数据库中没有排序信息，则使用本地存储的顺序
    if (
      nodeOrder &&
      nodeOrder.length > 0 &&
      sortedByDb.every((n) => n.inx === undefined || n.inx === 0)
    ) {
      const nodeMap = new Map(nodeList.map((n) => [n.id, n] as const));
      const localSorted: Node[] = [];

      nodeOrder.forEach((id) => {
        const node = nodeMap.get(id);

        if (node) localSorted.push(node);
      });

      nodeList.forEach((node) => {
        if (!nodeOrder.includes(node.id)) {
          localSorted.push(node);
        }
      });

      return localSorted;
    }

    return sortedByDb;
  }, [nodeList, nodeOrder]);

  const debouncedLocalSearch = useDebouncedValue(localSearchKeyword, 150);
  const debouncedRemoteSearch = useDebouncedValue(remoteSearchKeyword, 150);

  const filterNodesByKeyword = useCallback((nodes: Node[], keyword: string) => {
    const normalizedKeyword = keyword.trim().toLowerCase();

    if (!normalizedKeyword) {
      return nodes;
    }

    return nodes.filter(
      (node) =>
        (node.name && node.name.toLowerCase().includes(normalizedKeyword)) ||
        (node.remark &&
          node.remark.toLowerCase().includes(normalizedKeyword)) ||
        (node.serverIp &&
          node.serverIp.toLowerCase().includes(normalizedKeyword)) ||
        (node.serverIpV4 &&
          node.serverIpV4.toLowerCase().includes(normalizedKeyword)) ||
        (node.serverIpV6 &&
          node.serverIpV6.toLowerCase().includes(normalizedKeyword)),
    );
  }, []);

  const localNodes = useMemo(
    () => sortedNodes.filter((node) => node.isRemote !== 1),
    [sortedNodes],
  );

  const remoteNodes = useMemo(
    () => sortedNodes.filter((node) => node.isRemote === 1),
    [sortedNodes],
  );

  const filteredLocalNodes = useMemo(() => {
    const keywordFiltered = filterNodesByKeyword(
      localNodes,
      debouncedLocalSearch,
    );

    if (nodeFilterMode === "all") {
      return keywordFiltered;
    }

    return keywordFiltered.filter((node) => {
      const expiryMeta = getNodeExpiryMeta(node.expiryTime, node.renewalCycle);

      switch (nodeFilterMode) {
        case "expiringSoon":
          return expiryMeta.state === "expiringSoon";
        case "expired":
          return expiryMeta.state === "expired";
        case "withExpiry":
          return getNodeReminderEnabled(node);
        default:
          return true;
      }
    });
  }, [filterNodesByKeyword, localNodes, debouncedLocalSearch, nodeFilterMode]);

  const filteredRemoteNodes = useMemo(
    () => filterNodesByKeyword(remoteNodes, debouncedRemoteSearch),
    [filterNodesByKeyword, remoteNodes, debouncedRemoteSearch],
  );

  const currentSearchKeyword =
    activeTab === "remote" ? remoteSearchKeyword : localSearchKeyword;

  const setCurrentSearchKeyword =
    activeTab === "remote" ? setRemoteSearchKeyword : setLocalSearchKeyword;

  const displayNodes = useMemo(
    () => (activeTab === "remote" ? filteredRemoteNodes : filteredLocalNodes),
    [activeTab, filteredLocalNodes, filteredRemoteNodes],
  );

  const [sort, setSort] = useState<{
    key: "name" | "cpu" | "mem" | "disk" | "speed" | "month";
    dir: "asc" | "desc";
  } | null>(null);

  const orderedNodes = useMemo(() => {
    if (!sort) return displayNodes;
    const metric = (n: (typeof displayNodes)[number]) => {
      const info = n.systemInfo;
      const month = monthTraffic[String(n.id)];

      switch (sort.key) {
        case "cpu":
          return info?.cpuUsage ?? -1;
        case "mem":
          return info?.memoryUsage ?? -1;
        case "disk":
          return info?.diskUsage ?? -1;
        case "speed":
          return (info?.netInSpeed ?? 0) + (info?.netOutSpeed ?? 0);
        case "month":
          return month ? month[0] + month[1] : -1;
        default:
          return 0;
      }
    };
    const sorted = [...displayNodes].sort((a, b) => {
      if (sort.key === "name") return a.name.localeCompare(b.name, "zh-CN");

      return metric(a) - metric(b);
    });

    return sort.dir === "asc" ? sorted : sorted.reverse();
  }, [displayNodes, monthTraffic, sort]);

  const toggleSort = (key: NonNullable<typeof sort>["key"]) => {
    setSort((prev) =>
      prev?.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: key === "name" ? "asc" : "desc" },
    );
  };

  const sortButton = (key: NonNullable<typeof sort>["key"], label: string) => (
    <button
      aria-label={`按${label}排序`}
      className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
      type="button"
      onClick={() => toggleSort(key)}
    >
      {label}
      <span className="text-[9px] leading-none">
        {sort?.key === key ? (sort.dir === "asc" ? "▲" : "▼") : ""}
      </span>
    </button>
  );

  const virtualizeList = !card && orderedNodes.length > 60;
  const windowed = useWindowedList({
    count: orderedNodes.length,
    rowHeight: 72,
    enabled: virtualizeList,
  });
  const visibleNodes = virtualizeList
    ? orderedNodes.slice(windowed.start, windowed.end)
    : orderedNodes;

  const canBatchUpgrade = activeTab === "local";
  const canUseExpiryFilter = activeTab === "local";
  const hasKeywordSearch = currentSearchKeyword.trim().length > 0;
  const hasActiveFilters = nodeFilterMode !== "all";
  const isDisplayFiltered =
    hasKeywordSearch || (canUseExpiryFilter && hasActiveFilters);

  const sortableNodeIds = useMemo(
    () => displayNodes.map((n) => n.id),
    [displayNodes],
  );

  return (
    <PageShell embedded={embedded}>
      {!embedded && (
        <PageHeader
          description="装了 agent 的机器：搭建节点和中转、看状态和监控"
          primary={{ key: "add", label: "新建服务器", onClick: handleAdd }}
          title="服务器"
        />
      )}
      {remoteNodes.length > 0 && (
        <PageTabs
          tabs={[
            { key: "local", label: "本地服务器", badge: localNodes.length },
            { key: "remote", label: "远程服务器", badge: remoteNodes.length },
          ]}
          value={activeTab}
          onChange={setActiveTab}
        />
      )}

      {selectMode ? (
        <SelectionBar
          actions={[
            {
              key: "upgrade",
              label: "升级",
              disabled: !canBatchUpgrade || batchUpgradeLoading,
              onClick: () => openUpgradeModal("batch"),
            },
            {
              key: "targets",
              label: "测试点",
              disabled: !displayNodes.some(
                (n) => selectedIds.has(n.id) && n.isRemote !== 1,
              ),
              onClick: () =>
                setTargetNodes(
                  displayNodes.filter(
                    (n) => selectedIds.has(n.id) && n.isRemote !== 1,
                  ),
                ),
            },
            {
              key: "delete",
              label: "删除",
              danger: true,
              onClick: () => setBatchDeleteModalOpen(true),
            },
          ]}
          allSelected={
            displayNodes.length > 0 &&
            displayNodes.every((n) => selectedIds.has(n.id))
          }
          count={selectedIds.size}
          onExit={toggleSelectMode}
          onToggleAll={() =>
            displayNodes.every((n) => selectedIds.has(n.id))
              ? deselectAll()
              : selectAll()
          }
        />
      ) : (
        <PageToolbar
          more={[
            {
              key: "batch",
              label: "批量操作",
              disabled: displayNodes.length === 0,
              onClick: toggleSelectMode,
            },
          ]}
          placeholder={
            activeTab === "remote" ? "搜索远程服务器名称或 IP" : "搜索名称或 IP"
          }
          search={currentSearchKeyword}
          view={{ value: viewMode, onChange: setViewMode }}
          onSearch={setCurrentSearchKeyword}
        >
          {canUseExpiryFilter && (
            <ToolbarButton
              active={nodeFilterMode !== "all"}
              onClick={() => setIsFilterModalOpen(true)}
            >
              {nodeFilterMode !== "all" ? "已筛选" : "筛选"}
            </ToolbarButton>
          )}
        </PageToolbar>
      )}

      {!wsConnected && (
        <Alert className="mb-3" variant="warning">
          <AlertDescription>
            {wsConnecting
              ? "监控连接中..."
              : usingPollingFallback
                ? "监控连接已断开，已切换为列表自动刷新兜底模式。"
                : "监控连接已断开，正在重连..."}
          </AlertDescription>
        </Alert>
      )}

      {loading ? (
        <ListPageSkeleton />
      ) : nodeList.length === 0 ? (
        <EmptyHint
          action={{ key: "add", label: "新建服务器", onClick: handleAdd }}
          text="还没有服务器。新建后在服务器上运行安装命令，服务器就会连上面板"
        />
      ) : displayNodes.length === 0 ? (
        <EmptyHint
          text={
            isDisplayFiltered
              ? "没有匹配的服务器"
              : activeTab === "remote"
                ? "暂无远程服务器"
                : "暂无本地服务器"
          }
        />
      ) : (
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <SortableContext
            items={sortableNodeIds}
            strategy={rectSortingStrategy}
          >
            <div
              ref={windowed.ref}
              className={
                card
                  ? CARD_GRID
                  : "list-enter flex flex-col gap-2 lg:gap-0 lg:divide-y lg:divide-border lg:overflow-hidden lg:rounded-xl lg:border lg:border-border lg:bg-raised"
              }
              data-list={card ? undefined : "node"}
            >
              {!card && (
                <div
                  className="sticky top-0 z-10 hidden items-center gap-4 border-b border-border bg-raised px-4 py-2 text-[11px] font-medium text-muted-foreground lg:grid lg:[grid-template-columns:var(--list-cols)]"
                  data-slot="list-head"
                  role="row"
                >
                  <div className="min-w-0" role="columnheader">
                    {sortButton("name", "名称")}
                  </div>
                  <div
                    className="flex min-w-0 items-center gap-2"
                    role="columnheader"
                  >
                    {sortButton("cpu", "CPU")}
                    <span className="text-muted-foreground/40">/</span>
                    {sortButton("mem", "内存")}
                    <span className="text-muted-foreground/40">/</span>
                    {sortButton("disk", "磁盘")}
                  </div>
                  <div className="min-w-0 text-right" role="columnheader">
                    {sortButton("speed", "网速")}
                  </div>
                  <div className="min-w-0 text-right" role="columnheader">
                    {sortButton("month", "本月流量")}
                  </div>
                  <div className="min-w-0" role="columnheader">
                    延迟
                  </div>
                  <div />
                </div>
              )}
              {virtualizeList && windowed.start > 0 && (
                <div aria-hidden style={{ height: windowed.start * 72 }} />
              )}
              {visibleNodes.map((node) => {
                if (card) {
                  const isRemoteNode = node.isRemote === 1;
                  const remoteUsage = isRemoteNode
                    ? remoteUsageMap[node.id]
                    : null;
                  const expiryMeta = getNodeExpiryMeta(
                    node.expiryTime,
                    node.renewalCycle,
                  );
                  const connectionStatusMeta = getConnectionStatusMeta(
                    node.connectionStatus,
                  );
                  const statusText =
                    node.connectionStatus === "online" && node.systemInfo
                      ? `${connectionStatusMeta.text} · ${formatUptime(node.systemInfo.uptime)}`
                      : connectionStatusMeta.text;
                  const osLabel = node.systemInfo
                    ? [node.systemInfo.osName, node.systemInfo.osVersion]
                        .filter(Boolean)
                        .join(" ")
                    : "";
                  const osExtra = node.systemInfo
                    ? [node.systemInfo.virt, node.systemInfo.arch]
                        .filter(Boolean)
                        .join(" · ")
                    : "";
                  const hasRemark = Boolean(node.remark?.trim());
                  const hasExpiryInfo = Boolean(
                    node.expiryTime &&
                      node.expiryTime > 0 &&
                      node.renewalCycle &&
                      !node.expiryReminderDismissed,
                  );
                  const hasInfoTrigger = hasRemark || hasExpiryInfo;
                  const infoCount = Number(hasExpiryInfo) + Number(hasRemark);
                  const infoPlacement = infoPopoverPlacement[node.id] ?? "left";

                  return (
                    <SortableItem key={node.id} id={node.id}>
                      {() => (
                        <Card
                          key={node.id}
                          className={`group relative overflow-visible h-full flex flex-col [content-visibility:auto] [contain-intrinsic-size:auto_420px] ${node.expiryReminderDismissed ? "" : expiryMeta.accentClassName}`}
                          data-node-card="true"
                        >
                          <CardHeader className="pb-3 md:pb-3">
                            <div className="flex justify-between items-start w-full gap-3">
                              <div className="flex items-start gap-2 flex-1 min-w-0">
                                <span
                                  aria-label="地区"
                                  className="mt-0.5 flex-shrink-0 select-none"
                                  role="img"
                                  title="地区"
                                >
                                  <NodeFlag
                                    code={
                                      node.country || getNodeFlag(node.name)
                                    }
                                  />
                                </span>
                                {selectMode && (
                                  <Checkbox
                                    checked={selectedIds.has(node.id)}
                                    className="mt-0.5"
                                    onCheckedChange={checkboxHandler(() =>
                                      toggleSelect(node.id),
                                    )}
                                  />
                                )}
                                <div className="min-w-0 flex-1 pt-0.5">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <h3 className="font-semibold text-foreground truncate text-lg leading-5">
                                      {node.name}
                                    </h3>
                                    <div
                                      className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0
                                      ${connectionStatusMeta.color === "success" ? "bg-success/10 text-success-700 dark:text-success-400" : "bg-destructive/10 text-destructive"}
                                    `}
                                      title={statusText}
                                    >
                                      <span
                                        className={`h-1.5 w-1.5 rounded-full ${connectionStatusMeta.color === "success" ? "bg-success" : "bg-destructive"}`}
                                      />
                                      {statusText}
                                    </div>
                                  </div>
                                </div>
                              </div>
                              <div className="ml-2 flex-shrink-0 self-start">
                                {hasInfoTrigger && (
                                  <div className="group/info relative">
                                    <button
                                      aria-label={`查看服务器信息，共 ${infoCount} 项`}
                                      className="relative flex h-7 w-7 items-center justify-center rounded-full border border-hairline/80 bg-background/95 text-muted-foreground shadow-sm transition hover:border-border hover:text-foreground focus-visible:border-border focus-visible:text-foreground focus-visible:outline-none"
                                      type="button"
                                      onFocus={(event) =>
                                        updateInfoPopoverPlacement(
                                          node.id,
                                          event.currentTarget,
                                        )
                                      }
                                      onMouseEnter={(event) =>
                                        updateInfoPopoverPlacement(
                                          node.id,
                                          event.currentTarget,
                                        )
                                      }
                                    >
                                      <svg
                                        aria-hidden="true"
                                        className="h-3.5 w-3.5"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                      >
                                        <path
                                          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          strokeWidth={1.8}
                                        />
                                      </svg>
                                      {hasRemark && (
                                        <span className="absolute -right-1 -top-1 flex h-2.5 w-2.5 rounded-full border border-background bg-muted shadow-sm dark:bg-muted" />
                                      )}
                                    </button>
                                    <div
                                      className={`pointer-events-none invisible absolute z-[60] w-72 max-w-[min(18rem,calc(100vw-4rem))] rounded-xl border border-hairline bg-popover p-3 opacity-0 text-popover-foreground shadow-lg transition-transform duration-150 group-hover/info:visible group-hover/info:pointer-events-auto group-hover/info:opacity-100 group-focus-within/info:visible group-focus-within/info:pointer-events-auto group-focus-within/info:opacity-100 ${
                                        infoPlacement === "bottom"
                                          ? "right-0 top-[calc(100%+0.75rem)] translate-y-1 group-hover/info:translate-y-0 group-focus-within/info:translate-y-0"
                                          : "right-[calc(100%+0.75rem)] top-1/2 -translate-y-1/2 translate-x-1 group-hover/info:translate-x-0 group-focus-within/info:translate-x-0"
                                      }`}
                                    >
                                      <div className="flex flex-col gap-3">
                                        {hasExpiryInfo && (
                                          <div className="flex flex-col gap-2">
                                            <div className="flex items-center justify-between">
                                              <div className="text-[11px] font-medium text-muted-foreground">
                                                到期提醒
                                              </div>
                                              <button
                                                className="text-[11px] text-muted-foreground hover:text-muted-foreground transition-colors"
                                                type="button"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleDismissExpiryReminder(
                                                    node.id,
                                                  );
                                                }}
                                              >
                                                关闭提醒
                                              </button>
                                            </div>
                                            <div className="flex flex-wrap gap-1.5">
                                              <Badge
                                                className="text-[11px] h-5 px-1 flex-shrink-0"
                                                title={`${formatNodeRenewalTime(expiryMeta.nextDueTime)} (${getNodeRenewalCycleLabel(node.renewalCycle)})`}
                                                variant={badgeTone(
                                                  expiryMeta.tone,
                                                )}
                                              >
                                                {expiryMeta.label}
                                              </Badge>
                                            </div>
                                            <div className="rounded-lg border border-hairline/80 bg-muted/80 px-3 py-2 text-xs leading-5 text-foreground">
                                              {formatNodeRenewalTime(
                                                expiryMeta.nextDueTime,
                                              )}
                                            </div>
                                          </div>
                                        )}

                                        {hasRemark && (
                                          <div className="flex flex-col gap-2">
                                            <div className="text-[11px] font-medium text-muted-foreground">
                                              备注
                                            </div>
                                            <div
                                              className="max-h-32 overflow-y-auto rounded-lg border border-hairline/80 bg-muted/80 px-3 py-2 text-xs leading-5 text-foreground break-all [scrollbar-width:thin]"
                                              title={node.remark?.trim()}
                                            >
                                              {node.remark?.trim()}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </CardHeader>

                          <CardContent className="pt-0 pb-3 md:pt-0 md:pb-3 flex-1 flex flex-col">
                            {isRemoteNode && node.syncError && (
                              <div className="mb-3 px-2 py-1.5 rounded-md bg-warning-50 dark:bg-warning-100/10 text-warning-700 dark:text-warning-400 text-xs">
                                {getRemoteSyncErrorMessage(node.syncError)}
                              </div>
                            )}
                            {isRemoteNode ? (
                              <div className="flex flex-col gap-2 mb-4">
                                <div className="flex justify-between items-center text-sm min-w-0">
                                  <span className="text-muted-foreground flex-shrink-0">
                                    IP
                                  </span>
                                  <div className="text-right text-xs min-w-0 flex-1 ml-2 min-h-[2.125rem]">
                                    {node.serverIpV4?.trim() ||
                                    node.serverIpV6?.trim() ? (
                                      <div className="flex flex-col gap-0.5">
                                        {node.serverIpV4?.trim() && (
                                          <span
                                            className="font-mono truncate block"
                                            title={node.serverIpV4.trim()}
                                          >
                                            {node.serverIpV4.trim()}
                                          </span>
                                        )}
                                        {node.serverIpV6?.trim() && (
                                          <span
                                            className="font-mono truncate block"
                                            title={node.serverIpV6.trim()}
                                          >
                                            {node.serverIpV6.trim()}
                                          </span>
                                        )}
                                      </div>
                                    ) : (
                                      <span
                                        className="font-mono truncate block"
                                        title={node.serverIp.trim()}
                                      >
                                        {node.serverIp.trim()}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="mb-4 flex min-w-0 flex-col gap-3">
                                <div className="flex min-w-0 items-center gap-2 overflow-hidden text-[11px] text-muted-foreground">
                                  <span
                                    className="flex max-w-[45%] shrink-0 items-center gap-1"
                                    title={
                                      node.serverIpV4?.trim() ||
                                      node.serverIpV6?.trim() ||
                                      node.serverIp.trim()
                                    }
                                  >
                                    <Globe2 className="h-3 w-3 shrink-0 text-muted-foreground/70" />
                                    <span className="truncate font-mono">
                                      {node.serverIpV4?.trim() ||
                                        node.serverIpV6?.trim() ||
                                        node.serverIp.trim()}
                                    </span>
                                  </span>
                                  <span
                                    className="flex shrink-0 items-center gap-1"
                                    title={`Agent ${node.version || "未连接过"}`}
                                  >
                                    <Bot className="h-3 w-3 shrink-0 text-muted-foreground/70" />
                                    <span className="font-mono">
                                      {node.version || "未连接过"}
                                    </span>
                                  </span>
                                  {osLabel ? (
                                    <span
                                      className="flex min-w-0 flex-1 items-center gap-1"
                                      title={[osLabel, osExtra]
                                        .filter(Boolean)
                                        .join(" · ")}
                                    >
                                      <Monitor className="h-3 w-3 shrink-0 text-muted-foreground/70" />
                                      <span className="truncate">
                                        {osLabel}
                                        {osExtra ? (
                                          <span className="hidden sm:inline">
                                            {" · "}
                                            {osExtra}
                                          </span>
                                        ) : null}
                                      </span>
                                    </span>
                                  ) : null}
                                  {node.price ? (
                                    <p className="truncate text-[11px] text-muted-foreground">
                                      费用 ¥{node.price.toFixed(2)}
                                      {node.renewalCycle
                                        ? ` / ${getNodeRenewalCycleLabel(node.renewalCycle)}`
                                        : ""}
                                    </p>
                                  ) : null}
                                </div>
                                {upgradeProgress[node.id] &&
                                  upgradeProgress[node.id].percent < 100 && (
                                    <Progress
                                      showValueLabel
                                      aria-label="升级进度"
                                      color="warning"
                                      label={upgradeProgress[node.id].message}
                                      size="sm"
                                      value={upgradeProgress[node.id].percent}
                                    />
                                  )}
                                <NodeLiveStats
                                  info={
                                    node.connectionStatus === "online"
                                      ? (node.systemInfo ?? null)
                                      : null
                                  }
                                  month={monthTraffic[String(node.id)]}
                                  variant="card"
                                />
                              </div>
                            )}

                            {isRemoteNode && (
                              <div className="flex flex-col gap-3 mb-4">
                                {remoteUsage ? (
                                  <>
                                    <div className="text-xs rounded-md border border-border dark:border-border/30 bg-muted dark:bg-muted/20 p-2.5 flex flex-col gap-2">
                                      <div className="flex justify-between gap-2">
                                        <span className="text-muted-foreground">
                                          远程地址
                                        </span>
                                        <span
                                          className="font-mono text-right truncate"
                                          title={
                                            remoteUsage.remoteUrl ||
                                            node.remoteUrl ||
                                            "-"
                                          }
                                        >
                                          {remoteUsage.remoteUrl ||
                                            node.remoteUrl ||
                                            "-"}
                                        </span>
                                      </div>
                                      <div className="flex justify-between gap-2">
                                        <span className="text-muted-foreground">
                                          共享ID
                                        </span>
                                        <span className="font-mono">
                                          #{remoteUsage.shareId}
                                        </span>
                                      </div>
                                      <div className="flex justify-between gap-2">
                                        <span className="text-muted-foreground">
                                          流量
                                        </span>
                                        <span className="font-mono">
                                          {formatFlow(remoteUsage.currentFlow)}
                                        </span>
                                      </div>
                                      <div className="flex justify-between gap-2">
                                        <span className="text-muted-foreground">
                                          带宽上限
                                        </span>
                                        <span className="font-mono">
                                          {remoteUsage.maxBandwidth > 0
                                            ? formatSpeed(
                                                remoteUsage.maxBandwidth,
                                              )
                                            : "不限"}
                                        </span>
                                      </div>
                                    </div>

                                    <div className="text-xs rounded-md border border-border dark:border-border/30 bg-muted dark:bg-muted/20 p-2.5">
                                      <div className="flex items-center justify-between mb-2">
                                        <span className="text-muted-foreground">
                                          占用端口
                                        </span>
                                        <span className="font-mono text-foreground dark:text-muted-foreground">
                                          {remoteUsage.usedPorts.length}/
                                          {Math.max(
                                            remoteUsage.portRangeEnd -
                                              remoteUsage.portRangeStart +
                                              1,
                                            0,
                                          )}
                                        </span>
                                      </div>
                                      <div className="max-h-20 overflow-y-auto rounded bg-muted/40 dark:bg-black/20 p-1.5 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1">
                                        {remoteUsage.usedPorts.length > 0 ? (
                                          <div className="flex flex-wrap gap-1">
                                            {remoteUsage.usedPorts.map(
                                              (port) => (
                                                <Badge
                                                  key={`${node.id}-port-${port}`}
                                                  className="font-mono shrink-0 whitespace-nowrap"
                                                  variant="outline"
                                                >
                                                  {port}
                                                </Badge>
                                              ),
                                            )}
                                          </div>
                                        ) : (
                                          <div className="text-muted-foreground">
                                            暂无占用端口
                                          </div>
                                        )}
                                      </div>
                                    </div>

                                    <div className="text-xs rounded-md border border-border dark:border-border/30 bg-muted dark:bg-muted/20 p-2.5">
                                      <div className="flex items-center justify-between mb-2">
                                        <span className="text-muted-foreground">
                                          绑定明细
                                        </span>
                                        <span className="font-mono text-foreground dark:text-muted-foreground">
                                          {remoteUsage.activeBindingNum}
                                        </span>
                                      </div>
                                      <div className="max-h-32 overflow-y-auto flex flex-col gap-1.5 pr-1 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1">
                                        {remoteUsage.bindings.length > 0 ? (
                                          remoteUsage.bindings.map(
                                            (binding) => (
                                              <div
                                                key={binding.bindingId}
                                                className="rounded border border-border dark:border-border/30 bg-muted/40 dark:bg-black/20 p-2"
                                              >
                                                <div className="flex items-center justify-between gap-2">
                                                  <span
                                                    className="font-medium truncate"
                                                    title={binding.tunnelName}
                                                  >
                                                    {binding.tunnelName}
                                                  </span>
                                                  <span className="font-mono text-[11px]">
                                                    #{binding.tunnelId}
                                                  </span>
                                                </div>
                                                <div className="mt-1 text-[11px] text-muted-foreground flex items-center justify-between gap-2">
                                                  <span>
                                                    {formatChainType(
                                                      binding.chainType,
                                                      binding.hopInx,
                                                    )}
                                                  </span>
                                                  <span className="font-mono">
                                                    端口 {binding.allocatedPort}
                                                  </span>
                                                </div>
                                              </div>
                                            ),
                                          )
                                        ) : (
                                          <div className="text-muted-foreground">
                                            暂无绑定明细
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </>
                                ) : (
                                  <div className="text-xs rounded-md border border-border dark:border-border/30 bg-muted dark:bg-muted/20 p-2.5 text-muted-foreground">
                                    暂未获取到远程占用数据
                                  </div>
                                )}
                              </div>
                            )}

                            {node.latency && (
                              <div className="mb-4 empty:hidden">
                                {renderLatency(node, "card")}
                              </div>
                            )}

                            <div className="mt-auto">
                              {/* 图表与状态都在卡上，操作统一收进配置面板 */}
                              <Button
                                className="w-full gap-1.5"
                                size="sm"
                                variant="outline"
                                onClick={() => setSheetNodeId(node.id)}
                              >
                                <Settings2 className="h-3.5 w-3.5" />
                                配置
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      )}
                    </SortableItem>
                  );
                }

                const isRemoteNode = node.isRemote === 1;
                const online = node.connectionStatus === "online";
                const expiryMeta = getNodeExpiryMeta(
                  node.expiryTime,
                  node.renewalCycle,
                );
                const showExpiry = Boolean(
                  node.expiryTime &&
                    node.expiryTime > 0 &&
                    node.renewalCycle &&
                    !node.expiryReminderDismissed &&
                    expiryMeta.isHighlighted,
                );
                const progress = upgradeProgress[node.id];
                const upgrading = progress && progress.percent < 100;
                const address =
                  node.serverIpV4?.trim() ||
                  node.serverIpV6?.trim() ||
                  node.serverIp.trim();
                const meta = isRemoteNode
                  ? [address, node.syncError ? "同步失败" : ""]
                  : [
                      address,
                      upgrading
                        ? `升级中 ${progress.percent}%`
                        : node.version || "未连接过",
                      online && node.systemInfo
                        ? `已运行 ${formatUptime(node.systemInfo.uptime)}`
                        : "",
                    ];

                return (
                  <SortableItem key={node.id} id={node.id}>
                    {(listeners) => (
                      <ListRow
                        badges={
                          <>
                            {isRemoteNode && (
                              <Badge className="shrink-0" variant="outline">
                                远程
                              </Badge>
                            )}
                            {showExpiry && (
                              <Badge
                                className="shrink-0"
                                variant={badgeTone(expiryMeta.tone)}
                              >
                                {expiryMeta.label}
                              </Badge>
                            )}
                          </>
                        }
                        cells={
                          card || selectMode
                            ? undefined
                            : [
                                <div
                                  key="name"
                                  className="flex min-w-0 items-center gap-3"
                                >
                                  <span
                                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_DOT[upgrading ? "warn" : online ? "ok" : "bad"]}`}
                                    title={
                                      getConnectionStatusMeta(
                                        node.connectionStatus,
                                      ).text
                                    }
                                  />
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5">
                                      <span className="truncate text-sm font-medium text-foreground">
                                        {node.name}
                                      </span>
                                      {!isRemoteNode && showExpiry && (
                                        <Badge
                                          className="shrink-0"
                                          variant={badgeTone(expiryMeta.tone)}
                                        >
                                          {expiryMeta.label}
                                        </Badge>
                                      )}
                                      {isRemoteNode && (
                                        <Badge
                                          className="shrink-0"
                                          variant="outline"
                                        >
                                          远程
                                        </Badge>
                                      )}
                                    </div>
                                    <div className="truncate text-xs text-muted-foreground tabular">
                                      {meta.filter(Boolean).join(" · ")}
                                    </div>
                                  </div>
                                </div>,
                                !isRemoteNode && (
                                  <NodeMeters
                                    info={
                                      online ? (node.systemInfo ?? null) : null
                                    }
                                  />
                                ),
                                !isRemoteNode && (
                                  <NodeSpeed
                                    align="end"
                                    info={
                                      online ? (node.systemInfo ?? null) : null
                                    }
                                  />
                                ),
                                !isRemoteNode && (
                                  <NodeMonth
                                    align="end"
                                    month={monthTraffic[String(node.id)]}
                                  />
                                ),
                                <div
                                  key="latency"
                                  className="relative z-10 flex justify-end"
                                >
                                  {renderLatency(node, "list")}
                                </div>,
                                !isDisplayFiltered && (
                                  <span
                                    aria-label="拖动排序"
                                    className="relative z-10 hidden h-7 w-7 cursor-grab lg:inline-flex touch-none items-center justify-center justify-self-end rounded-md text-muted-foreground hover:bg-surface active:cursor-grabbing"
                                    role="button"
                                    title="拖动排序"
                                    {...listeners}
                                  >
                                    <GripVertical className="h-4 w-4" />
                                  </span>
                                ),
                              ]
                        }
                        footer={
                          !isRemoteNode && (
                            <NodeLiveStats
                              info={online ? (node.systemInfo ?? null) : null}
                              month={monthTraffic[String(node.id)]}
                              variant="footer"
                            />
                          )
                        }
                        meta={meta.filter(Boolean).join(" · ")}
                        right={
                          <>
                            {!isRemoteNode && (
                              <NodeLiveStats
                                info={online ? (node.systemInfo ?? null) : null}
                                month={monthTraffic[String(node.id)]}
                                variant="row"
                              />
                            )}
                            {/* A fixed slot keeps the stats in line across rows. */}
                            <div className="contents lg:flex lg:w-36 lg:justify-end">
                              {renderLatency(node, "list")}
                            </div>
                            {!isDisplayFiltered && (
                              <span
                                className="hidden h-7 w-7 cursor-grab lg:inline-flex touch-none items-center justify-center rounded-md text-muted-foreground hover:bg-surface active:cursor-grabbing"
                                title="拖动排序"
                                {...listeners}
                              >
                                <GripVertical className="h-4 w-4" />
                              </span>
                            )}
                          </>
                        }
                        selectMode={selectMode}
                        selected={selectedIds.has(node.id)}
                        status={upgrading ? "warn" : online ? "ok" : "bad"}
                        statusTitle={
                          getConnectionStatusMeta(node.connectionStatus).text
                        }
                        title={node.name}
                        onClick={() => setSheetNodeId(node.id)}
                        onSelect={() => toggleSelect(node.id)}
                      />
                    )}
                  </SortableItem>
                );
              })}
              {virtualizeList && windowed.end < orderedNodes.length && (
                <div
                  aria-hidden
                  style={{ height: (orderedNodes.length - windowed.end) * 72 }}
                />
              )}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {(() => {
        const node = nodeList.find((n) => n.id === sheetNodeId) ?? null;
        const isRemoteNode = node?.isRemote === 1;
        const online = node?.connectionStatus === "online";
        const usage = node ? remoteUsageMap[node.id] : undefined;
        const progress = node ? upgradeProgress[node.id] : undefined;
        const expiryMeta = node
          ? getNodeExpiryMeta(node.expiryTime, node.renewalCycle)
          : null;
        const close = () => setSheetNodeId(null);
        const rows: Array<[string, React.ReactNode]> = node
          ? isRemoteNode
            ? [
                ["地址", usage?.remoteUrl || node.remoteUrl || "-"],
                ...(usage
                  ? ([
                      ["流量", formatFlow(usage.currentFlow)],
                      [
                        "带宽上限",
                        usage.maxBandwidth > 0
                          ? formatSpeed(usage.maxBandwidth)
                          : "不限",
                      ],
                      [
                        "占用端口",
                        `${usage.usedPorts.length} / ${Math.max(
                          usage.portRangeEnd - usage.portRangeStart + 1,
                          0,
                        )}`,
                      ],
                      ["绑定", `${usage.activeBindingNum} 条`],
                    ] as Array<[string, React.ReactNode]>)
                  : []),
              ]
            : [
                [
                  "IP",
                  [node.serverIpV4?.trim(), node.serverIpV6?.trim()]
                    .filter(Boolean)
                    .join(" / ") || node.serverIp.trim(),
                ],
                ["版本", node.version || "未知"],
                ...(online && node.systemInfo
                  ? ([
                      ["已运行", formatUptime(node.systemInfo.uptime)],
                    ] as Array<[string, React.ReactNode]>)
                  : []),
                ...(node.expiryTime && node.renewalCycle && expiryMeta
                  ? ([
                      [
                        "续费",
                        `${expiryMeta.label} · ${formatNodeRenewalTime(
                          expiryMeta.nextDueTime,
                        )}（${getNodeRenewalCycleLabel(node.renewalCycle)}）`,
                      ],
                    ] as Array<[string, React.ReactNode]>)
                  : []),
              ]
          : [];

        return (
          <ActionsDialog
            actions={
              !node
                ? []
                : isRemoteNode
                  ? [
                      {
                        key: "delete",
                        label: "删除",
                        section: "管理",
                        description: "从面板移除这台远程服务器",
                        icon: Trash2,
                        kind: "dialog" as const,
                        closeOnSelect: false,
                        color: "danger" as const,
                        onClick: () => handleDelete(node),
                      },
                    ]
                  : [
                      ...(onOpenMonitor
                        ? [
                            {
                              key: "monitor",
                              label: "监控",
                              section: "运行",
                              description: "实时 CPU、内存与网络曲线",
                              icon: Activity,
                              hint: "打开",
                              kind: "navigate" as const,
                              onClick: () => onOpenMonitor(node.id),
                            },
                          ]
                        : []),
                      {
                        key: "install",
                        label: "安装命令",
                        section: "运行",
                        description: "复制 agent 安装脚本到剪贴板",
                        icon: Terminal,
                        hint: "复制",
                        kind: "copy" as const,
                        onClick: () => openInstallSelector(node),
                      },
                      {
                        key: "version",
                        label: "版本",
                        section: "维护",
                        description: "升级到新版本，或回退到上一版",
                        icon: GitBranch,
                        hint: online ? undefined : "离线不可用",
                        kind: "dialog" as const,
                        closeOnSelect: false,
                        disabled: !online,
                        onClick: () => openUpgradeModal("single", node.id),
                      },
                      {
                        key: "tune",
                        label: "调优",
                        section: "维护",
                        description: "内核与转发参数优化",
                        icon: SlidersHorizontal,
                        hint: online ? undefined : "离线不可用",
                        kind: "dialog" as const,
                        closeOnSelect: false,
                        disabled: !online,
                        onClick: () => setTuneNode(node),
                      },
                      {
                        key: "targets",
                        label: "测试点",
                        section: "维护",
                        description: "选择延迟探测目标",
                        icon: Crosshair,
                        kind: "dialog" as const,
                        closeOnSelect: false,
                        onClick: () => setTargetNodes([node]),
                      },
                      ...(node.expiryTime &&
                      node.renewalCycle &&
                      !node.expiryReminderDismissed &&
                      expiryMeta?.isHighlighted
                        ? [
                            {
                              key: "dismiss",
                              label: "关闭到期提醒",
                              section: "维护",
                              description: "不再提示这台服务器的续费到期",
                              icon: BellOff,
                              kind: "dialog" as const,
                              closeOnSelect: false,
                              onClick: () =>
                                handleDismissExpiryReminder(node.id),
                            },
                          ]
                        : []),
                      {
                        key: "edit",
                        label: "编辑",
                        section: "管理",
                        description: "名称、IP、端口、续费与备注",
                        icon: Pencil,
                        kind: "dialog" as const,
                        closeOnSelect: false,
                        onClick: () => handleEdit(node),
                      },
                      {
                        key: "delete",
                        label: "删除",
                        section: "管理",
                        description: "从面板移除；agent 留在机器上，需手动卸载",
                        icon: Trash2,
                        kind: "dialog" as const,
                        closeOnSelect: false,
                        color: "danger" as const,
                        onClick: () => handleDelete(node),
                      },
                    ]
            }
            badge={
              node && (
                <span
                  aria-label={
                    isRemoteNode
                      ? "远程服务器"
                      : online
                        ? "服务器在线"
                        : "服务器离线"
                  }
                  className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                    isRemoteNode
                      ? "bg-muted text-muted-foreground"
                      : online
                        ? "bg-success/10 text-success-700 dark:text-success-400"
                        : "bg-destructive/10 text-destructive"
                  }`}
                  role="status"
                >
                  {!isRemoteNode && (
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${online ? "bg-success" : "bg-destructive"}`}
                    />
                  )}
                  {isRemoteNode ? "远程" : online ? "在线" : "离线"}
                </span>
              )
            }
            footer={
              node && !isRemoteNode
                ? node.systemInfo && online
                  ? [
                      node.systemInfo.load1 !== undefined
                        ? `负载 ${node.systemInfo.load1.toFixed(2)} / ${(node.systemInfo.load5 ?? 0).toFixed(2)} / ${(node.systemInfo.load15 ?? 0).toFixed(2)}`
                        : null,
                      node.systemInfo.tcpConns !== undefined
                        ? `TCP ${node.systemInfo.tcpConns}`
                        : null,
                      node.systemInfo.udpConns !== undefined
                        ? `UDP ${node.systemInfo.udpConns}`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")
                  : "离线，暂无实时负载"
                : undefined
            }
            open={Boolean(node)}
            subtitle={
              node && (isRemoteNode || !online)
                ? isRemoteNode
                  ? "远程服务器，由远端面板管理"
                  : "agent 没有连上面板，实时数据可能过期"
                : undefined
            }
            title={node?.name ?? ""}
            onClose={close}
          >
            {node && (
              <div className="flex flex-col gap-2 text-sm">
                {isRemoteNode && node.syncError && (
                  <p className="rounded-lg bg-warning-50 px-2 py-1.5 text-xs text-warning-700 dark:bg-warning-100/10 dark:text-warning-400">
                    {getRemoteSyncErrorMessage(node.syncError)}
                  </p>
                )}
                <div className="overflow-hidden rounded-lg border border-border/60 bg-muted/30">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 p-3">
                    {rows.map(([k, v]) => (
                      <div
                        key={k}
                        className={`min-w-0 ${
                          k === "IP" || k === "地址" || k === "续费"
                            ? "col-span-2"
                            : ""
                        }`}
                      >
                        <div className="text-[11px] text-muted-foreground">
                          {k}
                        </div>
                        <div className="mt-0.5 break-words font-mono text-xs text-foreground [overflow-wrap:anywhere]">
                          {v}
                        </div>
                      </div>
                    ))}
                  </div>
                  {node.remark?.trim() && (
                    <div className="border-t border-border/60 px-3 py-2">
                      <div className="text-[11px] text-muted-foreground">
                        备注
                      </div>
                      <p className="mt-0.5 whitespace-pre-wrap break-words text-xs text-foreground">
                        {node.remark.trim()}
                      </p>
                    </div>
                  )}
                </div>
                {progress && progress.percent < 100 && (
                  <Progress
                    showValueLabel
                    aria-label="升级进度"
                    color="warning"
                    label={progress.message}
                    size="sm"
                    value={progress.percent}
                  />
                )}
              </div>
            )}
          </ActionsDialog>
        );
      })()}
      {/* 新增/编辑节点对话框 */}
      <NodeFormModal
        dialogTitle={dialogTitle}
        dialogVisible={dialogVisible}
        errors={errors}
        form={form}
        handleSubmit={handleSubmit}
        protocolControlsDisabled={protocolControlsDisabled}
        protocolControlsReason={protocolControlsReason}
        setDialogVisible={setDialogVisible}
        setForm={setForm}
        submitLoading={submitLoading}
      />

      <NodeTuneModal node={tuneNode} onClose={() => setTuneNode(null)} />

      {/* 回退确认模态框 */}
      <RollbackNodeModal
        confirmRollback={confirmRollback}
        nodeToRollback={nodeToRollback}
        rollbackModalOpen={rollbackModalOpen}
        setRollbackModalOpen={setRollbackModalOpen}
      />

      {/* 删除确认模态框 */}
      <DeleteNodeModal
        confirmDelete={confirmDelete}
        deleteLoading={deleteLoading}
        deleteModalOpen={deleteModalOpen}
        nodeToDelete={nodeToDelete}
        setDeleteModalOpen={setDeleteModalOpen}
      />

      {/* 安装命令模态框 */}
      <InstallCommandModal
        currentNodeName={currentNodeName}
        handleCopyCommand={handleCopyCommand}
        installCommandModal={installCommandModal}
        installCommands={installCommands}
        setInstallCommandModal={setInstallCommandModal}
      />

      {/* 版本选择升级模态框 */}
      <UpgradeNodeModal
        currentVersion={
          nodeList.find((n) => n.id === upgradeTargetNodeId)?.version
        }
        handleConfirmUpgrade={handleConfirmUpgrade}
        releases={releases}
        releasesLoading={releasesLoading}
        selectedIds={selectedIds}
        selectedVersion={selectedVersion}
        setSelectedVersion={setSelectedVersion}
        setUpgradeModalOpen={setUpgradeModalOpen}
        upgradeModalOpen={upgradeModalOpen}
        upgradeTarget={upgradeTarget}
        onRollback={() => {
          const target = nodeList.find((n) => n.id === upgradeTargetNodeId);

          setUpgradeModalOpen(false);
          if (target) handleRollbackNode(target);
        }}
      />

      {/* 批量删除确认模态框 */}
      <BatchDeleteNodesModal
        batchDeleteModalOpen={batchDeleteModalOpen}
        batchLoading={batchLoading}
        handleBatchDelete={handleBatchDelete}
        selectedIds={selectedIds}
        setBatchDeleteModalOpen={setBatchDeleteModalOpen}
      />

      <NodeFilterModal
        isFilterModalOpen={isFilterModalOpen}
        nodeExpiryStats={nodeExpiryStats}
        nodeFilterMode={nodeFilterMode}
        resetNodeFilterMode={resetNodeFilterMode}
        setIsFilterModalOpen={setIsFilterModalOpen}
        setNodeFilterMode={setNodeFilterMode}
      />
      <LatencyDialog
        node={latencyNode}
        probe={latencyNode?.latency}
        probing={latencyNode ? probingIds.has(latencyNode.id) : false}
        onClose={() => setLatencyNode(null)}
        onProbe={() => latencyNode && probeNode(latencyNode.id)}
        onTargetsSaved={() => setLatencyNode(null)}
      />

      <LatencyTargetsModal
        nodes={targetNodes}
        onClose={() => setTargetNodes([])}
        onSaved={() => loadNodes({ silent: true })}
      />
    </PageShell>
  );
}
