import type { Dispatch, SetStateAction } from "react";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { TextAreaField as Textarea } from "@/components/field-input";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@/components/modal";
import { Badge } from "@/components/ui/badge";
import { Select, SelectItem } from "@/components/select-field";
import { Tab, Tabs } from "@/shadcn-bridge/heroui/tabs";
import { type ReleaseChannel } from "@/api";

export interface InstallCommands {
  script: string;
  docker: string;
}

export interface InstallCommandModalProps {
  currentNodeName: string;
  handleCopyCommand: (command: string) => Promise<void>;
  installCommands: InstallCommands;
  installCommandModal: boolean;
  setInstallCommandModal: Dispatch<SetStateAction<boolean>>;
}

type InstallMode = keyof InstallCommands;

/** The commands that install the agent on a node: install.sh or Docker. */
export function InstallCommandModal({
  currentNodeName,
  handleCopyCommand,
  installCommands,
  installCommandModal,
  setInstallCommandModal,
}: InstallCommandModalProps) {
  const [mode, setMode] = useState<InstallMode>("script");

  useEffect(() => {
    if (installCommandModal) setMode("script");
  }, [installCommandModal]);

  const command = installCommands[mode];
  const commandBox = (
    <div className="relative">
      <Textarea
        readOnly
        className="font-mono text-sm"
        classNames={{
          input: "font-mono text-sm",
        }}
        maxRows={10}
        minRows={6}
        value={command}
        variant="bordered"
      />
      <Button
        className="absolute top-2 right-2"
        size="sm"
        variant="secondary"
        onClick={() => handleCopyCommand(command)}
      >
        复制
      </Button>
    </div>
  );

  return (
    <Modal
      backdrop="blur"
      classNames={{
        base: "!w-[calc(100%-32px)] !mx-auto sm:!w-full rounded-xl overflow-hidden",
      }}
      isOpen={installCommandModal}
      placement="center"
      scrollBehavior="inside"
      size="2xl"
      onClose={() => setInstallCommandModal(false)}
    >
      <ModalContent>
        <ModalHeader closable>安装命令 - {currentNodeName}</ModalHeader>
        <ModalBody>
          <div className="space-y-4">
            {installCommands.docker ? (
              <Tabs
                aria-label="安装方式"
                selectedKey={mode}
                onSelectionChange={(key) => setMode(key as InstallMode)}
              >
                <Tab key="script" title="一键脚本">
                  <div className="space-y-3 pt-2">
                    <p className="text-sm text-muted-foreground">
                      在服务器上以 root 执行，安装为 systemd / OpenRC 服务：
                    </p>
                    {commandBox}
                  </div>
                </Tab>
                <Tab key="docker" title="Docker">
                  <div className="space-y-3 pt-2">
                    <p className="text-sm text-muted-foreground">
                      在已安装 Docker 的服务器上执行：
                    </p>
                    {commandBox}
                    <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                      <li>
                        使用 host 网络，数据保存在宿主机 /etc/hoplane_agent；
                        不要和一键脚本装的 agent 同时运行。
                      </li>
                      <li>
                        面板一键升级会替换数据目录里的程序并自动重启容器；
                        拉取新镜像后重建容器也会升级。
                      </li>
                      <li>服务器调优需要容器以 --privileged 运行。</li>
                    </ul>
                  </div>
                </Tab>
              </Tabs>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  请复制以下安装命令到服务器上执行：
                </p>
                {commandBox}
              </>
            )}
            <div className="text-xs text-muted-foreground">
              💡 提示：如果复制按钮失效，请手动选择上方文本进行复制
            </div>
          </div>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}

export interface UpgradeNodeModalProps {
  handleConfirmUpgrade: () => Promise<void>;
  releases: {
    version: string;
    name: string;
    publishedAt: string;
    prerelease: boolean;
    channel: ReleaseChannel;
  }[];
  releasesLoading: boolean;
  selectedIds: Set<number>;
  selectedVersion: string;
  setSelectedVersion: Dispatch<SetStateAction<string>>;
  setUpgradeModalOpen: Dispatch<SetStateAction<boolean>>;
  upgradeModalOpen: boolean;
  upgradeTarget: "single" | "batch";
  /** Only for a single node: shows the installed version and a way back. */
  currentVersion?: string;
  onRollback?: () => void;
}

/** Pick a version and upgrade the agent on one or more nodes. */
export function UpgradeNodeModal({
  handleConfirmUpgrade,
  releases,
  releasesLoading,
  selectedIds,
  selectedVersion,
  setSelectedVersion,
  setUpgradeModalOpen,
  upgradeModalOpen,
  upgradeTarget,
  currentVersion,
  onRollback,
}: UpgradeNodeModalProps) {
  return (
    <Modal
      backdrop="blur"
      classNames={{
        base: "!w-[calc(100%-32px)] !mx-auto sm:!w-full rounded-xl overflow-hidden",
      }}
      isOpen={upgradeModalOpen}
      placement="center"
      scrollBehavior="inside"
      size="md"
      onOpenChange={setUpgradeModalOpen}
    >
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="flex flex-col gap-1">
              <h2 className="text-xl font-bold">
                {upgradeTarget === "batch"
                  ? `批量升级 (${selectedIds.size} 个服务器)`
                  : "版本管理"}
              </h2>
            </ModalHeader>
            <ModalBody>
              {releasesLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="size-7 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="space-y-4">
                  <Select
                    label="选择版本"
                    placeholder="留空则使用最新版本"
                    selectedKeys={selectedVersion ? [selectedVersion] : []}
                    onSelectionChange={(keys) => {
                      const selected = Array.from(keys)[0] as string;

                      setSelectedVersion(selected || "");
                    }}
                  >
                    {releases.map((r) => (
                      <SelectItem key={r.version} textValue={r.version}>
                        <div className="flex justify-between items-center">
                          <span>{r.version}</span>
                          <span className="text-xs text-muted-foreground">
                            {r.publishedAt
                              ? new Date(r.publishedAt).toLocaleDateString()
                              : ""}
                            {r.channel === "dev" && (
                              <Badge
                                className="ml-1 shrink-0 whitespace-nowrap"
                                variant="warning"
                              >
                                测试
                              </Badge>
                            )}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </Select>
                  <p className="text-sm text-muted-foreground">
                    {selectedVersion
                      ? `将升级到版本 ${selectedVersion}`
                      : "未选择版本，将自动使用最新版"}
                  </p>
                </div>
              )}
            </ModalBody>
            {upgradeTarget === "single" && onRollback && (
              <ModalBody className="border-t border-border pt-4">
                <div className="rounded-lg border border-border p-3">
                  <div className="text-sm font-medium">回退到上一版</div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    当前版本 {currentVersion || "未知"}
                    ，回退会重启 agent，正在转发的连接会短暂中断。
                  </p>
                  <Button
                    className="mt-2 w-full"
                    size="sm"
                    variant="outline"
                    onClick={onRollback}
                  >
                    回退
                  </Button>
                </div>
              </ModalBody>
            )}
            <ModalFooter>
              <Button variant="ghost" onClick={onClose}>
                取消
              </Button>
              <Button
                disabled={releasesLoading}
                variant="warning"
                onClick={handleConfirmUpgrade}
              >
                升级
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
