import type { Dispatch, SetStateAction } from "react";

import { Button } from "@/components/ui/button";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@/components/modal";
import { Node } from "@/pages/node/types";

export interface RollbackNodeModalProps {
  confirmRollback: () => Promise<void>;
  nodeToRollback: Node | null;
  rollbackModalOpen: boolean;
  setRollbackModalOpen: Dispatch<SetStateAction<boolean>>;
}

/** Confirm rolling a node's agent back to the previous version. */
export function RollbackNodeModal({
  confirmRollback,
  nodeToRollback,
  rollbackModalOpen,
  setRollbackModalOpen,
}: RollbackNodeModalProps) {
  return (
    <Modal
      backdrop="blur"
      classNames={{
        base: "!w-[calc(100%-32px)] !mx-auto sm:!w-full rounded-xl overflow-hidden",
      }}
      open={rollbackModalOpen}
      placement="center"
      scrollBehavior="inside"
      size="sm"
      onOpenChange={setRollbackModalOpen}
    >
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="flex flex-col gap-1">
              <h2 className="text-xl font-bold">确认回退</h2>
            </ModalHeader>
            <ModalBody>
              <p>
                确定要将服务器{" "}
                <strong>&quot;{nodeToRollback?.name}&quot;</strong>{" "}
                回退到上一个版本吗？
              </p>
              <p className="text-small text-muted-foreground">
                服务器将执行版本回退并自动重启，期间会导致服务器短暂离线。
              </p>
            </ModalBody>
            <ModalFooter>
              <Button variant="ghost" onClick={onClose}>
                取消
              </Button>
              <Button variant="secondary" onClick={confirmRollback}>
                回退
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}

export interface DeleteNodeModalProps {
  confirmDelete: () => Promise<void>;
  deleteLoading: boolean;
  deleteModalOpen: boolean;
  nodeToDelete: Node | null;
  setDeleteModalOpen: Dispatch<SetStateAction<boolean>>;
}

/** Confirm deleting one node. */
export function DeleteNodeModal({
  confirmDelete,
  deleteLoading,
  deleteModalOpen,
  nodeToDelete,
  setDeleteModalOpen,
}: DeleteNodeModalProps) {
  return (
    <Modal
      backdrop="blur"
      classNames={{
        base: "!w-[calc(100%-32px)] !mx-auto sm:!w-full rounded-xl overflow-hidden",
      }}
      open={deleteModalOpen}
      placement="center"
      scrollBehavior="inside"
      size="sm"
      onOpenChange={setDeleteModalOpen}
    >
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="flex flex-col gap-1">
              <h2 className="text-base font-semibold">删除服务器</h2>
            </ModalHeader>
            <ModalBody className="space-y-2">
              <p className="text-sm">
                确定要删除 <strong>{nodeToDelete?.name}</strong> 吗？
              </p>
              <p className="text-xs text-muted-foreground">
                服务器会从面板移除；agent
                仍在机器上运行，需要登录服务器手动卸载。此操作不可恢复。
              </p>
            </ModalBody>
            <ModalFooter>
              <Button variant="ghost" onClick={onClose}>
                取消
              </Button>
              <Button
                loading={deleteLoading}
                variant="destructive"
                onClick={confirmDelete}
              >
                {deleteLoading ? "删除中..." : "删除"}
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}

export interface BatchDeleteNodesModalProps {
  batchDeleteModalOpen: boolean;
  batchLoading: boolean;
  handleBatchDelete: () => Promise<void>;
  selectedIds: Set<number>;
  setBatchDeleteModalOpen: Dispatch<SetStateAction<boolean>>;
}

/** Confirm deleting the selected nodes. */
export function BatchDeleteNodesModal({
  batchDeleteModalOpen,
  batchLoading,
  handleBatchDelete,
  selectedIds,
  setBatchDeleteModalOpen,
}: BatchDeleteNodesModalProps) {
  return (
    <Modal
      backdrop="blur"
      classNames={{
        base: "!w-[calc(100%-32px)] !mx-auto sm:!w-full rounded-xl overflow-hidden",
      }}
      open={batchDeleteModalOpen}
      placement="center"
      scrollBehavior="inside"
      size="md"
      onOpenChange={setBatchDeleteModalOpen}
    >
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="flex flex-col gap-1">
              <h2 className="text-base font-semibold">批量删除服务器</h2>
            </ModalHeader>
            <ModalBody className="space-y-2">
              <p className="text-sm">
                确定要删除选中的 <strong>{selectedIds.size}</strong>{" "}
                个服务器吗？
              </p>
              <p className="text-xs text-muted-foreground">
                这些服务器会从面板移除；agent
                仍在机器上运行，需要登录服务器手动卸载。此操作不可恢复。
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
                {batchLoading ? "删除中..." : "删除"}
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
