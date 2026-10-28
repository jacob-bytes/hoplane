import type { Dispatch, SetStateAction } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MultiSelectField } from "@/components/multi-select-field";
import { SelectField } from "@/components/select-native";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
} from "@/components/dialog";
import { Badge, badgeTone } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Accordion, AccordionItem } from "@/components/accordion-field";
import { getTunnelForwardMode } from "@/pages/tunnel/helpers";
import { ChainTunnel, Node, TunnelForm } from "@/pages/tunnel/types";

export interface TunnelFormModalProps {
  errors: { [key: string]: string };
  form: TunnelForm;
  getChainGroups: () => ChainTunnel[][];
  getCommonIpOptions: (nodeIds: number[]) => string[];
  getSelectedChainNodeIds: () => number[];
  handleSubmit: () => Promise<void>;
  handleTypeChange: (type: number) => void;
  isEdit: boolean;
  mergeOrderedNodes: (
    currentNodes: ChainTunnel[],
    selectedNodeIds: number[],
    buildDefault: (nodeId: number) => ChainTunnel,
  ) => ChainTunnel[];
  modalOpen: boolean;
  nodes: Node[];
  removeChainNode: (groupIndex: number) => void;
  setForm: Dispatch<SetStateAction<TunnelForm>>;
  setModalOpen: Dispatch<SetStateAction<boolean>>;
  submitLoading: boolean;
  syncChainGroupNodes: (groupIndex: number, selectedNodeIds: number[]) => void;
  toSelectedNodeIds: (keys: Iterable<unknown>) => number[];
  updateChainConnectIp: (groupIndex: number, connectIp: string) => void;
  updateChainProtocol: (groupIndex: number, protocol: string) => void;
  updateChainStrategy: (groupIndex: number, strategy: string) => void;
}

/** Create or edit a tunnel: entry nodes, forwarding chain and exit. */
export function TunnelFormModal({
  errors,
  form,
  getChainGroups,
  getCommonIpOptions,
  getSelectedChainNodeIds,
  handleSubmit,
  handleTypeChange,
  isEdit,
  mergeOrderedNodes,
  modalOpen,
  nodes,
  removeChainNode,
  setForm,
  setModalOpen,
  submitLoading,
  syncChainGroupNodes,
  updateChainConnectIp,
  updateChainProtocol,
  updateChainStrategy,
}: TunnelFormModalProps) {
  return (
    <Dialog
      backdrop="blur"
      classNames={{
        base: "!w-[calc(100%-32px)] !mx-auto sm:!w-full rounded-xl overflow-hidden",
      }}
      open={modalOpen}
      placement="center"
      scrollBehavior="inside"
      size="xl"
      onOpenChange={setModalOpen}
    >
      <DialogContent>
        {(onClose) => (
          <>
            <DialogHeader className="flex flex-col gap-1">
              <h2 className="text-xl font-bold">
                {isEdit ? "编辑隧道" : "新增隧道"}
              </h2>
              <p className="text-small text-muted-foreground">
                {isEdit
                  ? "修改服务器配置会中断现有连接，隧道类型不可修改"
                  : "创建新的隧道配置"}
              </p>
            </DialogHeader>
            <DialogBody>
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="tunnel-name">隧道名称</Label>
                  <Input
                    aria-invalid={!!errors.name || undefined}
                    id="tunnel-name"
                    placeholder="请输入隧道名称"
                    value={form.name}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, name: e.target.value }))
                    }
                  />
                  {errors.name ? (
                    <p className="text-xs text-destructive" role="alert">
                      {errors.name}
                    </p>
                  ) : null}
                </div>

                <SelectField
                  description={isEdit ? "编辑时无法修改隧道类型" : undefined}
                  errorMessage={errors.type}
                  isDisabled={isEdit}
                  isInvalid={!!errors.type}
                  label="隧道类型"
                  options={[
                    { value: "1", label: "端口转发" },
                    { value: "2", label: "隧道转发" },
                  ]}
                  placeholder="请选择隧道类型"
                  value={form.type.toString()}
                  onValueChange={(selectedKey) => {
                    if (selectedKey) handleTypeChange(parseInt(selectedKey));
                  }}
                />

                {form.type === 1 &&
                  (getTunnelForwardMode(form.inNodeId, nodes) === "nftables" ? (
                    <p className="text-small text-muted-foreground">
                      入口是 nftables 服务器，由 nftables
                      转发（在服务器的转发模式里设置）
                    </p>
                  ) : (
                    <SelectField
                      description={
                        form.engine === "realm"
                          ? "入口服务器自动安装 realm 运行这条隧道的转发；不支持限速和连接数限制，服务器 agent 需 3.3.26 及以上"
                          : "服务器 agent 直接转发，支持限速和连接数限制"
                      }
                      label="转发引擎"
                      options={[
                        { value: "agent", label: "面板转发（默认，功能最全）" },
                        {
                          value: "realm",
                          label: "realm（占用低，不支持限速）",
                        },
                      ]}
                      value={form.engine === "realm" ? "realm" : "agent"}
                      onValueChange={(selectedKey) =>
                        setForm((prev) => ({
                          ...prev,
                          engine: selectedKey === "realm" ? "realm" : "",
                        }))
                      }
                    />
                  ))}

                <Separator />
                <h3 className="text-lg font-semibold">入口配置</h3>

                <div className="flex flex-col gap-2">
                  <MultiSelectField
                    errorMessage={errors.inNodeId}
                    isInvalid={!!errors.inNodeId}
                    label="入口服务器"
                    options={nodes.map((node) => ({
                      value: String(node.id),
                      label: (
                        <div className="flex items-center justify-between gap-2">
                          <span>{node.name}</span>
                          <span className="flex items-center gap-1">
                            <Badge
                              variant={badgeTone(
                                node.status === 1 ? "success" : "default",
                              )}
                            >
                              {node.status === 1 ? "在线" : "离线"}
                            </Badge>
                            {(form.outNodeId || []).some(
                              (ct) => ct.nodeId === node.id,
                            ) && (
                              <Badge variant="destructive">已选为出口</Badge>
                            )}
                            {getSelectedChainNodeIds().includes(node.id) && (
                              <Badge variant="default">已选为转发链</Badge>
                            )}
                          </span>
                        </div>
                      ),
                      disabled:
                        (node.status !== 1 &&
                          !(
                            isEdit &&
                            form.inNodeId.some((ct) => ct.nodeId === node.id)
                          )) ||
                        (form.outNodeId || []).some(
                          (ct) => ct.nodeId === node.id,
                        ) ||
                        getSelectedChainNodeIds().includes(node.id),
                    }))}
                    placeholder="请选择入口服务器（可多选）"
                    values={form.inNodeId.map((ct) => ct.nodeId.toString())}
                    onValuesChange={(next) => {
                      const selectedIds = next.map(Number);

                      setForm((prev) => ({
                        ...prev,
                        inNodeId: mergeOrderedNodes(
                          prev.inNodeId,
                          selectedIds,
                          (nodeId) => ({ nodeId, chainType: 1 }),
                        ),
                      }));
                    }}
                  />
                </div>

                {/* 隧道转发时显示转发链配置 */}
                {form.type === 2 && (
                  <>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold">转发链配置</h3>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          // 添加新的一跳（一个空组，或包含占位节点）
                          setForm((prev) => ({
                            ...prev,
                            chainNodes: [
                              ...(prev.chainNodes || []),
                              [
                                {
                                  nodeId: -1,
                                  chainType: 2,
                                  protocol: "tls",
                                  strategy: "round",
                                },
                              ],
                            ],
                          }));
                        }}
                      >
                        {
                          <svg
                            aria-hidden="true"
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              d="M12 4v16m8-8H4"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                            />
                          </svg>
                        }
                        添加一跳
                      </Button>
                    </div>

                    {getChainGroups().length > 0 && (
                      <div className="flex flex-col gap-3">
                        {getChainGroups().map((groupNodes, groupIndex) => {
                          const protocol =
                            groupNodes.length > 0
                              ? groupNodes[0].protocol || "tls"
                              : "tls";
                          const strategy =
                            groupNodes.length > 0
                              ? groupNodes[0].strategy || "round"
                              : "round";
                          const groupSelectedNodeIds = groupNodes
                            .filter((ct) => ct.nodeId !== -1)
                            .map((ct) => ct.nodeId);
                          const groupIpOptions =
                            getCommonIpOptions(groupSelectedNodeIds);
                          const isMultiNodeGroup =
                            groupSelectedNodeIds.length > 1;
                          const selectedGroupConnectIp =
                            groupNodes.length > 0
                              ? groupNodes[0].connectIp || ""
                              : "";

                          return (
                            <div
                              key={groupIndex}
                              className="border border-border rounded-lg p-3"
                            >
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-muted-foreground">
                                  第{groupIndex + 1}跳
                                </span>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => removeChainNode(groupIndex)}
                                >
                                  移除
                                </Button>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                                {/* 节点选择 - 移动端100%，桌面端50% */}
                                <div className="col-span-1 md:col-span-2">
                                  <MultiSelectField
                                    label="服务器"
                                    labelClassName="text-xs"
                                    options={nodes.map((node) => ({
                                      value: String(node.id),
                                      label:
                                        node.status === 1
                                          ? node.name
                                          : `${node.name}（离线）`,
                                      disabled:
                                        (node.status !== 1 &&
                                          !(
                                            isEdit &&
                                            groupNodes.some(
                                              (ct) =>
                                                ct.nodeId === node.id &&
                                                ct.nodeId !== -1,
                                            )
                                          )) ||
                                        form.inNodeId.some(
                                          (ct) => ct.nodeId === node.id,
                                        ) ||
                                        (form.outNodeId || []).some(
                                          (ct) => ct.nodeId === node.id,
                                        ) ||
                                        (form.chainNodes || []).some(
                                          (group, idx) =>
                                            idx !== groupIndex &&
                                            group.some(
                                              (ct) =>
                                                ct.nodeId === node.id &&
                                                ct.nodeId !== -1,
                                            ),
                                        ),
                                    }))}
                                    placeholder="选择服务器（可多选）"
                                    side="top"
                                    size="sm"
                                    values={groupNodes
                                      .filter((ct) => ct.nodeId !== -1)
                                      .map((ct) => ct.nodeId.toString())}
                                    onValuesChange={(next) =>
                                      syncChainGroupNodes(
                                        groupIndex,
                                        next.map(Number),
                                      )
                                    }
                                  />
                                </div>

                                {/* 协议选择 - 25% */}
                                <SelectField
                                  label="协议"
                                  labelClassName="text-xs"
                                  options={[
                                    { value: "tls", label: "TLS" },
                                    { value: "wss", label: "WSS" },
                                    { value: "tcp", label: "TCP" },
                                    { value: "mtls", label: "MTLS" },
                                    { value: "mwss", label: "MWSS" },
                                    { value: "mtcp", label: "MTCP" },
                                    { value: "kcp", label: "KCP" },
                                  ]}
                                  placeholder="选择协议"
                                  size="sm"
                                  value={protocol}
                                  onValueChange={(selectedKey) =>
                                    updateChainProtocol(groupIndex, selectedKey)
                                  }
                                />

                                {/* 负载策略 - 25% */}
                                <SelectField
                                  label="负载策略"
                                  labelClassName="text-xs"
                                  options={[
                                    { value: "fifo", label: "主备" },
                                    { value: "round", label: "轮询" },
                                    { value: "rand", label: "随机" },
                                  ]}
                                  placeholder="选择策略"
                                  size="sm"
                                  value={strategy}
                                  onValueChange={(selectedKey) =>
                                    updateChainStrategy(groupIndex, selectedKey)
                                  }
                                />
                              </div>

                              {/* 连接IP - 转发链节点 */}
                              <SelectField
                                description={
                                  isMultiNodeGroup
                                    ? "多服务器跳不支持设置自定义连接IP，使用各服务器默认IP"
                                    : "按当前跳所选服务器的共有IP进行选择，留空使用默认"
                                }
                                isDisabled={
                                  groupSelectedNodeIds.length === 0 ||
                                  groupIpOptions.length === 0 ||
                                  isMultiNodeGroup
                                }
                                label="连接IP"
                                labelClassName="text-xs"
                                options={[
                                  { value: "__default__", label: "默认连接IP" },
                                  ...groupIpOptions.map((ip) => ({
                                    value: ip,
                                    label: ip,
                                  })),
                                ]}
                                placeholder={
                                  isMultiNodeGroup
                                    ? "多服务器跳使用服务器默认IP"
                                    : groupSelectedNodeIds.length === 0
                                      ? "请先选择服务器"
                                      : groupIpOptions.length > 0
                                        ? "选择连接IP"
                                        : "所选服务器无共同可选IP"
                                }
                                size="sm"
                                value={selectedGroupConnectIp || "__default__"}
                                onValueChange={(selectedKey) =>
                                  updateChainConnectIp(
                                    groupIndex,
                                    selectedKey === "__default__"
                                      ? ""
                                      : selectedKey,
                                  )
                                }
                              />
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {getChainGroups().length === 0 && (
                      <div className="text-center py-8 bg-muted dark:bg-muted/50 rounded border border-dashed border-border">
                        <p className="text-sm text-muted-foreground">
                          还没有添加转发链，点击上方&quot;添加一跳&quot;按钮开始添加
                        </p>
                      </div>
                    )}
                  </>
                )}

                {/* 隧道转发时显示出口配置 */}
                {form.type === 2 && (
                  <>
                    <Separator />
                    <h3 className="text-lg font-semibold">出口配置</h3>

                    {(() => {
                      const selectedOutNodeIds = (form.outNodeId || [])
                        .filter((ct) => ct.nodeId !== -1)
                        .map((ct) => ct.nodeId);
                      const isMultiExit = selectedOutNodeIds.length > 1;
                      const commonOutIpOptions =
                        getCommonIpOptions(selectedOutNodeIds);

                      return (
                        <>
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                            {/* 节点选择 - 移动端100%，桌面端50% */}
                            <div className="col-span-1 md:col-span-2">
                              <MultiSelectField
                                errorMessage={errors.outNodeId}
                                isInvalid={!!errors.outNodeId}
                                label="服务器"
                                labelClassName="text-xs"
                                options={nodes.map((node) => ({
                                  value: String(node.id),
                                  label:
                                    node.status === 1
                                      ? node.name
                                      : `${node.name}（离线）`,
                                  disabled:
                                    (node.status !== 1 &&
                                      !(
                                        isEdit &&
                                        (form.outNodeId || []).some(
                                          (ct) =>
                                            ct.nodeId === node.id &&
                                            ct.nodeId !== -1,
                                        )
                                      )) ||
                                    form.inNodeId.some(
                                      (ct) => ct.nodeId === node.id,
                                    ) ||
                                    getSelectedChainNodeIds().includes(node.id),
                                }))}
                                placeholder="请选择出口服务器（可多选）"
                                side="top"
                                values={
                                  form.outNodeId
                                    ? form.outNodeId
                                        .filter((ct) => ct.nodeId !== -1)
                                        .map((ct) => ct.nodeId.toString())
                                    : []
                                }
                                onValuesChange={(next) => {
                                  const selectedIds = next.map(Number);

                                  setForm((prev) => {
                                    const currentOutNodes =
                                      prev.outNodeId || [];
                                    const protocol =
                                      currentOutNodes[0]?.protocol || "tls";
                                    const strategy =
                                      currentOutNodes[0]?.strategy || "round";
                                    const realNodes = currentOutNodes.filter(
                                      (ct) => ct.nodeId !== -1,
                                    );

                                    return {
                                      ...prev,
                                      outNodeId: mergeOrderedNodes(
                                        realNodes,
                                        selectedIds,
                                        (nodeId) => ({
                                          nodeId,
                                          chainType: 3,
                                          protocol,
                                          strategy,
                                        }),
                                      ),
                                    };
                                  });
                                }}
                              />
                            </div>

                            {/* 协议选择 - 25% */}
                            <SelectField
                              errorMessage={errors.protocol}
                              isInvalid={!!errors.protocol}
                              label="协议"
                              labelClassName="text-xs"
                              options={[
                                { value: "tls", label: "TLS" },
                                { value: "wss", label: "WSS" },
                                { value: "tcp", label: "TCP" },
                                { value: "mtls", label: "MTLS" },
                                { value: "mwss", label: "MWSS" },
                                { value: "mtcp", label: "MTCP" },
                                { value: "kcp", label: "KCP" },
                              ]}
                              placeholder="选择协议"
                              value={(() => {
                                if (
                                  !form.outNodeId ||
                                  form.outNodeId.length === 0
                                )
                                  return "tls";

                                return form.outNodeId[0].protocol || "tls";
                              })()}
                              onValueChange={(selectedKey) => {
                                if (!selectedKey) return;
                                setForm((prev) => {
                                  const currentOutNodes = prev.outNodeId || [];
                                  const currentStrategy =
                                    currentOutNodes.length > 0
                                      ? currentOutNodes[0].strategy || "round"
                                      : "round";

                                  if (currentOutNodes.length === 0) {
                                    return {
                                      ...prev,
                                      outNodeId: [
                                        {
                                          nodeId: -1,
                                          chainType: 3,
                                          protocol: selectedKey,
                                          strategy: currentStrategy,
                                        },
                                      ],
                                    };
                                  }

                                  return {
                                    ...prev,
                                    outNodeId: currentOutNodes.map((ct) => ({
                                      ...ct,
                                      protocol: selectedKey,
                                    })),
                                  };
                                });
                              }}
                            />

                            {/* 负载策略 - 25% */}
                            <SelectField
                              label="负载策略"
                              labelClassName="text-xs"
                              options={[
                                { value: "fifo", label: "主备" },
                                { value: "round", label: "轮询" },
                                { value: "rand", label: "随机" },
                                { value: "best", label: "最优" },
                              ]}
                              placeholder="选择策略"
                              value={(() => {
                                if (
                                  !form.outNodeId ||
                                  form.outNodeId.length === 0
                                )
                                  return "round";

                                return form.outNodeId[0].strategy || "round";
                              })()}
                              onValueChange={(selectedKey) => {
                                if (!selectedKey) return;
                                setForm((prev) => {
                                  const currentOutNodes = prev.outNodeId || [];
                                  const currentProtocol =
                                    currentOutNodes.length > 0
                                      ? currentOutNodes[0].protocol || "tls"
                                      : "tls";

                                  if (currentOutNodes.length === 0) {
                                    return {
                                      ...prev,
                                      outNodeId: [
                                        {
                                          nodeId: -1,
                                          chainType: 3,
                                          protocol: currentProtocol,
                                          strategy: selectedKey,
                                        },
                                      ],
                                    };
                                  }

                                  return {
                                    ...prev,
                                    outNodeId: currentOutNodes.map((ct) => ({
                                      ...ct,
                                      strategy: selectedKey,
                                    })),
                                  };
                                });
                              }}
                            />
                          </div>

                          {/* 连接IP - 出口节点 */}
                          <SelectField
                            description={
                              isMultiExit
                                ? "多出口隧道不支持设置自定义连接IP，使用各服务器默认IP"
                                : "按出口服务器共同可用IP选择，留空使用默认"
                            }
                            isDisabled={
                              selectedOutNodeIds.length === 0 ||
                              commonOutIpOptions.length === 0 ||
                              isMultiExit
                            }
                            label="连接IP"
                            options={[
                              { value: "__default__", label: "默认连接IP" },
                              ...commonOutIpOptions.map((ip) => ({
                                value: ip,
                                label: ip,
                              })),
                            ]}
                            placeholder={
                              isMultiExit
                                ? "多出口隧道使用服务器默认IP"
                                : selectedOutNodeIds.length === 0
                                  ? "请先选择出口服务器"
                                  : commonOutIpOptions.length > 0
                                    ? "选择连接IP"
                                    : "所选服务器无共同可选IP"
                            }
                            size="sm"
                            value={
                              form.outNodeId && form.outNodeId.length > 0
                                ? form.outNodeId[0].connectIp || "__default__"
                                : "__default__"
                            }
                            onValueChange={(selectedKey) => {
                              const value =
                                selectedKey === "__default__"
                                  ? ""
                                  : selectedKey;

                              setForm((prev) => {
                                const currentOutNodes = prev.outNodeId || [];

                                if (currentOutNodes.length === 0) {
                                  return {
                                    ...prev,
                                    outNodeId: [
                                      {
                                        nodeId: -1,
                                        chainType: 3,
                                        protocol: "tls",
                                        strategy: "round",
                                        connectIp: value,
                                      },
                                    ],
                                  };
                                }

                                return {
                                  ...prev,
                                  outNodeId: currentOutNodes.map((ct) => ({
                                    ...ct,
                                    connectIp: value,
                                  })),
                                };
                              });
                            }}
                          />
                        </>
                      );
                    })()}
                  </>
                )}

                <Accordion className="px-0" variant="light">
                  <AccordionItem
                    key="advanced"
                    aria-label="高级设置"
                    className="border-b-0 [&_[data-slot=accordion-trigger]]:no-underline [&_[data-slot=accordion-trigger]]:hover:no-underline"
                    title={
                      <span className="text-small text-muted-foreground font-medium">
                        高级设置
                      </span>
                    }
                  >
                    <div className="flex flex-col gap-4 pb-2">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <SelectField
                          errorMessage={errors.flow}
                          isInvalid={!!errors.flow}
                          label="流量计算"
                          options={[
                            { value: "1", label: "单向计算（仅上传）" },
                            { value: "2", label: "双向计算（上传+下载）" },
                          ]}
                          placeholder="请选择流量计算方式"
                          value={form.flow.toString()}
                          onValueChange={(selectedKey) => {
                            if (!selectedKey) return;
                            setForm((prev) => ({
                              ...prev,
                              flow: parseInt(selectedKey),
                            }));
                          }}
                        />

                        <div className="flex flex-col gap-1.5">
                          <Label htmlFor="tunnel-traffic-ratio">流量倍率</Label>
                          <Input
                            aria-invalid={!!errors.trafficRatio || undefined}
                            id="tunnel-traffic-ratio"
                            max={100}
                            min={0.01}
                            placeholder="例如：0.5 或 1 或 2"
                            step="any"
                            type="number"
                            value={form.trafficRatio.toString()}
                            onChange={(e) =>
                              setForm((prev) => ({
                                ...prev,
                                trafficRatio: parseFloat(e.target.value) || 0,
                              }))
                            }
                          />
                          {errors.trafficRatio ? (
                            <p
                              className="text-xs text-destructive"
                              role="alert"
                            >
                              {errors.trafficRatio}
                            </p>
                          ) : null}
                        </div>
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="tunnel-in-ip">入口IP</Label>
                        <Textarea
                          aria-invalid={!!errors.inIp || undefined}
                          className="min-h-24"
                          id="tunnel-in-ip"
                          placeholder={
                            "一行一个IP地址或域名，例如:\n192.168.1.100\nexample.com"
                          }
                          value={form.inIp}
                          onChange={(e) =>
                            setForm((prev) => ({
                              ...prev,
                              inIp: e.target.value,
                            }))
                          }
                        />
                        <p className="text-xs text-muted-foreground">
                          入口IP由系统自动从入口服务器采集，无需手动填写。支持多个IP，每行一个地址，留空则使用入口服务器IP
                        </p>
                        {errors.inIp ? (
                          <p className="text-xs text-destructive" role="alert">
                            {errors.inIp}
                          </p>
                        ) : null}
                      </div>

                      {form.type === 2 && (
                        <SelectField
                          description="当服务器同时拥有IPv4和IPv6地址时，选择隧道连接使用的地址类型"
                          label="隧道连接地址偏好"
                          options={[
                            { value: "v4", label: "优先IPv4" },
                            { value: "v6", label: "优先IPv6" },
                          ]}
                          placeholder="自动选择"
                          value={form.ipPreference || ""}
                          onValueChange={(selectedKey) =>
                            setForm((prev) => ({
                              ...prev,
                              ipPreference: selectedKey,
                            }))
                          }
                        />
                      )}

                      <div>
                        <div className="text-sm font-medium">质量检测目标</div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          用于实时隧道质量检测、诊断目标和 best
                          最优出口评分，留空使用 www.bing.com:443
                        </p>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-[1fr_140px] gap-3">
                        <div className="flex flex-col gap-1.5">
                          <Label htmlFor="tunnel-probe-host">Host</Label>
                          <Input
                            aria-invalid={!!errors.probeTargetHost || undefined}
                            id="tunnel-probe-host"
                            placeholder="www.bing.com"
                            value={form.probeTargetHost || ""}
                            onChange={(e) =>
                              setForm((prev) => ({
                                ...prev,
                                probeTargetHost: e.target.value,
                              }))
                            }
                          />
                          {errors.probeTargetHost ? (
                            <p
                              className="text-xs text-destructive"
                              role="alert"
                            >
                              {errors.probeTargetHost}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <Label htmlFor="tunnel-probe-port">Port</Label>
                          <Input
                            aria-invalid={!!errors.probeTargetPort || undefined}
                            id="tunnel-probe-port"
                            max={65535}
                            min={1}
                            placeholder="443"
                            type="number"
                            value={
                              form.probeTargetPort
                                ? String(form.probeTargetPort)
                                : ""
                            }
                            onChange={(e) =>
                              setForm((prev) => ({
                                ...prev,
                                probeTargetPort: e.target.value
                                  ? Number(e.target.value)
                                  : 0,
                              }))
                            }
                          />
                          {errors.probeTargetPort ? (
                            <p
                              className="text-xs text-destructive"
                              role="alert"
                            >
                              {errors.probeTargetPort}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </AccordionItem>
                </Accordion>
              </div>
            </DialogBody>
            <DialogFooter>
              <Button variant="ghost" onClick={onClose}>
                取消
              </Button>
              <Button loading={submitLoading} onClick={handleSubmit}>
                {submitLoading
                  ? isEdit
                    ? "更新中..."
                    : "创建中..."
                  : isEdit
                    ? "更新"
                    : "创建"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
