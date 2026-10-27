import type { Dispatch, SetStateAction } from "react";

import { Button } from "@/components/ui/button";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@/components/modal";
import { SelectField } from "@/components/select-native";
import { NodeFilterMode } from "@/pages/node/types";

export interface NodeFilterModalProps {
  isFilterModalOpen: boolean;
  nodeExpiryStats: {
    expired: number;
    expiringSoon: number;
    withExpiry: number;
  };
  nodeFilterMode: NodeFilterMode;
  resetNodeFilterMode: () => void;
  setIsFilterModalOpen: Dispatch<SetStateAction<boolean>>;
  setNodeFilterMode: (value: SetStateAction<NodeFilterMode>) => void;
}

/** Filter conditions for the node list. */
export function NodeFilterModal({
  isFilterModalOpen,
  nodeExpiryStats,
  nodeFilterMode,
  resetNodeFilterMode,
  setIsFilterModalOpen,
  setNodeFilterMode,
}: NodeFilterModalProps) {
  return (
    <Modal
      classNames={{
        base: "!w-[calc(100%-32px)] !mx-auto sm:!w-full rounded-xl overflow-hidden",
      }}
      open={isFilterModalOpen}
      placement="center"
      size="md"
      onOpenChange={setIsFilterModalOpen}
    >
      <ModalContent>
        {() => (
          <>
            <ModalHeader closable className="flex flex-col gap-1">
              筛选条件
            </ModalHeader>
            <ModalBody>
              <div className="flex flex-col gap-4 py-2">
                <div className="flex flex-col gap-2">
                  <p className="text-sm font-medium">按到期状态筛选</p>
                  <SelectField
                    aria-label="按到期状态筛选"
                    className="w-full"
                    options={[
                      { value: "all", label: "全部服务器" },
                      {
                        value: "expiringSoon",
                        label: `7天内续费 (${nodeExpiryStats.expiringSoon})`,
                      },
                      {
                        value: "expired",
                        label: `已逾期 (${nodeExpiryStats.expired})`,
                      },
                      {
                        value: "withExpiry",
                        label: `已启用续费提醒 (${nodeExpiryStats.withExpiry})`,
                      },
                    ]}
                    value={nodeFilterMode}
                    onValueChange={(value) =>
                      setNodeFilterMode(value as NodeFilterMode)
                    }
                  />
                </div>
              </div>
            </ModalBody>
            <ModalFooter>
              <Button variant="secondary" onClick={resetNodeFilterMode}>
                重置
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
