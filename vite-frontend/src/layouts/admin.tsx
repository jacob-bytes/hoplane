import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  Activity,
  ArrowLeftRight,
  Globe,
  LayoutDashboard,
  Link2,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Rss,
  Server,
  Settings,
  Share2,
  UserRound,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/brand-logo";
import { VersionFooter } from "@/components/version-footer";
import { CommandPalette } from "@/components/command-palette";
import { Avatar } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getMonitorAccess } from "@/api";
import { safeLogout } from "@/utils/logout";
import { siteConfig } from "@/config/site";
import { useMobileBreakpoint } from "@/hooks/useMobileBreakpoint";
import { getAdminFlag, getSessionName } from "@/utils/session";
import { useHasMySubscriptions } from "@/hooks/use-has-my-subscriptions";

interface MenuItem {
  path: string;
  label: string;
  icon: React.ReactNode;
  adminOnly?: boolean;
  // Hidden for admins: the page lives under 中转 for them.
  userOnly?: boolean;
  adminLabel?: string;
  // Admin menu heading shown above this item.
  section?: string;
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuVisible, setMobileMenuVisible] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(
    () => localStorage.getItem("sidebar_collapsed") === "true",
  );
  const [isAdmin, setIsAdmin] = useState(() => getAdminFlag());
  const hasMySubs = useHasMySubscriptions(isAdmin);
  const [monitorAllowed, setMonitorAllowed] = useState<boolean | null>(null);
  const [monitorAccessReason, setMonitorAccessReason] = useState<string | null>(
    null,
  );
  const sessionName = getSessionName() ?? "账户";
  const isMobile = useMobileBreakpoint();

  // 菜单项配置：管理员按 资源 / 分发 / 系统 分组（用户页含分组和限速），普通用户保持原样
  const menuItems: MenuItem[] = [
    {
      path: "/dashboard",
      section: "资源",
      label: "仪表",
      adminLabel: "概览",
      icon: <LayoutDashboard className="h-5 w-5" />,
    },
    {
      path: "/forward",
      label: "规则",
      icon: <ArrowLeftRight className="h-5 w-5" />,
      userOnly: true,
    },
    {
      path: "/my-subscriptions",
      label: "订阅",
      icon: <Rss className="h-5 w-5" />,
      // Shown once the user has subscriptions assigned.
      userOnly: true,
    },
    {
      path: "/node",
      label: "服务器",
      icon: <Server className="h-5 w-5" />,
      adminOnly: true,
    },
    {
      path: "/inbound",
      label: "节点",
      icon: <Globe className="h-5 w-5" />,
      adminOnly: true,
    },
    {
      path: "/relay",
      label: "中转",
      icon: <Link2 className="h-5 w-5" />,
      adminOnly: true,
    },
    {
      path: "/subscription",
      section: "分发",
      label: "订阅",
      icon: <Rss className="h-5 w-5" />,
      adminOnly: true,
    },
    {
      path: "/user",
      label: "用户",
      icon: <Users className="h-5 w-5" />,
      adminOnly: true,
    },
    {
      path: "/monitor",
      // Admins find monitoring under 节点 and 中转.
      userOnly: true,
      section: "系统",
      label: "监控",
      icon: <Activity className="h-5 w-5" />,
    },
    {
      path: "/panel-sharing",
      label: "共享",
      icon: <Share2 className="h-5 w-5" />,
      adminOnly: true,
    },
    {
      path: "/config",
      label: "设置",
      icon: <Settings className="h-5 w-5" />,
      adminOnly: true,
    },
  ];

  useEffect(() => {
    // 获取用户信息
    const adminFlag = getAdminFlag();

    setIsAdmin(adminFlag);

    // Monitor permission is not strictly role-based; non-admin users may be
    // granted access explicitly. Fetch a lightweight capability flag so we can
    // avoid a confusing 403 navigation.
    if (adminFlag) {
      setMonitorAllowed(true);
      setMonitorAccessReason(null);

      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const res = await getMonitorAccess();

        if (cancelled) return;
        if (res.code === 0 && res.data) {
          setMonitorAllowed(Boolean(res.data.allowed));
          setMonitorAccessReason(
            res.data.allowed ? null : res.data.reason || null,
          );

          return;
        }
        // Fail open to preserve legacy navigation behavior.
        setMonitorAllowed(true);
        setMonitorAccessReason(null);
      } catch {
        if (cancelled) return;
        setMonitorAllowed(true);
        setMonitorAccessReason(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isMobile) {
      setMobileMenuVisible(false);
    }
  }, [isMobile]);

  // The layout now stays mounted across pages: start each page at the top
  // and with the mobile menu closed, as a fresh layout did.
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    mainRef.current?.scrollTo(0, 0);
    setMobileMenuVisible(false);
  }, [location.pathname]);

  // 退出登录
  const handleLogout = () => {
    safeLogout();
  };

  // 切换移动端菜单
  const toggleMobileMenu = () => {
    setMobileMenuVisible(!mobileMenuVisible);
  };

  // 隐藏移动端菜单
  const hideMobileMenu = () => {
    setMobileMenuVisible(false);
  };

  // 切换折叠状态
  const toggleCollapse = () => {
    const newCollapsed = !isCollapsed;

    setIsCollapsed(newCollapsed);
    localStorage.setItem("sidebar_collapsed", newCollapsed.toString());
  };

  // 菜单点击处理
  const handleMenuClick = (path: string) => {
    if (path === "/monitor" && monitorAllowed !== true) {
      if (monitorAllowed == null) {
        toast("正在检查监控权限，请稍后重试");

        return;
      }

      const hint =
        monitorAccessReason === "need_admin_grant"
          ? "暂无监控权限，请联系管理员在用户页面授予监控权限"
          : "暂无监控权限，请联系管理员授权";

      toast.error(hint);

      return;
    }

    navigate(path);
    if (isMobile) {
      hideMobileMenu();
    }
  };

  // 过滤菜单项（根据权限）
  const filteredMenuItems = menuItems
    .filter((item) => (isAdmin ? !item.userOnly : !item.adminOnly))
    .filter((item) => item.path !== "/my-subscriptions" || hasMySubs)
    .map((item) =>
      isAdmin && item.adminLabel ? { ...item, label: item.adminLabel } : item,
    );

  // Breadcrumb names: the nav item gives the group, the route gives the page
  // (a sub-page such as 转发规则 sits under 中转 but is not the 中转 page).
  const breadcrumbTitles: Record<string, [section: string, page: string]> = {
    "/dashboard": ["资源", "概览"],
    "/node": ["资源", "服务器"],
    "/inbound": ["资源", "节点"],
    "/relay": ["资源", "中转"],
    "/tunnel": ["资源", "隧道"],
    "/forward": ["资源", "转发规则"],
    "/monitor": ["资源", "监控"],
    "/subscription": ["分发", "订阅"],
    "/user": ["分发", "用户"],
    "/group": ["分发", "分组"],
    "/limit": ["分发", "限速"],
    "/panel-sharing": ["分发", "共享"],
    "/my-subscriptions": ["分发", "我的订阅"],
    "/config": ["系统", "设置"],
    "/profile": ["系统", "账户与登录"],
  };
  const crumb = breadcrumbTitles[location.pathname] ?? ["", "概览"];
  const currentSection = isAdmin ? crumb[0] : "";
  const currentLabel = crumb[1];

  return (
    <div
      className={`flex ${isMobile ? "min-h-screen" : "h-screen"} overflow-hidden bg-canvas`}
    >
      <a
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-[60] focus:rounded-md focus:bg-raised focus:px-3 focus:py-2 focus:text-sm focus:shadow-md"
        href="#main-content"
      >
        跳到主内容
      </a>
      {/* 移动端遮罩层 */}
      {isMobile && mobileMenuVisible && (
        <button
          aria-label="关闭菜单"
          className="fixed inset-0 bg-foreground/20 z-40"
          type="button"
          onClick={hideMobileMenu}
        />
      )}

      {/* 左侧菜单栏 */}
      <aside
        className={`
        ${isMobile ? "fixed top-0 left-0 h-screen w-64 rounded-r-xl border-r border-border" : "relative h-full border-r border-border"}
        ${isMobile && !mobileMenuVisible ? "-translate-x-full" : "translate-x-0"}
        ${isMobile ? "" : isCollapsed ? "w-[76px]" : "w-[248px]"}
        bg-surface
        z-50
        transition-all duration-300 ease-in-out
        flex flex-col flex-shrink-0      `}
      >
        {/* Logo 区域 */}
        <div className="px-4 py-4 [@media(max-height:760px)]:py-3 flex items-center overflow-hidden whitespace-nowrap box-border">
          {/* The mark's viewBox is 200×200 but the artwork is 182×123, so a
              20px box shows an 18×12 glyph. 18px keeps it just under the
              20px navigation icons in visual weight. */}
          <BrandLogo className="h-[18px] w-[18px] flex-shrink-0" size={18} />
          <div
            className={`transition-all duration-300 overflow-hidden ${isCollapsed ? "max-w-0 opacity-0 ml-0" : "max-w-[180px] opacity-100 ml-3"}`}
          >
            <h1 className="text-sm font-semibold tracking-tight text-foreground overflow-hidden whitespace-nowrap text-ellipsis">
              {siteConfig.name}
            </h1>
          </div>
        </div>

        {/* 菜单导航 */}
        <nav className="flex-1 px-2 overflow-y-auto overflow-x-hidden scrollbar-hide">
          <ul className="space-y-1">
            {filteredMenuItems.map((item) => {
              const isActive =
                location.pathname === item.path ||
                (item.path === "/relay" &&
                  isAdmin &&
                  ["/tunnel", "/forward"].includes(location.pathname)) ||
                (item.path === "/user" &&
                  ["/group", "/limit"].includes(location.pathname));
              const isMonitor = item.path === "/monitor";
              const isMonitorBlocked = isMonitor && monitorAllowed !== true;

              return (
                <li key={item.path}>
                  {isAdmin &&
                    item.section &&
                    (isCollapsed ? (
                      <div className="mx-2 my-2 border-t border-border" />
                    ) : (
                      <div className="px-2.5 pb-1.5 pt-4 text-[11px] font-medium tracking-wide text-muted-foreground/80 [@media(max-height:760px)]:pt-3">
                        {item.section}
                      </div>
                    ))}
                  <motion.button
                    aria-current={isActive ? "page" : undefined}
                    aria-disabled={isMonitorBlocked}
                    className={`
                       group w-full flex items-center px-2.5 py-1.5 rounded-md text-left
                       relative min-h-9 overflow-hidden transition-colors duration-150
                       ${isMonitorBlocked ? "opacity-60" : ""}
                       ${
                         isActive
                           ? "text-primary font-medium"
                           : isMonitorBlocked
                             ? "text-muted-foreground font-normal"
                             : "text-muted-foreground hover:text-foreground font-normal"
                       }
                     `}
                    title={
                      isCollapsed
                        ? isMonitorBlocked
                          ? `${item.label} (无权限)`
                          : item.label
                        : undefined
                    }
                    transition={{ duration: 0.15 }}
                    onClick={() => handleMenuClick(item.path)}
                  >
                    {isActive && (
                      <motion.div
                        className="absolute inset-0 rounded-md bg-primary-soft"
                        layoutId="sidebar-active"
                        transition={{
                          type: "spring",
                          stiffness: 380,
                          damping: 30,
                        }}
                      />
                    )}
                    {!isActive && (
                      <motion.div
                        className="absolute inset-0 rounded-md bg-surface opacity-0"
                        transition={{ duration: 0.15 }}
                        whileHover={{ opacity: 1 }}
                      />
                    )}
                    <div
                      className={`relative z-10 flex h-6 w-6 flex-shrink-0 items-center justify-center ${isActive ? "text-primary" : ""}`}
                    >
                      {item.icon}
                    </div>
                    <div
                      className={`transition-all duration-300 overflow-hidden flex items-center ${isCollapsed ? "max-w-0 opacity-0 ml-0" : "max-w-[200px] opacity-100 ml-3"}`}
                    >
                      {/* 13px only here: navigation chrome sits a step below
                          the 14px body so long lists fit on a laptop. */}
                      <span className="relative z-10 whitespace-nowrap text-[13px]">
                        {item.label}
                      </span>
                    </div>
                  </motion.button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* 底部账号操作、版权信息和折叠按钮 */}
        <div className="px-5 py-4 [@media(max-height:760px)]:py-3 [@media(max-height:760px)]:gap-2 mt-auto flex-shrink-0 flex flex-col gap-3 overflow-hidden whitespace-nowrap box-border">
          {/* The collapse control moved to the header, so only the version
              stays here; it hides itself when the sidebar is collapsed. */}
          <div
            className={`min-w-0 overflow-hidden transition-all duration-300 ${
              isCollapsed ? "hidden" : "flex items-center"
            }`}
          >
            <VersionFooter
              poweredClassName="text-xs text-muted-foreground"
              updateBadgeClassName="ml-2 inline-flex items-center rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold tracking-wide text-primary-foreground"
              version={siteConfig.version}
              versionClassName="text-xs text-muted-foreground"
            />
          </div>
        </div>
      </aside>

      {/* 主内容区域 */}
      <div
        className={`relative flex min-w-0 flex-1 flex-col ${isMobile ? "min-h-0" : "h-full overflow-hidden"}`}
      >
        {/* 顶栏：移动端菜单按钮 + 面包屑 */}
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-hairline bg-raised pl-3 pr-3 lg:pr-6">
          {isMobile && (
            <Button
              aria-label="打开菜单"
              className="-ml-1 shrink-0"
              size="icon"
              variant="ghost"
              onClick={toggleMobileMenu}
            >
              <svg
                className="h-5 w-5 text-foreground"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  d="M4 6h16M4 12h16M4 18h16"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                />
              </svg>
            </Button>
          )}
          {isMobile && (
            <span
              aria-hidden
              className="mx-1 h-5 w-px shrink-0 bg-hairline-strong"
            />
          )}
          {!isMobile && (
            <>
              <Button
                aria-label={isCollapsed ? "展开侧栏" : "收起侧栏"}
                className="shrink-0 text-muted-foreground"
                size="icon"
                variant="ghost"
                onClick={toggleCollapse}
              >
                {isCollapsed ? (
                  <PanelLeftOpen className="h-4 w-4" />
                ) : (
                  <PanelLeftClose className="h-4 w-4" />
                )}
              </Button>
              <span
                aria-hidden
                className="mx-1 h-5 w-px shrink-0 bg-hairline-strong"
              />
            </>
          )}
          <nav
            aria-label="面包屑"
            className="flex min-w-0 flex-1 items-center gap-1.5 text-sm"
          >
            <button
              className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
              type="button"
              onClick={() => navigate("/dashboard")}
            >
              {isAdmin ? "后台" : "首页"}
            </button>
            {currentSection && (
              <>
                <span aria-hidden className="shrink-0 text-hairline-strong">
                  /
                </span>
                <span className="truncate text-muted-foreground">
                  {currentSection}
                </span>
              </>
            )}
            <span aria-hidden className="shrink-0 text-hairline-strong">
              /
            </span>
            <span className="truncate font-medium text-foreground">
              {currentLabel}
            </span>
          </nav>

          <CommandPalette />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                aria-label="账户菜单"
                className="flex shrink-0 items-center gap-2 rounded-lg py-1 pl-1 pr-2 text-sm transition-colors hover:bg-accent"
                type="button"
              >
                <Avatar name={sessionName} size="sm" />
                <span className="hidden max-w-[10rem] truncate text-muted-foreground sm:block">
                  {sessionName}
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => navigate("/profile")}>
                <UserRound className="h-4 w-4" />
                账户与登录
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive"
                onSelect={handleLogout}
              >
                <LogOut className="h-4 w-4" />
                退出登录
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        {/* 主内容 */}
        <main
          ref={mainRef}
          className="flex-1 overflow-y-auto scrollbar-hide"
          id="main-content"
        >
          {/* Enter animation only: an exit animation would hold the next
              page back until the old one is gone. */}
          <motion.div
            key={location.pathname}
            animate={{ opacity: 1, y: 0 }}
            className="h-full"
            initial={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.22, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  );
}
