import type { Dispatch, SetStateAction } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectField } from "@/components/select-native";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@/components/modal";
import { Tunnel } from "@/pages/forward/types";

export interface ForwardFilterModalProps {
  isAdmin: boolean;
  isSearchModalOpen: boolean;
  resetSearchParams: () => void;
  searchParams: {
    name: string;
    userId: string;
    tunnelId: string;
    inPort: string;
    remoteAddr: string;
  };
  setIsSearchModalOpen: Dispatch<SetStateAction<boolean>>;
  setSearchParams: Dispatch<
    SetStateAction<{
      name: string;
      userId: string;
      tunnelId: string;
      inPort: string;
      remoteAddr: string;
    }>
  >;
  tunnels: Tunnel[];
  uniqueUsers: { id: number; name: string }[];
}

/** Search and filter conditions for the forward list. */
export function ForwardFilterModal({
  isAdmin,
  isSearchModalOpen,
  resetSearchParams,
  searchParams,
  setIsSearchModalOpen,
  setSearchParams,
  tunnels,
  uniqueUsers,
}: ForwardFilterModalProps) {
  return (
    <Modal
      classNames={{
        base: "!w-[calc(100%-32px)] !mx-auto sm:!w-full rounded-xl overflow-hidden",
      }}
      open={isSearchModalOpen}
      placement="center"
      size="md"
      onOpenChange={setIsSearchModalOpen}
    >
      <ModalContent>
        {() => (
          <>
            <ModalHeader closable className="flex flex-col gap-1">
              筛选规则
            </ModalHeader>
            <ModalBody>
              <div className="flex flex-col gap-4 py-2">
                {isAdmin && (
                  <SelectField
                    label="所属用户"
                    options={[
                      { value: "all", label: "全部用户" },
                      ...uniqueUsers.map((user) => ({
                        value: user.id.toString(),
                        label: user.name,
                      })),
                    ]}
                    placeholder="选择用户"
                    value={searchParams.userId || "all"}
                    onValueChange={(key) =>
                      setSearchParams((prev) => ({
                        ...prev,
                        userId: key || "all",
                      }))
                    }
                  />
                )}

                <SelectField
                  label="所属隧道"
                  options={[
                    { value: "all", label: "全部隧道" },
                    ...tunnels.map((tunnel) => ({
                      value: tunnel.id.toString(),
                      label: tunnel.name,
                    })),
                  ]}
                  placeholder="选择隧道"
                  value={searchParams.tunnelId || "all"}
                  onValueChange={(key) =>
                    setSearchParams((prev) => ({
                      ...prev,
                      tunnelId: key || "all",
                    }))
                  }
                />

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="ff-in-port">入口监听端口 (精确)</Label>
                  <Input
                    id="ff-in-port"
                    placeholder="请输入具体端口号"
                    type="number"
                    value={searchParams.inPort}
                    onChange={(e) =>
                      setSearchParams((prev) => ({
                        ...prev,
                        inPort: e.target.value,
                      }))
                    }
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="ff-remote">目标地址或端口 (模糊)</Label>
                  <Input
                    id="ff-remote"
                    placeholder="请输入目标IP、域名或端口"
                    value={searchParams.remoteAddr}
                    onChange={(e) =>
                      setSearchParams((prev) => ({
                        ...prev,
                        remoteAddr: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>
            </ModalBody>
            <ModalFooter>
              <Button variant="secondary" onClick={resetSearchParams}>
                重置
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
