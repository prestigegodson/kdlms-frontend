import { Copy, Pencil, Plus, Trash2 } from "lucide-react";
import { type ReactNode, useState } from "react";
import type { QuizThemeLibraryView, QuizThemeStyle } from "@/api/quizThemes";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { SearchInput } from "@/components/ui/SearchInput";
import { Spinner } from "@/components/ui/Spinner";
import { Tabs } from "@/components/ui/Tabs";
import { useAuthStore } from "@/stores/authStore";
import { ThemeSwatch } from "@/features/takeHomeQuizzes/theme/ThemePreview";
import type { ThemeChoice } from "@/features/takeHomeQuizzes/theme/themeChoice";

interface ThemePickerModalProps {
  library: QuizThemeLibraryView | null;
  loadError: string | null;
  choice: ThemeChoice;
  /** "School themes" for a school, "My themes" for a creator. */
  libraryLabel: string;
  /** Offer a "Created by me" filter - pointless for a creator, the tenant's only author. */
  offerMine: boolean;
  /** False when the quiz is read-only: themes can still be browsed and managed, never applied. */
  canUse: boolean;
  onUse: (choice: ThemeChoice) => void;
  onCreate: (from?: { name: string; style: QuizThemeStyle }) => void;
  onEdit: (themeId: string) => void;
  onDelete: (themeId: string) => void;
  onClose: () => void;
}

type Tab = "presets" | "saved";

/**
 * The theme gallery: the platform's built-in presets and the tenant's saved themes, each a live
 * swatch. Duplicating is how a teacher adapts a preset or a colleague's theme they may not edit.
 */
export function ThemePickerModal({
  library,
  loadError,
  choice,
  libraryLabel,
  offerMine,
  canUse,
  onUse,
  onCreate,
  onEdit,
  onDelete,
  onClose,
}: ThemePickerModalProps) {
  const [tab, setTab] = useState<Tab>(choice.themeId ? "saved" : "presets");
  const [query, setQuery] = useState("");
  const [mine, setMine] = useState(false);
  const userId = useAuthStore((state) => state.user?.id);

  const saved = (library?.themes ?? []).filter(
    (theme) =>
      theme.name.toLowerCase().includes(query.trim().toLowerCase()) && (!mine || theme.createdBy === userId),
  );

  return (
    <Modal open onClose={onClose} title="Choose a theme" size="xxl">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Tabs
            ariaLabel="Theme source"
            value={tab}
            onChange={setTab}
            items={[
              { value: "presets", label: "Built-in" },
              { value: "saved", label: libraryLabel },
            ]}
          />
          <Button size="sm" onClick={() => onCreate()}>
            <Plus className="h-4 w-4" aria-hidden="true" /> Create theme
          </Button>
        </div>

        {loadError && <Alert variant="error">{loadError}</Alert>}
        {!library && !loadError && (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Spinner /> Loading themes…
          </div>
        )}

        {library && tab === "presets" && (
          <ul className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
            {library.presets.map((preset) => (
              <ThemeCard
                key={preset.key}
                name={preset.name}
                style={preset.style}
                detail="Built-in"
                selected={choice.themePreset === preset.key}
                canUse={canUse}
                onUse={() => onUse({ themeId: null, themePreset: preset.key })}
                actions={
                  <CardAction label={`Duplicate ${preset.name}`} onClick={() => onCreate({ name: `Copy of ${preset.name}`, style: preset.style })}>
                    <Copy className="h-4 w-4" aria-hidden="true" />
                  </CardAction>
                }
              />
            ))}
          </ul>
        )}

        {library && tab === "saved" && (
          <div className="space-y-3">
            {library.themes.length > 0 && (
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-48 flex-1">
                  <SearchInput value={query} onChange={setQuery} placeholder="Search themes" />
                </div>
                {offerMine && (
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <Checkbox checked={mine} onChange={(event) => setMine(event.target.checked)} />
                    Created by me
                  </label>
                )}
              </div>
            )}
            {library.themes.length === 0 ? (
              <EmptyState
                title="No saved themes yet"
                description="Create one from scratch, or duplicate a built-in theme and make it your own. Everyone who sets quizzes here can use it."
              />
            ) : saved.length === 0 ? (
              <p className="text-sm text-slate-500">No themes match.</p>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                {saved.map((theme) => (
                  <ThemeCard
                    key={theme.id}
                    name={theme.name}
                    style={theme.style}
                    detail={[
                      theme.createdByName && `by ${theme.createdByName}`,
                      `used by ${theme.usageCount} quiz${theme.usageCount === 1 ? "" : "zes"}`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                    selected={choice.themeId === theme.id}
                    canUse={canUse}
                    onUse={() => onUse({ themeId: theme.id, themePreset: null })}
                    actions={
                      <>
                        <CardAction label={`Duplicate ${theme.name}`} onClick={() => onCreate({ name: `Copy of ${theme.name}`, style: theme.style })}>
                          <Copy className="h-4 w-4" aria-hidden="true" />
                        </CardAction>
                        {theme.canEdit && (
                          <>
                            <CardAction label={`Edit ${theme.name}`} onClick={() => onEdit(theme.id)}>
                              <Pencil className="h-4 w-4" aria-hidden="true" />
                            </CardAction>
                            <CardAction label={`Delete ${theme.name}`} onClick={() => onDelete(theme.id)}>
                              <Trash2 className="h-4 w-4" aria-hidden="true" />
                            </CardAction>
                          </>
                        )}
                      </>
                    }
                  />
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

interface ThemeCardProps {
  name: string;
  style: QuizThemeStyle;
  detail: string;
  selected: boolean;
  canUse: boolean;
  onUse: () => void;
  actions: ReactNode;
}

function ThemeCard({ name, style, detail, selected, canUse, onUse, actions }: ThemeCardProps) {
  return (
    <li
      className={`flex flex-col gap-2 rounded-card border p-2 ${selected ? "border-brand-500 ring-2 ring-brand-200" : "border-slate-200"}`}
    >
      <ThemeSwatch style={style} />
      <div className="flex items-start justify-between gap-2 px-1">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-900">{name}</p>
          <p className="truncate text-xs text-slate-500">{detail}</p>
        </div>
        {selected && <Badge variant="brand">In use</Badge>}
      </div>
      <div className="mt-auto flex items-center justify-between gap-1 px-1 pb-1">
        {canUse && !selected ? (
          <Button size="sm" variant="secondary" onClick={onUse} aria-label={`Use ${name}`}>
            Use
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-0.5">{actions}</div>
      </div>
    </li>
  );
}

function CardAction({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex h-8 w-8 items-center justify-center rounded-control text-slate-500 hover:bg-slate-100 hover:text-slate-700 mobile:h-11 mobile:w-11"
    >
      {children}
    </button>
  );
}
