import {
  ArrowLeftRight,
  Globe,
  LayoutDashboard,
  Rss,
  Server,
  UserRound,
} from "lucide-react";
import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";

import { BrandLogo } from "@/components/brand-logo";
import { siteConfig } from "@/config/site";
import { getAdminFlag } from "@/utils/session";
import { useHasMySubscriptions } from "@/hooks/use-has-my-subscriptions";
import { useScrollTopOnPathChange } from "@/hooks/useScrollTopOnPathChange";

interface TabItem {
  path: string;
  label: string;
  icon: React.ReactNode;
  adminOnly?: boolean;
  // Admins reach it from the profile page instead, to keep the bar short.
  userOnly?: boolean;
  adminLabel?: string;
}

export default function H5Layout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [isAdmin, setIsAdmin] = useState(() => getAdminFlag());
  const hasMySubs = useHasMySubscriptions(isAdmin);

  useScrollTopOnPathChange();

  const [pull, setPull] = useState(0);
  const pullRef = useRef(0);
  const touchStart = useRef<number | null>(null);

  useEffect(() => {
    const onTouchStart = (event: TouchEvent) => {
      if (window.scrollY <= 0 && event.touches.length === 1) {
        touchStart.current = event.touches[0].clientY;
      }
    };

    const onTouchMove = (event: TouchEvent) => {
      if (touchStart.current === null) return;

      const delta = event.touches[0].clientY - touchStart.current;

      if (delta > 0 && window.scrollY <= 0) {
        if (delta > 20) event.preventDefault();
        const next = Math.min(80, delta * 0.5);

        pullRef.current = next;
        setPull(next);
      }
    };

    const onTouchEnd = () => {
      if (pullRef.current >= 60) {
        window.location.reload();
      }

      pullRef.current = 0;
      setPull(0);
      touchStart.current = null;
    };

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd);

    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, []);

  // Tabbar配置
  // Admins work along the landing → relay → subscription flow; the forward
  // pages for regular users stay as they were.
  const tabItems: TabItem[] = [
    {
      path: "/dashboard",
      label: "首页",
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
      path: "/subscription",
      label: "订阅",
      icon: <Rss className="h-5 w-5" />,
      adminOnly: true,
    },
    {
      path: "/profile",
      label: "我的",
      adminLabel: "更多",
      icon: <UserRound className="h-5 w-5" />,
    },
  ];

  const pageSections: Record<string, string> = {
    "/dashboard": "资源",
    "/node": "资源",
    "/inbound": "资源",
    "/relay": "资源",
    "/tunnel": "资源",
    "/forward": "资源",
    "/subscription": "分发",
    "/user": "分发",
    "/group": "分发",
    "/limit": "分发",
    "/my-subscriptions": "分发",
    "/audit": "系统",
    "/config": "系统",
    "/profile": "系统",
  };

  useEffect(() => {
    setIsAdmin(getAdminFlag());
  }, []);

  // Tab点击处理
  const handleTabClick = (path: string) => {
    navigate(path);
  };

  // 过滤tab项（根据权限）
  const filteredTabItems = tabItems.filter(
    (item) =>
      (isAdmin ? !item.userOnly : !item.adminOnly) &&
      (item.path !== "/my-subscriptions" || hasMySubs),
  );

  const tabsRef = useRef(filteredTabItems);
  const pathRef = useRef(location.pathname);

  tabsRef.current = filteredTabItems;
  pathRef.current = location.pathname;

  useEffect(() => {
    let start: { x: number; y: number } | null = null;

    const onStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) return;

      start = {
        x: event.touches[0].clientX,
        y: event.touches[0].clientY,
      };
    };

    const onEnd = (event: TouchEvent) => {
      if (!start) return;

      const touch = event.changedTouches[0];
      const dx = touch.clientX - start.x;
      const dy = touch.clientY - start.y;

      start = null;

      if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;

      const target = event.target as HTMLElement | null;

      if (
        target?.closest(
          '[role="dialog"], [role="tablist"], .overflow-x-auto, input, select, textarea, [data-slot="select-trigger"]',
        )
      ) {
        return;
      }

      const path = pathRef.current;
      const isActive = (itemPath: string) =>
        itemPath === path ||
        (itemPath === "/relay" &&
          isAdmin &&
          ["/tunnel", "/forward"].includes(path)) ||
        (itemPath === "/profile" &&
          isAdmin &&
          ["/node", "/user", "/group", "/limit", "/config", "/relay"].includes(
            path,
          ));
      const tabs = tabsRef.current;
      const index = tabs.findIndex((item) => isActive(item.path));

      if (index < 0) return;

      const next = tabs[index + (dx < 0 ? 1 : -1)];

      if (!next) return;

      navigate(next.path);
    };

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchend", onEnd);

    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchend", onEnd);
    };
  }, [isAdmin, navigate]);

  return (
    <div className="flex flex-col min-h-screen bg-mesh-gradient">
      {/* 顶部导航栏 */}
      <header className="relative z-10 flex h-14 flex-shrink-0 items-center justify-between border-b border-hairline bg-raised px-4 safe-top">
        <div className="flex min-w-0 items-center gap-2">
          <BrandLogo size={20} />
          <h1 className="truncate text-sm font-bold text-foreground">
            {siteConfig.name}
          </h1>
          {pageSections[location.pathname] ? (
            <>
              <span
                aria-hidden
                className="h-4 w-px shrink-0 bg-hairline-strong"
              />
              <span className="truncate text-sm text-muted-foreground">
                {pageSections[location.pathname]}
              </span>
            </>
          ) : null}
        </div>

        <div className="flex items-center gap-2" />
      </header>

      {pull > 0 && (
        <div
          aria-live="polite"
          className="pointer-events-none fixed left-1/2 top-14 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full border border-hairline bg-raised px-3 py-1 text-[11px] text-muted-foreground shadow-sm"
          style={{ transform: `translate(-50%, ${Math.max(0, pull - 16)}px)` }}
        >
          <span
            className={`h-3 w-3 rounded-full border-2 border-primary border-t-transparent ${pull >= 60 ? "" : "animate-spin"}`}
          />
          {pull >= 60 ? "松开刷新" : "下拉刷新"}
        </div>
      )}

      {/* 主内容区域 */}
      <main
        key={location.pathname}
        className="flex-1 animate-in fade-in-0 duration-200 motion-reduce:animate-none"
      >
        {children}
      </main>

      {/* 用于给固定 Tabbar 腾出空间的占位元素 */}
      <div aria-hidden className="h-[calc(4rem+var(--safe-area-bottom))]" />

      {/* 底部Tabbar */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 flex h-[calc(4rem+var(--safe-area-bottom))] flex-shrink-0 items-center justify-around border-t border-border bg-raised px-2">
        {filteredTabItems.map((item) => {
          const isActive =
            location.pathname === item.path ||
            (item.path === "/relay" &&
              isAdmin &&
              ["/tunnel", "/forward"].includes(location.pathname)) ||
            (item.path === "/profile" &&
              isAdmin &&
              [
                "/node",
                "/user",
                "/group",
                "/limit",
                "/config",
                "/relay",
              ].includes(location.pathname));

          return (
            <button
              key={item.path}
              className={`
                flex flex-col items-center justify-center flex-1 h-full pb-[var(--safe-area-bottom)]
                transition-colors duration-200 min-h-[44px]
                ${
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }
              `}
              onClick={() => handleTabClick(item.path)}
            >
              <div
                className={`mb-1 flex h-7 w-12 flex-shrink-0 items-center justify-center rounded-full transition-colors duration-200 ${
                  isActive ? "bg-primary/10" : ""
                }`}
              >
                {item.icon}
              </div>
              <span className="text-xs font-medium">
                {(isAdmin && item.adminLabel) || item.label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
