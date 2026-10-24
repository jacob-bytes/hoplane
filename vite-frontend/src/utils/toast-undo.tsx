import toast from "react-hot-toast";

/**
 * Toast with an undo action. Used for actions that are cheap to reverse
 * (enable/disable, reorder) so a misclick costs one click, not a form.
 */
export function toastUndo(message: string, onUndo: () => void | Promise<void>) {
  toast(
    (t) => (
      <span className="flex items-center gap-3 text-sm">
        <span className="min-w-0">{message}</span>
        <button
          className="shrink-0 font-medium text-primary hover:underline"
          type="button"
          onClick={() => {
            toast.dismiss(t.id);
            void onUndo();
          }}
        >
          撤销
        </button>
      </span>
    ),
    { duration: 5000 },
  );
}
