import { SelectField } from "@/components/select-native";

export function OutboundIPSelect({
  value,
  kernelType,
  onChange,
}: {
  value: "auto" | "ipv4_only" | "ipv6_only" | "prefer_ipv4" | "prefer_ipv6";
  kernelType: string;
  onChange: (
    value: "auto" | "ipv4_only" | "ipv6_only" | "prefer_ipv4" | "prefer_ipv6",
  ) => void;
}) {
  const supported = kernelType === "xray" || kernelType === "singbox";

  return (
    <SelectField
      description={
        supported
          ? value.startsWith("prefer_")
            ? "优先尝试所选 IP；域名无对应记录或 TCP 连接失败时回退到另一类型（约 250ms 启动备用尝试）。UDP 优先选择解析地址，远端静默不回包时无法可靠自动切换。链式代理的最终出口由目标服务器决定。"
            : "入站地址不变；仅 IPv4 / IPv6 时只解析和连接所选 IP 类型，并拒绝另一类型的目标。仅 IPv6 需要服务器具备 IPv6 连通性。链式代理的最终出口由目标服务器决定。"
          : "此策略需要 Xray 或 sing-box 内核"
      }
      isDisabled={!supported}
      label="出站 IP 策略"
      options={[
        { value: "auto", label: "自动（IPv4 / IPv6）" },
        { value: "ipv4_only", label: "仅 IPv4 出站" },
        { value: "ipv6_only", label: "仅 IPv6 出站" },
        { value: "prefer_ipv4", label: "优先 IPv4（失败回退 IPv6）" },
        { value: "prefer_ipv6", label: "优先 IPv6（失败回退 IPv4）" },
      ]}
      value={value}
      onValueChange={(next) => onChange(next as typeof value)}
    />
  );
}
