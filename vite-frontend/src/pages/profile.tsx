import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import {
  ChevronRight,
  CircleCheck,
  Fingerprint,
  Github,
  KeyRound,
  Link2,
  LogOut,
  Settings,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  useDisclosure,
} from "@/components/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isWebViewFunc } from "@/utils/panel";
import { siteConfig } from "@/config/site";
import { VersionFooter } from "@/components/version-footer";
import {
  getGithubInfo,
  getPasskeyStatus,
  listPasskeys,
  updatePassword,
  getUserSessions,
  revokeUserSession,
  revokeOtherUserSessions,
  revokeAllUserSessions,
  type GithubInfo,
  type PasskeyItem,
  type UserSessionApiItem,
} from "@/api";
import { safeLogout } from "@/utils/logout";
import { getAdminFlag, getSessionName, getToken } from "@/utils/session";
import { PasskeyModal } from "@/components/passkey-manager";
import { GithubBindingModal } from "@/components/github-binding";
import { PageHeader } from "@/components/page-kit";
import { Avatar } from "@/components/ui/avatar";
import { useH5Mode } from "@/hooks/useH5Mode";

interface PasswordForm {
  newUsername: string;
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

type Tone = "primary" | "success" | "warning" | "secondary" | "danger";

const TONE: Record<Tone, string> = {
  primary: "bg-surface text-ink-2",
  success: "bg-surface text-ink-2",
  warning: "bg-surface text-ink-2",
  secondary: "bg-surface text-ink-2",
  danger: "bg-surface text-destructive",
};

function IconTile({
  icon: Icon,
  tone,
  size = "md",
}: {
  icon: LucideIcon;
  tone: Tone;
  size?: "md" | "lg";
}) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-lg ${TONE[tone]} ${size === "lg" ? "h-11 w-11" : "h-8 w-8"}`}
    >
      <Icon className={size === "lg" ? "h-5 w-5" : "h-4 w-4"} />
    </span>
  );
}

interface SecurityItem {
  key: string;
  label: string;
  description: string;
  /** The current state, e.g. "已绑定 kure29". */
  status: string;
  /** Whether the status is a good one (bound, set up). */
  active?: boolean;
  /** The desktop button. */
  action: string;
  icon: LucideIcon;
  tone: Tone;
  onClick: () => void;
}

interface ShortcutItem {
  key: string;
  label: string;
  description: string;
  icon: LucideIcon;
  tone: Tone;
  onClick: () => void;
}

function RoleChip({ isAdmin }: { isAdmin: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${isAdmin ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}
    >
      {isAdmin && <ShieldCheck className="h-3 w-3" />}
      {isAdmin ? "管理员" : "普通用户"}
    </span>
  );
}

/** Phone: iOS-settings style rows, the status on the right. */
function SecurityList({ items }: { items: SecurityItem[] }) {
  return (
    <div className="divide-y divide-divider overflow-hidden rounded-xl bg-raised shadow-sm">
      {items.map((item) => (
        <button
          key={item.key}
          className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors active:bg-muted"
          type="button"
          onClick={item.onClick}
        >
          <IconTile icon={item.icon} tone={item.tone} />
          <span className="min-w-0 flex-1 truncate text-base">
            {item.label}
          </span>
          <span
            className={`max-w-[45%] truncate text-sm ${item.active ? "text-muted-foreground" : "text-muted-foreground"}`}
          >
            {item.status}
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
      ))}
    </div>
  );
}

/** Desktop: one row per method with what it is, its state and a button. */
function SecurityPanel({ items }: { items: SecurityItem[] }) {
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-raised">
      <div className="border-b border-border px-5 py-4">
        <h2 className="text-sm font-medium">登录与安全</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          管理登录这个面板的方式；绑定、解绑和修改都需要当前密码
        </p>
      </div>
      <div className="divide-y divide-border">
        {items.map((item) => (
          <div key={item.key} className="flex items-center gap-4 px-5 py-4">
            <IconTile icon={item.icon} size="lg" tone={item.tone} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{item.label}</span>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${item.active ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}
                >
                  {item.active && <CircleCheck className="h-3 w-3" />}
                  {item.status}
                </span>
              </div>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {item.description}
              </p>
            </div>
            <Button
              className="min-w-16"
              size="sm"
              variant="outline"
              onClick={item.onClick}
            >
              {item.action}
            </Button>
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * The login rows (passkey, GitHub) only show once their status loads, so
 * the page jumped as they popped in. The last status is remembered per
 * user in this browser and shown at once, then refreshed.
 */
interface LoginCache {
  passkeyEnabled: boolean;
  passkeyCount: number;
  github: GithubInfo | null;
}

const loginCacheKey = () => `hoplane_login_rows_${getSessionName() || ""}`;

function readLoginCache(): LoginCache {
  try {
    const raw = JSON.parse(localStorage.getItem(loginCacheKey()) || "null");

    if (raw && typeof raw === "object") return raw as LoginCache;
  } catch {
    // ignore: the rows just load as before
  }

  return { passkeyEnabled: false, passkeyCount: 0, github: null };
}

function writeLoginCache(patch: Partial<LoginCache>) {
  try {
    localStorage.setItem(
      loginCacheKey(),
      JSON.stringify({ ...readLoginCache(), ...patch }),
    );
  } catch {
    // ignore
  }
}

function sessionDevice() {
  const ua = navigator.userAgent;
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /Chrome\//.test(ua)
      ? "Chrome"
      : /Safari\//.test(ua) && !/Chrome/.test(ua)
        ? "Safari"
        : /Firefox\//.test(ua)
          ? "Firefox"
          : "浏览器";
  const os = /Mac OS X/.test(ua)
    ? "macOS"
    : /Windows/.test(ua)
      ? "Windows"
      : /Android/.test(ua)
        ? "Android"
        : /iPhone|iPad/.test(ua)
          ? "iOS"
          : "未知系统";

  return `${browser} · ${os}`;
}

function sessionTimes() {
  const token = getToken();

  if (!token) return { login: "—", expiry: "—" };

  try {
    const payload = JSON.parse(
      atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
    ) as { iat?: number; exp?: number };
    const format = (value?: number) =>
      value ? new Date(value * 1000).toLocaleString("zh-CN") : "—";

    return { login: format(payload.iat), expiry: format(payload.exp) };
  } catch {
    return { login: "—", expiry: "—" };
  }
}

function describeUA(ua: string) {
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /Chrome\//.test(ua)
      ? "Chrome"
      : /Safari\//.test(ua) && !/Chrome/.test(ua)
        ? "Safari"
        : /Firefox\//.test(ua)
          ? "Firefox"
          : "浏览器";
  const os = /Mac OS X/.test(ua)
    ? "macOS"
    : /Windows/.test(ua)
      ? "Windows"
      : /Android/.test(ua)
        ? "Android"
        : /iPhone|iPad/.test(ua)
          ? "iOS"
          : "未知系统";

  return `${browser} · ${os}`;
}

function relativeTime(ms: number) {
  if (!ms) return "刚刚";
  const diff = Math.max(0, Date.now() - ms);
  const minutes = Math.floor(diff / 60000);

  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);

  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);

  return `${days} 天前`;
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const isH5 = useH5Mode();
  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  const [username, setUsername] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordForm, setPasswordForm] = useState<PasswordForm>({
    newUsername: "",
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [cached] = useState(readLoginCache);
  const [passkeyEnabled, setPasskeyEnabled] = useState(cached.passkeyEnabled);
  const [passkeys, setPasskeys] = useState<PasskeyItem[] | null>(null);
  const passkeyCount = passkeys?.length ?? cached.passkeyCount;
  const [github, setGithub] = useState<GithubInfo | null>(cached.github);
  const [openLogin, setOpenLogin] = useState<"passkey" | "github" | null>(null);
  const [sessions, setSessions] = useState<UserSessionApiItem[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessionBusy, setSessionBusy] = useState(false);
  // The app's WebView can't do passkeys or come back from GitHub.
  const webView = isWebViewFunc();

  const loadPasskeys = () =>
    listPasskeys()
      .then((res) => {
        if (res.code === 0) {
          setPasskeys(res.data || []);
          writeLoginCache({ passkeyCount: (res.data || []).length });
        }
      })
      .catch(() => setPasskeys([]));
  const loadGithub = () =>
    getGithubInfo()
      .then((res) => {
        if (res.code === 0) {
          setGithub(res.data);
          writeLoginCache({ github: res.data });
        }
      })
      .catch(() => setGithub(null));

  useEffect(() => {
    // 获取用户信息
    setUsername(getSessionName() || "Admin");
    setIsAdmin(getAdminFlag());
    void loadGithub();
    getUserSessions()
      .then((res) => {
        if (res.code === 0) setSessions(res.data || []);
      })
      .catch(() => setSessions([]))
      .finally(() => setSessionsLoading(false));
    if (
      window.isSecureContext &&
      typeof window.PublicKeyCredential !== "undefined"
    ) {
      getPasskeyStatus()
        .then((res) => {
          if (res.code !== 0) return;
          setPasskeyEnabled(res.data.enabled);
          writeLoginCache({ passkeyEnabled: res.data.enabled });
          if (res.data.enabled) void loadPasskeys();
        })
        .catch(() => setPasskeyEnabled(false));
    }
  }, []);

  const go = (path: string) => () => navigate(path);

  const reloadSessions = () =>
    getUserSessions()
      .then((res) => {
        if (res.code === 0) setSessions(res.data || []);
      })
      .catch(() => undefined);

  const revokeOne = async (session: UserSessionApiItem) => {
    if (!window.confirm(`退出 ${describeUA(session.userAgent)} 这个会话？`))
      return;
    setSessionBusy(true);
    try {
      const res = await revokeUserSession(session.id);

      if (res.code === 0) {
        toast.success("已退出该设备");
        await reloadSessions();
      } else toast.error(res.msg || "退出失败");
    } finally {
      setSessionBusy(false);
    }
  };

  const revokeOthers = async () => {
    if (!window.confirm("退出除当前设备外的所有会话？")) return;
    setSessionBusy(true);
    try {
      const res = await revokeOtherUserSessions();

      if (res.code === 0) {
        toast.success("已退出其他设备");
        await reloadSessions();
      } else toast.error(res.msg || "操作失败");
    } finally {
      setSessionBusy(false);
    }
  };

  const revokeAll = async () => {
    if (!window.confirm("退出所有设备？当前会话也会失效，需要重新登录。"))
      return;
    setSessionBusy(true);
    try {
      const res = await revokeAllUserSessions();

      if (res.code === 0) {
        toast.success("已退出所有设备");
        safeLogout();
        navigate("/");
      } else toast.error(res.msg || "操作失败");
    } finally {
      setSessionBusy(false);
    }
  };

  // On phones the sidebar is gone; these are its admin pages.
  const shortcuts: ShortcutItem[] = [
    {
      key: "/user",
      label: "用户管理",
      description: "用户、分组和限速",
      icon: Users,
      tone: "primary",
      onClick: go("/user"),
    },
    {
      key: "/relay",
      label: "中转",
      description: "转发入口与隧道",
      icon: Link2,
      tone: "primary",
      onClick: go("/relay"),
    },
    {
      key: "/config",
      label: "网站配置",
      description: "站点、登录与备份",
      icon: Settings,
      tone: "warning",
      onClick: go("/config"),
    },
  ];

  // 退出登录
  const handleLogout = () => {
    safeLogout();
  };

  // 密码表单验证
  const validatePasswordForm = (): boolean => {
    if (!passwordForm.newUsername.trim()) {
      toast.error("请输入新用户名");

      return false;
    }
    if (passwordForm.newUsername.length < 3) {
      toast.error("用户名长度至少3位");

      return false;
    }
    if (!passwordForm.currentPassword) {
      toast.error("请输入当前密码");

      return false;
    }
    if (!passwordForm.newPassword) {
      toast.error("请输入新密码");

      return false;
    }
    if (passwordForm.newPassword.length < 6) {
      toast.error("新密码长度不能少于6位");

      return false;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error("两次输入密码不一致");

      return false;
    }

    return true;
  };

  // 提交密码修改
  const handlePasswordSubmit = async () => {
    if (!validatePasswordForm()) return;

    setPasswordLoading(true);
    try {
      const response = await updatePassword(passwordForm);

      if (response.code === 0) {
        toast.success("密码修改成功，请重新登录");
        onOpenChange();
        handleLogout();
      } else {
        toast.error(response.msg || "密码修改失败");
      }
    } catch {
      toast.error("修改密码时发生错误");
    } finally {
      setPasswordLoading(false);
    }
  };

  // 重置密码表单
  const resetPasswordForm = () => {
    setPasswordForm({
      newUsername: "",
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    });
  };

  const securityItems: SecurityItem[] = [
    {
      key: "password",
      label: "用户名与密码",
      description: "修改登录用的用户名和密码，改完需要重新登录",
      status: username,
      action: "修改",
      icon: KeyRound,
      tone: "primary",
      onClick: onOpen,
    },
    ...(passkeyEnabled && !webView
      ? [
          {
            key: "passkey",
            label: "通行证密钥",
            description: "用指纹、面容或设备密码登录，不用输入密码",
            status: passkeyCount > 0 ? `${passkeyCount} 个` : "未设置",
            active: passkeyCount > 0,
            action: "管理",
            icon: Fingerprint,
            tone: "success" as Tone,
            onClick: () => setOpenLogin("passkey"),
          },
        ]
      : []),
    // Shown once an admin turns GitHub login on, or while still bound so
    // the user can unbind.
    ...(github && !webView && (github.enabled || github.bound)
      ? [
          {
            key: "github",
            label: "GitHub 登录",
            description: "在登录页用 GitHub 账号一键登录",
            status: github.bound ? `已绑定 ${github.login}` : "未绑定",
            active: github.bound,
            action: github.bound ? "解绑" : "绑定",
            icon: Github,
            tone: "secondary" as Tone,
            onClick: () => setOpenLogin("github"),
          },
        ]
      : []),
  ];

  const logoutButton = (
    <Button
      className="w-full gap-2 border-destructive/30 text-destructive hover:bg-destructive/10"
      variant="outline"
      onClick={handleLogout}
    >
      {<LogOut className="h-4 w-4" />}
      退出登录
    </Button>
  );

  return (
    <div className="flex min-h-full flex-col px-3 py-6 lg:px-6">
      {isH5 ? (
        <div className="w-full flex-1 flex flex-col gap-6">
          <PageHeader title="更多" />

          <div className="flex items-center gap-4 rounded-xl bg-raised px-4 py-4 shadow-sm">
            <Avatar name={username} size="md" />
            <div className="min-w-0 flex-1 flex flex-col gap-1">
              <div className="truncate text-lg font-semibold">{username}</div>
              <RoleChip isAdmin={isAdmin} />
            </div>
          </div>

          {isAdmin && (
            <section className="flex flex-col gap-2">
              <h2 className="px-1 text-xs font-medium text-muted-foreground">
                管理
              </h2>
              <div className="grid grid-cols-2 gap-3">
                {shortcuts.map((item) => (
                  <button
                    key={item.key}
                    className="flex flex-col items-center gap-2 rounded-xl bg-raised px-2 py-4 shadow-sm transition-transform active:scale-[0.97]"
                    type="button"
                    onClick={item.onClick}
                  >
                    <IconTile icon={item.icon} size="lg" tone={item.tone} />
                    <span className="text-sm">{item.label}</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          <section className="flex flex-col gap-2">
            <h2 className="px-1 text-xs font-medium text-muted-foreground">
              登录与安全
            </h2>
            <SecurityList items={securityItems} />
          </section>

          {logoutButton}
        </div>
      ) : (
        <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-6">
          <PageHeader description="你的账号信息和登录方式" title="账户与登录" />

          <section className="overflow-hidden rounded-xl border border-border bg-raised">
            <div className="flex items-center gap-4 p-5">
              <Avatar name={username} size="lg" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-base font-semibold">
                    {username}
                  </span>
                  <RoleChip isAdmin={isAdmin} />
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {isAdmin
                    ? "管理员账号：可管理服务器、节点、订阅和用户"
                    : "普通账号：可管理自己的订阅与转发规则"}
                </p>
              </div>
            </div>
          </section>

          <SecurityPanel items={securityItems} />

          <section className="overflow-hidden rounded-xl border border-border bg-raised">
            <div className="flex flex-wrap items-center justify-between gap-3 p-5">
              <div className="min-w-0">
                <h2 className="text-sm font-medium">会话</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  退出后需要重新登录；服务器、节点和转发规则不受影响
                </p>
              </div>
              <Button
                className="shrink-0 border-destructive/30 text-destructive hover:bg-destructive/10"
                size="sm"
                variant="outline"
                onClick={handleLogout}
              >
                {<LogOut className="h-4 w-4" />}
                退出登录
              </Button>
            </div>
            <div className="grid gap-3 border-t border-hairline p-5 text-xs sm:grid-cols-3">
              <div>
                <div className="text-muted-foreground">当前设备</div>
                <div className="mt-1 truncate font-medium">
                  {sessionDevice()}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">登录时间</div>
                <div className="mt-1 truncate font-mono">
                  {sessionTimes().login}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">会话到期</div>
                <div className="mt-1 truncate font-mono">
                  {sessionTimes().expiry}
                </div>
              </div>
            </div>
            <div className="border-t border-hairline p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-medium">登录设备</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    当前账号最近活跃的会话
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    disabled={sessionBusy || sessions.length <= 1}
                    size="sm"
                    variant="ghost"
                    onClick={revokeOthers}
                  >
                    退出其他设备
                  </Button>
                  <Button
                    className="text-destructive hover:text-destructive"
                    disabled={sessionBusy}
                    size="sm"
                    variant="outline"
                    onClick={revokeAll}
                  >
                    退出所有设备
                  </Button>
                </div>
              </div>
              <div className="mt-3 flex flex-col">
                {sessionsLoading ? (
                  <p className="py-3 text-xs text-muted-foreground">
                    正在加载会话…
                  </p>
                ) : sessions.length === 0 ? (
                  <p className="py-3 text-xs text-muted-foreground">
                    当前会话已在上方显示
                  </p>
                ) : (
                  sessions.map((session) => (
                    <div
                      key={session.id}
                      className="flex items-center justify-between gap-3 border-b border-hairline py-2.5 last:border-b-0"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="truncate">
                            {describeUA(session.userAgent)}
                          </span>
                          {session.current && (
                            <Badge variant="success">当前</Badge>
                          )}
                        </div>
                        <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
                          {session.ip || "未知 IP"} · 最近活跃{" "}
                          {relativeTime(session.lastSeenAt)}
                        </div>
                      </div>
                      {!session.current && (
                        <Button
                          disabled={sessionBusy}
                          size="sm"
                          variant="ghost"
                          onClick={() => revokeOne(session)}
                        >
                          退出
                        </Button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>
        </div>
      )}

      {/* The desktop sidebar already shows the version. */}
      {isH5 && (
        <VersionFooter
          containerClassName="mt-8 text-center"
          poweredClassName="text-xs text-muted-foreground"
          updateBadgeClassName="ml-2 inline-flex items-center rounded-full bg-destructive px-2 py-0.5 text-[11px] font-semibold tracking-wide text-white"
          version={
            isWebViewFunc() ? siteConfig.app_version : siteConfig.version
          }
          versionClassName="mt-1 text-xs text-muted-foreground"
        />
      )}

      <PasskeyModal
        isOpen={openLogin === "passkey"}
        items={passkeys ?? []}
        onChanged={() => void loadPasskeys()}
        onClose={() => setOpenLogin(null)}
      />
      <GithubBindingModal
        info={github}
        isOpen={openLogin === "github"}
        onChanged={() => void loadGithub()}
        onClose={() => setOpenLogin(null)}
      />

      {/* 修改密码弹窗 */}
      <Dialog
        backdrop="blur"
        classNames={{
          base: "!w-[calc(100%-32px)] !mx-auto sm:!w-full rounded-xl overflow-hidden",
        }}
        open={isOpen}
        placement="center"
        scrollBehavior="inside"
        size="2xl"
        onOpenChange={() => {
          onOpenChange();
          resetPasswordForm();
        }}
      >
        <DialogContent>
          {(onClose: () => void) => (
            <>
              <DialogHeader className="flex flex-col gap-1">
                修改密码
              </DialogHeader>
              <DialogBody>
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="profile-new-username">新用户名</Label>
                    <Input
                      id="profile-new-username"
                      placeholder="请输入新用户名（至少3位）"
                      value={passwordForm.newUsername}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setPasswordForm((prev) => ({
                          ...prev,
                          newUsername: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="profile-current-password">当前密码</Label>
                    <Input
                      id="profile-current-password"
                      placeholder="请输入当前密码"
                      type="password"
                      value={passwordForm.currentPassword}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setPasswordForm((prev) => ({
                          ...prev,
                          currentPassword: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="profile-new-password">新密码</Label>
                    <Input
                      id="profile-new-password"
                      placeholder="请输入新密码（至少6位）"
                      type="password"
                      value={passwordForm.newPassword}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setPasswordForm((prev) => ({
                          ...prev,
                          newPassword: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="profile-confirm-password">确认密码</Label>
                    <Input
                      id="profile-confirm-password"
                      placeholder="请再次输入新密码"
                      type="password"
                      value={passwordForm.confirmPassword}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setPasswordForm((prev) => ({
                          ...prev,
                          confirmPassword: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
              </DialogBody>
              <DialogFooter>
                <Button variant="ghost" onClick={onClose}>
                  取消
                </Button>
                <Button
                  loading={passwordLoading}
                  onClick={handlePasswordSubmit}
                >
                  修改密码
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
