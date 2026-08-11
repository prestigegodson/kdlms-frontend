import { type FormEvent, useEffect, useState } from "react";
import { ApiError } from "@/api/client";
import { listMySubjects, type TeacherSubjectAssignmentView } from "@/api/me";
import {
  createSubjectGroup,
  deleteSubjectGroup,
  listSubjectGroups,
  renameSubjectGroup,
  type SubjectGroupView,
} from "@/api/subjectGroups";
import {
  activateSubject,
  createSubject,
  deactivateSubject,
  deleteSubject,
  listSubjects,
  type SubjectView,
  updateSubject,
} from "@/api/subjects";
import { can } from "@/auth/permissions";
import { BookOpen } from "lucide-react";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Checkbox } from "@/components/ui/Checkbox";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { Select } from "@/components/ui/Select";
import { Spinner } from "@/components/ui/Spinner";
import { StickySubHeader } from "@/components/ui/StickySubHeader";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/Table";
import { CopySubjectsModal } from "@/features/academics/components/CopySubjectsModal";
import { LevelSelect } from "@/features/academics/components/LevelSelect";
import { ALL_TERM_NUMBERS, termNumbersLabel } from "@/features/academics/subjectTerms";
import { useAuthStore } from "@/stores/authStore";
import { useLevelStore } from "@/stores/levelStore";
import { useTeacherScopeStore } from "@/stores/teacherScopeStore";

type ListState =
  | { kind: "loading" }
  | { kind: "loaded"; subjects: SubjectView[] }
  | { kind: "error"; message: string };

const UNGROUPED_LABEL = "Ungrouped";

/**
 * Subject management per level for the caller's own school, sectioned by the
 * school's subject groups (alphabetical, ungrouped subjects trailing) -
 * previewing how a result sheet will later section subjects. A TEACHER
 * never sees this admin catalogue (GET /api/v1/subjects is admin-only) -
 * they get "My Subjects" instead, scoped to their own assignments.
 */
export function SubjectsPage() {
  const role = useAuthStore((state) => state.user?.role);

  if (role === "TEACHER") {
    return <MySubjects />;
  }

  return <AdminSubjects />;
}

type MySubjectsState =
  | { kind: "loading" }
  | { kind: "loaded"; assignments: TeacherSubjectAssignmentView[] }
  | { kind: "error"; message: string };

/**
 * Read-only: only the (class, subject) pairs the calling TEACHER is assigned
 * to teach (GET /api/v1/me/subjects), already scoped server-side to the
 * school's current term. `capabilities` is populated app-wide by
 * SchoolLayout on mount, so `currentTermName` is either already there or
 * arrives a moment later via the store subscription below.
 */
function MySubjects() {
  const [state, setState] = useState<MySubjectsState>({ kind: "loading" });
  const capabilities = useTeacherScopeStore((state) => state.capabilities);

  useEffect(() => {
    listMySubjects()
      .then((assignments) => setState({ kind: "loaded", assignments }))
      .catch((error: unknown) =>
        setState({
          kind: "error",
          message: error instanceof ApiError ? error.message : "Failed to load your subjects",
        }),
      );
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="My subjects"
        description={
          capabilities?.currentTermName ? `Showing subjects for ${capabilities.currentTermName}.` : undefined
        }
      />
      {capabilities && !capabilities.currentTermName && (
        <Alert variant="warning">
          Your school has not set a current term - showing all your subjects.
        </Alert>
      )}

      {state.kind === "loading" && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner /> Loading your subjects…
        </div>
      )}
      {state.kind === "error" && <Alert variant="error">{state.message}</Alert>}
      {state.kind === "loaded" && state.assignments.length === 0 && (
        <EmptyState
          icon={BookOpen}
          title="No subjects yet"
          description="You have no subject-teacher assignments yet."
        />
      )}
      {state.kind === "loaded" && state.assignments.length > 0 && (
        <Card className="p-0">
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Subject</TableHeaderCell>
                <TableHeaderCell>Class</TableHeaderCell>
                <TableHeaderCell>Level</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {state.assignments.map((assignment) => (
                <TableRow key={`${assignment.classId}-${assignment.subjectId}`}>
                  <TableCell label="Subject" className="font-medium text-slate-900">
                    {assignment.subjectName}
                  </TableCell>
                  <TableCell label="Class">{assignment.className}</TableCell>
                  <TableCell label="Level">{assignment.levelName ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

function AdminSubjects() {
  const role = useAuthStore((state) => state.user?.role);
  const canManage = can.manageAcademics(role);
  const canDelete = can.deleteSubjects(role);

  const levels = useLevelStore((storeState) => storeState.levels);
  const levelsStatus = useLevelStore((storeState) => storeState.status);
  const fetchLevels = useLevelStore((storeState) => storeState.fetchIfNeeded);
  const refreshLevels = useLevelStore((storeState) => storeState.refresh);
  // Derived rather than synced via an effect: nothing chosen yet falls back
  // to the first level once the store has loaded, with no setState-in-effect.
  const [selectedLevelId, setSelectedLevelId] = useState<string | null>(null);
  const levelId = selectedLevelId ?? levels[0]?.id ?? "";
  const [state, setState] = useState<ListState>({ kind: "loading" });
  const [groups, setGroups] = useState<SubjectGroupView[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<SubjectView | null>(null);
  const [deleting, setDeleting] = useState<SubjectView | null>(null);
  const [managingGroups, setManagingGroups] = useState(false);
  const [copying, setCopying] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    fetchLevels();
  }, [fetchLevels]);

  function fetchSubjects() {
    if (!levelId) return;
    listSubjects(levelId)
      .then((page) => setState({ kind: "loaded", subjects: page.content }))
      .catch((error: unknown) =>
        setState({
          kind: "error",
          message: error instanceof ApiError ? error.message : "Failed to load subjects",
        }),
      );
  }

  function fetchGroups() {
    if (!levelId) return;
    listSubjectGroups(levelId)
      .then(setGroups)
      .catch(() => setGroups([]));
  }

  useEffect(fetchSubjects, [levelId]);
  useEffect(fetchGroups, [levelId]);

  function load() {
    setState({ kind: "loading" });
    fetchSubjects();
    fetchGroups();
  }

  async function toggleActive(subject: SubjectView) {
    setActionError(null);
    try {
      if (subject.status === "ACTIVE") {
        await deactivateSubject(subject.id);
      } else {
        await activateSubject(subject.id);
      }
      load();
    } catch (error) {
      setActionError(error instanceof ApiError ? error.message : "That action failed");
    }
  }

  const sections = state.kind === "loaded" ? sectionByGroup(state.subjects) : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Subjects"
        description="The subject catalogue for each level, sectioned by group."
        actions={
          canManage && (
            <>
              <Button variant="secondary" onClick={() => setManagingGroups(true)} disabled={!levelId}>
                Manage groups
              </Button>
              <Button variant="secondary" onClick={() => setCopying(true)} disabled={!levelId || levels.length < 2}>
                Copy from level…
              </Button>
              <Button onClick={() => setCreateOpen(true)} disabled={!levelId}>
                Add subject
              </Button>
            </>
          )
        }
      />

      {levelsStatus !== "loaded" && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner /> Loading levels…
        </div>
      )}
      {levelsStatus === "loaded" && levels.length > 0 && (
        <StickySubHeader>
          <FormField
            label="Level"
            htmlFor="subject-level-filter"
            className="min-w-0 flex-1 lg:max-w-xs"
            labelClassName="sr-only lg:not-sr-only"
          >
            <LevelSelect id="subject-level-filter" levels={levels} value={levelId} onChange={setSelectedLevelId} />
          </FormField>
        </StickySubHeader>
      )}

      {actionError && <Alert variant="error">{actionError}</Alert>}

      {state.kind === "loading" && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner /> Loading subjects…
        </div>
      )}
      {state.kind === "error" && <Alert variant="error">{state.message}</Alert>}
      {state.kind === "loaded" && state.subjects.length === 0 && (
        <EmptyState
          icon={BookOpen}
          title="No subjects yet"
          description="Add a subject for this level to get started."
        />
      )}
      {state.kind === "loaded" && state.subjects.length > 0 && (
        <div className="space-y-6">
          {sections.map((section) => (
            <Card key={section.label} className="p-0">
              <div className="border-b border-slate-100 px-4 py-2 text-sm font-medium text-slate-700">
                {section.label}
              </div>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableHeaderCell>Name</TableHeaderCell>
                    <TableHeaderCell>Code</TableHeaderCell>
                    <TableHeaderCell>Terms</TableHeaderCell>
                    <TableHeaderCell>Selective</TableHeaderCell>
                    <TableHeaderCell>Status</TableHeaderCell>
                    {canManage && <TableHeaderCell>Actions</TableHeaderCell>}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {section.subjects.map((subject) => (
                    <TableRow key={subject.id}>
                      <TableCell label="Name" className="font-medium text-slate-900">
                        {subject.name}
                      </TableCell>
                      <TableCell label="Code">{subject.code ?? "—"}</TableCell>
                      <TableCell label="Terms">
                        <Badge variant="neutral">{termNumbersLabel(subject.termNumbers)}</Badge>
                      </TableCell>
                      <TableCell label="Selective">
                        {subject.selective ? <Badge variant="neutral">Selective</Badge> : "—"}
                      </TableCell>
                      <TableCell label="Status">
                        <Badge variant={subject.status === "ACTIVE" ? "success" : "neutral"}>
                          {subject.status}
                        </Badge>
                      </TableCell>
                      {canManage && (
                        <TableCell label="Actions">
                          <div className="flex gap-3">
                            <button
                              type="button"
                              className="text-brand-500 hover:text-brand-600"
                              onClick={() => setEditing(subject)}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="text-slate-500 hover:text-slate-700"
                              onClick={() => toggleActive(subject)}
                            >
                              {subject.status === "ACTIVE" ? "Deactivate" : "Activate"}
                            </button>
                            {canDelete && (
                              <button
                                type="button"
                                className="text-red-600 hover:text-red-700"
                                onClick={() => setDeleting(subject)}
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          ))}
        </div>
      )}

      {createOpen && levelId && (
        <SubjectFormModal
          title="Add subject"
          groups={groups}
          onClose={() => setCreateOpen(false)}
          onSubmit={async (values) => {
            await createSubject({
              levelId,
              name: values.name,
              code: values.code,
              subjectGroupId: values.subjectGroupId,
              termNumbers: values.termNumbers,
              selective: values.selective,
            });
          }}
          onSaved={() => {
            setCreateOpen(false);
            load();
          }}
        />
      )}
      {editing && (
        <SubjectFormModal
          key={editing.id}
          title="Edit subject"
          initial={editing}
          groups={groups}
          onClose={() => setEditing(null)}
          onSubmit={async (values) => {
            await updateSubject(editing.id, {
              name: values.name,
              code: values.code,
              subjectGroupId: values.subjectGroupId,
              termNumbers: values.termNumbers,
              selective: values.selective,
            });
          }}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
      {managingGroups && (
        <SubjectGroupsModal
          levelId={levelId}
          groups={groups}
          onClose={() => setManagingGroups(false)}
          onChanged={load}
        />
      )}
      {copying && levelId && (
        <CopySubjectsModal
          targetLevelId={levelId}
          targetLevelName={levels.find((level) => level.id === levelId)?.displayName ?? "this level"}
          levels={levels}
          onClose={() => setCopying(false)}
          onCopied={() => {
            load();
            refreshLevels();
          }}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title="Delete this subject?"
          message={
            <>
              <strong>{deleting.name}</strong> will be removed, along with any teacher assigned to it in a class.
              This can't be undone.
            </>
          }
          confirmLabel="Delete"
          variant="danger"
          onConfirm={async () => {
            await deleteSubject(deleting.id);
            setDeleting(null);
            load();
          }}
          onClose={() => setDeleting(null)}
        />
      )}
    </div>
  );
}

interface SubjectSection {
  label: string;
  subjects: SubjectView[];
}

/** Alphabetical by group name, with any ungrouped subjects trailing under {@link UNGROUPED_LABEL}. */
function sectionByGroup(subjects: SubjectView[]): SubjectSection[] {
  const byGroupName = new Map<string, SubjectView[]>();
  const ungrouped: SubjectView[] = [];

  for (const subject of subjects) {
    if (subject.subjectGroupId && subject.subjectGroupName) {
      const bucket = byGroupName.get(subject.subjectGroupName) ?? [];
      bucket.push(subject);
      byGroupName.set(subject.subjectGroupName, bucket);
    } else {
      ungrouped.push(subject);
    }
  }

  const sections = [...byGroupName.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, groupSubjects]) => ({ label, subjects: groupSubjects }));

  if (ungrouped.length > 0) {
    sections.push({ label: UNGROUPED_LABEL, subjects: ungrouped });
  }

  return sections;
}

interface SubjectFormValues {
  name: string;
  code?: string;
  subjectGroupId?: string;
  termNumbers?: number[];
  selective?: boolean;
}

interface SubjectFormModalProps {
  title: string;
  initial?: SubjectFormValues;
  groups: SubjectGroupView[];
  onClose: () => void;
  onSubmit: (values: SubjectFormValues) => Promise<void>;
  onSaved: () => void;
}

function SubjectFormModal({ title, initial, groups, onClose, onSubmit, onSaved }: SubjectFormModalProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [code, setCode] = useState(initial?.code ?? "");
  const [subjectGroupId, setSubjectGroupId] = useState(initial?.subjectGroupId ?? "");
  const [termNumbers, setTermNumbers] = useState<number[]>(initial?.termNumbers ?? ALL_TERM_NUMBERS);
  const [selective, setSelective] = useState(initial?.selective ?? false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleTerm(termNumber: number) {
    setTermNumbers((current) =>
      current.includes(termNumber)
        ? current.filter((value) => value !== termNumber)
        : [...current, termNumber].sort((a, b) => a - b),
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (termNumbers.length === 0) {
      setError("Select at least one term.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        name,
        code: code || undefined,
        subjectGroupId: subjectGroupId || undefined,
        termNumbers,
        selective,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save subject");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={title}>
      <form className="space-y-4" onSubmit={handleSubmit}>
        {error && <Alert variant="error">{error}</Alert>}
        <FormField label="Name" htmlFor="subject-name">
          <Input id="subject-name" required value={name} onChange={(event) => setName(event.target.value)} />
        </FormField>
        <FormField label="Code" htmlFor="subject-code">
          <Input id="subject-code" value={code} onChange={(event) => setCode(event.target.value)} />
        </FormField>
        <FormField label="Group" htmlFor="subject-group">
          <Select
            id="subject-group"
            value={subjectGroupId}
            onChange={(event) => setSubjectGroupId(event.target.value)}
          >
            <option value="">— None —</option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Terms" htmlFor="subject-term-1">
          <div className="flex gap-4">
            {ALL_TERM_NUMBERS.map((termNumber) => (
              <label key={termNumber} className="flex items-center gap-2 text-sm text-slate-700">
                <Checkbox
                  id={`subject-term-${termNumber}`}
                  checked={termNumbers.includes(termNumber)}
                  onChange={() => toggleTerm(termNumber)}
                />
                Term {termNumber}
              </label>
            ))}
          </div>
        </FormField>
        <FormField label="Enrollment" htmlFor="subject-selective">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <Checkbox id="subject-selective" checked={selective} onChange={() => setSelective((value) => !value)} />
            Selective - only registered students take it
          </label>
          <p className="mt-1 text-xs text-slate-500">
            Leave unchecked for a mandatory subject every student at this level takes. Once any score or rating has
            been recorded, this can no longer be changed.
          </p>
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

interface SubjectGroupsModalProps {
  levelId: string;
  groups: SubjectGroupView[];
  onClose: () => void;
  onChanged: () => void;
}

/**
 * Create, rename, and delete subject groups for the currently selected
 * level. Rename/delete happen inline in the list rather than in a further
 * nested dialog, matching this app's Modal (no portal, not designed to
 * stack).
 */
function SubjectGroupsModal({ levelId, groups, onClose, onChanged }: SubjectGroupsModalProps) {
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);
    setError(null);
    try {
      await createSubjectGroup({ levelId, name: newName });
      setNewName("");
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create subject group");
    } finally {
      setCreating(false);
    }
  }

  function startRename(group: SubjectGroupView) {
    setEditingId(group.id);
    setEditingName(group.name);
    setConfirmingDeleteId(null);
  }

  async function saveRename(groupId: string) {
    setBusyId(groupId);
    setError(null);
    try {
      await renameSubjectGroup(groupId, { name: editingName });
      setEditingId(null);
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to rename subject group");
    } finally {
      setBusyId(null);
    }
  }

  async function confirmDelete(groupId: string) {
    setBusyId(groupId);
    setError(null);
    try {
      await deleteSubjectGroup(groupId);
      setConfirmingDeleteId(null);
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to delete subject group");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Modal open onClose={onClose} title="Manage subject groups">
      <div className="space-y-4">
        {error && <Alert variant="error">{error}</Alert>}

        {groups.length === 0 && <p className="text-sm text-slate-500">No groups yet for this level.</p>}
        {groups.length > 0 && (
          <ul className="divide-y divide-slate-100 rounded-control border border-slate-200">
            {groups.map((group) => (
              <li key={group.id} className="px-3 py-2 text-sm">
                {editingId === group.id ? (
                  <div className="flex items-center gap-2">
                    <Input
                      aria-label={`Rename ${group.name}`}
                      value={editingName}
                      onChange={(event) => setEditingName(event.target.value)}
                    />
                    <button
                      type="button"
                      className="inline-flex mobile:min-h-11 items-center px-1 text-brand-500 hover:text-brand-600"
                      disabled={busyId === group.id}
                      onClick={() => saveRename(group.id)}
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      className="inline-flex mobile:min-h-11 items-center px-1 text-slate-500 hover:text-slate-700"
                      onClick={() => setEditingId(null)}
                    >
                      Cancel
                    </button>
                  </div>
                ) : confirmingDeleteId === group.id ? (
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-slate-700">Delete "{group.name}"? Its subjects become ungrouped.</span>
                    <div className="flex shrink-0 gap-3">
                      <button
                        type="button"
                        className="inline-flex mobile:min-h-11 items-center px-1 text-red-600 hover:text-red-700"
                        disabled={busyId === group.id}
                        onClick={() => confirmDelete(group.id)}
                      >
                        Confirm
                      </button>
                      <button
                        type="button"
                        className="inline-flex mobile:min-h-11 items-center px-1 text-slate-500 hover:text-slate-700"
                        onClick={() => setConfirmingDeleteId(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-slate-900">{group.name}</span>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        className="inline-flex mobile:min-h-11 items-center px-1 text-brand-500 hover:text-brand-600"
                        onClick={() => startRename(group)}
                      >
                        Rename
                      </button>
                      <button
                        type="button"
                        className="inline-flex mobile:min-h-11 items-center px-1 text-red-600 hover:text-red-700"
                        onClick={() => {
                          setConfirmingDeleteId(group.id);
                          setEditingId(null);
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        <form className="flex flex-wrap items-end gap-2" onSubmit={handleCreate}>
          <FormField label="New group name" htmlFor="new-subject-group-name" className="flex-1">
            <Input
              id="new-subject-group-name"
              required
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
            />
          </FormField>
          <Button type="submit" disabled={creating}>
            Add
          </Button>
        </form>

        <div className="flex justify-end">
          <Button type="button" variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}
