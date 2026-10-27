import type { SubscriptionItem } from "@/api";

import { Loader2 } from "lucide-react";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { toast } from "sonner";
import { parseDate } from "@internationalized/date";

import { ActionsDialog } from "@/components/action-dialog";
import {
  EmptyHint,
  ListGroup,
  SortHeader,
  TablePagination,
  ListRow,
  PageHeader,
  PageShell,
  PageToolbar,
  formatDate,
  type RowStatus,
} from "@/components/page-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
} from "@/components/modal";
import { Badge, badgeTone } from "@/components/ui/badge";
import { MultiSelectField } from "@/components/multi-select-field";
import { SelectField } from "@/components/select-native";
import {
  RadioGroupField as RadioGroup,
  RadioOption as Radio,
} from "@/components/radio-group-field";
import { Checkbox, checkboxHandler } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { DatePicker } from "@/components/date-picker-field";
import { ProgressBar as Progress } from "@/components/progress-bar";
import {
  User,
  UserForm,
  UserGroup,
  UserTunnel,
  TunnelAssignItem,
  Tunnel,
  SpeedLimit,
  Pagination as PaginationType,
} from "@/types";
import {
  getAllUsers,
  getSubscriptions,
  createUser,
  updateUser,
  deleteUser,
  getTunnelList,
  batchAssignUserTunnel,
  getUserTunnelList,
  removeUserTunnel,
  updateUserTunnel,
  getSpeedLimitList,
  resetUserFlow,
  resetUserQuota,
  getUserGroupList,
  getUserGroups,
  getMonitorPermissionList,
  assignMonitorPermission,
  removeMonitorPermission,
} from "@/api";
import { DeleteIcon } from "@/components/icons";
import { ListPageSkeleton } from "@/components/page-state";
import {
  markPageCached,
  pageCached,
  useCachedState,
} from "@/hooks/use-cached-state";
import { TrafficLimitField } from "@/components/traffic-limit-field";
import { useLocalStorageState } from "@/hooks/use-local-storage-state";
import { removeItemsById, replaceItemById } from "@/utils/list-state";
import {
  formatTraffic,
  formatFlowLimit,
  flowLimitBytes,
  flowLimitMiB,
  parseTrafficInput,
  preferredTrafficUnit,
  TRAFFIC_UNIT_MIB,
  type TrafficUnit,
} from "@/utils/traffic";

// 工具函数
const formatFlow = formatTraffic;

const formatQuotaLimit = (value?: number): string => {
  const limit = Number(value ?? 0);

  if (!Number.isFinite(limit) || limit <= 0) {
    return "不限";
  }

  return formatTraffic(limit * 1024 ** 3);
};

const trafficInputFor = (flowGB: number, flowMiB?: number) => {
  const mib = flowLimitMiB(flowGB, flowMiB);
  const unit = preferredTrafficUnit(mib);

  return { value: String(mib / TRAFFIC_UNIT_MIB[unit]), unit };
};

const getExpireStatus = (expTime: number) => {
  const now = Date.now();

  if (expTime < now) {
    return { color: "danger" as const, text: "已过期" };
  }
  const diffDays = Math.ceil((expTime - now) / (1000 * 60 * 60 * 24));

  if (diffDays <= 7) {
    return { color: "warning" as const, text: `${diffDays}天后过期` };
  }

  return { color: "success" as const, text: "正常" };
};

// 列表行状态：禁用 > 已过期 > 即将过期 > 正常
const getUserRowState = (user: User): { status: RowStatus; text: string } => {
  if (user.status !== 1) return { status: "off", text: "禁用" };
  if (user.expTime && user.expTime < Date.now()) {
    return { status: "bad", text: "已过期" };
  }
  if (user.disabledByQuota) return { status: "bad", text: "配额超额" };
  if (user.expTime && getExpireStatus(user.expTime).color === "warning") {
    return { status: "warn", text: getExpireStatus(user.expTime).text };
  }

  return { status: "ok", text: "正常" };
};

const calculateUserTotalUsedFlow = (user: User): number => {
  return (user.inFlow || 0) + (user.outFlow || 0);
};

/** Used share of a user's traffic limit; nothing for unlimited users. */
function UsageBar({ user }: { user: User }) {
  if (user.flow === 99999 && !user.flowMiB) return null;
  const limit = flowLimitBytes(user.flow, user.flowMiB);

  if (limit <= 0) return null;
  const pct = Math.min(100, (calculateUserTotalUsedFlow(user) / limit) * 100);
  const tone =
    pct >= 100 ? "bg-destructive" : pct >= 90 ? "bg-warning" : "bg-primary";

  return (
    <div className="h-1.5 max-w-md overflow-hidden rounded-full bg-muted">
      <div
        className={`h-full rounded-full ${tone}`}
        style={{ width: `${Math.max(2, pct)}%` }}
      />
    </div>
  );
}

const calculateTunnelUsedFlow = (tunnel: UserTunnel): number => {
  const inFlow = tunnel.inFlow || 0;
  const outFlow = tunnel.outFlow || 0;

  // 后端已按计费类型处理流量，前端直接使用入站+出站总和
  return inFlow + outFlow;
};

const USER_SEARCH_DEBOUNCE_MS = 250;

const normalizeUserItem = (item: Partial<User>): User => {
  return {
    id: Number(item.id ?? 0),
    name: item.name,
    user: String(item.user ?? ""),
    status: Number(item.status ?? 0),
    flow: Number(item.flow ?? 0),
    flowMiB: Number(item.flowMiB ?? 0),
    num: Number(item.num ?? 0),
    expTime: item.expTime,
    flowResetTime: item.flowResetTime ?? 0,
    createdTime: item.createdTime,
    inFlow: Number(item.inFlow ?? 0),
    outFlow: Number(item.outFlow ?? 0),
    dailyQuotaGB: Number(item.dailyQuotaGB ?? 0),
    monthlyQuotaGB: Number(item.monthlyQuotaGB ?? 0),
    dailyUsedBytes: Number(item.dailyUsedBytes ?? 0),
    monthlyUsedBytes: Number(item.monthlyUsedBytes ?? 0),
    disabledByQuota: Number(item.disabledByQuota ?? 0),
    quotaDisabledAt: Number(item.quotaDisabledAt ?? 0),
    maxConn: item.maxConn != null ? Number(item.maxConn) : undefined,
  };
};

const normalizeUserTunnelItem = (item: Partial<UserTunnel>): UserTunnel => {
  return {
    id: Number(item.id ?? 0),
    userId: Number(item.userId ?? 0),
    tunnelId: Number(item.tunnelId ?? 0),
    tunnelName: String(item.tunnelName ?? ""),
    status: Number(item.status ?? 0),
    flow: Number(item.flow ?? 0),
    flowMiB: Number(item.flowMiB ?? 0),
    num: Number(item.num ?? 0),
    expTime: Number(item.expTime ?? 0),
    flowResetTime: Number(item.flowResetTime ?? 0),
    speedId: item.speedId ?? null,
    speedLimitName: item.speedLimitName,
    inFlow: Number(item.inFlow ?? 0),
    outFlow: Number(item.outFlow ?? 0),
    tunnelFlow: item.tunnelFlow,
  };
};

/**
 * The subscriptions assigned to the user being edited. A subscription has
 * one user: picking one that belongs to someone else moves it here.
 */
function SubscriptionPicker({
  subscriptions,
  selected,
  userId,
  onChange,
}: {
  subscriptions: SubscriptionItem[];
  selected: number[];
  userId?: number;
  onChange: (ids: number[]) => void;
}) {
  if (subscriptions.length === 0) return null;
  const owner = (s: SubscriptionItem) =>
    s.userId && s.userId !== userId ? s.userName || `#${s.userId}` : "";
  const moved = subscriptions.filter(
    (s) => selected.includes(s.id) && owner(s),
  );

  return (
    <div className="space-y-1">
      <MultiSelectField
        label="订阅（可选）"
        options={subscriptions.map((s) => ({
          value: s.id.toString(),
          label: s.name,
        }))}
        placeholder="选择分配给该用户的订阅"
        values={selected.map(String)}
        onValuesChange={(next) => onChange(next.map(Number))}
      />
      {moved.length > 0 ? (
        <p className="text-xs text-warning">
          {moved.map((s) => `「${s.name}」`).join("、")}
          会从 {[...new Set(moved.map(owner))].join("、")} 转给该用户
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          分配后，该用户登录面板就能在「订阅」里导入客户端、查看流量和到期、自己重置链接
        </p>
      )}
    </div>
  );
}

// A revisit shows the last data at once and reloads in the background.
const PAGE = "user";

export default function UserPage({ embedded = false }: { embedded?: boolean }) {
  // 状态管理
  const [users, setUsers] = useCachedState<User[]>(PAGE, "users", []);
  const [loading, setLoading] = useState(true);
  const [searchKeyword, setSearchKeyword] = useLocalStorageState(
    "user-search-keyword",
    "",
  );
  const [sheetUserId, setSheetUserId] = useState<number | null>(null);
  const [pagination, setPagination] = useState<PaginationType>({
    current: 1,
    size: 10,
    total: 0,
  });
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 用户表单相关状态
  const {
    isOpen: isUserModalOpen,
    onOpen: onUserModalOpen,
    onClose: onUserModalClose,
  } = useDisclosure();
  const [isEdit, setIsEdit] = useState(false);
  const [userForm, setUserForm] = useState<UserForm>({
    user: "",
    pwd: "",
    status: 1,
    flow: 1000,
    dailyQuotaGB: 0,
    monthlyQuotaGB: 0,
    num: 10,
    expTime: null,
    flowResetTime: 0,
    maxConn: 0,
  });
  const [userFormLoading, setUserFormLoading] = useState(false);
  const [userFlowInput, setUserFlowInput] = useState("1000");
  const [userFlowUnit, setUserFlowUnit] = useState<TrafficUnit>("GB");
  const [quotaResetLoading, setQuotaResetLoading] = useState(false);

  const editingUser = useMemo(
    () =>
      userForm.id
        ? users.find((item) => item.id === userForm.id) || null
        : null,
    [userForm.id, users],
  );

  // 隧道权限管理相关状态
  const {
    isOpen: isTunnelModalOpen,
    onOpen: onTunnelModalOpen,
    onClose: onTunnelModalClose,
  } = useDisclosure();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [monitorPermissionUserIds, setMonitorPermissionUserIds] = useState<
    Set<number>
  >(new Set());
  const [monitorPermissionLoading, setMonitorPermissionLoading] =
    useState(false);
  const [monitorPermissionMutatingUserId, setMonitorPermissionMutatingUserId] =
    useState<number | null>(null);
  const [userTunnels, setUserTunnels] = useState<UserTunnel[]>([]);
  const [tunnelListLoading, setTunnelListLoading] = useState(false);

  // 分配新隧道权限相关状态
  const [assignLoading, setAssignLoading] = useState(false);
  const [batchTunnelSelections, setBatchTunnelSelections] = useState<
    Map<number, number | null>
  >(new Map());

  // 编辑隧道权限相关状态
  const {
    isOpen: isEditTunnelModalOpen,
    onOpen: onEditTunnelModalOpen,
    onClose: onEditTunnelModalClose,
  } = useDisclosure();
  const [editTunnelForm, setEditTunnelForm] = useState<UserTunnel | null>(null);
  const [tunnelFlowInput, setTunnelFlowInput] = useState("");
  const [tunnelFlowUnit, setTunnelFlowUnit] = useState<TrafficUnit>("GB");
  const [editTunnelLoading, setEditTunnelLoading] = useState(false);

  // 删除确认相关状态
  const {
    isOpen: isDeleteModalOpen,
    onOpen: onDeleteModalOpen,
    onClose: onDeleteModalClose,
  } = useDisclosure();
  const [userToDelete, setUserToDelete] = useState<User | null>(null);

  // 删除隧道权限确认相关状态
  const {
    isOpen: isDeleteTunnelModalOpen,
    onOpen: onDeleteTunnelModalOpen,
    onClose: onDeleteTunnelModalClose,
  } = useDisclosure();
  const [tunnelToDelete, setTunnelToDelete] = useState<UserTunnel | null>(null);

  // 重置流量确认相关状态
  const {
    isOpen: isResetFlowModalOpen,
    onOpen: onResetFlowModalOpen,
    onClose: onResetFlowModalClose,
  } = useDisclosure();
  const [userToReset, setUserToReset] = useState<User | null>(null);
  const [resetFlowLoading, setResetFlowLoading] = useState(false);

  // 重置隧道流量确认相关状态
  const {
    isOpen: isResetTunnelFlowModalOpen,
    onOpen: onResetTunnelFlowModalOpen,
    onClose: onResetTunnelFlowModalClose,
  } = useDisclosure();
  const [tunnelToReset, setTunnelToReset] = useState<UserTunnel | null>(null);
  const [resetTunnelFlowLoading, setResetTunnelFlowLoading] = useState(false);

  // 其他数据
  const [tunnels, setTunnels] = useCachedState<Tunnel[]>(PAGE, "tunnels", []);
  const [speedLimits, setSpeedLimits] = useCachedState<SpeedLimit[]>(
    PAGE,
    "speedLimits",
    [],
  );
  const [userGroups, setUserGroups] = useCachedState<UserGroup[]>(
    PAGE,
    "userGroups",
    [],
  );
  const [subscriptions, setSubscriptions] = useCachedState<SubscriptionItem[]>(
    PAGE,
    "subscriptions",
    [],
  );
  const userSubCount = useMemo(() => {
    const m = new Map<number, number>();

    for (const s of subscriptions) {
      if (s.userId) m.set(s.userId, (m.get(s.userId) ?? 0) + 1);
    }

    return m;
  }, [subscriptions]);

  const noLimitSpeedLimitIds = useMemo(() => {
    return new Set(
      speedLimits
        .filter((speedLimit) => speedLimit.name.trim() === "不限速")
        .map((speedLimit) => speedLimit.id),
    );
  }, [speedLimits]);

  const speedLimitIds = useMemo(() => {
    return new Set(speedLimits.map((speedLimit) => speedLimit.id));
  }, [speedLimits]);

  const normalizeSpeedId = (speedId?: number | null): number | null => {
    if (speedId === null || speedId === undefined) {
      return null;
    }

    if (noLimitSpeedLimitIds.has(speedId)) {
      return null;
    }

    if (speedLimits.length > 0 && !speedLimitIds.has(speedId)) {
      return null;
    }

    return speedId;
  };

  const isMissingSpeedLimit = (speedId?: number | null): boolean => {
    if (speedId === null || speedId === undefined) {
      return false;
    }

    if (speedLimits.length === 0 || noLimitSpeedLimitIds.has(speedId)) {
      return false;
    }

    return !speedLimitIds.has(speedId);
  };

  // 数据加载函数
  const loadUsers = useCallback(
    async (keywordOverride?: string) => {
      setLoading(true);
      try {
        const keyword = keywordOverride ?? searchKeyword;
        const response = await getAllUsers({
          current: pagination.current,
          size: pagination.size,
          keyword,
        });

        if (response.code === 0) {
          const nextUsers = Array.isArray(response.data)
            ? response.data.map((item) => normalizeUserItem(item))
            : [];

          setUsers(nextUsers);
          setPagination((prev) => ({ ...prev, total: nextUsers.length }));
          markPageCached(PAGE);
        } else {
          toast.error(response.msg || "获取用户列表失败");
        }
      } catch {
        toast.error("获取用户列表失败");
      } finally {
        setLoading(false);
      }
    },
    [pagination.current, pagination.size],
  );

  const loadSubscriptions = useCallback(async () => {
    try {
      const res = await getSubscriptions();

      if (res.code === 0) setSubscriptions(res.data?.items ?? []);
    } catch {}
  }, []);

  const loadTunnels = useCallback(async () => {
    try {
      const response = await getTunnelList();

      if (response.code === 0) {
        setTunnels(Array.isArray(response.data) ? response.data : []);
      }
    } catch {}
  }, []);

  const loadSpeedLimits = useCallback(async () => {
    try {
      const response = await getSpeedLimitList();

      if (response.code === 0) {
        const speedLimitList = Array.isArray(response.data)
          ? response.data.map((item) => ({
              ...item,
              uploadSpeed: item.uploadSpeed ?? item.speed ?? 0,
              downloadSpeed: item.downloadSpeed ?? item.speed ?? 0,
            }))
          : [];

        setSpeedLimits(speedLimitList);
      }
    } catch {}
  }, []);

  const loadUserGroups = useCallback(async () => {
    try {
      const response = await getUserGroupList();

      if (response.code === 0) {
        setUserGroups(Array.isArray(response.data) ? response.data : []);
      }
    } catch {}
  }, []);

  const loadMonitorPermissions = useCallback(async () => {
    setMonitorPermissionLoading(true);
    try {
      const response = await getMonitorPermissionList();

      if (response.code === 0) {
        const ids = new Set<number>();

        if (Array.isArray(response.data)) {
          response.data.forEach((item: any) => {
            const id = Number(item?.userId ?? 0);

            if (id > 0) ids.add(id);
          });
        }
        setMonitorPermissionUserIds(ids);
      } else if (response.code !== 403) {
        toast.error(response.msg || "获取监控权限失败");
      }
    } catch {
      // ignore
    } finally {
      setMonitorPermissionLoading(false);
    }
  }, []);

  const loadUserTunnels = useCallback(async (userId: number) => {
    setTunnelListLoading(true);
    try {
      const response = await getUserTunnelList({ userId });

      if (response.code === 0) {
        setUserTunnels(
          Array.isArray(response.data)
            ? response.data.map((item) => normalizeUserTunnelItem(item))
            : [],
        );
      } else {
        toast.error(response.msg || "获取隧道权限列表失败");
      }
    } catch {
      toast.error("获取隧道权限列表失败");
    } finally {
      setTunnelListLoading(false);
    }
  }, []);

  // 生命周期
  useEffect(() => {
    void loadTunnels();
    void loadSpeedLimits();
    void loadUserGroups();
    void loadMonitorPermissions();
    void loadSubscriptions();
  }, [
    loadMonitorPermissions,
    loadSpeedLimits,
    loadSubscriptions,
    loadTunnels,
    loadUserGroups,
  ]);

  useEffect(() => {
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

    searchDebounceRef.current = setTimeout(() => {
      setPagination((prev) => {
        if (prev.current === 1) {
          void loadUsers(searchKeyword);

          return prev;
        }

        return { ...prev, current: 1 };
      });
    }, USER_SEARCH_DEBOUNCE_MS);

    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
        searchDebounceRef.current = null;
      }
    };
  }, [loadUsers, searchKeyword]);

  // 用户管理操作
  const handleSearch = () => {
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
      searchDebounceRef.current = null;
    }

    setPagination((prev) => ({ ...prev, current: 1 }));
    void loadUsers(searchKeyword);
  };

  const handleAdd = () => {
    setIsEdit(false);
    setUserFlowInput("1000");
    setUserFlowUnit("GB");
    setUserForm({
      user: "",
      pwd: "",
      status: 1,
      flow: 1000,
      dailyQuotaGB: 0,
      monthlyQuotaGB: 0,
      num: 10,
      expTime: null,
      flowResetTime: 0,
      maxConn: 0,
      groupIds: [],
      subscriptionIds: [],
    });
    onUserModalOpen();
  };

  const handleEdit = async (user: User) => {
    setIsEdit(true);
    const trafficInput = trafficInputFor(user.flow, user.flowMiB);

    setUserFlowInput(trafficInput.value);
    setUserFlowUnit(trafficInput.unit);
    let currentGroupIds: number[] = [];

    try {
      const groupRes = await getUserGroups(user.id);

      if (groupRes.code === 0) {
        currentGroupIds = groupRes.data || [];
      }
    } catch {}

    setUserForm({
      id: user.id,
      name: user.name,
      user: user.user,
      pwd: "",
      status: user.status,
      flow: user.flow,
      dailyQuotaGB: user.dailyQuotaGB ?? 0,
      monthlyQuotaGB: user.monthlyQuotaGB ?? 0,
      num: user.num,
      expTime: user.expTime ? new Date(user.expTime) : null,
      flowResetTime: user.flowResetTime ?? 0,
      maxConn: user.maxConn ?? 0,
      groupIds: currentGroupIds,
      subscriptionIds: subscriptions
        .filter((s) => s.userId === user.id)
        .map((s) => s.id),
    });
    onUserModalOpen();
  };

  const handleDelete = (user: User) => {
    setUserToDelete(user);
    onDeleteModalOpen();
  };

  const handleConfirmDelete = async () => {
    if (!userToDelete) return;

    try {
      const response = await deleteUser(userToDelete.id);

      if (response.code === 0) {
        toast.success("删除成功");
        onDeleteModalClose();
        setUsers((prev) => removeItemsById(prev, [userToDelete.id]));
        setPagination((prev) => ({
          ...prev,
          total: Math.max(prev.total - 1, 0),
        }));
        setUserToDelete(null);
        if (currentUser?.id === userToDelete.id) {
          setCurrentUser(null);
          setUserTunnels([]);
        }
      } else {
        toast.error(response.msg || "删除失败");
      }
    } catch {
      toast.error("删除失败");
    }
  };

  const handleSubmitUser = async () => {
    if (!userForm.user || (!userForm.pwd && !isEdit) || !userForm.expTime) {
      toast.error("请填写完整信息");

      return;
    }

    const flowMiB = parseTrafficInput(userFlowInput, userFlowUnit);

    if (flowMiB === null) {
      toast.error("请输入有效的流量限制，最小单位为 1 MB");

      return;
    }

    setUserFormLoading(true);
    try {
      const submitData: any = {
        ...userForm,
        flow: Math.ceil(flowMiB / 1024),
        flowMiB:
          userFlowInput === "99999" && userFlowUnit === "GB" ? 0 : flowMiB,
        expTime: userForm.expTime.getTime(),
        groupIds: userForm.groupIds ?? [],
      };

      if (isEdit && !submitData.pwd) {
        delete submitData.pwd;
      }

      const response = isEdit
        ? await updateUser(submitData)
        : await createUser(submitData);

      if (response.code === 0) {
        toast.success(isEdit ? "更新成功" : "创建成功");
        onUserModalClose();
        void loadSubscriptions();
        const responseUser = normalizeUserItem((response as any).data || {});

        if (
          isEdit &&
          responseUser.id > 0 &&
          pagination.current === 1 &&
          !searchKeyword.trim()
        ) {
          setUsers((prev) => replaceItemById(prev, responseUser));
        } else if (
          !isEdit &&
          responseUser.id > 0 &&
          pagination.current === 1 &&
          !searchKeyword.trim()
        ) {
          setUsers((prev) => [responseUser, ...prev].slice(0, pagination.size));
          setPagination((prev) => ({ ...prev, total: prev.total + 1 }));
        } else {
          await loadUsers();
        }
      } else {
        toast.error(response.msg || (isEdit ? "更新失败" : "创建失败"));
      }
    } catch {
      toast.error(isEdit ? "更新失败" : "创建失败");
    } finally {
      setUserFormLoading(false);
    }
  };

  const setUserMonitorPermission = useCallback(
    async (userId: number, enabled: boolean) => {
      if (userId <= 0) return;
      if (monitorPermissionMutatingUserId === userId) return;

      const prevEnabled = monitorPermissionUserIds.has(userId);

      if (prevEnabled === enabled) return;

      setMonitorPermissionMutatingUserId(userId);

      // Optimistic update for better UX.
      setMonitorPermissionUserIds((prev) => {
        const next = new Set(prev);

        if (enabled) {
          next.add(userId);
        } else {
          next.delete(userId);
        }

        return next;
      });

      try {
        const response = enabled
          ? await assignMonitorPermission(userId)
          : await removeMonitorPermission(userId);

        if (response.code === 0) {
          toast.success(enabled ? "已授权监控" : "已撤销监控");

          return;
        }

        toast.error(response.msg || "操作失败");
        throw new Error("mutation failed");
      } catch {
        // Revert optimistic update on failure.
        setMonitorPermissionUserIds((prev) => {
          const next = new Set(prev);

          if (prevEnabled) {
            next.add(userId);
          } else {
            next.delete(userId);
          }

          return next;
        });
      } finally {
        setMonitorPermissionMutatingUserId(null);
      }
    },
    [monitorPermissionMutatingUserId, monitorPermissionUserIds],
  );

  // 隧道权限管理操作
  const handleManageTunnels = (user: User) => {
    setCurrentUser(user);
    setBatchTunnelSelections(new Map());
    onTunnelModalOpen();
    loadUserTunnels(user.id);
  };

  const handleBatchAssignTunnel = async () => {
    if (batchTunnelSelections.size === 0 || !currentUser) {
      toast.error("请选择至少一个隧道");

      return;
    }

    setAssignLoading(true);
    try {
      let speedLimitAutoCleared = false;
      const tunnelsToAssign: TunnelAssignItem[] = Array.from(
        batchTunnelSelections.entries(),
      ).map(([tunnelId, speedId]) => ({
        tunnelId,
        speedId: (() => {
          const cleared = normalizeSpeedId(speedId);

          if (isMissingSpeedLimit(speedId)) {
            speedLimitAutoCleared = true;
          }

          return cleared;
        })(),
      }));

      const response = await batchAssignUserTunnel({
        userId: currentUser.id,
        tunnels: tunnelsToAssign,
      });

      if (response.code === 0) {
        if (speedLimitAutoCleared) {
          toast("所选限速规则不存在，已自动清除为不限速", {
            icon: "⚠️",
            duration: 5000,
          });
        }
        toast.success(response.msg || "分配成功");
        setBatchTunnelSelections(new Map());
        await loadUserTunnels(currentUser.id);
      } else {
        toast.error(response.msg || "分配失败");
      }
    } catch {
      toast.error("分配失败");
    } finally {
      setAssignLoading(false);
    }
  };

  const handleEditTunnel = (userTunnel: UserTunnel) => {
    const trafficInput = trafficInputFor(userTunnel.flow, userTunnel.flowMiB);

    setTunnelFlowInput(trafficInput.value);
    setTunnelFlowUnit(trafficInput.unit);
    setEditTunnelForm({
      ...userTunnel,
      speedId: normalizeSpeedId(userTunnel.speedId),
      expTime: userTunnel.expTime,
    });
    onEditTunnelModalOpen();
  };

  const handleUpdateTunnel = async () => {
    if (!editTunnelForm) return;

    const flowMiB = parseTrafficInput(tunnelFlowInput, tunnelFlowUnit);

    if (flowMiB === null) {
      toast.error("请输入有效的流量限制，最小单位为 1 MB");

      return;
    }
    const flow = Math.ceil(flowMiB / 1024);
    const storedFlowMiB =
      tunnelFlowInput === "99999" && tunnelFlowUnit === "GB" ? 0 : flowMiB;

    setEditTunnelLoading(true);
    try {
      const speedLimitAutoCleared = isMissingSpeedLimit(editTunnelForm.speedId);
      const response = await updateUserTunnel({
        id: editTunnelForm.id,
        flow,
        flowMiB: storedFlowMiB,
        num: editTunnelForm.num,
        expTime: editTunnelForm.expTime,
        flowResetTime: editTunnelForm.flowResetTime,
        speedId: normalizeSpeedId(editTunnelForm.speedId),
        status: editTunnelForm.status,
      });

      if (response.code === 0) {
        if (speedLimitAutoCleared) {
          toast("所选限速规则不存在，已自动清除为不限速", {
            icon: "⚠️",
            duration: 5000,
          });
        }
        toast.success("更新成功");
        onEditTunnelModalClose();
        if (currentUser) {
          const nextTunnel = normalizeUserTunnelItem({
            ...editTunnelForm,
            flow,
            flowMiB: storedFlowMiB,
            speedId: normalizeSpeedId(editTunnelForm.speedId),
            speedLimitName:
              normalizeSpeedId(editTunnelForm.speedId) !== null
                ? speedLimits.find(
                    (speedLimit) =>
                      speedLimit.id ===
                      normalizeSpeedId(editTunnelForm.speedId),
                  )?.name
                : undefined,
          });

          setUserTunnels((prev) => replaceItemById(prev, nextTunnel));
        }
      } else {
        toast.error(response.msg || "更新失败");
      }
    } catch {
      toast.error("更新失败");
    } finally {
      setEditTunnelLoading(false);
    }
  };

  const handleRemoveTunnel = (userTunnel: UserTunnel) => {
    setTunnelToDelete(userTunnel);
    onDeleteTunnelModalOpen();
  };

  const handleConfirmRemoveTunnel = async () => {
    if (!tunnelToDelete) return;

    try {
      const response = await removeUserTunnel({ id: tunnelToDelete.id });

      if (response.code === 0) {
        toast.success("删除成功");
        if (currentUser) {
          setUserTunnels((prev) => removeItemsById(prev, [tunnelToDelete.id]));
        }
        onDeleteTunnelModalClose();
        setTunnelToDelete(null);
      } else {
        toast.error(response.msg || "删除失败");
      }
    } catch {
      toast.error("删除失败");
    }
  };

  // 重置流量相关函数
  const handleResetFlow = (user: User) => {
    setUserToReset(user);
    onResetFlowModalOpen();
  };

  const handleConfirmResetFlow = async () => {
    if (!userToReset) return;

    setResetFlowLoading(true);
    try {
      const response = await resetUserFlow({
        id: userToReset.id,
        type: 1, // 1表示重置用户流量
      });

      if (response.code === 0) {
        toast.success("流量重置成功");
        onResetFlowModalClose();
        const targetUserId = userToReset.id;

        setUsers((prev) =>
          prev.map((user) =>
            user.id === targetUserId
              ? { ...user, inFlow: 0, outFlow: 0 }
              : user,
          ),
        );
        setUserToReset(null);
      } else {
        toast.error(response.msg || "重置失败");
      }
    } catch {
      toast.error("重置失败");
    } finally {
      setResetFlowLoading(false);
    }
  };

  const handleQuotaReset = async (scope: "daily" | "monthly" | "all") => {
    const userId = userForm.id;

    if (!userId) {
      return;
    }

    setQuotaResetLoading(true);
    try {
      const response = await resetUserQuota({ userId, scope });

      if (response.code === 0) {
        toast.success("用户配额已重置");
        await loadUsers(searchKeyword);
      } else {
        toast.error(response.msg || "重置用户配额失败");
      }
    } catch {
      toast.error("重置用户配额失败");
    } finally {
      setQuotaResetLoading(false);
    }
  };

  // 隧道流量重置相关函数
  const handleResetTunnelFlow = (userTunnel: UserTunnel) => {
    setTunnelToReset(userTunnel);
    onResetTunnelFlowModalOpen();
  };

  const handleConfirmResetTunnelFlow = async () => {
    if (!tunnelToReset) return;

    setResetTunnelFlowLoading(true);
    try {
      const response = await resetUserFlow({
        id: tunnelToReset.id,
        type: 2, // 2表示重置隧道流量
      });

      if (response.code === 0) {
        toast.success("隧道流量重置成功");
        onResetTunnelFlowModalClose();
        const targetTunnelId = tunnelToReset.id;

        setUserTunnels((prev) =>
          prev.map((userTunnel) =>
            userTunnel.id === targetTunnelId
              ? { ...userTunnel, inFlow: 0, outFlow: 0 }
              : userTunnel,
          ),
        );
        setTunnelToReset(null);
      } else {
        toast.error(response.msg || "重置失败");
      }
    } catch {
      toast.error("重置失败");
    } finally {
      setResetTunnelFlowLoading(false);
    }
  };

  const editAvailableSpeedLimits = speedLimits.filter(
    (speedLimit) => !noLimitSpeedLimitIds.has(speedLimit.id),
  );

  const getSpeedLimitsForTunnel = (_tunnelId: number) => {
    return speedLimits.filter(
      (speedLimit) => !noLimitSpeedLimitIds.has(speedLimit.id),
    );
  };

  const editTunnelSelectedSpeedId = normalizeSpeedId(editTunnelForm?.speedId);

  const toggleTunnelSelection = (tunnelId: number) => {
    setBatchTunnelSelections((prev) => {
      const newMap = new Map(prev);

      if (newMap.has(tunnelId)) {
        newMap.delete(tunnelId);
      } else {
        newMap.set(tunnelId, null);
      }

      return newMap;
    });
  };

  const updateTunnelSpeedLimit = (tunnelId: number, speedId: number | null) => {
    setBatchTunnelSelections((prev) => {
      const newMap = new Map(prev);

      newMap.set(tunnelId, speedId);

      return newMap;
    });
  };

  const isTunnelAssigned = (tunnelId: number) => {
    return userTunnels.some((ut) => ut.tunnelId === tunnelId);
  };

  const sheetUser = users.find((u) => u.id === sheetUserId) ?? null;

  const [userPage, setUserPage] = useState(1);
  const [userSort, setUserSort] = useState<"name" | "usage" | null>(null);
  const [userDir, setUserDir] = useState<"asc" | "desc">("asc");

  const toggleUserSort = (key: "name" | "usage") => {
    setUserDir(userSort === key && userDir === "asc" ? "desc" : "asc");
    setUserSort(key);
  };

  const sortedUsers = useMemo(() => {
    if (!userSort) return users;
    const list = [...users].sort((a, b) =>
      userSort === "name"
        ? (a.name || a.user).localeCompare(b.name || b.user, "zh-CN")
        : calculateUserTotalUsedFlow(a) - calculateUserTotalUsedFlow(b),
    );

    return userDir === "asc" ? list : list.reverse();
  }, [userSort, userDir, users]);

  const USER_PAGE_SIZE = 20;
  const pagedUsers = sortedUsers.slice(
    (userPage - 1) * USER_PAGE_SIZE,
    userPage * USER_PAGE_SIZE,
  );

  return (
    <PageShell embedded={embedded}>
      {!embedded && (
        <PageHeader
          description="面板账号，分配隧道权限、流量和到期时间"
          primary={{ key: "add", label: "新建用户", onClick: handleAdd }}
          title="用户"
        />
      )}
      <PageToolbar
        more={[{ key: "refresh", label: "刷新列表", onClick: handleSearch }]}
        placeholder="搜索用户名"
        primary={
          embedded
            ? { key: "add", label: "新建用户", onClick: handleAdd }
            : undefined
        }
        search={searchKeyword}
        onSearch={setSearchKeyword}
      />

      {loading && !pageCached(PAGE) ? (
        <ListPageSkeleton />
      ) : users.length === 0 ? (
        searchKeyword.trim() ? (
          <EmptyHint text="没有匹配的用户" />
        ) : (
          <EmptyHint
            action={{ key: "add", label: "新建用户", onClick: handleAdd }}
            text="还没有用户"
          />
        )
      ) : (
        <>
          <ListGroup
            columns="minmax(0,1fr) minmax(0,1.15fr) 240px"
            head={[
              <SortHeader
                key="name"
                active={userSort === "name"}
                dir={userDir}
                label="用户"
                onToggle={() => toggleUserSort("name")}
              />,
              "详情",
              <SortHeader
                key="usage"
                active={userSort === "usage"}
                dir={userDir}
                label="用量"
                onToggle={() => toggleUserSort("usage")}
              />,
            ]}
          >
            {pagedUsers.map((user) => {
              const state = getUserRowState(user);
              const expStatus = user.expTime
                ? getExpireStatus(user.expTime)
                : null;
              const meta = [
                `已用 ${formatFlow(calculateUserTotalUsedFlow(user))} / ${formatFlowLimit(user.flow, user.flowMiB)}`,
                `规则 ${user.num}`,
                ...(userSubCount.get(user.id)
                  ? [`订阅 ${userSubCount.get(user.id)}`]
                  : []),
                user.expTime ? `到期 ${formatDate(user.expTime)}` : "永久",
              ];

              return (
                <ListRow
                  key={user.id}
                  badges={
                    <>
                      {user.status !== 1 && (
                        <Badge className="shrink-0" variant="secondary">
                          已禁用
                        </Badge>
                      )}
                      {expStatus && expStatus.color !== "success" && (
                        <Badge
                          className="shrink-0"
                          variant={badgeTone(expStatus.color)}
                        >
                          {expStatus.text}
                        </Badge>
                      )}
                      {user.disabledByQuota ? (
                        <Badge className="shrink-0" variant="destructive">
                          配额超额
                        </Badge>
                      ) : null}
                    </>
                  }
                  cells={[
                    <div key="who" className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-medium text-foreground">
                          {user.name || user.user}
                        </span>
                        {user.status !== 1 && (
                          <Badge className="shrink-0" variant="outline">
                            已禁用
                          </Badge>
                        )}
                        {user.disabledByQuota ? (
                          <Badge className="shrink-0" variant="destructive">
                            配额超额
                          </Badge>
                        ) : null}
                      </div>
                      {user.name && user.name !== user.user && (
                        <div className="truncate text-xs text-muted-foreground">
                          {user.user}
                        </div>
                      )}
                    </div>,
                    <div
                      key="meta"
                      className="min-w-0 truncate text-xs text-muted-foreground tabular"
                    >
                      {meta.join(" · ")}
                    </div>,
                    <div key="usage" className="min-w-0">
                      <UsageBar user={user} />
                    </div>,
                  ]}
                  footer={<UsageBar user={user} />}
                  meta={meta.join(" · ")}
                  status={state.status}
                  statusTitle={state.text}
                  title={user.name || user.user}
                  onClick={() => setSheetUserId(user.id)}
                />
              );
            })}
          </ListGroup>

          <TablePagination
            page={userPage}
            pageSize={USER_PAGE_SIZE}
            total={sortedUsers.length}
            unit="个用户"
            onPageChange={setUserPage}
          />
        </>
      )}

      {(() => {
        const user = sheetUser;
        const usedFlow = user ? calculateUserTotalUsedFlow(user) : 0;
        const unlimited =
          !user || user.flow <= 0 || (user.flow === 99999 && !user.flowMiB);
        const flowPercent =
          user && !unlimited
            ? Math.min(
                (usedFlow / flowLimitBytes(user.flow, user.flowMiB)) * 100,
                100,
              )
            : 0;
        const hasQuota =
          !!user &&
          ((user.dailyQuotaGB ?? 0) > 0 ||
            (user.monthlyQuotaGB ?? 0) > 0 ||
            (user.disabledByQuota ?? 0) > 0);
        const rows: Array<[string, React.ReactNode]> = user
          ? [
              ["账号", user.user],
              ...(hasQuota
                ? ([
                    [
                      "每日配额",
                      `${formatFlow(Number(user.dailyUsedBytes ?? 0))} / ${formatQuotaLimit(user.dailyQuotaGB)}`,
                    ],
                    [
                      "每月配额",
                      `${formatFlow(Number(user.monthlyUsedBytes ?? 0))} / ${formatQuotaLimit(user.monthlyQuotaGB)}`,
                    ],
                  ] as Array<[string, React.ReactNode]>)
                : []),
              ["规则数量", user.num],
              [
                "流量重置",
                user.flowResetTime === 0
                  ? "不重置"
                  : `每月${user.flowResetTime}号`,
              ],
              [
                "到期时间",
                user.expTime ? formatDate(user.expTime, true) : "永久",
              ],
            ]
          : [];

        return (
          <ActionsDialog
            actions={
              user
                ? [
                    {
                      key: "edit",
                      label: "编辑",
                      color: "primary" as const,
                      onClick: () => void handleEdit(user),
                    },
                    {
                      key: "perm",
                      label: "权限",
                      onClick: () => handleManageTunnels(user),
                    },
                    {
                      key: "reset",
                      label: "重置流量",
                      onClick: () => handleResetFlow(user),
                    },
                    {
                      key: "delete",
                      label: "删除",
                      color: "danger" as const,
                      onClick: () => handleDelete(user),
                    },
                  ]
                : []
            }
            open={Boolean(user)}
            subtitle={user && getUserRowState(user).text}
            title={user ? user.name || user.user : ""}
            onClose={() => setSheetUserId(null)}
          >
            {user && (
              <div className="space-y-2 text-sm">
                <div className="space-y-1">
                  <div className="flex justify-between gap-3">
                    <span className="shrink-0 text-muted-foreground">流量</span>
                    <span className="font-mono text-xs leading-5">
                      {formatFlow(usedFlow)} /{" "}
                      {formatFlowLimit(user.flow, user.flowMiB)}
                    </span>
                  </div>
                  {!unlimited && (
                    <Progress
                      aria-label={`流量使用 ${flowPercent.toFixed(1)}%`}
                      color={
                        flowPercent > 90
                          ? "danger"
                          : flowPercent > 70
                            ? "warning"
                            : "primary"
                      }
                      size="sm"
                      value={flowPercent}
                    />
                  )}
                </div>
                {rows.map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3">
                    <span className="shrink-0 text-muted-foreground">{k}</span>
                    <span className="min-w-0 break-all text-right font-mono text-xs leading-5">
                      {v}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </ActionsDialog>
        );
      })()}

      {/* 用户表单模态框 */}
      <Modal
        backdrop="blur"
        classNames={{
          base: "!w-[calc(100%-32px)] !mx-auto sm:!w-full rounded-xl",
        }}
        open={isUserModalOpen}
        placement="center"
        scrollBehavior="inside"
        size="xl"
        onClose={onUserModalClose}
      >
        <ModalContent>
          <ModalHeader>{isEdit ? "编辑用户" : "新建用户"}</ModalHeader>
          <ModalBody>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="user-name">
                  用户名<span className="ml-1 text-destructive">*</span>
                </Label>
                <Input
                  required
                  id="user-name"
                  value={userForm.user}
                  onChange={(e) =>
                    setUserForm((prev) => ({ ...prev, user: e.target.value }))
                  }
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="user-password">
                  密码
                  {!isEdit ? (
                    <span className="ml-1 text-destructive">*</span>
                  ) : null}
                </Label>
                <Input
                  id="user-password"
                  placeholder={isEdit ? "留空则不修改密码" : "请输入密码"}
                  required={!isEdit}
                  type="password"
                  value={userForm.pwd}
                  onChange={(e) =>
                    setUserForm((prev) => ({ ...prev, pwd: e.target.value }))
                  }
                />
              </div>
              <TrafficLimitField
                isRequired
                label="流量限制"
                unit={userFlowUnit}
                value={userFlowInput}
                onChange={(value, unit) => {
                  setUserFlowInput(value);
                  setUserFlowUnit(unit);
                }}
              />
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="user-max-conn">最大连接数</Label>
                <Input
                  id="user-max-conn"
                  min="0"
                  placeholder="0 或空表示不限制"
                  type="number"
                  value={
                    userForm.maxConn === 0 ? "" : String(userForm.maxConn || "")
                  }
                  onChange={(e) => {
                    const value = Math.max(Number(e.target.value) || 0, 0);

                    setUserForm((prev) => ({ ...prev, maxConn: value }));
                  }}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="user-rule-count">
                  规则数量<span className="ml-1 text-destructive">*</span>
                </Label>
                <Input
                  required
                  id="user-rule-count"
                  max="99999"
                  min="1"
                  type="number"
                  value={userForm.num.toString()}
                  onChange={(e) => {
                    const value = Math.min(
                      Math.max(Number(e.target.value) || 0, 1),
                      99999,
                    );

                    setUserForm((prev) => ({ ...prev, num: value }));
                  }}
                />
              </div>
              <SelectField
                label="流量重置日期"
                options={[
                  { value: "0", label: "不重置" },
                  ...Array.from({ length: 31 }, (_, i) => ({
                    value: String(i + 1),
                    label: `每月${i + 1}号（0点重置）`,
                  })),
                ]}
                value={userForm.flowResetTime.toString()}
                onValueChange={(value) =>
                  setUserForm((prev) => ({
                    ...prev,
                    flowResetTime: Number(value),
                  }))
                }
              />
              <DatePicker
                isRequired
                showMonthAndYearPickers
                label="过期时间"
                value={
                  userForm.expTime
                    ? (parseDate(
                        userForm.expTime.toISOString().split("T")[0],
                      ) as any)
                    : null
                }
                onChange={(date) => {
                  if (date) {
                    const jsDate = new Date(
                      date.year,
                      date.month - 1,
                      date.day,
                      23,
                      59,
                      59,
                    );

                    setUserForm((prev) => ({ ...prev, expTime: jsDate }));
                  } else {
                    setUserForm((prev) => ({ ...prev, expTime: null }));
                  }
                }}
              />
            </div>

            {isEdit &&
              editingUser &&
              ((editingUser.dailyQuotaGB ?? 0) > 0 ||
                (editingUser.monthlyQuotaGB ?? 0) > 0 ||
                (editingUser.disabledByQuota ?? 0) > 0) && (
                <div className="space-y-3 rounded-xl border border-border bg-muted/60 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">
                        当前配额状态
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        配额超额后会自动暂停该用户的转发，重置后可恢复
                      </p>
                    </div>
                    {editingUser.disabledByQuota ? (
                      <Badge variant="destructive">配额已触发禁用</Badge>
                    ) : (
                      <Badge variant="success">配额正常</Badge>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div className="rounded-lg bg-background p-3">
                      <div className="text-xs text-muted-foreground">
                        每日用量
                      </div>
                      <div className="mt-1 text-sm font-semibold text-foreground">
                        {formatFlow(Number(editingUser.dailyUsedBytes ?? 0))} /{" "}
                        {formatQuotaLimit(editingUser.dailyQuotaGB)}
                      </div>
                    </div>
                    <div className="rounded-lg bg-background p-3">
                      <div className="text-xs text-muted-foreground">
                        每月用量
                      </div>
                      <div className="mt-1 text-sm font-semibold text-foreground">
                        {formatFlow(Number(editingUser.monthlyUsedBytes ?? 0))}{" "}
                        / {formatQuotaLimit(editingUser.monthlyQuotaGB)}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      loading={quotaResetLoading}
                      size="sm"
                      variant="secondary"
                      onClick={() => handleQuotaReset("daily")}
                    >
                      重置每日配额
                    </Button>
                    <Button
                      loading={quotaResetLoading}
                      size="sm"
                      variant="secondary"
                      onClick={() => handleQuotaReset("monthly")}
                    >
                      重置每月配额
                    </Button>
                    <Button
                      loading={quotaResetLoading}
                      size="sm"
                      variant="secondary"
                      onClick={() => handleQuotaReset("all")}
                    >
                      全部重置并恢复
                    </Button>
                  </div>
                </div>
              )}

            <RadioGroup
              label="状态"
              orientation="horizontal"
              value={userForm.status.toString()}
              onValueChange={(value: string) =>
                setUserForm((prev) => ({ ...prev, status: Number(value) }))
              }
            >
              <Radio value="1">正常</Radio>
              <Radio value="0">禁用</Radio>
            </RadioGroup>

            {userGroups.length > 0 && (
              <MultiSelectField
                label="用户分组（可选）"
                options={userGroups.map((g) => ({
                  value: g.id.toString(),
                  label: g.name,
                }))}
                placeholder="选择要加入的分组"
                values={(userForm.groupIds ?? []).map(String)}
                onValuesChange={(next) =>
                  setUserForm((prev) => ({
                    ...prev,
                    groupIds: next.map(Number),
                  }))
                }
              />
            )}

            <SubscriptionPicker
              selected={userForm.subscriptionIds ?? []}
              subscriptions={subscriptions}
              userId={userForm.id}
              onChange={(ids) =>
                setUserForm((prev) => ({ ...prev, subscriptionIds: ids }))
              }
            />
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" onClick={onUserModalClose}>
              取消
            </Button>
            <Button loading={userFormLoading} onClick={handleSubmitUser}>
              {isEdit ? "保存" : "创建"}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* 隧道权限管理模态框 */}
      <Modal
        backdrop="blur"
        classNames={{
          base: "max-w-[95vw] sm:max-w-4xl",
        }}
        isDismissable={false}
        open={isTunnelModalOpen}
        placement="center"
        scrollBehavior="inside"
        size="2xl"
        onClose={onTunnelModalClose}
      >
        <ModalContent>
          <ModalHeader closable>
            用户 {currentUser?.user} 的权限管理
          </ModalHeader>
          <ModalBody>
            <div className="space-y-6">
              {/* 监控权限部分 */}
              <div>
                <h3 className="text-lg font-semibold mb-4">监控权限</h3>
                <div className="flex items-center justify-between gap-4 bg-muted dark:bg-muted p-4 rounded-lg border border-border dark:border-border/30">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-foreground">
                      允许访问监控功能
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      授予后，该用户可以访问监控页面并管理服务监控（TCP/ICMP）。
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {monitorPermissionLoading ? (
                      <Loader2 className="size-4 animate-spin text-muted-foreground" />
                    ) : null}
                    <Switch
                      checked={
                        currentUser
                          ? monitorPermissionUserIds.has(currentUser.id)
                          : false
                      }
                      disabled={
                        !currentUser ||
                        monitorPermissionLoading ||
                        monitorPermissionMutatingUserId === currentUser.id
                      }
                      onCheckedChange={(v) =>
                        currentUser &&
                        void setUserMonitorPermission(currentUser.id, v)
                      }
                    />
                  </div>
                </div>
              </div>

              {/* 分配新权限部分 */}
              <div>
                <h3 className="text-lg font-semibold mb-4">分配新权限</h3>
                <div className="space-y-4">
                  <div className="text-sm text-muted-foreground bg-muted dark:bg-muted p-3 rounded-lg border border-border dark:border-border/30">
                    流量限制、规则数量、到期时间、流量重置时间将自动继承用户设置
                  </div>

                  <div className="grid gap-2 max-h-72 overflow-y-auto pr-1 scrollbar-hide">
                    {tunnels.map((tunnel) => {
                      const isAssigned = isTunnelAssigned(tunnel.id);
                      const isSelected = batchTunnelSelections.has(tunnel.id);
                      const tunnelSpeedLimits = getSpeedLimitsForTunnel(
                        tunnel.id,
                      );

                      return (
                        <div
                          key={tunnel.id}
                          aria-disabled={isAssigned}
                          className={`
                            px-4 py-3 rounded-lg border transition-all duration-200 cursor-pointer
                            ${
                              isAssigned
                                ? "bg-muted/50 dark:bg-muted/50 border-border/50 dark:border-border/20 opacity-60 cursor-not-allowed"
                                : isSelected
                                  ? "bg-primary-soft dark:bg-primary-900/20 border-primary-300 dark:border-primary-500/50 shadow-sm"
                                  : "bg-white dark:bg-muted border-border dark:border-border/30 hover:border-primary-200 dark:hover:border-primary-500/30 hover:shadow-sm"
                            }
                          `}
                          role="button"
                          tabIndex={isAssigned ? -1 : 0}
                          onClick={() =>
                            !isAssigned && toggleTunnelSelection(tunnel.id)
                          }
                          onKeyDown={(event) => {
                            if (isAssigned) {
                              return;
                            }

                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              toggleTunnelSelection(tunnel.id);
                            }
                          }}
                        >
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <Checkbox
                                checked={isSelected}
                                disabled={isAssigned}
                                onCheckedChange={checkboxHandler(() =>
                                  toggleTunnelSelection(tunnel.id),
                                )}
                                onClick={(event) => event.stopPropagation()}
                                onKeyDown={(event) => event.stopPropagation()}
                              />
                              <span
                                className={`font-medium truncate ${isAssigned ? "text-muted-foreground" : "text-foreground dark:text-muted-foreground"}`}
                              >
                                {tunnel.name}
                              </span>
                              {isAssigned && (
                                <Badge className="shrink-0" variant="outline">
                                  已分配
                                </Badge>
                              )}
                            </div>

                            {isSelected && !isAssigned && (
                              <div>
                                <SelectField
                                  className="w-36 min-h-10 h-10"
                                  options={tunnelSpeedLimits.map((sl) => ({
                                    value: sl.id.toString(),
                                    label: sl.name,
                                  }))}
                                  placeholder="不限速"
                                  size="sm"
                                  value={
                                    batchTunnelSelections.get(tunnel.id) !==
                                      null &&
                                    batchTunnelSelections.get(tunnel.id) !==
                                      undefined
                                      ? String(
                                          batchTunnelSelections.get(tunnel.id),
                                        )
                                      : ""
                                  }
                                  onClick={(e) => e.stopPropagation()}
                                  onValueChange={(selectedKey) =>
                                    updateTunnelSpeedLimit(
                                      tunnel.id,
                                      selectedKey ? Number(selectedKey) : null,
                                    )
                                  }
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {tunnels.length === 0 && (
                      <div className="p-8 text-center text-muted-foreground bg-muted dark:bg-muted/50 rounded-lg border border-dashed border-border dark:border-border/30">
                        暂无可用隧道
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      className="w-full sm:w-auto"
                      disabled={
                        batchTunnelSelections.size === 0 || assignLoading
                      }
                      onClick={handleBatchAssignTunnel}
                    >
                      分配权限
                    </Button>
                    {batchTunnelSelections.size > 0 && (
                      <Badge variant="default">
                        已选 {batchTunnelSelections.size} 个隧道
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              {/* 已有权限部分 */}
              <div>
                <h3 className="text-lg font-semibold mb-4">已有权限</h3>
                {tunnelListLoading ? (
                  <div className="flex justify-center py-6">
                    <Loader2 className="size-4 animate-spin text-muted-foreground" />
                  </div>
                ) : userTunnels.length === 0 ? (
                  <EmptyHint text="暂无隧道权限" />
                ) : (
                  <div className="space-y-2">
                    {userTunnels.map((userTunnel) => (
                      <div
                        key={userTunnel.id}
                        className="rounded-xl border border-hairline bg-raised px-3 py-2.5"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`h-2 w-2 shrink-0 rounded-full ${
                              userTunnel.status === 1
                                ? "bg-success"
                                : "bg-muted"
                            }`}
                            title={userTunnel.status === 1 ? "正常" : "禁用"}
                          />
                          <span className="truncate font-medium">
                            {userTunnel.tunnelName}
                          </span>
                          {userTunnel.status !== 1 && (
                            <Badge className="shrink-0" variant="secondary">
                              已禁用
                            </Badge>
                          )}
                          {userTunnel.speedLimitName && (
                            <Badge className="shrink-0" variant="secondary">
                              {userTunnel.speedLimitName}
                            </Badge>
                          )}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {[
                            `已用 ${formatFlow(calculateTunnelUsedFlow(userTunnel))} / ${formatFlowLimit(userTunnel.flow, userTunnel.flowMiB)}`,
                            `规则 ${userTunnel.num}`,
                            userTunnel.flowResetTime === 0
                              ? "不重置"
                              : `每月${userTunnel.flowResetTime}号重置`,
                            userTunnel.expTime
                              ? `到期 ${formatDate(userTunnel.expTime)}`
                              : "永久",
                          ].join(" · ")}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handleEditTunnel(userTunnel)}
                          >
                            编辑
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handleResetTunnelFlow(userTunnel)}
                          >
                            重置流量
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handleRemoveTunnel(userTunnel)}
                          >
                            删除
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </ModalBody>
        </ModalContent>
      </Modal>

      {/* 编辑隧道权限模态框 */}
      <Modal
        backdrop="blur"
        classNames={{
          base: "!w-[calc(100%-32px)] !mx-auto sm:!w-full rounded-xl",
        }}
        isDismissable={false}
        open={isEditTunnelModalOpen}
        placement="center"
        scrollBehavior="inside"
        size="2xl"
        onClose={onEditTunnelModalClose}
      >
        <ModalContent>
          <ModalHeader>编辑隧道权限 - {editTunnelForm?.tunnelName}</ModalHeader>
          <ModalBody>
            {editTunnelForm && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <TrafficLimitField
                    isRequired
                    label="流量限制"
                    unit={tunnelFlowUnit}
                    value={tunnelFlowInput}
                    onChange={(value, unit) => {
                      setTunnelFlowInput(value);
                      setTunnelFlowUnit(unit);
                    }}
                  />

                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="edit-tunnel-rule-count">规则数量</Label>
                    <Input
                      id="edit-tunnel-rule-count"
                      max="99999"
                      min="1"
                      type="number"
                      value={editTunnelForm.num.toString()}
                      onChange={(e) => {
                        const value = Math.min(
                          Math.max(Number(e.target.value) || 0, 1),
                          99999,
                        );

                        setEditTunnelForm((prev) =>
                          prev ? { ...prev, num: value } : null,
                        );
                      }}
                    />
                  </div>

                  <SelectField
                    label="限速规则"
                    options={editAvailableSpeedLimits.map((speedLimit) => ({
                      value: speedLimit.id.toString(),
                      label: speedLimit.name,
                    }))}
                    placeholder="不限速"
                    value={
                      editTunnelSelectedSpeedId !== null
                        ? editTunnelSelectedSpeedId.toString()
                        : ""
                    }
                    onValueChange={(selectedKey) =>
                      setEditTunnelForm((prev) =>
                        prev
                          ? {
                              ...prev,
                              speedId: selectedKey ? Number(selectedKey) : null,
                            }
                          : null,
                      )
                    }
                  />

                  <SelectField
                    label="流量重置日期"
                    options={[
                      { value: "0", label: "不重置" },
                      ...Array.from({ length: 31 }, (_, i) => ({
                        value: String(i + 1),
                        label: `每月${i + 1}号（0点重置）`,
                      })),
                    ]}
                    value={editTunnelForm.flowResetTime.toString()}
                    onValueChange={(value) =>
                      setEditTunnelForm((prev) =>
                        prev ? { ...prev, flowResetTime: Number(value) } : null,
                      )
                    }
                  />

                  <DatePicker
                    isRequired
                    showMonthAndYearPickers
                    label="到期时间"
                    value={
                      editTunnelForm.expTime
                        ? (parseDate(
                            new Date(editTunnelForm.expTime)
                              .toISOString()
                              .split("T")[0],
                          ) as any)
                        : null
                    }
                    onChange={(date) => {
                      if (date) {
                        const jsDate = new Date(
                          date.year,
                          date.month - 1,
                          date.day,
                          23,
                          59,
                          59,
                        );

                        setEditTunnelForm((prev) =>
                          prev ? { ...prev, expTime: jsDate.getTime() } : null,
                        );
                      } else {
                        setEditTunnelForm((prev) =>
                          prev ? { ...prev, expTime: Date.now() } : null,
                        );
                      }
                    }}
                  />
                </div>

                <RadioGroup
                  label="状态"
                  orientation="horizontal"
                  value={editTunnelForm.status.toString()}
                  onValueChange={(value: string) =>
                    setEditTunnelForm((prev) =>
                      prev ? { ...prev, status: Number(value) } : null,
                    )
                  }
                >
                  <Radio value="1">正常</Radio>
                  <Radio value="0">禁用</Radio>
                </RadioGroup>
              </>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" onClick={onEditTunnelModalClose}>
              取消
            </Button>
            <Button loading={editTunnelLoading} onClick={handleUpdateTunnel}>
              保存
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* 删除确认对话框 */}
      <Modal
        backdrop="blur"
        classNames={{
          base: "!w-[calc(100%-32px)] !mx-auto sm:!w-full rounded-xl",
        }}
        open={isDeleteModalOpen}
        placement="center"
        scrollBehavior="inside"
        size="2xl"
        onClose={onDeleteModalClose}
      >
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">
            确认删除用户
          </ModalHeader>
          <ModalBody>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center">
                <DeleteIcon className="w-6 h-6 text-destructive" />
              </div>
              <div className="flex-1">
                <p className="text-foreground">
                  确定要删除用户{" "}
                  <span className="font-semibold text-destructive">
                    &quot;{userToDelete?.user}&quot;
                  </span>{" "}
                  吗？
                </p>
                <p className="text-small text-muted-foreground mt-1">
                  此操作不可撤销，用户的所有数据将被永久删除。
                </p>
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" onClick={onDeleteModalClose}>
              取消
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete}>
              删除
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* 删除隧道权限确认对话框 */}
      <Modal
        backdrop="blur"
        classNames={{
          base: "!w-[calc(100%-32px)] !mx-auto sm:!w-full rounded-xl",
        }}
        open={isDeleteTunnelModalOpen}
        placement="center"
        scrollBehavior="inside"
        size="2xl"
        onClose={onDeleteTunnelModalClose}
      >
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">
            确认删除隧道权限
          </ModalHeader>
          <ModalBody>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center">
                <DeleteIcon className="w-6 h-6 text-destructive" />
              </div>
              <div className="flex-1">
                <p className="text-foreground">
                  确定要删除用户{" "}
                  <span className="font-semibold">{currentUser?.user}</span>{" "}
                  对隧道{" "}
                  <span className="font-semibold text-destructive">
                    &quot;{tunnelToDelete?.tunnelName}&quot;
                  </span>{" "}
                  的权限吗？
                </p>
                <p className="text-small text-muted-foreground mt-1">
                  删除后该用户将无法使用此隧道创建规则，此操作不可撤销。{" "}
                </p>
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" onClick={onDeleteTunnelModalClose}>
              取消
            </Button>
            <Button variant="destructive" onClick={handleConfirmRemoveTunnel}>
              删除
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* 重置流量确认对话框 */}
      <Modal
        backdrop="blur"
        classNames={{
          base: "!w-[calc(100%-32px)] !mx-auto sm:!w-full rounded-xl",
        }}
        open={isResetFlowModalOpen}
        placement="center"
        scrollBehavior="inside"
        size="2xl"
        onClose={onResetFlowModalClose}
      >
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">
            确认重置流量
          </ModalHeader>
          <ModalBody>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-warning-100 rounded-full flex items-center justify-center">
                <svg
                  aria-hidden="true"
                  className="w-6 h-6 text-warning"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    clipRule="evenodd"
                    d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"
                    fillRule="evenodd"
                  />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-foreground">
                  确定要重置用户{" "}
                  <span className="font-semibold text-warning">
                    &quot;{userToReset?.user}&quot;
                  </span>{" "}
                  的流量吗？
                </p>
                <p className="text-small text-muted-foreground mt-1">
                  该操作只会重置账号流量不会重置隧道权限流量，重置后该用户的上下行流量将归零，此操作不可撤销。
                </p>
                <div className="mt-2 p-2 bg-warning-50 dark:bg-warning-100/10 rounded text-xs">
                  <div className="text-warning-700 dark:text-warning-300">
                    当前流量使用情况：
                  </div>
                  <div className="mt-1 space-y-1">
                    <div className="flex justify-between">
                      <span>上行流量：</span>
                      <span className="font-mono">
                        {userToReset
                          ? formatFlow(userToReset.inFlow || 0)
                          : "-"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>下行流量：</span>
                      <span className="font-mono">
                        {userToReset
                          ? formatFlow(userToReset.outFlow || 0)
                          : "-"}
                      </span>
                    </div>
                    <div className="flex justify-between font-medium">
                      <span>总计：</span>
                      <span className="font-mono text-warning-700 dark:text-warning-300">
                        {userToReset
                          ? formatFlow(calculateUserTotalUsedFlow(userToReset))
                          : "-"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" onClick={onResetFlowModalClose}>
              取消
            </Button>
            <Button
              loading={resetFlowLoading}
              variant="warning"
              onClick={handleConfirmResetFlow}
            >
              重置
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* 重置隧道流量确认对话框 */}
      <Modal
        backdrop="blur"
        classNames={{
          base: "!w-[calc(100%-32px)] !mx-auto sm:!w-full rounded-xl",
        }}
        open={isResetTunnelFlowModalOpen}
        placement="center"
        scrollBehavior="inside"
        size="2xl"
        onClose={onResetTunnelFlowModalClose}
      >
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">
            确认重置隧道流量
          </ModalHeader>
          <ModalBody>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-warning-100 rounded-full flex items-center justify-center">
                <svg
                  aria-hidden="true"
                  className="w-6 h-6 text-warning"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    clipRule="evenodd"
                    d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"
                    fillRule="evenodd"
                  />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-foreground">
                  确定要重置用户{" "}
                  <span className="font-semibold">{currentUser?.user}</span>{" "}
                  对隧道{" "}
                  <span className="font-semibold text-warning">
                    &quot;{tunnelToReset?.tunnelName}&quot;
                  </span>{" "}
                  的流量吗？
                </p>
                <p className="text-small text-muted-foreground mt-1">
                  该操作只会重置隧道权限流量不会重置账号流量，重置后该隧道权限的上下行流量将归零，此操作不可撤销。
                </p>
                <div className="mt-2 p-2 bg-warning-50 dark:bg-warning-100/10 rounded text-xs">
                  <div className="text-warning-700 dark:text-warning-300">
                    当前流量使用情况：
                  </div>
                  <div className="mt-1 space-y-1">
                    <div className="flex justify-between">
                      <span>上行流量：</span>
                      <span className="font-mono">
                        {tunnelToReset
                          ? formatFlow(tunnelToReset.inFlow || 0)
                          : "-"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>下行流量：</span>
                      <span className="font-mono">
                        {tunnelToReset
                          ? formatFlow(tunnelToReset.outFlow || 0)
                          : "-"}
                      </span>
                    </div>
                    <div className="flex justify-between font-medium">
                      <span>总计：</span>
                      <span className="font-mono text-warning-700 dark:text-warning-300">
                        {tunnelToReset
                          ? formatFlow(calculateTunnelUsedFlow(tunnelToReset))
                          : "-"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" onClick={onResetTunnelFlowModalClose}>
              取消
            </Button>
            <Button
              loading={resetTunnelFlowLoading}
              variant="warning"
              onClick={handleConfirmResetTunnelFlow}
            >
              重置
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </PageShell>
  );
}
