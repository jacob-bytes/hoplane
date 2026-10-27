import type { SpeedLimitApiItem } from "@/api/types";
import type { Dispatch, SetStateAction } from "react";

import { Button } from "@/components/ui/button";
import { TextField as Input } from "@/components/field-input";
import { TextAreaField as Textarea } from "@/components/field-input";
import { SelectField } from "@/components/select-native";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@/components/modal";
import { Accordion, AccordionItem } from "@/components/accordion-field";
import { Tunnel, ForwardForm } from "@/pages/forward/types";

export interface ForwardFormModalProps {
  availableSpeedLimits: SpeedLimitApiItem[];
  currentTunnelIpOptions: string[];
  currentTunnelPortRange: { min: number; max: number } | null;
  errors: { [key: string]: string };
  form: ForwardForm;
  getAddressCount: (addressString: string) => number;
  handleSubmit: () => Promise<void>;
  handleTunnelChange: (tunnelId: string) => void;
  isAdmin: boolean;
  isCurrentTunnelMultiEntrance: boolean;
  isEdit: boolean;
  modalOpen: boolean;
  selectedIPSpeedId: number | null;
  selectedSpeedId: number | null;
  setForm: Dispatch<SetStateAction<ForwardForm>>;
  setInIpTouched: Dispatch<SetStateAction<boolean>>;
  setModalOpen: Dispatch<SetStateAction<boolean>>;
  submitLoading: boolean;
  tunnels: Tunnel[];
}

/** Create or edit a forward. */
export function ForwardFormModal({
  availableSpeedLimits,
  currentTunnelIpOptions,
  currentTunnelPortRange,
  errors,
  form,
  getAddressCount,
  handleSubmit,
  handleTunnelChange,
  isAdmin,
  isCurrentTunnelMultiEntrance,
  isEdit,
  modalOpen,
  selectedIPSpeedId,
  selectedSpeedId,
  setForm,
  setInIpTouched,
  setModalOpen,
  submitLoading,
  tunnels,
}: ForwardFormModalProps) {
  return (
    <Modal
      backdrop="blur"
      classNames={{
        base: "!w-[calc(100%-32px)] !mx-auto sm:!w-full rounded-xl overflow-hidden",
      }}
      open={modalOpen}
      placement="center"
      scrollBehavior="inside"
      size="2xl"
      onOpenChange={setModalOpen}
    >
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="flex flex-col gap-1">
              <h2 className="text-xl font-bold">
                {isEdit ? "编辑规则" : "新增规则"}
              </h2>
              <p className="text-small text-muted-foreground">
                {isEdit ? "修改现有规则配置的信息" : "创建新的规则配置"}
              </p>
            </ModalHeader>
            <ModalBody>
              <div className="space-y-4 pb-4">
                <Input
                  errorMessage={errors.name}
                  isInvalid={!!errors.name}
                  label="规则名称"
                  placeholder="请输入规则名称"
                  value={form.name}
                  variant="bordered"
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                />

                <SelectField
                  description={
                    isEdit
                      ? "更改隧道将释放原端口并在新隧道分配端口"
                      : undefined
                  }
                  errorMessage={errors.tunnelId}
                  isInvalid={!!errors.tunnelId}
                  label="选择隧道"
                  options={tunnels.map((tunnel) => ({
                    value: String(tunnel.id),
                    label: tunnel.name,
                  }))}
                  placeholder="请选择关联的隧道"
                  value={form.tunnelId ? form.tunnelId.toString() : ""}
                  onValueChange={(selectedKey) => {
                    if (selectedKey) handleTunnelChange(selectedKey);
                  }}
                />

                <Input
                  description={
                    currentTunnelPortRange
                      ? `指定入口端口，留空自动分配 (允许范围: ${currentTunnelPortRange.min}-${currentTunnelPortRange.max})`
                      : "指定入口端口，留空则从服务器可用端口中自动分配"
                  }
                  errorMessage={errors.inPort}
                  isInvalid={!!errors.inPort}
                  label="入口端口"
                  placeholder="留空则自动分配可用端口"
                  type="number"
                  value={form.inPort !== null ? form.inPort.toString() : ""}
                  variant="bordered"
                  onChange={(e) => {
                    const value = e.target.value;

                    setForm((prev) => ({
                      ...prev,
                      inPort: value ? parseInt(value) : null,
                    }));
                  }}
                />

                <SelectField
                  description={
                    isCurrentTunnelMultiEntrance
                      ? "多入口隧道不支持自定义监听IP，使用各服务器默认IP"
                      : "从入口服务器IP中选择，留空使用默认"
                  }
                  isDisabled={
                    !form.tunnelId ||
                    currentTunnelIpOptions.length === 0 ||
                    isCurrentTunnelMultiEntrance
                  }
                  label="监听IP"
                  options={[
                    { value: "__default__", label: "默认入口IP" },
                    ...currentTunnelIpOptions.map((ip) => ({
                      value: ip,
                      label: ip,
                    })),
                  ]}
                  placeholder={
                    isCurrentTunnelMultiEntrance
                      ? "多入口隧道使用服务器默认IP"
                      : form.tunnelId
                        ? currentTunnelIpOptions.length > 0
                          ? "选择入口监听IP"
                          : "当前隧道入口服务器暂无可选IP"
                        : "请先选择隧道"
                  }
                  value={form.inIp || "__default__"}
                  onValueChange={(selectedKey) => {
                    setInIpTouched(true);
                    setForm((prev) => ({
                      ...prev,
                      inIp: selectedKey === "__default__" ? "" : selectedKey,
                    }));
                  }}
                />

                <Textarea
                  description="格式: IP:端口 或 域名:端口，支持多个地址（每行一个）"
                  errorMessage={errors.remoteAddr}
                  isInvalid={!!errors.remoteAddr}
                  label="落地地址"
                  maxRows={6}
                  minRows={3}
                  placeholder="请输入落地地址，多个地址用换行分隔，例如:&#10;192.168.1.100:10000&#10;[2001:db8::10]:10086&#10;test.example.com:10010"
                  value={form.remoteAddr}
                  variant="bordered"
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      remoteAddr: e.target.value,
                    }))
                  }
                />

                {getAddressCount(form.remoteAddr) > 1 && (
                  <SelectField
                    description="多个目标地址的负载均衡策略"
                    label="负载策略"
                    options={[
                      { value: "fifo", label: "主备模式 - 自上而下" },
                      { value: "round", label: "轮询模式 - 依次轮换" },
                      { value: "rand", label: "随机模式 - 随机选择" },
                      { value: "hash", label: "哈希模式 - IP哈希" },
                    ]}
                    placeholder="请选择负载均衡策略"
                    value={form.strategy}
                    onValueChange={(selectedKey) =>
                      setForm((prev) => ({ ...prev, strategy: selectedKey }))
                    }
                  />
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
                    <div className="space-y-4 pb-2">
                      <Input
                        description="大于 0 时优先于用户全局限制；0 或空表示使用用户全局限制，用户也为 0 时不限制。"
                        label="最大连接数"
                        min="0"
                        placeholder="0 或空表示使用用户全局限制"
                        type="number"
                        value={
                          form.maxConn === 0 ? "" : String(form.maxConn || "")
                        }
                        variant="bordered"
                        onChange={(e) => {
                          const value = Math.max(
                            Number(e.target.value) || 0,
                            0,
                          );

                          setForm((prev) => ({ ...prev, maxConn: value }));
                        }}
                      />
                      <Input
                        description="每个客户端 IP 可同时建立的最大连接数；0 或空表示不限制。"
                        label="每 IP 最大连接数"
                        min="0"
                        placeholder="0 或空表示不限制"
                        type="number"
                        value={
                          form.ipMaxConn === 0
                            ? ""
                            : String(form.ipMaxConn || "")
                        }
                        variant="bordered"
                        onChange={(e) => {
                          const value = Math.max(
                            Number(e.target.value) || 0,
                            0,
                          );

                          setForm((prev) => ({ ...prev, ipMaxConn: value }));
                        }}
                      />
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <SelectField
                          description="入口监听接收 PROXY protocol，用于读取上游传入的真实客户端 IP。"
                          label="Proxy Protocol 接收"
                          options={[
                            { value: "0", label: "禁用" },
                            { value: "1", label: "Version 1" },
                            { value: "2", label: "Version 2" },
                          ]}
                          placeholder="禁用"
                          value={String(form.proxyProtocolReceive || 0)}
                          onValueChange={(selectedKey) =>
                            setForm((prev) => ({
                              ...prev,
                              proxyProtocolReceive: Number(selectedKey),
                            }))
                          }
                        />
                        <SelectField
                          description="连接目标地址时发送 PROXY protocol，用于向下游透传客户端真实 IP。"
                          label="Proxy Protocol 发送"
                          options={[
                            { value: "0", label: "禁用" },
                            { value: "1", label: "Version 1" },
                            { value: "2", label: "Version 2" },
                          ]}
                          placeholder="禁用"
                          value={String(form.proxyProtocolSend || 0)}
                          onValueChange={(selectedKey) => {
                            const proxyProtocolSend = Number(selectedKey);

                            setForm((prev) => ({
                              ...prev,
                              proxyProtocol: proxyProtocolSend,
                              proxyProtocolSend,
                            }));
                          }}
                        />
                      </div>
                      {isAdmin && (
                        <SelectField
                          label="规则限速"
                          options={availableSpeedLimits.map((speedLimit) => ({
                            value: speedLimit.id.toString(),
                            label: speedLimit.name,
                          }))}
                          placeholder="不限速"
                          value={
                            selectedSpeedId !== null
                              ? selectedSpeedId.toString()
                              : ""
                          }
                          onValueChange={(selectedKey) =>
                            setForm((prev) => ({
                              ...prev,
                              speedId: selectedKey ? Number(selectedKey) : null,
                            }))
                          }
                        />
                      )}
                      {isAdmin && (
                        <SelectField
                          description="每个客户端 IP 独享该限速规则；不选择表示不限制。"
                          label="每 IP 限速"
                          options={availableSpeedLimits.map((speedLimit) => ({
                            value: speedLimit.id.toString(),
                            label: speedLimit.name,
                          }))}
                          placeholder="不限速"
                          value={
                            selectedIPSpeedId !== null
                              ? selectedIPSpeedId.toString()
                              : ""
                          }
                          onValueChange={(selectedKey) =>
                            setForm((prev) => ({
                              ...prev,
                              ipSpeedId: selectedKey
                                ? Number(selectedKey)
                                : null,
                            }))
                          }
                        />
                      )}
                    </div>
                  </AccordionItem>
                </Accordion>
              </div>
            </ModalBody>
            <ModalFooter>
              <Button variant="ghost" onClick={onClose}>
                取消
              </Button>
              <Button disabled={submitLoading} onClick={handleSubmit}>
                {isEdit ? "保存修改" : "创建规则"}
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
