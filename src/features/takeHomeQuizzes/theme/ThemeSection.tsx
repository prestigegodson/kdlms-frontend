import { Palette } from "lucide-react";
import { useEffect, useState } from "react";
import { ApiError } from "@/api/client";
import { deleteQuizTheme, listQuizThemes, type QuizThemeLibraryView, type QuizThemeStyle } from "@/api/quizThemes";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { NO_THEME, type ThemeChoice } from "@/features/takeHomeQuizzes/theme/themeChoice";
import { DEFAULT_THEME_STYLE } from "@/features/takeHomeQuizzes/theme/themeColors";
import { type ThemeDraft, ThemeDesignerModal } from "@/features/takeHomeQuizzes/theme/ThemeDesignerModal";
import { ThemePickerModal } from "@/features/takeHomeQuizzes/theme/ThemePickerModal";
import { ThemeSwatch } from "@/features/takeHomeQuizzes/theme/ThemePreview";

interface ThemeSectionProps {
  choice: ThemeChoice;
  /** The saved quiz's resolved theme - shown until the library loads, so the row never flickers. */
  resolved: QuizThemeStyle | null;
  onChange: (choice: ThemeChoice) => void;
  /** The quiz is read-only: the current theme shows, and the library can't be applied from here. */
  disabled: boolean;
  /** "School themes" for a school, "My themes" for a creator. */
  libraryLabel: string;
  offerMine: boolean;
  quizTitle: string;
}

type Dialog =
  | { kind: "none" }
  | { kind: "picker" }
  | { kind: "designer"; initial: ThemeDraft; editingId?: string }
  | { kind: "delete"; themeId: string };

/**
 * The quiz editor's "Theme" row - the current theme at a glance, and the way into the gallery and
 * designer. Shared by the school and creator editors; the theme library itself is tenant-wide, so
 * this one component talks to `/api/v1/quiz-themes` for both. Choosing a theme changes the form
 * only - it reaches the quiz with the editor's ordinary Save, like every other setting.
 */
export function ThemeSection({ choice, resolved, onChange, disabled, libraryLabel, offerMine, quizTitle }: ThemeSectionProps) {
  const [library, setLibrary] = useState<QuizThemeLibraryView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialog>({ kind: "none" });
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    listQuizThemes()
      .then((data) => {
        if (!cancelled) {
          setLibrary(data);
          setLoadError(null);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoadError(error instanceof ApiError ? error.message : "Failed to load themes");
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const preset = choice.themePreset ? library?.presets.find((p) => p.key === choice.themePreset) : undefined;
  const saved = choice.themeId ? library?.themes.find((t) => t.id === choice.themeId) : undefined;
  const current = preset
    ? { name: preset.name, style: preset.style, detail: "Built-in theme" }
    : saved
      ? { name: saved.name, style: saved.style, detail: "Saved theme - edits to it update this quiz too" }
      : (choice.themeId || choice.themePreset) && !library && resolved
        ? { name: "Theme", style: resolved, detail: "" }
        : null;
  const editing = dialog.kind === "designer" && dialog.editingId
    ? library?.themes.find((t) => t.id === dialog.editingId)
    : undefined;

  function use(next: ThemeChoice) {
    onChange(next);
    setDialog({ kind: "none" });
  }

  return (
    <div className="space-y-2">
      <span className="block text-sm font-medium text-slate-700">Theme</span>
      <div className="flex flex-wrap items-center gap-3 rounded-card border border-slate-200 p-3">
        {current ? (
          <ThemeSwatch style={current.style} className="w-28 shrink-0" />
        ) : (
          <div className="flex h-16 w-28 shrink-0 items-center justify-center rounded-panel border border-dashed border-slate-300 text-slate-400">
            <Palette className="h-5 w-5" aria-hidden="true" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-slate-900">{current?.name ?? "Standard look"}</p>
          <p className="text-xs text-slate-500">
            {current?.detail || "Give this quiz a background, header image, colours and font your class will love."}
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => setDialog({ kind: "picker" })}>
            {current ? "Change" : disabled ? "Browse themes" : "Choose theme"}
          </Button>
          {current && !disabled && (
            <Button size="sm" variant="ghost" onClick={() => onChange(NO_THEME)}>
              Remove
            </Button>
          )}
        </div>
      </div>

      {dialog.kind === "picker" && (
        <ThemePickerModal
          library={library}
          loadError={loadError}
          choice={choice}
          libraryLabel={libraryLabel}
          offerMine={offerMine}
          canUse={!disabled}
          onUse={use}
          onCreate={(from) =>
            setDialog({ kind: "designer", initial: from ?? { name: "", style: DEFAULT_THEME_STYLE } })
          }
          onEdit={(themeId) => {
            const theme = library?.themes.find((t) => t.id === themeId);
            if (theme) setDialog({ kind: "designer", initial: { name: theme.name, style: theme.style }, editingId: themeId });
          }}
          onDelete={(themeId) => setDialog({ kind: "delete", themeId })}
          onClose={() => setDialog({ kind: "none" })}
        />
      )}

      {dialog.kind === "designer" && (
        <ThemeDesignerModal
          initial={dialog.initial}
          editing={editing}
          canUse={!disabled}
          quizTitle={quizTitle}
          onClose={() => setDialog({ kind: "picker" })}
          onSaved={(theme, useIt) => {
            setRefreshKey((key) => key + 1);
            if (useIt) {
              use({ themeId: theme.id, themePreset: null });
            } else {
              setDialog({ kind: "picker" });
            }
          }}
        />
      )}

      {dialog.kind === "delete" && (
        <DeleteThemeDialog
          name={library?.themes.find((t) => t.id === dialog.themeId)?.name ?? "this theme"}
          usageCount={library?.themes.find((t) => t.id === dialog.themeId)?.usageCount ?? 0}
          onConfirm={async () => {
            await deleteQuizTheme(dialog.themeId);
            if (choice.themeId === dialog.themeId) onChange(NO_THEME);
            setRefreshKey((key) => key + 1);
            setDialog({ kind: "picker" });
          }}
          onClose={() => setDialog({ kind: "picker" })}
        />
      )}
    </div>
  );
}

function DeleteThemeDialog({
  name,
  usageCount,
  onConfirm,
  onClose,
}: {
  name: string;
  usageCount: number;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}) {
  return (
    <ConfirmDialog
      title={`Delete ${name}?`}
      variant="danger"
      confirmLabel="Delete theme"
      message={
        usageCount > 0 ? (
          <p>
            {usageCount} quiz{usageCount === 1 ? "" : "zes"} use this theme and will go back to the standard look. This
            can&apos;t be undone.
          </p>
        ) : (
          <p>No quiz uses this theme. This can&apos;t be undone.</p>
        )
      }
      onConfirm={onConfirm}
      onClose={onClose}
    />
  );
}
