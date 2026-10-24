import { toast } from "sonner";

/**
 * Toast with an undo action. Used for actions that are cheap to reverse
 * (enable/disable, reorder) so a misclick costs one click, not a form.
 */
export function toastUndo(message: string, onUndo: () => void | Promise<void>) {
  toast(message, {
    duration: 5000,
    action: {
      label: "撤销",
      onClick: () => void onUndo(),
    },
  });
}
