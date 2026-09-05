import { useEffect, useState } from "react";
import { useBlocker } from "react-router";
import {
  type RemarksSheetView,
  type RowOutcome,
  saveTeacherRemarks,
  savePrincipalRemarks,
} from "@/api/assessments";
import { ApiError } from "@/api/client";
import { Alert } from "@/components/ui/Alert";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Table, TableBody, TableHead, TableHeaderCell, TableRow } from "@/components/ui/Table";
import { Tabs } from "@/components/ui/Tabs";
import { RegisterProgress } from "@/features/attendance/components/RegisterProgress";
import { type RemarkField, RemarkEntryRow } from "@/features/assessments/components/RemarkEntryRow";
import { TraitEntryRow } from "@/features/assessments/components/TraitEntryRow";
import { TraitScaleLegend } from "@/features/assessments/components/TraitScaleLegend";
import { UnsavedChangesBar } from "@/features/assessments/components/UnsavedChangesBar";

/** traitId -> scaleOptionId, `""` meaning not yet rated. */
export type TraitDraft = Record<string, string>;

interface Draft {
  remark: string;
  traits: TraitDraft;
}

function draftsFromSheet(sheet: RemarksSheetView, field: RemarkField): Record<string, Draft> {
  const drafts: Record<string, Draft> = {};
  for (const row of sheet.rows) {
    const traits: TraitDraft = {};
    for (const entry of row.traits) {
      traits[entry.traitId] = entry.scaleOptionId ?? "";
    }
    drafts[row.enrollmentId] = {
      remark: (field === "classTeacher" ? row.classTeacherRemark : row.principalRemark) ?? "",
      traits,
    };
  }
  return drafts;
}

interface RemarksEntryGridProps {
  sheet: RemarksSheetView;
  /** Which half this caller writes - the class teacher's own remark, or the admin's separate principal remark. */
  field: RemarkField;
  onSaved: (outcomes: RowOutcome[]) => void;
}

/**
 * The remarks entry grid, shared verbatim by `RemarksPanel` (a class
 * teacher writing `classTeacher`) and `AdminResultsPanel`'s principal
 * composer (`principal`) - the "one component, two callers" precedent
 * `ThreadCard`/`AttendanceSummaryPanel` already set. Whether the field
 * renders as an editable Textarea or plain text is the server's own
 * `classTeacherEditable`/`principalRemarkEditable` flag, never re-derived
 * here - the same trust-the-server shape `AttendanceRegisterGrid` uses for
 * `register.editable`.
 * <p>
 * Behavioural-trait ratings (Phase 15) ride the same draft/dirty/save cycle
 * as the remark text, but only for `field === "classTeacher"` - a principal
 * save never touches them, and `traits` is omitted from that request
 * entirely (`RecordRemarksUseCase`'s "a null list leaves ratings untouched"
 * contract). They render on their own tab (one per enabled category,
 * alongside a "Remarks" tab for the remark text) since a rating chosen from
 * a scale is a different kind of entry from free-text prose - tabs are a
 * pure view over this one shared draft/dirty state, so switching tabs never
 * loses an edit and one save carries both halves together.
 */
export function RemarksEntryGrid({ sheet, field, onSaved }: RemarksEntryGridProps) {
  const editable = field === "classTeacher" ? sheet.classTeacherEditable : sheet.principalRemarkEditable;
  const traitTabs = field === "classTeacher" ? sheet.traitCategories : [];

  const [drafts, setDrafts] = useState<Record<string, Draft>>(() => draftsFromSheet(sheet, field));
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<string>("remarks");

  // A new sheet is adopted by comparing against the last-seen sheet during render -
  // see ScoreEntryGrid's identical comment for why this isn't an effect.
  const [lastSheet, setLastSheet] = useState(sheet);
  if (sheet !== lastSheet) {
    setLastSheet(sheet);
    setDrafts(draftsFromSheet(sheet, field));
    setDirty(new Set());
  }

  // If the currently-selected trait tab's category is no longer enabled (or this caller can't
  // see traits at all), fall back to the Remarks tab - same derive-during-render idiom as above,
  // mirrors TeacherTimetablePanel's activeTab fallback.
  if (tab !== "remarks" && !traitTabs.some((category) => category.category === tab)) {
    setTab("remarks");
  }

  const activeCategory = tab === "remarks" ? null : (traitTabs.find((category) => category.category === tab) ?? null);

  const blocker = useBlocker(dirty.size > 0);

  useEffect(() => {
    function handler(event: BeforeUnloadEvent) {
      if (dirty.size > 0) event.preventDefault();
    }
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const totalCount = sheet.rows.length;
  const markedCount = activeCategory
    ? sheet.rows.filter((row) => activeCategory.traits.every((trait) => (drafts[row.enrollmentId]?.traits[trait.id] ?? "") !== "")).length
    : sheet.rows.filter((row) => (drafts[row.enrollmentId]?.remark ?? "").trim() !== "").length;

  function updateRemark(enrollmentId: string, value: string) {
    setDrafts((current) => ({ ...current, [enrollmentId]: { ...current[enrollmentId], remark: value } }));
    setDirty((current) => new Set(current).add(enrollmentId));
  }

  function updateTrait(enrollmentId: string, traitId: string, scaleOptionId: string) {
    setDrafts((current) => ({
      ...current,
      [enrollmentId]: {
        ...current[enrollmentId],
        traits: { ...current[enrollmentId].traits, [traitId]: scaleOptionId },
      },
    }));
    setDirty((current) => new Set(current).add(enrollmentId));
  }

  function discard() {
    setDrafts(draftsFromSheet(sheet, field));
    setDirty(new Set());
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const entries = Array.from(dirty).map((enrollmentId) => {
        const draft = drafts[enrollmentId];
        const remark = draft.remark.trim() === "" ? null : draft.remark;
        if (field !== "classTeacher" || sheet.traitCategories.length === 0) {
          return { enrollmentId, remark };
        }
        const traits = Object.entries(draft.traits)
          .filter(([, scaleOptionId]) => scaleOptionId)
          .map(([traitId, scaleOptionId]) => ({ traitId, scaleOptionId }));
        return { enrollmentId, remark, traits };
      });
      const outcome =
        field === "classTeacher"
          ? await saveTeacherRemarks(sheet.classId, sheet.termId, entries)
          : await savePrincipalRemarks(sheet.classId, sheet.termId, entries);
      setDirty(new Set());
      onSaved(outcome.outcomes);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save remarks");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 pb-4">
      {error && <Alert variant="error">{error}</Alert>}

      {traitTabs.length > 0 && (
        <Tabs
          ariaLabel="Remarks views"
          value={tab}
          onChange={setTab}
          items={[{ value: "remarks", label: "Remarks" }, ...traitTabs.map((category) => ({ value: category.category, label: category.displayName }))]}
        />
      )}

      {activeCategory && <TraitScaleLegend category={activeCategory} />}

      {editable && (
        <RegisterProgress markedCount={markedCount} totalCount={totalCount} verbLabel={activeCategory ? "rated" : "written"} />
      )}

      <Table>
        <TableHead>
          <TableRow>
            <TableHeaderCell>Student</TableHeaderCell>
            {activeCategory
              ? activeCategory.traits.map((trait) => <TableHeaderCell key={trait.id}>{trait.name}</TableHeaderCell>)
              : (
                  <>
                    <TableHeaderCell>{field === "classTeacher" ? "Class teacher's remark" : "Principal's remark"}</TableHeaderCell>
                    {field === "principal" && <TableHeaderCell>Class teacher's remark</TableHeaderCell>}
                  </>
                )}
          </TableRow>
        </TableHead>
        <TableBody>
          {sheet.rows.map((row) =>
            activeCategory ? (
              <TraitEntryRow
                key={row.enrollmentId}
                row={row}
                category={activeCategory}
                editable={editable}
                dirty={dirty.has(row.enrollmentId)}
                traitDraft={drafts[row.enrollmentId]?.traits ?? {}}
                onTraitChange={(traitId, scaleOptionId) => updateTrait(row.enrollmentId, traitId, scaleOptionId)}
              />
            ) : (
              <RemarkEntryRow
                key={row.enrollmentId}
                row={row}
                field={field}
                value={drafts[row.enrollmentId]?.remark ?? ""}
                editable={editable}
                dirty={dirty.has(row.enrollmentId)}
                onChange={(value) => updateRemark(row.enrollmentId, value)}
              />
            ),
          )}
        </TableBody>
      </Table>

      {editable && <UnsavedChangesBar count={dirty.size} saving={saving} onSave={handleSave} onDiscard={discard} />}

      {blocker.state === "blocked" && (
        <ConfirmDialog
          title="Leave without saving?"
          message="You have unsaved remark changes on this sheet that will be lost."
          confirmLabel="Leave"
          variant="danger"
          onConfirm={async () => {
            blocker.proceed();
          }}
          onClose={() => blocker.reset()}
        />
      )}
    </div>
  );
}
