import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { ListPageSkeleton } from "@/components/page-state";
import {
  markPageCached,
  pageCached,
  useCachedState,
} from "@/hooks/use-cached-state";
import { ActionsDialog } from "@/components/action-dialog";
import {
  EmptyHint,
  ListGroup,
  ListRow,
  PageHeader,
  PageShell,
  PageTabs,
  PageToolbar,
  formatDate,
} from "@/components/page-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  useDisclosure,
} from "@/components/modal";
import { MultiSelectField } from "@/components/multi-select-field";
import { SelectField } from "@/components/select-native";
import {
  assignGroupPermission,
  assignTunnelsToGroup,
  assignUsersToGroup,
  createTunnelGroup,
  createUserGroup,
  deleteTunnelGroup,
  deleteUserGroup,
  getAllUsers,
  getGroupPermissionList,
  getTunnelGroupList,
  getTunnelList,
  getUserGroupList,
  removeGroupPermission,
  updateTunnelGroup,
  updateUserGroup,
} from "@/api";
import { getAdminFlag } from "@/utils/session";

interface TunnelItem {
  id: number;
  name: string;
}

interface UserItem {
  id: number;
  user: string;
}

interface TunnelGroup {
  id: number;
  name: string;
  status: number;
  tunnelIds: number[];
  tunnelNames: string[];
  createdTime: number;
}

interface UserGroup {
  id: number;
  name: string;
  status: number;
  userIds: number[];
  userNames: string[];
  createdTime: number;
}

interface GroupPermission {
  id: number;
  userGroupId: number;
  userGroupName: string;
  tunnelGroupId: number;
  tunnelGroupName: string;
  createdTime: number;
}

type GroupTab = "tunnel" | "user" | "perm";

// A revisit shows the last data at once and reloads in the background.
const PAGE = "group";

export default function GroupPage({
  embedded = false,
}: {
  embedded?: boolean;
}) {
  const [loading, setLoading] = useState(true);
  const [isAdmin] = useState(getAdminFlag());
  const [activeTab, setActiveTab] = useState<GroupTab>("tunnel");
  const [search, setSearch] = useState("");
  const [sheet, setSheet] = useState<{ kind: GroupTab; id: number } | null>(
    null,
  );

  const [tunnelGroups, setTunnelGroups] = useCachedState<TunnelGroup[]>(
    PAGE,
    "tunnelGroups",
    [],
  );
  const [userGroups, setUserGroups] = useCachedState<UserGroup[]>(
    PAGE,
    "userGroups",
    [],
  );
  const [permissions, setPermissions] = useCachedState<GroupPermission[]>(
    PAGE,
    "permissions",
    [],
  );
  const [tunnels, setTunnels] = useCachedState<TunnelItem[]>(
    PAGE,
    "tunnels",
    [],
  );
  const [users, setUsers] = useCachedState<UserItem[]>(PAGE, "users", []);

  const [selectedUserGroupId, setSelectedUserGroupId] = useState<number | null>(
    null,
  );
  const [selectedTunnelGroupId, setSelectedTunnelGroupId] = useState<
    number | null
  >(null);

  const [savingPermission, setSavingPermission] = useState(false);

  const {
    isOpen: tunnelGroupModalOpen,
    onOpen: onTunnelGroupModalOpen,
    onClose: onTunnelGroupModalClose,
    onOpenChange: onTunnelGroupModalChange,
  } = useDisclosure();
  const {
    isOpen: userGroupModalOpen,
    onOpen: onUserGroupModalOpen,
    onClose: onUserGroupModalClose,
    onOpenChange: onUserGroupModalChange,
  } = useDisclosure();
  const {
    isOpen: tunnelAssignModalOpen,
    onOpen: onTunnelAssignModalOpen,
    onClose: onTunnelAssignModalClose,
    onOpenChange: onTunnelAssignModalChange,
  } = useDisclosure();
  const {
    isOpen: userAssignModalOpen,
    onOpen: onUserAssignModalOpen,
    onClose: onUserAssignModalClose,
    onOpenChange: onUserAssignModalChange,
  } = useDisclosure();

  const [editingTunnelGroup, setEditingTunnelGroup] =
    useState<TunnelGroup | null>(null);
  const [editingUserGroup, setEditingUserGroup] = useState<UserGroup | null>(
    null,
  );
  const [groupName, setGroupName] = useState("");
  const [groupStatus, setGroupStatus] = useState("1");
  const [savingGroup, setSavingGroup] = useState(false);

  const [assignTunnelGroup, setAssignTunnelGroup] =
    useState<TunnelGroup | null>(null);
  const [assignUserGroup, setAssignUserGroup] = useState<UserGroup | null>(
    null,
  );
  const [selectedTunnelKeys, setSelectedTunnelKeys] = useState<Set<string>>(
    new Set(),
  );
  const [selectedUserKeys, setSelectedUserKeys] = useState<Set<string>>(
    new Set(),
  );
  const [savingAssign, setSavingAssign] = useState(false);

  const tunnelNameMap = useMemo(() => {
    const map = new Map<number, string>();

    tunnels.forEach((item) => {
      map.set(item.id, item.name);
    });

    return map;
  }, [tunnels]);

  const userNameMap = useMemo(() => {
    const map = new Map<number, string>();

    users.forEach((item) => {
      map.set(item.id, item.user);
    });

    return map;
  }, [users]);

  const selectedTunnelSummary = useMemo(() => {
    const value = Array.from(selectedTunnelKeys)
      .map((id) => tunnelNameMap.get(Number(id)) || id)
      .join("、");

    return value || "无";
  }, [selectedTunnelKeys, tunnelNameMap]);

  const selectedUserSummary = useMemo(() => {
    const value = Array.from(selectedUserKeys)
      .map((id) => userNameMap.get(Number(id)) || id)
      .join("、");

    return value || "无";
  }, [selectedUserKeys, userNameMap]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [tunnelGroupRes, userGroupRes, permissionRes, tunnelRes, userRes] =
        await Promise.all([
          getTunnelGroupList(),
          getUserGroupList(),
          getGroupPermissionList(),
          getTunnelList(),
          getAllUsers(),
        ]);

      if (tunnelGroupRes.code === 0) {
        setTunnelGroups(
          Array.isArray(tunnelGroupRes.data) ? tunnelGroupRes.data : [],
        );
      }
      if (userGroupRes.code === 0) {
        setUserGroups(
          Array.isArray(userGroupRes.data) ? userGroupRes.data : [],
        );
      }
      if (permissionRes.code === 0) {
        setPermissions(
          Array.isArray(permissionRes.data) ? permissionRes.data : [],
        );
      }
      if (tunnelRes.code === 0) {
        setTunnels(Array.isArray(tunnelRes.data) ? tunnelRes.data : []);
      }
      if (userRes.code === 0) {
        setUsers(Array.isArray(userRes.data) ? userRes.data : []);
      }

      if (
        tunnelGroupRes.code !== 0 ||
        userGroupRes.code !== 0 ||
        permissionRes.code !== 0
      ) {
        toast.error("部分分组数据加载失败");
      } else {
        markPageCached(PAGE);
      }
    } catch {
      toast.error("分组数据加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openCreateTunnelGroup = () => {
    setEditingTunnelGroup(null);
    setGroupName("");
    setGroupStatus("1");
    onTunnelGroupModalOpen();
  };

  const openEditTunnelGroup = (group: TunnelGroup) => {
    setEditingTunnelGroup(group);
    setGroupName(group.name);
    setGroupStatus(String(group.status));
    onTunnelGroupModalOpen();
  };

  const openCreateUserGroup = () => {
    setEditingUserGroup(null);
    setGroupName("");
    setGroupStatus("1");
    onUserGroupModalOpen();
  };

  const openEditUserGroup = (group: UserGroup) => {
    setEditingUserGroup(group);
    setGroupName(group.name);
    setGroupStatus(String(group.status));
    onUserGroupModalOpen();
  };

  const saveTunnelGroup = async () => {
    if (!groupName.trim()) {
      toast.error("请输入分组名称");

      return;
    }
    setSavingGroup(true);
    try {
      const payload = { name: groupName.trim(), status: Number(groupStatus) };
      const res = editingTunnelGroup
        ? await updateTunnelGroup({ id: editingTunnelGroup.id, ...payload })
        : await createTunnelGroup(payload);

      if (res.code === 0) {
        toast.success(editingTunnelGroup ? "更新成功" : "创建成功");
        onTunnelGroupModalClose();
        loadData();
      } else {
        toast.error(res.msg || "保存失败");
      }
    } catch {
      toast.error("保存失败");
    } finally {
      setSavingGroup(false);
    }
  };

  const saveUserGroup = async () => {
    if (!groupName.trim()) {
      toast.error("请输入分组名称");

      return;
    }
    setSavingGroup(true);
    try {
      const payload = { name: groupName.trim(), status: Number(groupStatus) };
      const res = editingUserGroup
        ? await updateUserGroup({ id: editingUserGroup.id, ...payload })
        : await createUserGroup(payload);

      if (res.code === 0) {
        toast.success(editingUserGroup ? "更新成功" : "创建成功");
        onUserGroupModalClose();
        loadData();
      } else {
        toast.error(res.msg || "保存失败");
      }
    } catch {
      toast.error("保存失败");
    } finally {
      setSavingGroup(false);
    }
  };

  const handleDeleteTunnelGroup = async (id: number) => {
    try {
      const res = await deleteTunnelGroup(id);

      if (res.code === 0) {
        toast.success("删除成功");
        loadData();
      } else {
        toast.error(res.msg || "删除失败");
      }
    } catch {
      toast.error("删除失败");
    }
  };

  const handleDeleteUserGroup = async (id: number) => {
    try {
      const res = await deleteUserGroup(id);

      if (res.code === 0) {
        toast.success("删除成功");
        loadData();
      } else {
        toast.error(res.msg || "删除失败");
      }
    } catch {
      toast.error("删除失败");
    }
  };

  const openAssignTunnels = (group: TunnelGroup) => {
    setAssignTunnelGroup(group);
    setSelectedTunnelKeys(new Set(group.tunnelIds.map((id) => String(id))));
    onTunnelAssignModalOpen();
  };

  const openAssignUsers = (group: UserGroup) => {
    setAssignUserGroup(group);
    setSelectedUserKeys(new Set(group.userIds.map((id) => String(id))));
    onUserAssignModalOpen();
  };

  const saveAssignTunnels = async () => {
    if (!assignTunnelGroup) return;
    setSavingAssign(true);
    try {
      const tunnelIds = Array.from(selectedTunnelKeys).map((id) => Number(id));
      const res = await assignTunnelsToGroup({
        groupId: assignTunnelGroup.id,
        tunnelIds,
      });

      if (res.code === 0) {
        toast.success("分配成功");
        onTunnelAssignModalClose();
        loadData();
      } else {
        toast.error(res.msg || "分配失败");
      }
    } catch {
      toast.error("分配失败");
    } finally {
      setSavingAssign(false);
    }
  };

  const saveAssignUsers = async () => {
    if (!assignUserGroup) return;
    setSavingAssign(true);
    try {
      const userIds = Array.from(selectedUserKeys).map((id) => Number(id));
      const res = await assignUsersToGroup({
        groupId: assignUserGroup.id,
        userIds,
      });

      if (res.code === 0) {
        toast.success("分配成功");
        onUserAssignModalClose();
        loadData();
      } else {
        toast.error(res.msg || "分配失败");
      }
    } catch {
      toast.error("分配失败");
    } finally {
      setSavingAssign(false);
    }
  };

  const handleAssignPermission = async () => {
    if (!selectedUserGroupId || !selectedTunnelGroupId) {
      toast.error("请选择用户分组和隧道分组");

      return;
    }
    setSavingPermission(true);
    try {
      const res = await assignGroupPermission({
        userGroupId: selectedUserGroupId,
        tunnelGroupId: selectedTunnelGroupId,
      });

      if (res.code === 0) {
        toast.success(res.msg || "权限分配成功");
        loadData();
      } else {
        toast.error(res.msg || "权限分配失败");
      }
    } catch {
      toast.error("权限分配失败");
    } finally {
      setSavingPermission(false);
    }
  };

  const handleRemovePermission = async (id: number) => {
    try {
      const res = await removeGroupPermission(id);

      if (res.code === 0) {
        toast.success("权限回收成功");
        loadData();
      } else {
        toast.error(res.msg || "权限回收失败");
      }
    } catch {
      toast.error("权限回收失败");
    }
  };

  if (!isAdmin) {
    return (
      <div className="mx-auto w-full max-w-[1440px] px-6 py-6">
        <EmptyHint text="权限不足，只有管理员可以访问分组管理页面。" />
      </div>
    );
  }

  const keyword = search.trim().toLowerCase();
  const matches = (...values: Array<string | undefined>) =>
    !keyword ||
    values.some((value) => (value || "").toLowerCase().includes(keyword));

  const filteredTunnelGroups = tunnelGroups.filter((item) =>
    matches(item.name, ...item.tunnelNames),
  );
  const filteredUserGroups = userGroups.filter((item) =>
    matches(item.name, ...item.userNames),
  );
  const filteredPermissions = permissions.filter((item) =>
    matches(item.userGroupName, item.tunnelGroupName),
  );

  const groupMeta = (count: number, unit: string, createdTime: number) =>
    [`${count} ${unit}`, formatDate(createdTime)].filter(Boolean).join(" · ");

  const sheetTunnelGroup =
    sheet?.kind === "tunnel"
      ? (tunnelGroups.find((item) => item.id === sheet.id) ?? null)
      : null;
  const sheetUserGroup =
    sheet?.kind === "user"
      ? (userGroups.find((item) => item.id === sheet.id) ?? null)
      : null;
  const sheetPermission =
    sheet?.kind === "perm"
      ? (permissions.find((item) => item.id === sheet.id) ?? null)
      : null;
  const closeSheet = () => setSheet(null);

  const renderDetails = (rows: Array<[string, React.ReactNode]>) => (
    <div className="space-y-2 text-sm">
      {rows.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-3">
          <span className="shrink-0 text-muted-foreground">{k}</span>
          <span className="min-w-0 break-all text-right">{v}</span>
        </div>
      ))}
    </div>
  );

  return (
    <PageShell embedded={embedded}>
      {!embedded && (
        <PageHeader
          description="把隧道和用户编组，再按组授予隧道使用权限"
          title="分组"
        />
      )}
      <PageTabs
        tabs={[
          { key: "tunnel", label: "隧道分组", badge: tunnelGroups.length },
          { key: "user", label: "用户分组", badge: userGroups.length },
          { key: "perm", label: "权限分配", badge: permissions.length },
        ]}
        value={activeTab}
        onChange={(key) => {
          setActiveTab(key);
          setSearch("");
        }}
      />
      {loading && !pageCached(PAGE) ? (
        <ListPageSkeleton />
      ) : (
        <>
          {activeTab === "tunnel" && (
            <>
              <PageToolbar
                placeholder="搜索分组或隧道"
                primary={{
                  key: "create",
                  label: "新建隧道分组",
                  onPress: openCreateTunnelGroup,
                }}
                search={search}
                onSearch={setSearch}
              />
              {filteredTunnelGroups.length === 0 ? (
                <EmptyHint
                  action={
                    tunnelGroups.length === 0
                      ? {
                          key: "create",
                          label: "新建隧道分组",
                          onPress: openCreateTunnelGroup,
                        }
                      : undefined
                  }
                  text={
                    tunnelGroups.length === 0
                      ? "还没有隧道分组"
                      : "没有匹配的隧道分组"
                  }
                />
              ) : (
                <ListGroup>
                  {filteredTunnelGroups.map((item) => (
                    <ListRow
                      key={item.id}
                      meta={groupMeta(
                        item.tunnelIds.length,
                        "条隧道",
                        item.createdTime,
                      )}
                      status={item.status === 1 ? "ok" : "off"}
                      statusTitle={item.status === 1 ? "启用" : "停用"}
                      title={item.name}
                      onPress={() => setSheet({ kind: "tunnel", id: item.id })}
                    />
                  ))}
                </ListGroup>
              )}
            </>
          )}

          {activeTab === "user" && (
            <>
              <PageToolbar
                placeholder="搜索分组或用户"
                primary={{
                  key: "create",
                  label: "新建用户分组",
                  onPress: openCreateUserGroup,
                }}
                search={search}
                onSearch={setSearch}
              />
              {filteredUserGroups.length === 0 ? (
                <EmptyHint
                  action={
                    userGroups.length === 0
                      ? {
                          key: "create",
                          label: "新建用户分组",
                          onPress: openCreateUserGroup,
                        }
                      : undefined
                  }
                  text={
                    userGroups.length === 0
                      ? "还没有用户分组"
                      : "没有匹配的用户分组"
                  }
                />
              ) : (
                <ListGroup>
                  {filteredUserGroups.map((item) => (
                    <ListRow
                      key={item.id}
                      meta={groupMeta(
                        item.userIds.length,
                        "个用户",
                        item.createdTime,
                      )}
                      status={item.status === 1 ? "ok" : "off"}
                      statusTitle={item.status === 1 ? "启用" : "停用"}
                      title={item.name}
                      onPress={() => setSheet({ kind: "user", id: item.id })}
                    />
                  ))}
                </ListGroup>
              )}
            </>
          )}

          {activeTab === "perm" && (
            <>
              <div className="mb-4 rounded-xl border border-hairline bg-raised p-3">
                <p className="mb-2 text-xs text-muted-foreground">
                  让用户分组里的用户可以使用隧道分组里的隧道
                </p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-center">
                  <SelectField
                    aria-label="用户分组"
                    options={userGroups.map((g) => ({
                      value: String(g.id),
                      label: g.name,
                    }))}
                    placeholder="选择用户分组"
                    size="sm"
                    value={
                      selectedUserGroupId ? String(selectedUserGroupId) : ""
                    }
                    onValueChange={(key) =>
                      setSelectedUserGroupId(key ? Number(key) : null)
                    }
                  />
                  <SelectField
                    aria-label="隧道分组"
                    options={tunnelGroups.map((g) => ({
                      value: String(g.id),
                      label: g.name,
                    }))}
                    placeholder="选择隧道分组"
                    size="sm"
                    value={
                      selectedTunnelGroupId ? String(selectedTunnelGroupId) : ""
                    }
                    onValueChange={(key) =>
                      setSelectedTunnelGroupId(key ? Number(key) : null)
                    }
                  />
                  <Button
                    className="whitespace-nowrap px-4"
                    disabled={savingPermission}
                    size="sm"
                    onClick={handleAssignPermission}
                  >
                    分配
                  </Button>
                </div>
              </div>
              <PageToolbar
                placeholder="搜索分组"
                search={search}
                onSearch={setSearch}
              />
              {filteredPermissions.length === 0 ? (
                <EmptyHint
                  text={
                    permissions.length === 0
                      ? "还没有权限分配，在上方选择两个分组后点击分配"
                      : "没有匹配的权限分配"
                  }
                />
              ) : (
                <ListGroup>
                  {filteredPermissions.map((item) => (
                    <ListRow
                      key={item.id}
                      meta={[
                        `隧道分组 ${item.tunnelGroupName || item.tunnelGroupId}`,
                        formatDate(item.createdTime),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                      title={item.userGroupName || `#${item.userGroupId}`}
                      onPress={() => setSheet({ kind: "perm", id: item.id })}
                    />
                  ))}
                </ListGroup>
              )}
            </>
          )}

          <ActionsDialog
            actions={
              sheetTunnelGroup
                ? [
                    {
                      key: "assign",
                      label: "分配隧道",
                      color: "primary",
                      onPress: () => openAssignTunnels(sheetTunnelGroup),
                    },
                    {
                      key: "edit",
                      label: "编辑",
                      onPress: () => openEditTunnelGroup(sheetTunnelGroup),
                    },
                    {
                      key: "delete",
                      label: "删除",
                      color: "danger",
                      onPress: () =>
                        handleDeleteTunnelGroup(sheetTunnelGroup.id),
                    },
                  ]
                : sheetUserGroup
                  ? [
                      {
                        key: "assign",
                        label: "分配用户",
                        color: "primary",
                        onPress: () => openAssignUsers(sheetUserGroup),
                      },
                      {
                        key: "edit",
                        label: "编辑",
                        onPress: () => openEditUserGroup(sheetUserGroup),
                      },
                      {
                        key: "delete",
                        label: "删除",
                        color: "danger",
                        onPress: () => handleDeleteUserGroup(sheetUserGroup.id),
                      },
                    ]
                  : sheetPermission
                    ? [
                        {
                          key: "remove",
                          label: "回收",
                          color: "danger",
                          onPress: () =>
                            handleRemovePermission(sheetPermission.id),
                        },
                      ]
                    : []
            }
            open={Boolean(
              sheetTunnelGroup || sheetUserGroup || sheetPermission,
            )}
            subtitle={
              sheetTunnelGroup
                ? `隧道分组 · ${sheetTunnelGroup.status === 1 ? "启用" : "停用"}`
                : sheetUserGroup
                  ? `用户分组 · ${sheetUserGroup.status === 1 ? "启用" : "停用"}`
                  : sheetPermission
                    ? "权限分配"
                    : undefined
            }
            title={
              sheetTunnelGroup?.name ??
              sheetUserGroup?.name ??
              (sheetPermission
                ? `${sheetPermission.userGroupName || sheetPermission.userGroupId} → ${
                    sheetPermission.tunnelGroupName ||
                    sheetPermission.tunnelGroupId
                  }`
                : "")
            }
            onClose={closeSheet}
          >
            {sheetTunnelGroup &&
              renderDetails([
                [
                  "隧道",
                  sheetTunnelGroup.tunnelNames.length > 0
                    ? sheetTunnelGroup.tunnelNames.join("、")
                    : "无",
                ],
                [
                  "创建时间",
                  formatDate(sheetTunnelGroup.createdTime, true) || "-",
                ],
              ])}
            {sheetUserGroup &&
              renderDetails([
                [
                  "用户",
                  sheetUserGroup.userNames.length > 0
                    ? sheetUserGroup.userNames.join("、")
                    : "无",
                ],
                [
                  "创建时间",
                  formatDate(sheetUserGroup.createdTime, true) || "-",
                ],
              ])}
            {sheetPermission &&
              renderDetails([
                [
                  "用户分组",
                  sheetPermission.userGroupName || sheetPermission.userGroupId,
                ],
                [
                  "隧道分组",
                  sheetPermission.tunnelGroupName ||
                    sheetPermission.tunnelGroupId,
                ],
                [
                  "创建时间",
                  formatDate(sheetPermission.createdTime, true) || "-",
                ],
              ])}
          </ActionsDialog>

          <Modal
            backdrop="blur"
            classNames={{
              base: "!w-[calc(100%-32px)] !mx-auto sm:!w-full rounded-xl overflow-hidden",
            }}
            open={tunnelGroupModalOpen}
            onOpenChange={onTunnelGroupModalChange}
          >
            <ModalContent>
              <ModalHeader>
                {editingTunnelGroup ? "编辑隧道分组" : "新建隧道分组"}
              </ModalHeader>
              <ModalBody className="space-y-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="tunnel-group-name">分组名称</Label>
                  <Input
                    id="tunnel-group-name"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                  />
                </div>
                <SelectField
                  label="状态"
                  options={[
                    { value: "1", label: "启用" },
                    { value: "0", label: "停用" },
                  ]}
                  value={groupStatus}
                  onValueChange={setGroupStatus}
                />
              </ModalBody>
              <ModalFooter>
                <Button variant="ghost" onClick={onTunnelGroupModalClose}>
                  取消
                </Button>
                <Button disabled={savingGroup} onClick={saveTunnelGroup}>
                  保存
                </Button>
              </ModalFooter>
            </ModalContent>
          </Modal>

          <Modal
            backdrop="blur"
            classNames={{
              base: "!w-[calc(100%-32px)] !mx-auto sm:!w-full rounded-xl overflow-hidden",
            }}
            open={userGroupModalOpen}
            onOpenChange={onUserGroupModalChange}
          >
            <ModalContent>
              <ModalHeader>
                {editingUserGroup ? "编辑用户分组" : "新建用户分组"}
              </ModalHeader>
              <ModalBody className="space-y-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="user-group-name">分组名称</Label>
                  <Input
                    id="user-group-name"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                  />
                </div>
                <SelectField
                  label="状态"
                  options={[
                    { value: "1", label: "启用" },
                    { value: "0", label: "停用" },
                  ]}
                  value={groupStatus}
                  onValueChange={setGroupStatus}
                />
              </ModalBody>
              <ModalFooter>
                <Button variant="ghost" onClick={onUserGroupModalClose}>
                  取消
                </Button>
                <Button disabled={savingGroup} onClick={saveUserGroup}>
                  保存
                </Button>
              </ModalFooter>
            </ModalContent>
          </Modal>

          <Modal
            backdrop="blur"
            classNames={{
              base: "!w-[calc(100%-32px)] !mx-auto sm:!w-full rounded-xl overflow-hidden",
            }}
            open={tunnelAssignModalOpen}
            onOpenChange={onTunnelAssignModalChange}
          >
            <ModalContent>
              <ModalHeader>分配隧道 - {assignTunnelGroup?.name}</ModalHeader>
              <ModalBody className="min-w-0">
                <MultiSelectField
                  className="min-w-0"
                  label="选择隧道"
                  options={tunnels.map((tunnel) => ({
                    value: String(tunnel.id),
                    label: tunnel.name,
                  }))}
                  placeholder="选择隧道"
                  values={Array.from(selectedTunnelKeys)}
                  onValuesChange={(next) =>
                    setSelectedTunnelKeys(new Set(next))
                  }
                />
                <p
                  className="w-full min-w-0 max-w-full text-xs text-muted-foreground truncate"
                  title={`当前已选：${selectedTunnelSummary}`}
                >
                  当前已选：{selectedTunnelSummary}
                </p>
                <p className="text-xs text-muted-foreground">
                  不选择任何隧道并保存将清空该分组成员。
                </p>
              </ModalBody>
              <ModalFooter>
                <Button variant="ghost" onClick={onTunnelAssignModalClose}>
                  取消
                </Button>
                <Button disabled={savingAssign} onClick={saveAssignTunnels}>
                  保存
                </Button>
              </ModalFooter>
            </ModalContent>
          </Modal>

          <Modal
            backdrop="blur"
            classNames={{
              base: "!w-[calc(100%-32px)] !mx-auto sm:!w-full rounded-xl overflow-hidden",
            }}
            open={userAssignModalOpen}
            onOpenChange={onUserAssignModalChange}
          >
            <ModalContent>
              <ModalHeader>分配用户 - {assignUserGroup?.name}</ModalHeader>
              <ModalBody className="min-w-0">
                <MultiSelectField
                  className="min-w-0"
                  label="选择用户"
                  options={users.map((user) => ({
                    value: String(user.id),
                    label: user.user,
                  }))}
                  placeholder="选择用户"
                  values={Array.from(selectedUserKeys)}
                  onValuesChange={(next) => setSelectedUserKeys(new Set(next))}
                />
                <p
                  className="w-full min-w-0 max-w-full text-xs text-muted-foreground truncate"
                  title={`当前已选：${selectedUserSummary}`}
                >
                  当前已选：{selectedUserSummary}
                </p>
                <p className="text-xs text-muted-foreground">
                  不选择任何用户并保存将清空该分组成员。
                </p>
              </ModalBody>
              <ModalFooter>
                <Button variant="ghost" onClick={onUserAssignModalClose}>
                  取消
                </Button>
                <Button disabled={savingAssign} onClick={saveAssignUsers}>
                  保存
                </Button>
              </ModalFooter>
            </ModalContent>
          </Modal>
        </>
      )}
    </PageShell>
  );
}
