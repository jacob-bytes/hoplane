import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@/components/modal";
import { TextField as Input } from "@/components/field-input";
import {
  beginPasskeyRegistration,
  deletePasskey,
  finishPasskeyRegistration,
  type PasskeyItem,
} from "@/api";
import { createPasskey } from "@/utils/passkey";

/** Binds and removes passkeys (profile page). */
export function PasskeyModal({
  items,
  isOpen,
  onClose,
  onChanged,
}: {
  items: PasskeyItem[];
  isOpen: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setPassword("");
      setName("");
    }
  }, [isOpen]);

  const register = async () => {
    if (!password) {
      toast.error("请输入当前密码");

      return;
    }
    setBusy(true);
    try {
      const begin = await beginPasskeyRegistration(password);

      if (begin.code !== 0) {
        toast.error(begin.msg || "无法绑定通行证密钥");

        return;
      }
      const credential = await createPasskey(begin.data.options);
      const finish = await finishPasskeyRegistration(
        begin.data.sessionId,
        credential,
        name.trim(),
      );

      if (finish.code !== 0) {
        toast.error(finish.msg || "绑定失败");

        return;
      }
      toast.success("通行证密钥已绑定");
      setPassword("");
      setName("");
      onChanged();
    } catch {
      toast.error("绑定已取消或失败");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (!password) {
      toast.error("请输入当前密码以删除密钥");

      return;
    }
    setBusy(true);
    try {
      const result = await deletePasskey(id, password);

      if (result.code !== 0) {
        toast.error(result.msg || "删除失败");

        return;
      }
      toast.success("通行证密钥已删除");
      onChanged();
    } catch {
      toast.error("删除失败");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      backdrop="blur"
      classNames={{
        base: "!w-[calc(100%-32px)] !mx-auto sm:!w-full rounded-xl overflow-hidden",
      }}
      isOpen={isOpen}
      placement="center"
      scrollBehavior="inside"
      size="md"
      onClose={onClose}
    >
      <ModalContent>
        <ModalHeader closable>通行证密钥</ModalHeader>
        <ModalBody>
          <p className="text-sm text-muted-foreground">
            绑定后可用设备解锁（指纹、面容等）登录。绑定和删除都需要当前密码。
          </p>
          {items.length > 0 && (
            <div className="divide-y divide-divider overflow-hidden rounded-xl border border-hairline">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">
                      {item.name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      创建于 {new Date(item.createdAt).toLocaleDateString()}
                      {item.lastUsedAt
                        ? ` · 最近使用 ${new Date(item.lastUsedAt).toLocaleDateString()}`
                        : ""}
                    </div>
                  </div>
                  <Button
                    disabled={busy}
                    size="sm"
                    variant="ghost"
                    onClick={() => void remove(item.id)}
                  >
                    删除
                  </Button>
                </div>
              ))}
            </div>
          )}
          <Input
            autoComplete="current-password"
            label="当前密码"
            type="password"
            value={password}
            variant="bordered"
            onChange={(e) => setPassword(e.target.value)}
          />
          <Input
            label="新密钥名称（可选）"
            value={name}
            variant="bordered"
            onChange={(e) => setName(e.target.value)}
          />
        </ModalBody>
        <ModalFooter>
          <Button disabled={busy} onClick={() => void register()}>
            绑定新密钥
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
