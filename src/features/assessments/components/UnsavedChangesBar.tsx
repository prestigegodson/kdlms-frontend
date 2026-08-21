import { Button } from "@/components/ui/Button";

interface UnsavedChangesBarProps {
  count: number;
  saving: boolean;
  onSave: () => void;
  onDiscard: () => void;
  /**
   * The Save button's variant - defaults to `accent`, the one CTA on every entry-grid view this bar
   * originally shipped for. `LessonNoteEditorPage` (Phase 16E) overrides this to `primary`: that
   * screen's own "Generate with AI" button is its single accent per the style guide's 60/30/10
   * balance, so Save can't also be amber there without two accents competing on one view.
   */
  saveVariant?: "accent" | "primary";
}

/**
 * A sticky bottom bar carrying the dirty-row count, a Save button, and a ghost "Discard". Renders
 * nothing when there's nothing unsaved.
 */
export function UnsavedChangesBar({ count, saving, onSave, onDiscard, saveVariant = "accent" }: UnsavedChangesBarProps) {
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
        <Button type="button" variant={saveVariant} loading={saving} onClick={onSave}>
          Save changes
        </Button>
      </div>
    </div>
  );
}
