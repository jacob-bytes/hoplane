import { Copy } from "lucide-react";

import { copyText } from "@/pages/inbound/share";
import { SUB_CLIENTS } from "@/pages/subscription/clients";

/**
 * One tile per client: pressing it opens the app's own import (or copies
 * the link where the app has none), the button on its right copies the
 * link. With routing rules, clients that take a full configuration get it.
 */
export function SubClientGrid({
  link,
  name,
  rules,
  configClients = [],
  columns = 2,
}: {
  /** The subscription link for a ?format= value ("" for auto). */
  link: (format: string) => string;
  name: string;
  rules: boolean;
  /** Clients rendered from a template: they get a full configuration too. */
  configClients?: string[];
  /** Wide cards can fit one more column. */
  columns?: 2 | 3;
}) {
  return (
    <div
      className={`grid gap-1.5 ${columns === 3 ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2"}`}
    >
      {SUB_CLIENTS.map((c) => {
        const url = link(c.format);
        const isConfig =
          c.configImportURL !== undefined &&
          (rules || configClients.includes(c.key));
        const importURL = isConfig ? (c.configImportURL ?? null) : c.importURL;
        const open = () => {
          if (importURL) {
            window.location.href = importURL(url, name);
          } else {
            copyText(
              url,
              isConfig
                ? `${c.label}配置链接已复制，在 App 的配置里从 URL 下载`
                : `${c.label}订阅已复制`,
            );
          }
        };

        return (
          <div
            key={c.key}
            className="relative flex h-11 items-center rounded-xl border border-hairline transition-colors hover:bg-muted"
          >
            <button
              className="h-full min-w-0 flex-1 truncate pl-2 pr-8 text-left text-[13px] font-medium sm:pl-3 sm:text-sm"
              title={
                importURL
                  ? `导入到 ${c.label}`
                  : isConfig
                    ? `复制 ${c.label} 配置链接`
                    : "复制通用订阅"
              }
              type="button"
              onClick={open}
            >
              {c.label}
            </button>
            <button
              aria-label={`复制 ${c.label} 订阅链接`}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-muted-foreground"
              type="button"
              onClick={() => copyText(url, `${c.label} 订阅已复制`)}
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
