import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Github } from "lucide-react";

import { Button, buttonVariant } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@/components/modal";
import { beginGithubBind, unbindGithub, type GithubInfo } from "@/api";
import { githubCallbackUrl, goToGithub } from "@/utils/github-login";

/** Binds or unbinds the GitHub account used for GitHub login. */
export function GithubBindingModal({
  info,
  isOpen,
  onClose,
  onChanged,
}: {
  info: GithubInfo | null;
  isOpen: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const bound = Boolean(info?.bound);

  useEffect(() => {
    if (isOpen) setPassword("");
  }, [isOpen]);

  const submit = async () => {
    if (!password) {
      toast.error("请输入当前密码");

      return;
    }
    setBusy(true);
    try {
      if (!bound) {
        const res = await beginGithubBind(githubCallbackUrl(), password);

        if (res.code !== 0) {
          toast.error(res.msg || "无法绑定 GitHub");
          setBusy(false);

          return;
        }
        // Leaves the page; GitHub comes back to /github-callback.
        goToGithub("bind", res.data.url);

        return;
      }
      const res = await unbindGithub(password);

      if (res.code !== 0) {
        toast.error(res.msg || "解绑失败");

        return;
      }
      toast.success("已解绑 GitHub 账号");
      onChanged();
      onClose();
    } catch {
      toast.error(bound ? "解绑失败" : "无法绑定 GitHub");
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
      open={isOpen}
      placement="center"
      size="md"
      onClose={onClose}
    >
      <ModalContent>
        <ModalHeader>GitHub 登录</ModalHeader>
        <ModalBody>
          <div className="flex items-center gap-3 rounded-xl bg-muted px-3 py-3">
            <Github className="h-5 w-5 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">
                {bound ? info?.login : "未绑定"}
              </div>
              <div className="text-xs text-muted-foreground">
                {bound
                  ? `绑定于 ${new Date(info?.createdAt || 0).toLocaleDateString()}，可在登录页用 GitHub 登录`
                  : "绑定后可在登录页用 GitHub 账号登录"}
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="github-current-password">当前密码</Label>
            <Input
              autoComplete="current-password"
              id="github-current-password"
              placeholder={bound ? "输入当前密码以解绑" : "输入当前密码以绑定"}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void submit();
              }}
            />
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button
            disabled={busy}
            variant={buttonVariant(bound ? "danger" : "primary")}
            onClick={() => void submit()}
          >
            {bound ? "解绑" : "去 GitHub 授权"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
