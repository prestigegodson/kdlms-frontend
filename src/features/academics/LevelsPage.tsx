import { type FormEvent, useEffect, useState } from "react";
import {
  activateLevel,
  createLevel,
  deactivateLevel,
  deleteLevel,
  type LevelView,
  renameLevel,
  reorderLevels,
} from "@/api/levels";
import { ApiError } from "@/api/client";
import { can } from "@/auth/permissions";
import { ArrowDown, ArrowUp, Layers } from "lucide-react";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { Select } from "@/components/ui/Select";
import { Spinner } from "@/components/ui/Spinner";
import { useAuthStore } from "@/stores/authStore";
import { useLevelStore } from "@/stores/levelStore";

/** The five platform stages a level can be created against - fixed, unlike display names. */
const BASE_LEVEL_OPTIONS = [
  { value: "PRE_SCHOOL", label: "Pre School" },
  { value: "PRE_NURSERY", label: "Pre Nursery" },
  { value: "NURSERY", label: "Nursery" },
  { value: "PRIMARY", label: "Primary" },
  { value: "SECONDARY", label: "Secondary" },
];

function baseLevelLabel(baseLevel: string): string {
  return BASE_LEVEL_OPTIONS.find((option) => option.value === baseLevel)?.label ?? baseLevel;
}

function describeUsage(level: LevelView): string {
  const parts: string[] = [];
  if (level.subjectCount > 0) parts.push(`${level.subjectCount} subject${level.subjectCount === 1 ? "" : "s"}`);
  if (level.classCount > 0) parts.push(`${level.classCount} class${level.classCount === 1 ? "" : "es"}`);
  if (level.subjectGroupCount > 0) {
    parts.push(`${level.subjectGroupCount} group${level.subjectGroupCount === 1 ? "" : "s"}`);
  }
  return parts.length > 0 ? parts.join(" · ") : "Nothing set up yet";
}

/**
 * School-owned levels, in promotion order - a SCHOOL_ADMIN's control over
 * how their school's stages are named and sequenced. Every school starts
 * with the five platform defaults (provisioned on onboarding); this page
 * lets them be renamed, reordered, added to, archived/restored, and
 * deleted once nothing references them. Order carries real meaning here
 * (it drives promotion), so the list renders as a ranked ladder rather than
 * a plain table - the one place in the app a numbered marker is earned.
 */
export function LevelsPage() {
  const role = useAuthStore((state) => state.user?.role);
  const canManage = can.manageLevels(role);

  const levels = useLevelStore((state) => state.levels);
  const status = useLevelStore((state) => state.status);
  const fetchIfNeeded = useLevelStore((state) => state.fetchIfNeeded);
  const refresh = useLevelStore((state) => state.refresh);

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<LevelView | null>(null);
  const [deleting, setDeleting] = useState<LevelView | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [reordering, setReordering] = useState(false);

  useEffect(() => {
    fetchIfNeeded();
  }, [fetchIfNeeded]);

  async function toggleActive(level: LevelView) {
    setActionError(null);
    try {
      if (level.status === "ACTIVE") {
        await deactivateLevel(level.id);
      } else {
        await activateLevel(level.id);
      }
      await refresh();
    } catch (error) {
      setActionError(error instanceof ApiError ? error.message : "That action failed");
    }
  }

  async function move(index: number, direction: -1 | 1) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= levels.length) return;
    const reordered = [...levels];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, moved);

    setActionError(null);
    setReordering(true);
    try {
      await reorderLevels({ levelIds: reordered.map((level) => level.id) });
      await refresh();
    } catch (error) {
      setActionError(error instanceof ApiError ? error.message : "Failed to reorder levels");
    } finally {
      setReordering(false);
    }
  }

  async function confirmDelete(level: LevelView) {
    await deleteLevel(level.id);
    setDeleting(null);
    await refresh();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Levels"
        description="The schooling stages your school uses, in promotion order."
        actions={canManage && <Button variant="accent" onClick={() => setCreateOpen(true)}>Add level</Button>}
      />

      {actionError && <Alert variant="error">{actionError}</Alert>}

      {status !== "loaded" && status !== "error" && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner /> Loading levels…
        </div>
      )}
      {status === "error" && <Alert variant="error">Failed to load levels</Alert>}
      {status === "loaded" && levels.length === 0 && (
        <EmptyState
          icon={Layers}
          title="No levels yet"
          description="Add a level to start building your subject and class catalogue."
        />
      )}
      {status === "loaded" && levels.length > 0 && (
        <Card className="p-0">
          <ol className="divide-y divide-slate-100">
            {levels.map((level, index) => (
              <li key={level.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-800">
                  {level.rank}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-slate-900">{level.displayName}</span>
                    {/* Only shown once the name has diverged from its stage's default label -
                        otherwise it's just the same word twice (e.g. "Primary" next to "Primary"). */}
                    {level.displayName !== baseLevelLabel(level.baseLevel) && (
                      <Badge variant="brand">{baseLevelLabel(level.baseLevel)}</Badge>
                    )}
                    {level.status === "INACTIVE" && <Badge variant="neutral">Archived</Badge>}
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">{describeUsage(level)}</p>
                </div>

                {canManage && (
                  <>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        aria-label={`Move ${level.displayName} up`}
                        className="flex items-center justify-center rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 disabled:pointer-events-none disabled:opacity-30 mobile:h-11 mobile:w-11"
                        disabled={index === 0 || reordering}
                        onClick={() => move(index, -1)}
                      >
                        <ArrowUp className="h-4 w-4" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Move ${level.displayName} down`}
                        className="flex items-center justify-center rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 disabled:pointer-events-none disabled:opacity-30 mobile:h-11 mobile:w-11"
                        disabled={index === levels.length - 1 || reordering}
                        onClick={() => move(index, 1)}
                      >
                        <ArrowDown className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>

                    {/* Only separates the arrows from the text actions when they share one line - from `md` up. */}
                    <span className="mx-1 hidden h-4 w-px bg-slate-200 md:block" aria-hidden="true" />

                    <div className="flex w-full flex-wrap items-center justify-end gap-1 md:w-auto md:shrink-0">
                      <button
                        type="button"
                        className="inline-flex items-center px-2 py-1 text-sm text-brand-500 hover:text-brand-600 mobile:min-h-11"
                        onClick={() => setEditing(level)}
                      >
                        Rename
                      </button>
                      <button
                        type="button"
                        className="inline-flex items-center px-2 py-1 text-sm text-slate-500 hover:text-slate-700 mobile:min-h-11"
                        onClick={() => toggleActive(level)}
                      >
                        {level.status === "ACTIVE" ? "Archive" : "Restore"}
                      </button>
                      <button
                        type="button"
                        className="inline-flex items-center px-2 py-1 text-sm text-red-600 hover:text-red-700 disabled:pointer-events-none disabled:opacity-40 mobile:min-h-11"
                        disabled={level.subjectCount + level.classCount + level.subjectGroupCount > 0}
                        title={
                          level.subjectCount + level.classCount + level.subjectGroupCount > 0
                            ? "Move or delete what this level still holds before deleting it."
                            : undefined
                        }
                        onClick={() => setDeleting(level)}
                      >
                        Delete
                      </button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ol>
        </Card>
      )}

      {createOpen && (
        <LevelFormModal
          title="Add level"
          onClose={() => setCreateOpen(false)}
          onSubmit={async (values) => {
            await createLevel({ baseLevel: values.baseLevel ?? BASE_LEVEL_OPTIONS[0].value, displayName: values.displayName });
          }}
          onSaved={() => {
            setCreateOpen(false);
            refresh();
          }}
        />
      )}
      {editing && (
        <LevelFormModal
          key={editing.id}
          title="Rename level"
          initial={editing}
          onClose={() => setEditing(null)}
          onSubmit={async (values) => {
            await renameLevel(editing.id, { displayName: values.displayName });
          }}
          onSaved={() => {
            setEditing(null);
            refresh();
          }}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title="Delete this level?"
          message={
            <>
              <strong>{deleting.displayName}</strong> will be removed. This can't be undone - you'd need to add it
              back and it would start out empty again.
            </>
          }
          confirmLabel="Delete"
          variant="danger"
          onConfirm={() => confirmDelete(deleting)}
          onClose={() => setDeleting(null)}
        />
      )}
    </div>
  );
}

interface LevelFormValues {
  baseLevel?: string;
  displayName: string;
}

interface LevelFormModalProps {
  title: string;
  /** Presence indicates rename mode - the stage selector is create-only, since baseLevel is immutable once set. */
  initial?: LevelView;
  onClose: () => void;
  onSubmit: (values: LevelFormValues) => Promise<void>;
  onSaved: () => void;
}

function LevelFormModal({ title, initial, onClose, onSubmit, onSaved }: LevelFormModalProps) {
  const [baseLevel, setBaseLevel] = useState(initial?.baseLevel ?? BASE_LEVEL_OPTIONS[0].value);
  const [displayName, setDisplayName] = useState(initial?.displayName ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({ baseLevel: initial ? undefined : baseLevel, displayName });
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save level");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={title}>
      <form className="space-y-4" onSubmit={handleSubmit}>
        {error && <Alert variant="error">{error}</Alert>}
        {!initial && (
          <FormField label="Stage" htmlFor="level-base">
            <Select id="level-base" value={baseLevel} onChange={(event) => setBaseLevel(event.target.value)}>
              {BASE_LEVEL_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
            <p className="mt-1 text-xs text-slate-500">
              Sets the grading style this level starts with. It can't be changed later.
            </p>
          </FormField>
        )}
        <FormField label="Name" htmlFor="level-name">
          <Input
            id="level-name"
            required
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
          />
        </FormField>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving…" : "Save"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
