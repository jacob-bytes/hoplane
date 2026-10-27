import type { Dispatch, SetStateAction } from "react";

import { Button } from "@/components/ui/button";
import { Select, SelectItem } from "@/components/select-field";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@/components/modal";
import { type ForwardAddressItem } from "@/pages/forward/address";
import { Forward, Tunnel } from "@/pages/forward/types";

export interface DeleteForwardModalProps {
  confirmDelete: () => Promise<void>;
  deleteLoading: boolean;
  deleteModalOpen: boolean;
  forwardToDelete: Forward | null;
  setDeleteModalOpen: Dispatch<SetStateAction<boolean>>;
}

/** Confirm deleting one forward. */
export function DeleteForwardModal({
  confirmDelete,
  deleteLoading,
  deleteModalOpen,
  forwardToDelete,
  setDeleteModalOpen,
}: DeleteForwardModalProps) {
  return (
    <Modal
      backdrop="blur"
      classNames={{
        base: "!w-[calc(100%-32px)] !mx-auto sm:!w-full rounded-xl overflow-hidden",
      }}
      isOpen={deleteModalOpen}
      placement="center"
      scrollBehavior="inside"
      size="2xl"
      onOpenChange={setDeleteModalOpen}
    >
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="flex flex-col gap-1">
              <h2 className="text-lg font-bold text-destructive">确认删除</h2>
            </ModalHeader>
            <ModalBody>
              <p className="text-muted-foreground">
                确定要删除规则{" "}
                <span className="font-semibold text-foreground">
                  &quot;{forwardToDelete?.name}&quot;
                </span>{" "}
                吗？
              </p>
              <p className="text-small text-muted-foreground mt-2">
                此操作无法撤销，删除后该规则将永久消失。
              </p>
            </ModalBody>
            <ModalFooter>
              <Button variant="ghost" onClick={onClose}>
                取消
              </Button>
              <Button
                disabled={deleteLoading}
                variant="destructive"
                onClick={confirmDelete}
              >
                删除
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}

export interface ResetFlowModalProps {
  confirmResetFlow: () => Promise<void>;
  forwardToResetFlow: Forward | null;
  handleResetFlowModalOpenChange: (isOpen: boolean) => void;
  resetFlowLoading: boolean;
  resetFlowModalOpen: boolean;
}

/** Confirm zeroing a forward's traffic counters. */
export function ResetFlowModal({
  confirmResetFlow,
  forwardToResetFlow,
  handleResetFlowModalOpenChange,
  resetFlowLoading,
  resetFlowModalOpen,
}: ResetFlowModalProps) {
  return (
    <Modal
      backdrop="blur"
      classNames={{
        base: "!w-[calc(100%-32px)] !mx-auto sm:!w-full rounded-xl overflow-hidden",
      }}
      isOpen={resetFlowModalOpen}
      placement="center"
      scrollBehavior="inside"
      size="lg"
      onOpenChange={handleResetFlowModalOpenChange}
    >
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="flex flex-col gap-1">
              <h2 className="text-lg font-bold text-secondary">确认流量清零</h2>
            </ModalHeader>
            <ModalBody>
              <p className="text-muted-foreground">
                确定要清零规则{" "}
                <span className="font-semibold text-foreground">
                  &quot;{forwardToResetFlow?.name}&quot;
                </span>{" "}
                当前显示的上传和下载流量吗？
              </p>
              <p className="text-small text-muted-foreground mt-2">
                此操作不可撤销，但不会影响用户总流量、用户隧道配额和历史统计。
              </p>
            </ModalBody>
            <ModalFooter>
              <Button
                disabled={resetFlowLoading}
                variant="ghost"
                onClick={onClose}
              >
                取消
              </Button>
              <Button
                disabled={resetFlowLoading}
                variant="secondary"
                onClick={confirmResetFlow}
              >
                清零
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}

export interface AddressListModalProps {
  addressList: ForwardAddressItem[];
  addressModalOpen: boolean;
  addressModalTitle: string;
  copyAddress: (addressItem: ForwardAddressItem) => Promise<void>;
  copyAllAddresses: () => Promise<void>;
  setAddressModalOpen: Dispatch<SetStateAction<boolean>>;
}

/** A forward's entry or target addresses, with copy buttons. */
export function AddressListModal({
  addressList,
  addressModalOpen,
  addressModalTitle,
  copyAddress,
  copyAllAddresses,
  setAddressModalOpen,
}: AddressListModalProps) {
  return (
    <Modal
      classNames={{
        base: "!w-[calc(100%-32px)] !mx-auto sm:!w-full rounded-xl overflow-hidden",
      }}
      isOpen={addressModalOpen}
      scrollBehavior="inside"
      size="lg"
      onClose={() => setAddressModalOpen(false)}
    >
      <ModalContent>
        <ModalHeader className="text-base">{addressModalTitle}</ModalHeader>
        <ModalBody className="pb-6">
          <div className="mb-4 text-right">
            <Button size="sm" onClick={copyAllAddresses}>
              复制
            </Button>
          </div>

          <div className="space-y-2 max-h-60 overflow-y-auto scrollbar-hide">
            {addressList.map((item) => (
              <div
                key={item.id}
                className="flex justify-between items-center p-3 border border-border dark:border-border rounded-lg"
              >
                <code className="font-mono text-sm flex-1 mr-3 text-foreground">
                  {item.address}
                </code>
                <Button
                  disabled={item.copying}
                  size="sm"
                  variant="ghost"
                  onClick={() => copyAddress(item)}
                >
                  复制
                </Button>
              </div>
            ))}
          </div>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}

export interface BatchDeleteModalProps {
  batchDeleteModalOpen: boolean;
  batchLoading: boolean;
  handleBatchDelete: () => Promise<void>;
  selectedIds: Set<number>;
  setBatchDeleteModalOpen: Dispatch<SetStateAction<boolean>>;
}

/** Confirm deleting the selected forwards. */
export function BatchDeleteModal({
  batchDeleteModalOpen,
  batchLoading,
  handleBatchDelete,
  selectedIds,
  setBatchDeleteModalOpen,
}: BatchDeleteModalProps) {
  return (
    <Modal
      classNames={{
        base: "!w-[calc(100%-32px)] !mx-auto sm:!w-full rounded-xl overflow-hidden",
      }}
      isOpen={batchDeleteModalOpen}
      onOpenChange={setBatchDeleteModalOpen}
    >
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader>确认删除</ModalHeader>
            <ModalBody>
              <p>
                确定要删除选中的 {selectedIds.size} 项规则吗？此操作不可撤销。
              </p>
            </ModalBody>
            <ModalFooter>
              <Button variant="ghost" onClick={onClose}>
                取消
              </Button>
              <Button
                disabled={batchLoading}
                variant="destructive"
                onClick={handleBatchDelete}
              >
                删除
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}

export interface BatchChangeTunnelModalProps {
  batchChangeTunnelModalOpen: boolean;
  batchLoading: boolean;
  batchTargetTunnelId: number | null;
  handleBatchChangeTunnel: () => Promise<void>;
  selectedIds: Set<number>;
  setBatchChangeTunnelModalOpen: Dispatch<SetStateAction<boolean>>;
  setBatchTargetTunnelId: Dispatch<SetStateAction<number | null>>;
  tunnels: Tunnel[];
}

/** Move the selected forwards to another tunnel. */
export function BatchChangeTunnelModal({
  batchChangeTunnelModalOpen,
  batchLoading,
  batchTargetTunnelId,
  handleBatchChangeTunnel,
  selectedIds,
  setBatchChangeTunnelModalOpen,
  setBatchTargetTunnelId,
  tunnels,
}: BatchChangeTunnelModalProps) {
  return (
    <Modal
      classNames={{
        base: "!w-[calc(100%-32px)] !mx-auto sm:!w-full rounded-xl overflow-hidden",
      }}
      isOpen={batchChangeTunnelModalOpen}
      onOpenChange={setBatchChangeTunnelModalOpen}
    >
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader>隧道</ModalHeader>
            <ModalBody>
              <p className="mb-4">
                将选中的 {selectedIds.size} 项规则迁移到新隧道：
              </p>
              <Select
                label="目标隧道"
                placeholder="请选择目标隧道"
                selectedKeys={
                  batchTargetTunnelId ? [String(batchTargetTunnelId)] : []
                }
                onSelectionChange={(keys) => {
                  const selected = Array.from(keys)[0];

                  setBatchTargetTunnelId(selected ? Number(selected) : null);
                }}
              >
                {tunnels.map((tunnel) => (
                  <SelectItem key={String(tunnel.id)}>{tunnel.name}</SelectItem>
                ))}
              </Select>
            </ModalBody>
            <ModalFooter>
              <Button variant="ghost" onClick={onClose}>
                取消
              </Button>
              <Button
                disabled={!batchTargetTunnelId || batchLoading}
                onClick={handleBatchChangeTunnel}
              >
                换隧道
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
