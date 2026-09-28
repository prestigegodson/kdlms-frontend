import { useEffect, useState } from "react";
import { type BranchView, listBranches } from "@/api/branches";
import { ApiError } from "@/api/client";
import {
  type RemarkCommenterEntry,
  type RemarkCommenterView,
  listRemarkCommenters,
  saveRemarkCommenters,
} from "@/api/reportSettings";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FormField } from "@/components/ui/FormField";
import { ImageUploadField } from "@/components/ui/ImageUploadField";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Spinner } from "@/components/ui/Spinner";

interface RemarkCommentersCardProps {
  levels: { levelId: string; levelName: string }[];
  editable: boolean;
}

interface DraftRow {
  levelId: string;
  /** `undefined` means this row is the level's school-wide default, not a branch override. */
  branchId?: string;
  title: string;
  name: string;
  signatureFileId?: string;
}

function rowKey(levelId: string, branchId: string | undefined): string {
  return `${levelId}|${branchId ?? ""}`;
}

function fromView(view: RemarkCommenterView): DraftRow {
  return {
    levelId: view.levelId,
    branchId: view.branchId,
    title: view.title,
    name: view.name,
    signatureFileId: view.signatureFileId,
  };
}

/**
 * Who signs each level's "principal remark" slot - a title/name (+ optional
 * signature) per level, with an optional per-branch override. A level with
 * nothing set here keeps printing "Principal" (branding's own principal
 * name/signature) - see `BrandingFields`' own note and CLAUDE.md's Domain
 * Rules for the branch-override -> level-default -> Principal resolution
 * order. Blank title/name on save simply drops that row (level falls back),
 * enforced by the backend's own `@NotBlank` on a submitted entry.
 */
export function RemarkCommentersCard({ levels, editable }: RemarkCommentersCardProps) {
  const [branches, setBranches] = useState<BranchView[] | null>(null);
  const [rows, setRows] = useState<DraftRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    Promise.all([listRemarkCommenters(), listBranches(0, 100)])
      .then(([commenters, branchPage]) => {
        setRows(commenters.map(fromView));
        setBranches(branchPage.content.filter((branch) => branch.status === "ACTIVE"));
      })
      .catch((error: unknown) =>
        setLoadError(error instanceof ApiError ? error.message : "Failed to load remark commenters"),
      );
  }, []);

  function rowFor(levelId: string, branchId: string | undefined): DraftRow | undefined {
    return rows?.find((row) => row.levelId === levelId && row.branchId === branchId);
  }

  function updateRow(levelId: string, branchId: string | undefined, patch: Partial<DraftRow>) {
    setSaved(false);
    setRows((previous) => {
      const list = previous ?? [];
      const existing = list.find((row) => row.levelId === levelId && row.branchId === branchId);
      if (existing) {
        return list.map((row) => (row === existing ? { ...row, ...patch } : row));
      }
      return [...list, { levelId, branchId, title: "", name: "", ...patch }];
    });
  }

  function removeRow(levelId: string, branchId: string | undefined) {
    setSaved(false);
    setRows((previous) => (previous ?? []).filter((row) => !(row.levelId === levelId && row.branchId === branchId)));
  }

  async function handleSave() {
    if (!rows) {
      return;
    }
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      // A row with a blank title or name isn't configured - dropped rather than
      // sent, so the level/branch simply falls back (the backend also rejects a
      // blank title/name outright, but this avoids a round-trip 422 for it).
      const entries: RemarkCommenterEntry[] = rows
        .filter((row) => row.title.trim() && row.name.trim())
        .map((row) => ({
          levelId: row.levelId,
          branchId: row.branchId ?? null,
          title: row.title.trim(),
          name: row.name.trim(),
          signatureFileId: row.signatureFileId ?? null,
        }));
      const result = await saveRemarkCommenters(entries);
      setRows(result.map(fromView));
      setSaved(true);
    } catch (error) {
      setSaveError(error instanceof ApiError ? error.message : "Failed to save remark commenters");
    } finally {
      setSaving(false);
    }
  }

  const loaded = rows !== null && branches !== null;

  return (
    <Card>
      <h2 className="mb-1 font-display text-lg font-medium text-slate-900">Report remark commenters</h2>
      <p className="mb-4 text-sm text-slate-500">
        Many schools have no principal to comment on a report - set a Head of Nursery, Head of Primary, or Head of
        Secondary instead. A class with nothing set here keeps printing "Principal" (the branding above). A branch
        override, when set, wins over a class's own default.
      </p>

      {loadError && <Alert variant="error">{loadError}</Alert>}

      {!loaded ? (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner /> Loading…
        </div>
      ) : (
        <>
          <div className="divide-y divide-slate-200">
            {levels.map((level) => {
              const defaultRow = rowFor(level.levelId, undefined);
              const overrideRows = (rows ?? []).filter((row) => row.levelId === level.levelId && row.branchId);
              const overriddenBranchIds = new Set(overrideRows.map((row) => row.branchId));
              const availableBranches = (branches ?? []).filter((branch) => !overriddenBranchIds.has(branch.id));

              return (
                <div key={level.levelId} className="py-4 first:pt-0 last:pb-0">
                  <h3 className="font-display text-sm font-medium text-slate-900">{level.levelName}</h3>
                  <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <FormField label="Title">
                      <Input
                        placeholder="Principal"
                        value={defaultRow?.title ?? ""}
                        disabled={!editable}
                        onChange={(event) => updateRow(level.levelId, undefined, { title: event.target.value })}
                      />
                    </FormField>
                    <FormField label="Name">
                      <Input
                        value={defaultRow?.name ?? ""}
                        disabled={!editable}
                        onChange={(event) => updateRow(level.levelId, undefined, { name: event.target.value })}
                      />
                    </FormField>
                    <ImageUploadField
                      label="Signature"
                      fileId={defaultRow?.signatureFileId}
                      onChange={editable ? (id) => updateRow(level.levelId, undefined, { signatureFileId: id }) : () => undefined}
                    />
                  </div>

                  {overrideRows.length > 0 && (
                    <div className="mt-3 space-y-3 rounded-md bg-slate-50 p-3">
                      <p className="text-xs font-medium text-slate-600">Branch overrides</p>
                      {overrideRows.map((row) => (
                        <div
                          key={rowKey(row.levelId, row.branchId)}
                          className="grid grid-cols-1 items-end gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto_auto]"
                        >
                          <div className="text-sm text-slate-700">
                            {branches?.find((branch) => branch.id === row.branchId)?.name ?? row.branchId}
                          </div>
                          <Input
                            placeholder="Title"
                            value={row.title}
                            disabled={!editable}
                            onChange={(event) => updateRow(level.levelId, row.branchId, { title: event.target.value })}
                          />
                          <Input
                            placeholder="Name"
                            value={row.name}
                            disabled={!editable}
                            onChange={(event) => updateRow(level.levelId, row.branchId, { name: event.target.value })}
                          />
                          <ImageUploadField
                            label="Signature"
                            fileId={row.signatureFileId}
                            onChange={
                              editable
                                ? (id) => updateRow(level.levelId, row.branchId, { signatureFileId: id })
                                : () => undefined
                            }
                          />
                          {editable && (
                            <Button variant="ghost" size="sm" onClick={() => removeRow(level.levelId, row.branchId)}>
                              Remove
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {editable && availableBranches.length > 0 && (
                    <div className="mt-2 max-w-xs">
                      <Select
                        value=""
                        onChange={(event) => {
                          if (event.target.value) {
                            updateRow(level.levelId, event.target.value, {});
                          }
                        }}
                      >
                        <option value="">+ Add a branch override…</option>
                        {availableBranches.map((branch) => (
                          <option key={branch.id} value={branch.id}>
                            {branch.name}
                          </option>
                        ))}
                      </Select>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {editable && (
            <div className="mt-6 flex items-center gap-3">
              <Button onClick={handleSave} loading={saving}>
                Save commenters
              </Button>
              {saved && !saveError && <span className="text-sm text-green-700">Saved.</span>}
            </div>
          )}
          {saveError && (
            <Alert variant="error" className="mt-4">
              {saveError}
            </Alert>
          )}
        </>
      )}
    </Card>
  );
}
