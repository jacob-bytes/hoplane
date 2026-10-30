import { useState } from "react";
import {
  CalendarClock,
  ChevronDown,
  ChevronRight,
  Database,
  ListChecks,
  TimerReset,
  Waypoints,
} from "lucide-react";

const DAY = 86400000;

import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

import { AnimatedPage } from "@/components/animated-page";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PageEmptyState, PageLoadingState } from "@/components/page-state";
import { ListGroup, ListRow } from "@/components/page-kit";
import { AnnouncementBanner } from "@/pages/dashboard/components/announcement-banner";
import { AnnouncementModal } from "@/pages/dashboard/components/announcement-modal";
import { FlowChartCard } from "@/components/lazy-charts";
import { MetricCard } from "@/pages/dashboard/components/metric-card";
import { getAdminFlag, getSessionName } from "@/utils/session";
import { AdminOverview } from "@/pages/dashboard/admin-overview";
import { safeLogout } from "@/utils/logout";
import {
  formatTraffic,
  formatFlowLimit,
  flowLimitBytes,
} from "@/utils/traffic";
import {
  formatNodeRenewalTime,
  getNodeRenewalCycleLabel,
  getNodeRenewalSnapshot,
} from "@/pages/node/renewal";
import {
  useDashboardData,
  type DashboardForward as Forward,
  type DashboardNodeExpiryItem,
  type DashboardUserTunnel as UserTunnel,
} from "@/pages/dashboard/use-dashboard-data";

/** Admins get the health overview; regular users their traffic and rules. */
export default function DashboardPage() {
  return getAdminFlag() ? <AdminOverview /> : <UserDashboard />;
}

function UserDashboard() {
  const navigate = useNavigate();
  const username = getSessionName() || "User";

  const handleLogout = () => {
    safeLogout();
    toast.success("已退出登录");
  };

  const {
    loading,
    userInfo,
    userTunnels,
    forwardList,
    statisticsFlows,
    nodeExpiryReminders,
    isAdmin,
    announcement,
    isAnnouncementModalOpen,
    setIsAnnouncementModalOpen,
    dismissAnnouncementModal,
  } = useDashboardData();

  const [expandedTunnels, setExpandedTunnels] = useState<Set<number>>(
    new Set(),
  );
  const [flowRange, setFlowRange] = useState<"24h" | "7d" | "30d">("24h");

  const formatFlow = formatTraffic;

  const formatNumber = (value: number): string => {
    // 99999 表示无限制
    if (value === 99999) {
      return "无限制";
    }

    return value.toString();
  };

  const getNodeExpiryStatus = (
    nextDueTime?: number,
    renewalState: "unset" | "expired" | "dueSoon" | "scheduled" = "unset",
  ) => {
    if (!nextDueTime || renewalState === "unset") {
      return {
        label: "未设置",
        badgeClassName:
          "bg-muted text-foreground dark:bg-muted dark:text-muted-foreground",
        nextDueTime: undefined as number | undefined,
      };
    }

    const diffDays = Math.ceil(
      (nextDueTime - Date.now()) / (1000 * 60 * 60 * 24),
    );

    if (renewalState === "expired" || diffDays <= 0) {
      return {
        label: "已逾期",
        badgeClassName: "bg-destructive/10 text-destructive",
        nextDueTime,
      };
    }

    if (diffDays === 1) {
      return {
        label: "明天到期",
        badgeClassName: "bg-warning/10 text-warning-700 dark:text-warning-500",
        nextDueTime,
      };
    }

    return {
      label: `${diffDays}天后到期`,
      badgeClassName:
        diffDays <= 7
          ? "bg-warning/10 text-warning-700 dark:text-warning-500"
          : "bg-success/10 text-success dark:bg-success/20 dark:text-success-300",
      nextDueTime,
    };
  };

  const renderNodeExpiryCard = (node: DashboardNodeExpiryItem) => {
    const renewalSnapshot = getNodeRenewalSnapshot(
      node.expiryTime,
      node.renewalCycle,
    );
    const expiryStatus = getNodeExpiryStatus(
      renewalSnapshot.nextDueTime,
      renewalSnapshot.state,
    );

    return (
      <div
        key={node.id}
        className="rounded-xl border border-warning/20 bg-warning/5 p-4"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-foreground truncate">
              {node.name}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              服务器 ID: {node.id}
            </div>
          </div>
          <span
            className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${expiryStatus.badgeClassName}`}
          >
            {expiryStatus.label}
          </span>
        </div>

        <div className="mt-3 text-sm text-foreground dark:text-muted-foreground">
          {formatNodeRenewalTime(renewalSnapshot.nextDueTime)}
        </div>

        <div className="mt-1 text-xs text-muted-foreground">
          {getNodeRenewalCycleLabel(node.renewalCycle)}
        </div>

        {node.remark?.trim() && (
          <p className="mt-3 line-clamp-2 text-xs leading-5 text-muted-foreground dark:text-muted-foreground">
            {node.remark.trim()}
          </p>
        )}
      </div>
    );
  };

  // 处理24小时流量统计数据
  const processFlowChartData = (range: "24h" | "7d" | "30d") => {
    if (range === "24h") {
      const now = new Date();
      const hours: string[] = [];

      for (let i = 23; i >= 0; i--) {
        const time = new Date(now.getTime() - i * 60 * 60 * 1000);

        hours.push(time.getHours().toString().padStart(2, "0") + ":00");
      }

      const flowMap = new Map<
        string,
        { flow: number; in: number; out: number }
      >();

      statisticsFlows.forEach((item) => {
        flowMap.set(item.time, {
          flow: item.flow || 0,
          in: item.inFlow || 0,
          out: item.outFlow || 0,
        });
      });

      return hours.map((hour) => {
        const point = flowMap.get(hour);

        return {
          time: hour,
          flow: point?.flow || 0,
          in: point?.in || 0,
          out: point?.out || 0,
          formattedFlow: formatFlow(point?.flow || 0),
        };
      });
    }

    const days = range === "7d" ? 7 : 30;
    const buckets = new Map<
      string,
      { flow: number; in: number; out: number }
    >();
    const labels: string[] = [];

    for (let i = days - 1; i >= 0; i--) {
      const day = new Date();

      day.setHours(0, 0, 0, 0);
      day.setDate(day.getDate() - i);
      const key = day.toISOString().slice(0, 10);

      buckets.set(key, { flow: 0, in: 0, out: 0 });
      labels.push(
        `${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`,
      );
    }

    statisticsFlows.forEach((item, index) => {
      const stamp =
        item.createdTime ??
        Date.now() - (statisticsFlows.length - 1 - index) * 3600_000;
      const key = new Date(stamp).toISOString().slice(0, 10);
      const bucket = buckets.get(key);

      if (!bucket) return;
      bucket.flow += item.flow || 0;
      bucket.in += item.inFlow || 0;
      bucket.out += item.outFlow || 0;
    });

    return labels.map((time, index) => {
      const key = [...buckets.keys()][index];
      const bucket = buckets.get(key) ?? { flow: 0, in: 0, out: 0 };

      return {
        time,
        flow: bucket.flow,
        in: bucket.in,
        out: bucket.out,
        formattedFlow: formatFlow(bucket.flow),
      };
    });
  };

  const flowLimit = flowLimitBytes(userInfo.flow || 0, userInfo.flowMiB);
  const flowUsed = (userInfo.inFlow || 0) + (userInfo.outFlow || 0);
  const recentFlow = statisticsFlows
    .filter(
      (item) =>
        item.createdTime && Date.now() - item.createdTime < 7 * 86400_000,
    )
    .reduce((sum, item) => sum + (item.flow || 0), 0);
  const dailyAverage = recentFlow / 7;
  const forecastDays =
    flowLimit > flowUsed && dailyAverage > 0
      ? Math.ceil((flowLimit - flowUsed) / dailyAverage)
      : null;

  const getExpStatus = (expTime?: string | number) => {
    if (!expTime)
      return {
        color: "text-success",
        bg: "bg-success/10 border-success/20",
        text: "永久",
      };

    const now = new Date();
    const expDate = new Date(expTime);

    if (isNaN(expDate.getTime())) {
      return {
        color: "text-muted-foreground",
        bg: "bg-muted border-border",
        text: "无效",
      };
    }

    if (expDate < now) {
      return {
        color: "text-destructive",
        bg: "bg-destructive/10 border-destructive/20",
        text: "已过期",
      };
    }

    const diffTime = expDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays <= 7) {
      return {
        color: "text-destructive",
        bg: "bg-destructive/10 border-destructive/20",
        text: `${diffDays}天后过期`,
      };
    } else if (diffDays <= 30) {
      return {
        color: "text-warning-700 dark:text-warning-500",
        bg: "bg-warning/10 border-warning/20",
        text: `${diffDays}天后过期`,
      };
    } else {
      return {
        color: "text-success",
        bg: "bg-success/10 border-success/20",
        text: `${diffDays}天后过期`,
      };
    }
  };

  const calculateUserTotalUsedFlow = (): number => {
    // 后端已按计费类型处理流量，前端直接使用入站+出站总和
    return (userInfo.inFlow || 0) + (userInfo.outFlow || 0);
  };

  const calculateUsagePercentage = (type: "flow" | "forwards"): number => {
    if (type === "flow") {
      const totalUsed = calculateUserTotalUsedFlow();
      const totalLimit = flowLimitBytes(userInfo.flow || 0, userInfo.flowMiB);

      // 无限制时返回0%
      if (userInfo.flow === 99999 && !userInfo.flowMiB) return 0;

      return totalLimit > 0 ? Math.min((totalUsed / totalLimit) * 100, 100) : 0;
    } else if (type === "forwards") {
      const totalUsed = forwardList.length;
      const totalLimit = userInfo.num || 0;

      // 无限制时返回0%
      if (userInfo.num === 99999) return 0;

      return totalLimit > 0 ? Math.min((totalUsed / totalLimit) * 100, 100) : 0;
    }

    return 0;
  };

  // Usage bars speak Accent for "fine" and only escalate to status colours
  // when the quota is nearly gone.
  const getUsageColor = (percentage: number) => {
    if (percentage >= 90) return "bg-destructive";
    if (percentage >= 70) return "bg-warning";

    return "bg-primary";
  };

  const renderProgressBar = (
    percentage: number,
    size: "sm" | "md" = "md",
    isUnlimited: boolean = false,
  ) => {
    const height = size === "sm" ? "h-1.5" : "h-2";

    if (isUnlimited) {
      return (
        <div className="w-full">
          <div className={`w-full bg-muted rounded-full ${height}`}>
            <div className={`${height} bg-primary/40 rounded-full w-full`} />
          </div>
        </div>
      );
    }

    return (
      <div className="w-full">
        <div className={`w-full bg-muted rounded-full ${height}`}>
          <div
            className={`${height} rounded-full transition-all duration-300 ${getUsageColor(percentage)}`}
            style={{ width: `${Math.min(percentage, 100)}%` }}
          />
        </div>
      </div>
    );
  };

  const calculateTunnelUsedFlow = (tunnel: UserTunnel): number => {
    if (!tunnel) return 0;
    const inFlow = tunnel.inFlow || 0;
    const outFlow = tunnel.outFlow || 0;

    // 后端已按计费类型处理流量，前端直接使用入站+出站总和
    return inFlow + outFlow;
  };

  const calculateTunnelFlowPercentage = (tunnel: UserTunnel): number => {
    const totalUsed = calculateTunnelUsedFlow(tunnel);
    const totalLimit = flowLimitBytes(tunnel.flow || 0, tunnel.flowMiB);

    // 无限制时返回0%
    if (tunnel.flow === 99999 && !tunnel.flowMiB) return 0;

    return totalLimit > 0 ? Math.min((totalUsed / totalLimit) * 100, 100) : 0;
  };

  const getTunnelUsedForwards = (tunnelId: number): number => {
    return forwardList.filter((forward) => forward.tunnelId === tunnelId)
      .length;
  };

  const calculateTunnelForwardPercentage = (tunnel: UserTunnel): number => {
    const totalUsed = getTunnelUsedForwards(tunnel.tunnelId);
    const totalLimit = tunnel.num || 0;

    // 无限制时返回0%
    if (tunnel.num === 99999) return 0;

    return totalLimit > 0 ? Math.min((totalUsed / totalLimit) * 100, 100) : 0;
  };

  const formatResetTime = (resetDay?: number): string => {
    if (resetDay === undefined || resetDay === null) return "";
    if (resetDay === 0) return "不重置";

    const now = new Date();
    const currentDay = now.getDate();

    let daysUntilReset: number;

    if (resetDay > currentDay) {
      daysUntilReset = resetDay - currentDay;
    } else if (resetDay < currentDay) {
      const nextMonth = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        resetDay,
      );
      const diffTime = nextMonth.getTime() - now.getTime();

      daysUntilReset = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    } else {
      daysUntilReset = 0;
    }

    if (daysUntilReset === 0) {
      return "今日重置";
    } else if (daysUntilReset === 1) {
      return "明日重置";
    } else {
      return `${daysUntilReset}天后重置`;
    }
  };

  const formatInAddress = (ipString: string, port: number): string => {
    if (!ipString) return "";

    const items = ipString
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item);

    if (items.length === 0) return "";

    // 检查第一项是否已经包含端口（格式：IP:端口）
    const firstItem = items[0];
    const hasPort = /:\d+$/.test(firstItem);

    if (hasPort) {
      // inIp 已经包含完整的 IP:Port 组合
      if (items.length === 1) {
        return items[0];
      }

      return `${items[0]} (+${items.length - 1}个)`;
    }

    // inIp 只包含IP，需要添加端口（兼容旧数据）
    if (!port) return "";

    if (items.length === 1) {
      const ip = items[0];

      if (ip.includes(":") && !ip.startsWith("[")) {
        return `[${ip}]:${port}`;
      } else {
        return `${ip}:${port}`;
      }
    }

    const firstIp = items[0];
    let formattedFirstIp: string;

    if (firstIp.includes(":") && !firstIp.startsWith("[")) {
      formattedFirstIp = `[${firstIp}]`;
    } else {
      formattedFirstIp = firstIp;
    }

    return `${formattedFirstIp}:${port} (+${items.length - 1}个)`;
  };

  const formatRemoteAddress = (remoteAddr: string): string => {
    if (!remoteAddr) return "";

    const addresses = remoteAddr
      .split(",")
      .map((addr) => addr.trim())
      .filter((addr) => addr);

    if (addresses.length === 0) return "";

    if (addresses.length === 1) {
      return addresses[0];
    }

    return `${addresses[0]} (+${addresses.length - 1})`;
  };

  const calculateForwardBillingFlow = (forward: Forward): number => {
    if (!forward) return 0;

    const inFlow = forward.inFlow || 0;
    const outFlow = forward.outFlow || 0;

    // 后端已按计费类型处理流量，前端直接使用入站+出站总和
    return inFlow + outFlow;
  };

  if (loading) {
    return (
      <div className="px-3 lg:px-6 flex-grow pt-2 lg:pt-4">
        <PageLoadingState message="正在加载数据..." />
      </div>
    );
  }

  return (
    <AnimatedPage className="mx-auto w-full max-w-[1440px] px-6 py-6">
      {/* 顶部个人状态和下拉菜单 */}
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-lg font-semibold">概览</h1>
          <p className="text-xs text-muted-foreground">
            {username}，这里是你的流量和转发规则
          </p>
        </div>
        <div className="flex items-center gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                className="h-9 w-9 min-w-0 rounded-full bg-primary text-sm font-semibold text-primary-foreground"
                size="icon"
                variant="default"
              >
                {username.slice(0, 2).toUpperCase()}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-48">
              <DropdownMenuItem onSelect={() => navigate("/profile")}>
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                  />
                </svg>
                个人资料
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive"
                onSelect={handleLogout}
              >
                <svg
                  className="h-4 w-4"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    clipRule="evenodd"
                    d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z"
                    fillRule="evenodd"
                  />
                </svg>
                退出登录
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      {announcement && <AnnouncementBanner announcement={announcement} />}
      {announcement && (
        <AnnouncementModal
          announcement={announcement}
          isOpen={isAnnouncementModalOpen}
          onClose={() => setIsAnnouncementModalOpen(false)}
          onDontShowAgain={dismissAnnouncementModal}
        />
      )}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:mb-8 lg:grid-cols-4 lg:gap-4">
        <MetricCard
          bottomContent={
            <div className="mt-1">
              {renderProgressBar(
                calculateUsagePercentage("flow"),
                "sm",
                userInfo.flow === 99999 && !userInfo.flowMiB,
              )}
              <div className="mt-1 flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5">
                <p className="min-w-0 truncate text-xs text-muted-foreground">
                  {userInfo.flow === 99999 && !userInfo.flowMiB
                    ? "不限流量"
                    : `共 ${formatFlowLimit(userInfo.flow, userInfo.flowMiB)} · ${calculateUsagePercentage("flow").toFixed(1)}%`}
                </p>
                {forecastDays !== null && (
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    预计 {forecastDays} 天用完
                  </span>
                )}
                {userInfo.flowResetTime !== undefined &&
                  userInfo.flowResetTime !== null && (
                    <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                      <TimerReset className="h-3 w-3" />
                      {formatResetTime(userInfo.flowResetTime)}
                    </span>
                  )}
              </div>
            </div>
          }
          icon={<Database className="h-4 w-4 text-muted-foreground" />}
          iconClassName="bg-muted"
          title="已用流量"
          value={formatFlow(calculateUserTotalUsedFlow())}
          onClick={() => navigate("/my-subscriptions")}
        />

        <MetricCard
          bottomContent={
            <div className="mt-1">
              {renderProgressBar(
                calculateUsagePercentage("forwards"),
                "sm",
                userInfo.num === 99999,
              )}
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {userInfo.num === 99999
                  ? "不限规则数"
                  : `配额 ${formatNumber(userInfo.num || 0)} · ${calculateUsagePercentage("forwards").toFixed(1)}%`}
              </p>
            </div>
          }
          icon={<ListChecks className="h-4 w-4 text-muted-foreground" />}
          iconClassName="bg-muted"
          title="已用规则"
          value={forwardList.length}
          onClick={() => navigate("/forward")}
        />

        <MetricCard
          bottomContent={
            <p className="mt-1 truncate text-xs text-muted-foreground">
              {userTunnels.length > 0
                ? "可创建转发规则的隧道"
                : "暂无隧道权限，请联系管理员"}
            </p>
          }
          icon={<Waypoints className="h-4 w-4 text-muted-foreground" />}
          iconClassName="bg-muted"
          title="隧道权限"
          value={userTunnels.length}
          onClick={() => navigate("/monitor")}
        />

        <MetricCard
          bottomContent={
            <p className="mt-1 truncate text-xs text-muted-foreground">
              {userInfo.expTime
                ? (() => {
                    const days = Math.ceil(
                      (new Date(userInfo.expTime).getTime() - Date.now()) / DAY,
                    );

                    return days <= 0 ? "已到期" : `剩余 ${days} 天`;
                  })()
                : "永久有效"}
            </p>
          }
          icon={<CalendarClock className="h-4 w-4 text-muted-foreground" />}
          iconClassName="bg-muted"
          title="账户到期"
          value={
            userInfo.expTime
              ? new Date(userInfo.expTime).toLocaleDateString("zh-CN", {
                  year: "numeric",
                  month: "2-digit",
                  day: "2-digit",
                })
              : "永久"
          }
          onClick={() => navigate("/profile")}
        />
      </div>

      <FlowChartCard
        chartData={processFlowChartData(flowRange)}
        formatFlow={formatFlow}
        range={flowRange}
        statisticsFlowsCount={statisticsFlows.length}
        onRangeChange={setFlowRange}
      />

      {isAdmin && nodeExpiryReminders.length > 0 && (
        <Card className="mb-6 border border-warning/20 bg-warning/5 shadow-none lg:mb-8">
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between w-full">
              <div className="flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10 text-warning-700 dark:text-warning-500">
                  <svg
                    aria-hidden="true"
                    className="h-5 w-5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      clipRule="evenodd"
                      d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.981-1.742 2.981H4.42c-1.53 0-2.492-1.647-1.743-2.98l5.58-9.92zM11 13a1 1 0 10-2 0 1 1 0 002 0zm-1-7a1 1 0 00-1 1v3a1 1 0 102 0V7a1 1 0 00-1-1z"
                      fillRule="evenodd"
                    />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg lg:text-xl font-semibold text-foreground">
                    服务器到期提醒
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    展示 7
                    天内需要续费或已经逾期的服务器，基于月付/季付/年付周期自动推算
                  </p>
                </div>
              </div>
              <span className="inline-flex w-fit items-center rounded-full bg-raised px-3 py-1 text-xs font-medium text-warning-700 ring-1 ring-warning/20 dark:text-warning-500 tabular">
                {nodeExpiryReminders.length} 个提醒
              </span>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
              {nodeExpiryReminders.slice(0, 6).map(renderNodeExpiryCard)}
            </div>
            {nodeExpiryReminders.length > 6 && (
              <p className="mt-4 text-xs text-muted-foreground">
                还有 {nodeExpiryReminders.length - 6}{" "}
                个服务器未展开显示，可前往服务器页面继续处理。
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* 隧道权限 - 管理员不显示 */}
      {!isAdmin && (
        <Card className="mb-6 border border-hairline shadow-none lg:mb-8">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Waypoints className="h-4 w-4 text-primary" />
              <h2 className="text-[15px] font-medium">隧道权限</h2>
              <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                {userTunnels.length}
              </span>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {userTunnels.length === 0 ? (
              <PageEmptyState className="h-40" message="暂无隧道权限" />
            ) : (
              <div className="divide-y divide-hairline overflow-hidden rounded-xl border border-hairline">
                {userTunnels.map((tunnel) => {
                  const expStatus = getExpStatus(tunnel.expTime);
                  const flowUsed = calculateTunnelUsedFlow(tunnel);
                  const flowPct = calculateTunnelFlowPercentage(tunnel);
                  const rulesUsed = getTunnelUsedForwards(tunnel.tunnelId);
                  const rulesPct = calculateTunnelForwardPercentage(tunnel);
                  const expanded = expandedTunnels.has(tunnel.id);
                  const rules = forwardList
                    .filter((item) => item.tunnelId === tunnel.tunnelId)
                    .slice(0, 3);

                  return (
                    <div key={tunnel.id}>
                      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                        <button
                          aria-expanded={expanded}
                          className="flex min-w-0 flex-1 items-start gap-2 text-left"
                          type="button"
                          onClick={() =>
                            setExpandedTunnels((prev) => {
                              const next = new Set(prev);

                              if (next.has(tunnel.id)) next.delete(tunnel.id);
                              else next.add(tunnel.id);

                              return next;
                            })
                          }
                        >
                          <ChevronDown
                            className={`mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform ${expanded ? "" : "-rotate-90"}`}
                          />
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                              <span className="text-sm font-medium">
                                {tunnel.tunnelName}
                              </span>
                              <span className="text-[11px] text-muted-foreground">
                                ID {tunnel.id}
                              </span>
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                              <span className="rounded-md border border-hairline px-1.5 py-0.5">
                                {tunnel.tunnelFlow === 1
                                  ? "单向计费"
                                  : "双向计费"}
                              </span>
                              <span
                                className={`rounded-md border px-1.5 py-0.5 ${expStatus.bg} ${expStatus.color}`}
                              >
                                {expStatus.text}
                              </span>
                              {tunnel.flowResetTime !== undefined &&
                                tunnel.flowResetTime !== null && (
                                  <span>
                                    {formatResetTime(tunnel.flowResetTime)}
                                  </span>
                                )}
                            </div>
                          </div>
                        </button>
                        <Button
                          className="shrink-0 self-start sm:self-auto"
                          size="sm"
                          variant="ghost"
                          onClick={() => navigate("/forward")}
                        >
                          查看规则
                          <ChevronRight className="h-3.5 w-3.5" />
                        </Button>
                      </div>

                      <div className="grid grid-cols-2 gap-4 px-4 pb-4">
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-baseline justify-between gap-2 text-[11px] text-muted-foreground">
                            <span>流量</span>
                            <span className="truncate font-mono tabular text-foreground">
                              {formatFlow(flowUsed)} /{" "}
                              {formatFlowLimit(tunnel.flow, tunnel.flowMiB)}
                            </span>
                          </div>
                          {renderProgressBar(
                            flowPct,
                            "sm",
                            tunnel.flow === 99999 && !tunnel.flowMiB,
                          )}
                          <span className="text-[11px] text-muted-foreground">
                            {tunnel.flow === 99999 && !tunnel.flowMiB
                              ? "不限流量"
                              : `${flowPct.toFixed(1)}%`}
                          </span>
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-baseline justify-between gap-2 text-[11px] text-muted-foreground">
                            <span>规则</span>
                            <span className="truncate font-mono tabular text-foreground">
                              {rulesUsed} / {formatNumber(tunnel.num)}
                            </span>
                          </div>
                          {renderProgressBar(
                            rulesPct,
                            "sm",
                            tunnel.num === 99999,
                          )}
                          <span className="text-[11px] text-muted-foreground">
                            {tunnel.num === 99999
                              ? "不限规则"
                              : `${rulesPct.toFixed(1)}%`}
                          </span>
                        </div>
                      </div>

                      {expanded && (
                        <div className="border-t border-hairline bg-surface/40 px-4 py-3">
                          <div className="mb-2 flex items-center justify-between text-xs">
                            <span className="font-medium text-muted-foreground">
                              最近规则
                            </span>
                            <button
                              className="text-primary"
                              type="button"
                              onClick={() => navigate("/forward")}
                            >
                              新建规则
                            </button>
                          </div>
                          {rules.length === 0 ? (
                            <p className="text-xs text-muted-foreground">
                              这条隧道下还没有规则
                            </p>
                          ) : (
                            <div className="flex flex-col gap-1.5">
                              {rules.map((rule) => (
                                <div
                                  key={rule.id}
                                  className="flex min-w-0 items-center gap-3 text-xs"
                                >
                                  <span className="w-28 shrink-0 truncate font-medium">
                                    {rule.name}
                                  </span>
                                  <span className="min-w-0 flex-1 truncate font-mono text-muted-foreground">
                                    {formatInAddress(rule.inIp, rule.inPort)} →{" "}
                                    {formatRemoteAddress(rule.remoteAddr)}
                                  </span>
                                  <span className="shrink-0 font-mono tabular text-muted-foreground">
                                    {formatFlow(
                                      calculateForwardBillingFlow(rule),
                                    )}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 规则配置：首页只保留最近五条，完整列表在转发规则页 */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-primary" />
            <h2 className="text-[15px] font-medium">规则配置</h2>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
              {forwardList.length}
            </span>
          </div>
          {forwardList.length > 0 && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => navigate("/forward")}
            >
              查看全部
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>

        {forwardList.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-raised/50 py-10">
            <ListChecks className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">暂无规则配置</p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate("/forward")}
            >
              新建规则
            </Button>
          </div>
        ) : (
          <ListGroup
            columns="minmax(0,1fr) minmax(0,1.6fr) 170px"
            head={["规则", "入口 → 目标", "流量"]}
          >
            {forwardList.slice(0, 5).map((forward) => (
              <ListRow
                key={forward.id}
                cells={[
                  <div key="name" className="min-w-0">
                    <div className="truncate text-sm font-medium">
                      {forward.name}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {forward.tunnelName}
                    </div>
                  </div>,
                  <div
                    key="route"
                    className="min-w-0 truncate font-mono text-xs text-muted-foreground"
                  >
                    {formatInAddress(forward.inIp, forward.inPort) || "-"} →{" "}
                    {formatRemoteAddress(forward.remoteAddr) || "-"}
                  </div>,
                  <div
                    key="flow"
                    className="truncate text-right font-mono text-xs tabular text-muted-foreground"
                  >
                    ↑ {formatFlow(forward.inFlow || 0)} · ↓{" "}
                    {formatFlow(forward.outFlow || 0)}
                  </div>,
                ]}
                meta={`${formatInAddress(forward.inIp, forward.inPort) || "-"} → ${formatRemoteAddress(forward.remoteAddr) || "-"}`}
                title={forward.name}
                onClick={() => navigate("/forward")}
              />
            ))}
          </ListGroup>
        )}
      </section>
    </AnimatedPage>
  );
}
