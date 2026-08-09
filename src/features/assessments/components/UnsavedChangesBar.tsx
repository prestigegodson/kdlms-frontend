import { Button } from "@/components/ui/Button";

interface UnsavedChangesBarProps {
  count: number;
  saving: boolean;
  onSave: () => void;
  onDiscard: () => void;
}

/**
 * The one accent CTA on the entry-grid views: a sticky bottom bar carrying
 * the dirty-row count, "Save changes" (accent), and a ghost "Discard".
 * Renders nothing when there's nothing unsaved.
 */
export function UnsavedChangesBar({ count, saving, onSave, onDiscard }: UnsavedChangesBarProps) {
  if (count === 0) return null;

  return (
    <div className="sticky bottom-tabbar-safe -mx-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:bottom-0 lg:px-8">
      <p className="text-sm text-slate-600">
        {count} unsaved change{count === 1 ? "" : "s"}
      </p>
      <div className="flex gap-2">
        <Button type="button" variant="ghost" disabled={saving} onClick={onDiscard}>
          Discard
        </Button>
        <Button type="button" variant="accent" loading={saving} onClick={onSave}>
          Save changes
        </Button>
      </div>
    </div>
  );
}
