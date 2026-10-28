import type {
  InboundApiItem,
  KernelApiItem,
  KernelCapabilitiesApiData,
  NodeApiItem,
} from "@/api/types";

import { useMemo, useState } from "react";
import { toast } from "sonner";

import {
  ACME_DNS_LABELS,
  CERT_MODE_LABELS,
  PROTOCOL_LABELS,
  SECURITY_LABELS,
  TRANSPORT_LABELS,
  type InboundForm,
  applyPreset,
  isAutoName,
  passwordProtocols,
  presetsFor,
  protocolCap,
  sniOptionalProtocols,
  toPayload,
  usernameProtocols,
  uuidProtocols,
  visionAllowed,
  vlessEncAllowed,
} from "./presets";
import { DROP_NOTICE, savedDespiteDrop } from "./save-recovery";
import { OutboundIPSelect } from "./outbound-ip-select";

import { createInbound, updateInbound } from "@/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "@/components/dialog";
import { SelectField } from "@/components/select-native";
import { Switch } from "@/components/ui/switch";

interface Props {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  caps: KernelCapabilitiesApiData | null;
  nodes: NodeApiItem[];
  kernels: KernelApiItem[];
  /** All inbounds, to confirm a save whose answer was lost. */
  inbounds: InboundApiItem[];
  initial: InboundForm;
  onSaved: () => void;
  onInstallKernel: (nodeId: number, kernelType: string) => void;
}

const XHTTP_MODES = ["auto", "packet-up", "stream-up", "stream-one"];

export function eligibleNodes(nodes: NodeApiItem[]): NodeApiItem[] {
  return nodes.filter(
    (n) => Number(n.isRemote ?? 0) !== 1 && n.forwardMode !== "nftables",
  );
}

/**
 * The node's IPv4 or IPv6 address for the share address: its own field,
 * else its server IP when that is of the family (as the panel resolves it).
 */
function nodeFamilyIP(node: NodeApiItem | undefined, v6: boolean): string {
  for (const raw of [
    v6 ? node?.serverIpV6 : node?.serverIpV4,
    node?.serverIp,
  ]) {
    const host = String(raw ?? "")
      .trim()
      .replace(/^\[|\]$/g, "");

    if (v6 ? host.includes(":") : /^\d{1,3}(\.\d{1,3}){3}$/.test(host))
      return host;
  }

  return "";
}

export function InboundFormModal({
  isOpen,
  onOpenChange,
  caps,
  nodes,
  kernels,
  inbounds,
  initial,
  onSaved,
  onInstallKernel,
}: Props) {
  const [form, setForm] = useState<InboundForm>(initial);
  const [initialKey, setInitialKey] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(
    initial.outboundIpStrategy !== "auto",
  );
  const isEdit = Boolean(initial.id);
  const selectedNode = nodes.find((node) => String(node.id) === form.nodeId);
  const shareV4 = nodeFamilyIP(selectedNode, false);
  const shareV6 = nodeFamilyIP(selectedNode, true);

  // Reset when the parent opens the modal with a different item.
  if (initialKey !== initial) {
    setInitialKey(initial);
    setForm(initial);
    setShowAdvanced(initial.outboundIpStrategy !== "auto");
  }

  const set = <K extends keyof InboundForm>(key: K, value: InboundForm[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const implementedKernels = useMemo(
    () => (caps?.kernels ?? []).filter((k) => k.implemented && !k.relay),
    [caps],
  );
  const kernelInfo = caps?.kernels.find((k) => k.type === form.kernelType);
  const installedKernel = kernels.find(
    (k) => String(k.nodeId) === form.nodeId && k.kernelType === form.kernelType,
  );
  // snell-server 6.x only serves v6 clients, so new inbounds default to it.
  const defaultSnellVersion =
    form.kernelType === "snell" && installedKernel?.version?.startsWith("6.")
      ? "6"
      : "5";
  // NaïveProxy needs a certificate clients trust, so no self-signed option.
  const certModes = (kernelInfo?.certModes ?? ["self", "file"]).filter(
    (m) => !(form.protocol === "naive" && m === "self"),
  );
  const certMode = certModes.includes(form.certMode)
    ? form.certMode
    : (certModes[0] ?? "self");
  const pCap = protocolCap(caps, form.kernelType, form.protocol);
  const transports = pCap?.transports ?? [];
  const securities =
    transports.find((t) => t.type === form.transportType)?.securities ?? [];

  // Reality / ShadowTLS borrow a public site's name; it must never leak into
  // a TLS SNI (a self-signed cert would be issued for it), and vice versa.
  const borrowed = (t: string) => t === "reality" || t === "shadowtls";
  const nextSni = (prevSecurity: string, prevSni: string, security: string) => {
    if (borrowed(security)) {
      return borrowed(prevSecurity) && prevSni
        ? prevSni
        : (caps?.defaults.realitySni ?? "");
    }

    return borrowed(prevSecurity) ? "" : prevSni;
  };

  const changeKernel = (kernelType: string) => {
    const info = caps?.kernels.find((k) => k.type === kernelType);
    const first = presetsFor(caps, kernelType)[0];

    setForm((prev) => {
      const next: InboundForm = {
        ...prev,
        kernelType,
        outboundIpStrategy:
          kernelType === "xray" || kernelType === "singbox"
            ? prev.outboundIpStrategy
            : "auto",
      };

      if (info?.protocols?.some((p) => p.protocol === prev.protocol)) {
        return next;
      }
      if (first) return applyPreset(next, first, caps);
      const proto = info?.protocols?.[0];

      return {
        ...next,
        protocol: proto?.protocol ?? prev.protocol,
        transportType: proto?.transports[0]?.type ?? "tcp",
        securityType: proto?.transports[0]?.securities[0] ?? "none",
      };
    });
  };

  const pickSecurity = (secs: string[], current: string) =>
    secs.includes(current) ? current : (secs[0] ?? "none");

  const changeProtocol = (protocol: string) => {
    const cap = protocolCap(caps, form.kernelType, protocol);
    const transport = cap?.transports.some((t) => t.type === form.transportType)
      ? form.transportType
      : (cap?.transports[0]?.type ?? "tcp");
    const secs =
      cap?.transports.find((t) => t.type === transport)?.securities ?? [];

    setForm((prev) => {
      const security = pickSecurity(secs, prev.securityType);

      return {
        ...prev,
        protocol,
        transportType: transport,
        securityType: security,
        sni: nextSni(prev.securityType, prev.sni, security),
        name:
          prev.name.trim() && isAutoName(prev.name)
            ? (PROTOCOL_LABELS[protocol] ?? protocol)
            : prev.name,
      };
    });
  };

  const changeTransport = (transportType: string) => {
    const secs =
      transports.find((t) => t.type === transportType)?.securities ?? [];

    setForm((prev) => {
      const security = pickSecurity(secs, prev.securityType);

      return {
        ...prev,
        transportType,
        securityType: security,
        sni: nextSni(prev.securityType, prev.sni, security),
      };
    });
  };

  const changeSecurity = (securityType: string) => {
    setForm((prev) => ({
      ...prev,
      securityType,
      sni: nextSni(prev.securityType, prev.sni, securityType),
    }));
  };

  const validate = (): string | null => {
    if (!form.nodeId) return "请选择服务器";
    if (!installedKernel) return "该服务器还没有安装所选内核";
    if (!form.name.trim()) return "请输入名称";
    if (form.shareAddressMode === "custom" && !form.shareHost.trim())
      return "请输入自定义分享地址";
    if (form.shareAddressMode === "ipv4" && !shareV4)
      return "请先在服务器设置 IPv4 地址";
    if (form.shareAddressMode === "ipv6" && !shareV6)
      return "请先在服务器设置 IPv6 地址";
    if (form.port.trim()) {
      const port = Number(form.port);

      if (!Number.isInteger(port) || port < 1 || port > 65535) {
        return "端口必须在 1-65535 之间";
      }
    }
    if (
      form.securityType === "tls" &&
      !form.sni.trim() &&
      !sniOptionalProtocols.includes(form.protocol)
    ) {
      return "TLS 需要填写域名";
    }
    if (form.securityType === "tls" && certMode === "acme") {
      if (!form.sni.trim()) return "自动申请证书需要填写解析到该服务器的域名";
      const needKey = !(isEdit && form.acmeDnsSet);

      if (form.acmeDns === "cloudflare" && needKey && !form.acmeDnsKey.trim()) {
        return "请填写 Cloudflare API Token";
      }
      if (
        form.acmeDns === "alidns" &&
        needKey &&
        (!form.acmeDnsKey.trim() || !form.acmeDnsSecret.trim())
      ) {
        return "请填写阿里云 AccessKey ID 和 Secret";
      }
    }
    if (form.protocol === "hysteria2" && form.portHopping.trim()) {
      const m = form.portHopping.trim().match(/^(\d+)\s*[-:]\s*(\d+)$/);

      if (
        !m ||
        Number(m[1]) < 1024 ||
        Number(m[2]) > 65535 ||
        Number(m[1]) >= Number(m[2])
      ) {
        return "端口跳跃格式为 起始-结束（1024-65535），例如 20000-30000";
      }
    }
    if (form.securityType === "tls" && certMode === "file") {
      if (!form.certFile.trim() || !form.keyFile.trim()) {
        return "请填写证书和私钥在服务器上的路径";
      }
    }
    if (form.extra.trim()) {
      try {
        const parsed = JSON.parse(form.extra);

        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          return "高级配置必须是 JSON 对象";
        }
      } catch {
        return "高级配置不是合法的 JSON";
      }
    }

    return null;
  };

  const submit = async () => {
    const err = validate();

    if (err) {
      toast.error(err);

      return;
    }
    setSaving(true);
    try {
      const payload = toPayload({
        ...form,
        certMode,
        snellVersion: form.snellVersion || defaultSnellVersion,
      });
      const res = isEdit
        ? await updateInbound(payload)
        : await createInbound(payload);

      if (res.code !== 0) {
        const prev = inbounds.find((i) => i.id === form.id);

        if (
          isEdit &&
          prev &&
          (await savedDespiteDrop(res, prev.id, prev.updatedTime))
        ) {
          toast.success(DROP_NOTICE, { duration: 6000 });
          onOpenChange(false);
          onSaved();

          return;
        }
        toast.error(res.msg || "保存失败");

        return;
      }
      if (res.msg && res.msg !== "操作成功") {
        toast(res.msg, { icon: "⚠️", duration: 6000 });
      } else {
        toast.success(isEdit ? "已保存并下发" : "已创建并下发");
      }
      onOpenChange(false);
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  const nodeOptions = eligibleNodes(nodes);

  return (
    <Dialog
      backdrop="blur"
      classNames={{
        base: "!w-[calc(100%-32px)] !mx-auto sm:!w-full rounded-xl overflow-hidden",
      }}
      open={isOpen}
      placement="center"
      scrollBehavior="inside"
      size="2xl"
      onOpenChange={onOpenChange}
    >
      <DialogContent>
        {(onClose) => (
          <>
            <DialogHeader className="flex flex-col gap-1">
              <h2 className="text-xl font-bold">
                {isEdit ? "编辑入站" : "新建入站"}
              </h2>
              <p className="text-small text-muted-foreground">
                留空的 UUID、密码、密钥会自动生成，端口留空则随机分配
              </p>
            </DialogHeader>
            <DialogBody>
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <SelectField
                    isDisabled={isEdit}
                    label="服务器"
                    options={nodeOptions.map((n) => ({
                      value: String(n.id),
                      label: n.status === 1 ? n.name : `${n.name}（离线）`,
                    }))}
                    placeholder="选择服务器"
                    value={form.nodeId}
                    onValueChange={(value) => set("nodeId", value)}
                  />
                  <SelectField
                    isDisabled={isEdit}
                    label="内核"
                    options={implementedKernels.map((k) => ({
                      value: k.type,
                      label: k.name,
                    }))}
                    value={form.kernelType}
                    onValueChange={(value) => changeKernel(value)}
                  />
                </div>

                {form.nodeId && !installedKernel && (
                  <div className="flex items-center justify-between gap-3 rounded-xl bg-warning-50 dark:bg-warning-500/10 px-3 py-2 text-sm">
                    <span className="text-warning-700 dark:text-warning-400">
                      该服务器还没有安装 {kernelInfo?.name ?? form.kernelType}
                    </span>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        onInstallKernel(Number(form.nodeId), form.kernelType)
                      }
                    >
                      去安装
                    </Button>
                  </div>
                )}

                {!isEdit && (
                  <div>
                    <p className="text-sm font-medium mb-2">快速模板</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {presetsFor(caps, form.kernelType).map((p) => {
                        const active =
                          form.protocol === p.protocol &&
                          form.transportType === p.transport &&
                          form.securityType === p.security;

                        return (
                          <button
                            key={p.key}
                            className={`text-left rounded-xl border px-3 py-2 transition-colors ${
                              active
                                ? "border-primary bg-primary-soft dark:bg-primary/10"
                                : "border-hairline hover:bg-muted"
                            }`}
                            type="button"
                            onClick={() =>
                              setForm((prev) => applyPreset(prev, p, caps))
                            }
                          >
                            <div className="text-sm font-medium">{p.label}</div>
                            <div className="text-xs text-muted-foreground">
                              {p.description}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="field-0">名称</Label>
                    <Input
                      id="field-0"
                      placeholder="例如：东京-Reality"
                      value={form.name}
                      onChange={(e) => set("name", e.target.value)}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="field-1">端口</Label>
                    <Input
                      id="field-1"
                      placeholder="留空随机"
                      type="number"
                      value={form.port}
                      onChange={(e) => set("port", e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <SelectField
                    label="协议"
                    options={(kernelInfo?.protocols ?? []).map((p) => ({
                      value: p.protocol,
                      label: PROTOCOL_LABELS[p.protocol] ?? p.protocol,
                    }))}
                    value={form.protocol}
                    onValueChange={(value) => changeProtocol(value)}
                  />
                  <SelectField
                    isDisabled={transports.length <= 1}
                    label="传输"
                    options={transports.map((t) => ({
                      value: t.type,
                      label: TRANSPORT_LABELS[t.type] ?? t.type,
                    }))}
                    value={form.transportType}
                    onValueChange={(value) => changeTransport(value)}
                  />
                  <SelectField
                    isDisabled={securities.length <= 1}
                    label="安全"
                    options={securities.map((value) => ({
                      value,
                      label: SECURITY_LABELS[value] ?? value,
                    }))}
                    value={form.securityType}
                    onValueChange={(value) => changeSecurity(value)}
                  />
                </div>

                {uuidProtocols.includes(form.protocol) && (
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="field-2">UUID</Label>
                    <Input
                      id="field-2"
                      placeholder="留空自动生成"
                      value={form.uuid}
                      onChange={(e) => set("uuid", e.target.value)}
                    />
                  </div>
                )}
                {vlessEncAllowed(form) && (
                  <div className="flex items-start gap-2">
                    <Switch
                      checked={form.vlessEnc}
                      onCheckedChange={(v) => set("vlessEnc", v)}
                    />
                    <div>
                      <p className="text-sm">VLESS Encryption（抗量子加密）</p>
                      <p className="text-xs text-muted-foreground">
                        不用证书也能防探测，密钥自动生成。客户端需要 Xray
                        25.9+（v2rayN 等）或 Mihomo；sing-box、Surge
                        等客户端的订阅里会略过它
                      </p>
                    </div>
                  </div>
                )}
                {visionAllowed(form) && (
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={form.flowVision}
                      onCheckedChange={(v) => set("flowVision", v)}
                    />
                    <span className="text-sm">启用 XTLS Vision 流控</span>
                  </div>
                )}
                {form.protocol === "shadowsocks" && (
                  <SelectField
                    label="加密方式"
                    options={(caps?.ssMethods ?? []).map((m) => ({
                      value: m,
                      label: m,
                    }))}
                    value={form.method}
                    onValueChange={(value) =>
                      setForm((prev) => ({
                        ...prev,
                        method: value,
                        password: "",
                      }))
                    }
                  />
                )}
                {usernameProtocols.includes(form.protocol) && (
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="field-3">用户名</Label>
                    <Input
                      id="field-3"
                      placeholder="留空自动生成"
                      value={form.username}
                      onChange={(e) => set("username", e.target.value)}
                    />
                  </div>
                )}
                {passwordProtocols.includes(form.protocol) && (
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="field-4">
                      {form.protocol === "snell" ? "PSK" : "密码"}
                    </Label>
                    <Input
                      id="field-4"
                      placeholder="留空自动生成"
                      value={form.password}
                      onChange={(e) => set("password", e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      {form.protocol === "shadowsocks" &&
                      form.method.startsWith("2022-")
                        ? "SS2022 需要 base64 密钥，建议留空自动生成"
                        : undefined}
                    </p>
                  </div>
                )}

                {form.protocol === "snell" && (
                  <SelectField
                    description={
                      form.kernelType === "singbox"
                        ? "客户端使用的协议版本；sing-box 内置 Snell 需要 1.14 及以上，v6 的 PSK 至少 12 位"
                        : "客户端使用的协议版本，要和服务器上的 Snell 一致：v4 / v5 用 5.x（也可 4.x 跑 v4），v6 用 6.0.0（只接受 v6 客户端）"
                    }
                    label="Snell 版本"
                    options={["6", "5", "4"].map((v) => ({
                      value: v,
                      label: `v${v}`,
                    }))}
                    value={form.snellVersion || defaultSnellVersion}
                    onValueChange={(value) => set("snellVersion", value)}
                  />
                )}
                {form.protocol === "snell" && form.snellVersion === "6" && (
                  <SelectField
                    description="客户端要选同样的模式；unshaped 不做流量整形，更快但更容易被识别"
                    label="流量整形"
                    options={[
                      { value: "default", label: "默认" },
                      { value: "unshaped", label: "unshaped" },
                    ]}
                    value={form.snellMode || "default"}
                    onValueChange={(v) =>
                      set("snellMode", v === "default" ? "" : v)
                    }
                  />
                )}
                {(form.protocol === "socks" || form.protocol === "http") && (
                  <p className="text-xs text-warning">
                    {PROTOCOL_LABELS[form.protocol]}
                    不加密，流量和密码都是明文，适合内网或经加密线路中转后使用
                  </p>
                )}
                {form.protocol === "wireguard" && (
                  <div className="flex flex-col gap-2">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="field-5">客户端地址</Label>
                        <Input
                          id="field-5"
                          placeholder="10.66.66.2"
                          value={form.wgPeerAddress}
                          onChange={(e) => set("wgPeerAddress", e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">
                          服务端用同一网段的 .1
                        </p>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="field-6">MTU</Label>
                        <Input
                          id="field-6"
                          placeholder="1420"
                          value={form.wgMtu}
                          onChange={(e) => set("wgMtu", e.target.value)}
                        />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      密钥自动生成，所有人共用一份客户端配置（在“分享”里）；需要更换时用“换密钥”
                    </p>
                  </div>
                )}
                {form.protocol === "hysteria2" && (
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="field-7">伪装网站（可选）</Label>
                    <Input
                      id="field-7"
                      placeholder="https://www.bing.com"
                      value={form.masquerade}
                      onChange={(e) => set("masquerade", e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      非客户端访问时返回此网站内容，留空不伪装
                    </p>
                  </div>
                )}
                {form.protocol === "hysteria2" && (
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="field-8">端口跳跃（可选）</Label>
                    <Input
                      id="field-8"
                      placeholder="例如 20000-30000"
                      value={form.portHopping}
                      onChange={(e) => set("portHopping", e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      客户端在这段 UDP 端口间随机切换，缓解运营商对单端口 UDP
                      的限速；服务器上由 nftables
                      转到入站端口。经中转连接时不跳跃
                    </p>
                  </div>
                )}

                {(form.transportType === "ws" ||
                  form.transportType === "xhttp") && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="field-9">路径</Label>
                      <Input
                        id="field-9"
                        placeholder="留空随机"
                        value={form.path}
                        onChange={(e) => set("path", e.target.value)}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="field-10">Host（可选）</Label>
                      <Input
                        id="field-10"
                        value={form.host}
                        onChange={(e) => set("host", e.target.value)}
                      />
                    </div>
                  </div>
                )}
                {form.transportType === "xhttp" && (
                  <SelectField
                    label="XHTTP 模式"
                    options={XHTTP_MODES.map((m) => ({
                      value: m,
                      label: m,
                    }))}
                    value={form.xhttpMode}
                    onValueChange={(value) => set("xhttpMode", value)}
                  />
                )}
                {form.transportType === "grpc" && (
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="field-11">gRPC serviceName</Label>
                    <Input
                      id="field-11"
                      placeholder="grpc"
                      value={form.serviceName}
                      onChange={(e) => set("serviceName", e.target.value)}
                    />
                  </div>
                )}

                {form.securityType === "reality" && (
                  <div className="flex flex-col gap-3 rounded-xl border border-hairline p-3">
                    <p className="text-sm font-medium">Reality</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="field-12">伪装域名</Label>
                        <Input
                          id="field-12"
                          value={form.sni}
                          onChange={(e) => set("sni", e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">
                          客户端使用的 SNI，需是支持 TLS1.3 的大站
                        </p>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="field-13">目标地址 (dest)</Label>
                        <Input
                          id="field-13"
                          placeholder="www.example.com:443"
                          value={form.realityDest}
                          onChange={(e) => set("realityDest", e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">
                          留空则为 伪装域名:443
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="field-14">私钥</Label>
                        <Input
                          id="field-14"
                          placeholder="留空自动生成"
                          value={form.realityPrivateKey}
                          onChange={(e) =>
                            set("realityPrivateKey", e.target.value)
                          }
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="field-15">shortId</Label>
                        <Input
                          id="field-15"
                          placeholder="留空自动生成，多个用逗号分隔"
                          value={form.realityShortIds}
                          onChange={(e) =>
                            set("realityShortIds", e.target.value)
                          }
                        />
                      </div>
                    </div>
                    {form.kernelType === "xray" && (
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="field-16">最低客户端版本</Label>
                        <Input
                          id="field-16"
                          placeholder="1.0.0"
                          value={form.realityMinClientVer}
                          onChange={(e) =>
                            set("realityMinClientVer", e.target.value)
                          }
                        />
                        <p className="text-xs text-muted-foreground">
                          低于此版本的客户端会被拒绝。Xray 新版默认
                          26.3.27，会导致 Clash / Mihomo 等客户端连不上，保持
                          1.0.0 即可兼容所有客户端
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {form.securityType === "shadowtls" && (
                  <div className="flex flex-col gap-3 rounded-xl border border-hairline p-3">
                    <p className="text-sm font-medium">ShadowTLS v3</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="field-17">伪装网站</Label>
                        <Input
                          id="field-17"
                          value={form.sni}
                          onChange={(e) => set("sni", e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">
                          握手转发到该网站的 443 端口，需支持 TLS1.3
                        </p>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="field-18">ShadowTLS 密码</Label>
                        <Input
                          id="field-18"
                          placeholder="留空自动生成"
                          value={form.shadowTlsPassword}
                          onChange={(e) =>
                            set("shadowTlsPassword", e.target.value)
                          }
                        />
                      </div>
                    </div>
                  </div>
                )}

                {form.securityType === "tls" && (
                  <div className="flex flex-col gap-3 rounded-xl border border-hairline p-3">
                    <p className="text-sm font-medium">TLS</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="field-19">域名 (SNI)</Label>
                        <Input
                          id="field-19"
                          placeholder={
                            sniOptionalProtocols.includes(form.protocol) &&
                            certMode === "self"
                              ? "留空使用 www.bing.com（自签）"
                              : "node.example.com"
                          }
                          value={form.sni}
                          onChange={(e) => set("sni", e.target.value)}
                        />
                      </div>
                      <SelectField
                        label="证书"
                        options={certModes.map((m) => ({
                          value: m,
                          label: CERT_MODE_LABELS[m] ?? m,
                        }))}
                        value={certMode}
                        onValueChange={(value) => set("certMode", value)}
                      />
                    </div>
                    {certMode === "acme" && (
                      <div className="flex flex-col gap-3">
                        <p className="text-xs text-muted-foreground">
                          由 sing-box 向 Let&apos;s Encrypt
                          申请并自动续期，域名需要解析到该服务器。 HTTP
                          验证要求服务器 80 端口可从公网访问；用 DNS
                          验证则不需要。
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="flex flex-col gap-1.5">
                            <Label htmlFor="field-20">邮箱（可选）</Label>
                            <Input
                              id="field-20"
                              placeholder="用于证书到期提醒"
                              value={form.acmeEmail}
                              onChange={(e) => set("acmeEmail", e.target.value)}
                            />
                          </div>
                          <SelectField
                            label="验证方式"
                            options={Object.entries(ACME_DNS_LABELS).map(
                              ([k, label]) => ({
                                value: k || "http",
                                label,
                              }),
                            )}
                            value={form.acmeDns || "http"}
                            onValueChange={(v) =>
                              setForm((prev) => ({
                                ...prev,
                                acmeDns: v === "http" ? "" : v,
                                acmeDnsKey: "",
                                acmeDnsSecret: "",
                                acmeDnsSet: false,
                              }))
                            }
                          />
                        </div>
                        {form.acmeDns && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="flex flex-col gap-1.5">
                              <Label htmlFor="field-21">
                                {form.acmeDns === "cloudflare"
                                  ? "API Token"
                                  : "AccessKey ID"}
                              </Label>
                              <Input
                                id="field-21"
                                placeholder={
                                  form.acmeDnsSet
                                    ? "已保存，留空不修改"
                                    : undefined
                                }
                                type="password"
                                value={form.acmeDnsKey}
                                onChange={(e) =>
                                  set("acmeDnsKey", e.target.value)
                                }
                              />
                            </div>
                            {form.acmeDns === "alidns" && (
                              <div className="flex flex-col gap-1.5">
                                <Label htmlFor="field-22">
                                  AccessKey Secret
                                </Label>
                                <Input
                                  id="field-22"
                                  placeholder={
                                    form.acmeDnsSet
                                      ? "已保存，留空不修改"
                                      : undefined
                                  }
                                  type="password"
                                  value={form.acmeDnsSecret}
                                  onChange={(e) =>
                                    set("acmeDnsSecret", e.target.value)
                                  }
                                />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                    {certMode === "file" && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1.5">
                          <Label htmlFor="field-23">证书路径</Label>
                          <Input
                            id="field-23"
                            placeholder="/etc/ssl/fullchain.pem"
                            value={form.certFile}
                            onChange={(e) => set("certFile", e.target.value)}
                          />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <Label htmlFor="field-24">私钥路径</Label>
                          <Input
                            id="field-24"
                            placeholder="/etc/ssl/privkey.pem"
                            value={form.keyFile}
                            onChange={(e) => set("keyFile", e.target.value)}
                          />
                        </div>
                      </div>
                    )}
                    {form.protocol !== "hysteria2" &&
                      form.protocol !== "tuic" && (
                        <div className="flex flex-col gap-1.5">
                          <Label htmlFor="field-25">ALPN（可选）</Label>
                          <Input
                            id="field-25"
                            placeholder="h2,http/1.1"
                            value={form.alpn}
                            onChange={(e) => set("alpn", e.target.value)}
                          />
                        </div>
                      )}
                  </div>
                )}

                <button
                  className="text-sm text-primary"
                  type="button"
                  onClick={() => setShowAdvanced((v) => !v)}
                >
                  {showAdvanced ? "收起高级选项" : "展开高级选项"}
                </button>
                {showAdvanced && (
                  <div className="flex flex-col gap-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="field-26">监听地址</Label>
                        <Input
                          id="field-26"
                          value={form.listen}
                          onChange={(e) => set("listen", e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">
                          默认 :: 监听所有地址；127.0.0.1 仅本机（配合隧道中转）
                        </p>
                      </div>
                      <div className="flex flex-col gap-2">
                        <SelectField
                          label="分享地址"
                          options={[
                            { value: "auto", label: "自动（服务器默认地址）" },
                            {
                              value: "ipv4",
                              label: `服务器 IPv4${shareV4 ? ` · ${shareV4}` : "（未设置）"}`,
                              disabled: !shareV4,
                            },
                            {
                              value: "ipv6",
                              label: `服务器 IPv6${shareV6 ? ` · ${shareV6}` : "（未设置）"}`,
                              disabled: !shareV6,
                            },
                          ]}
                          value={form.shareAddressMode}
                          onValueChange={(value) =>
                            set(
                              "shareAddressMode",
                              value as InboundForm["shareAddressMode"],
                            )
                          }
                        />
                        {form.shareAddressMode === "custom" && (
                          <Input
                            aria-label="自定义分享地址"
                            placeholder="域名或 IP，不含端口"
                            value={form.shareHost}
                            onChange={(e) => set("shareHost", e.target.value)}
                          />
                        )}
                        <p className="text-xs text-muted-foreground">
                          决定分享和订阅中的入口地址，与出站策略独立。IPv4 /
                          IPv6 随服务器设置更新；监听地址需支持对应类型。
                        </p>
                      </div>
                    </div>
                    <OutboundIPSelect
                      kernelType={form.kernelType}
                      value={form.outboundIpStrategy}
                      onChange={(value) => set("outboundIpStrategy", value)}
                    />
                    <div className="flex flex-col gap-3 rounded-xl border border-hairline p-3">
                      <p className="text-sm font-medium">中转相关</p>
                      <div className="flex items-start gap-2">
                        <Switch
                          checked={form.relayOnly || form.acceptProxyProtocol}
                          disabled={form.acceptProxyProtocol}
                          onCheckedChange={(v) => set("relayOnly", v)}
                        />
                        <div>
                          <p className="text-sm">仅通过中转提供</p>
                          <p className="text-xs text-muted-foreground">
                            订阅和分享中不再给出这个节点的直连地址
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <Switch
                          checked={form.acceptProxyProtocol}
                          disabled={
                            form.kernelType !== "xray" &&
                            !form.acceptProxyProtocol
                          }
                          onCheckedChange={(v) => set("acceptProxyProtocol", v)}
                        />
                        <div>
                          <p className="text-sm">
                            获取真实客户端 IP（PROXY protocol）
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {form.kernelType === "xray"
                              ? "中转转发会附带客户端地址，节点的内核日志可见真实 IP。开启后直连将无法使用，自动变为仅中转"
                              : "目前只有 Xray 内核支持"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <Switch
                          checked={form.relayWhitelist}
                          onCheckedChange={(v) => set("relayWhitelist", v)}
                        />
                        <div>
                          <p className="text-sm">
                            仅允许中转机访问（防火墙白名单）
                          </p>
                          <p className="text-xs text-muted-foreground">
                            只放行已对接中转的入口服务器 IP
                            和本机，其他来源访问该端口一律丢弃；需要服务器安装
                            nftables
                          </p>
                        </div>
                      </div>
                      {form.relayWhitelist && (
                        <div className="flex flex-col gap-1.5">
                          <Label htmlFor="field-27">额外放行</Label>
                          <Input
                            id="field-27"
                            placeholder="203.0.113.9, 10.0.0.0/8"
                            value={form.whitelistExtra}
                            onChange={(e) =>
                              set("whitelistExtra", e.target.value)
                            }
                          />
                          <p className="text-xs text-muted-foreground">
                            中转机出口 IP 与服务器地址不同时，在此补充；支持 IP
                            和网段，逗号分隔
                          </p>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="field-28">备注</Label>
                      <Input
                        id="field-28"
                        value={form.remark}
                        onChange={(e) => set("remark", e.target.value)}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="inbound-extra-json">
                        高级配置 (JSON)
                      </Label>
                      <Textarea
                        className="min-h-24 font-mono text-xs"
                        id="inbound-extra-json"
                        placeholder='{"streamSettings":{"sockopt":{"tcpFastOpen":true}}}'
                        value={form.extra}
                        onChange={(e) => set("extra", e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        内核原生字段，深度合并到该入站配置中（例如
                        sniffing、sockopt）
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </DialogBody>
            <DialogFooter>
              <Button variant="ghost" onClick={onClose}>
                取消
              </Button>
              <Button loading={saving} onClick={submit}>
                {isEdit ? "保存并下发" : "创建并下发"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
