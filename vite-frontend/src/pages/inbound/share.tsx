import type { InboundApiItem, InboundShareEntry } from "@/api/types";

import axios from "axios";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Copy, QrCode } from "lucide-react";

import { copyWithToast } from "@/utils/clipboard";
import { getInboundShare } from "@/api";
import { Button } from "@/components/ui/button";
import { Badge, badgeTone } from "@/components/ui/badge";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
} from "@/components/dialog";

const modalBase =
  "!w-[calc(100%-32px)] !mx-auto sm:!w-full rounded-xl overflow-hidden";

export async function copyText(text: string, label = "已复制") {
  await copyWithToast(text, label);
}

/** The panel origin the browser talks to, so links work behind a proxy. */
export function panelOrigin(): string {
  const base = axios.defaults.baseURL || "";

  try {
    return new URL(base, window.location.origin).origin;
  } catch {
    return window.location.origin;
  }
}

export function QrImage({ text, size = 220 }: { text: string; size?: number }) {
  const [src, setSrc] = useState("");

  useEffect(() => {
    let alive = true;

    QRCode.toDataURL(text, {
      margin: 1,
      width: size,
      errorCorrectionLevel: "M",
    })
      .then((url) => alive && setSrc(url))
      .catch(() => alive && setSrc(""));

    return () => {
      alive = false;
    };
  }, [text, size]);

  if (!src) {
    return (
      <div
        className="flex items-center justify-center text-xs text-muted-foreground bg-muted rounded-xl"
        style={{ width: size, height: size }}
      >
        内容过长，无法生成二维码
      </div>
    );
  }

  return (
    <img
      alt="二维码"
      className="rounded-xl bg-white p-2"
      height={size}
      src={src}
      width={size}
    />
  );
}

function ShareEntryCard({ entry }: { entry: InboundShareEntry }) {
  const [showQr, setShowQr] = useState(false);
  // Snell has no common link format; its Surge line is all there is.
  const surgeOnly = !entry.uri;
  // WireGuard apps import a config file or scan it as a QR code.
  const [asConf, setAsConf] = useState(Boolean(entry.conf));
  const text = (asConf && entry.conf) || entry.uri || entry.surge;

  return (
    <div className="rounded-xl border border-hairline p-4 flex flex-col gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <Badge
            variant={badgeTone(
              entry.kind === "relay" ? "secondary" : "primary",
            )}
          >
            {entry.kind === "relay" ? "中转" : "直连"}
          </Badge>
          <span className="font-medium truncate">{entry.name}</span>
        </div>
        <p className="text-xs text-muted-foreground font-mono mt-1 break-all">
          {entry.host}:{entry.port}
        </p>
      </div>

      {entry.conf && (
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1 text-sm">
          {[
            [true, "配置文件"],
            [false, "分享链接"],
          ].map(([conf, label]) => (
            <button
              key={String(conf)}
              className={`rounded-lg py-1 ${asConf === conf ? "bg-background font-medium shadow-sm" : "text-muted-foreground"}`}
              type="button"
              onClick={() => setAsConf(Boolean(conf))}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      <pre className="text-xs font-mono whitespace-pre-wrap break-all rounded-xl bg-muted p-3 max-h-32 overflow-y-auto select-all">
        {text}
      </pre>

      <div className="flex gap-2">
        <Button
          className="flex-1"
          onClick={() =>
            copyText(
              text,
              asConf
                ? "WireGuard 配置已复制"
                : surgeOnly
                  ? "Surge 配置行已复制"
                  : "链接已复制",
            )
          }
        >
          {<Copy className="w-4 h-4" />}
          {asConf ? "复制配置" : surgeOnly ? "复制 Surge 配置" : "复制链接"}
        </Button>
        {!surgeOnly && (
          <Button
            aria-label="二维码"
            size="icon"
            variant={showQr ? "default" : "flat"}
            onClick={() => setShowQr((v) => !v)}
          >
            <QrCode className="w-4 h-4" />
          </Button>
        )}
      </div>

      {surgeOnly && (
        <p className="text-xs text-muted-foreground">
          Snell 没有通用分享链接，粘贴到 Surge 配置的 [Proxy] 段，或使用 Surge
          订阅。
        </p>
      )}
      {asConf && (
        <p className="text-xs text-muted-foreground">
          WireGuard 官方 App 扫码或导入配置即可；v2rayN、Clash
          等用分享链接或订阅
        </p>
      )}
      {showQr && (
        <div className="flex justify-center">
          <QrImage text={text} />
        </div>
      )}
    </div>
  );
}

export function ShareModal({
  item,
  onClose,
}: {
  item: InboundApiItem | null;
  onClose: () => void;
}) {
  const [entries, setEntries] = useState<InboundShareEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!item) return;
    setEntries([]);
    setLoading(true);
    getInboundShare(item.id)
      .then((res) => {
        if (res.code === 0) {
          setEntries(res.data || []);
        } else {
          toast.error(res.msg || "获取分享链接失败");
        }
      })
      .finally(() => setLoading(false));
  }, [item]);

  return (
    <Dialog
      backdrop="blur"
      classNames={{ base: modalBase }}
      open={Boolean(item)}
      placement="center"
      scrollBehavior="inside"
      size="lg"
      onOpenChange={(open) => !open && onClose()}
    >
      <DialogContent>
        {() => (
          <>
            <DialogHeader closable className="flex flex-col gap-1">
              <h2 className="text-lg font-bold">分享 · {item?.name}</h2>
              <p className="text-small text-muted-foreground">
                复制链接或扫码导入 v2rayN、Shadowrocket、NekoBox 等客户端；Surge
                请使用订阅
              </p>
            </DialogHeader>
            <DialogBody>
              {loading && (
                <p className="text-sm text-muted-foreground">加载中...</p>
              )}
              {!loading && entries.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  没有可分享的地址：入站仅监听本机或设置了仅中转，但还没有对接中转。
                </p>
              )}
              <div className="flex flex-col gap-3">
                {entries.map((e) => (
                  <ShareEntryCard
                    key={`${e.kind}-${e.host}-${e.port}`}
                    entry={e}
                  />
                ))}
              </div>
            </DialogBody>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
