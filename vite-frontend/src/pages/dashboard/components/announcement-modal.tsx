import type { AnnouncementData } from "@/api";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "@/components/dialog";

interface AnnouncementModalProps {
  announcement: AnnouncementData;
  isOpen: boolean;
  onClose: () => void;
  onDontShowAgain: () => void;
}

export const AnnouncementModal = ({
  announcement,
  isOpen,
  onClose,
  onDontShowAgain,
}: AnnouncementModalProps) => {
  return (
    <Dialog
      open={isOpen}
      size="2xl"
      onOpenChange={(open) => !open && onClose()}
    >
      <DialogContent>
        <DialogHeader closable className="flex flex-col gap-1">
          平台公告
        </DialogHeader>
        <DialogBody>
          <div className="prose prose-sm dark:prose-invert max-w-none max-h-[60vh] overflow-y-auto">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {announcement.content}
            </ReactMarkdown>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={onDontShowAgain}>
            不再提示
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
