import type { AnnouncementData } from "@/api";

import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";

import { Card, CardContent } from "@/components/ui/card";

interface AnnouncementBannerProps {
  announcement: AnnouncementData;
}

export const AnnouncementBanner = ({
  announcement,
}: AnnouncementBannerProps) => {
  if (!announcement.content) {
    return null;
  }

  return (
    <Card className="mb-4 border border-primary/15 bg-primary/5 shadow-none lg:mb-6">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-center gap-3.5 sm:gap-4">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border border-primary/15 bg-raised sm:h-11 sm:w-11">
            <svg
              aria-hidden="true"
              className="h-5 w-5 text-primary"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                clipRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                fillRule="evenodd"
              />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="mb-1 mt-1.5 text-base font-semibold tracking-tight text-foreground sm:mb-1.5">
              公告
            </h3>
            <div className="break-words text-sm leading-relaxed text-foreground/80">
              <ReactMarkdown
                components={{
                  p: ({ children }) => (
                    <p className="mb-2 last:mb-0">{children}</p>
                  ),
                  a: ({ children, href }) => (
                    <a
                      className="underline decoration-primary/40 underline-offset-2 hover:text-primary"
                      href={href}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      {children}
                    </a>
                  ),
                  ul: ({ children }) => (
                    <ul className="list-disc pl-5 space-y-1 mb-2 last:mb-0">
                      {children}
                    </ul>
                  ),
                  ol: ({ children }) => (
                    <ol className="list-decimal pl-5 space-y-1 mb-2 last:mb-0">
                      {children}
                    </ol>
                  ),
                  code: ({ children }) => (
                    <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.92em]">
                      {children}
                    </code>
                  ),
                  pre: ({ children }) => (
                    <pre className="mb-2 overflow-x-auto rounded-md bg-muted p-2.5 font-mono text-xs leading-relaxed">
                      {children}
                    </pre>
                  ),
                  blockquote: ({ children }) => (
                    <blockquote className="mb-2 border-l-2 border-border pl-3 italic text-muted-foreground">
                      {children}
                    </blockquote>
                  ),
                }}
                rehypePlugins={[rehypeSanitize]}
                remarkPlugins={[remarkGfm]}
              >
                {announcement.content}
              </ReactMarkdown>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
