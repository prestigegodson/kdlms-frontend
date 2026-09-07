export type SaveStatus = "saved" | "saving" | "offline";

const LABELS: Record<SaveStatus, string> = {
  saved: "Saved",
  saving: "Saving…",
  offline: "Offline — will save when reconnected",
};

const DOT_CLASSES: Record<SaveStatus, string> = {
  saved: "bg-green-500",
  saving: "bg-amber-500",
  offline: "bg-slate-400",
};

/** The saved/saving/offline indicator the design doc's "poor connectivity" section calls for. */
export function SaveStatusIndicator({ status }: { status: SaveStatus }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500" role="status">
      <span className={`h-1.5 w-1.5 rounded-full ${DOT_CLASSES[status]}`} aria-hidden="true" />
      {LABELS[status]}
    </span>
  );
}
