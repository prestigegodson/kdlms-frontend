import { type FormEvent, useEffect, useMemo, useState } from "react";
import { listBranches, type BranchView } from "@/api/branches";
import {
  activateClass,
  createClass,
  deactivateClass,
  listClasses,
  type SchoolClassView,
  updateClass,
} from "@/api/classes";
import { ApiError } from "@/api/client";
import type { LevelView } from "@/api/levels";
import { listMyClasses, type TeacherClassView } from "@/api/me";
import type { Role } from "@/api/types";
import { can } from "@/auth/permissions";
import { Library } from "lucide-react";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { Select } from "@/components/ui/Select";
import { Spinner } from "@/components/ui/Spinner";
import { StickySubHeader } from "@/components/ui/StickySubHeader";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/Table";
import { LevelSelect } from "@/features/academics/components/LevelSelect";
import { useAuthStore } from "@/stores/authStore";
import { useLevelStore } from "@/stores/levelStore";

type ListState =
  | { kind: "loading" }
  | { kind: "loaded"; classes: SchoolClassView[] }
  | { kind: "error"; message: string };

/**
 * Class management per branch/level for the caller's own school. A TEACHER
 * gets a distinct, read-only view scoped to classes they're assigned to
 * (class-teacher or subject-teacher) rather than this admin listing - see
 * {@link TeacherClasses}.
 */
export function ClassesPage() {
  const role = useAuthStore((state) => state.user?.role);

  if (role === "TEACHER") {
    return <TeacherClasses />;
  }

  return <AdminClasses role={role} />;
}

function AdminClasses({ role }: { role: Role | undefined }) {
  const canManage = can.manageAcademics(role);
  const isBranchScoped = role === "BRANCH_ADMIN";

  const [branches, setBranches] = useState<BranchView[] | null>(null);
  const levels = useLevelStore((storeState) => storeState.levels);
  const fetchLevels = useLevelStore((storeState) => storeState.fetchIfNeeded);
  const [branchId, setBranchId] = useState("");
  const [levelId, setLevelId] = useState("");
  const [state, setState] = useState<ListState>({ kind: "loading" });
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<SchoolClassView | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const levelNames = useMemo(
    () => new Map(levels.map((level) => [level.id, level.displayName])),
    [levels],
  );

  useEffect(() => {
    if (!isBranchScoped) {
      listBranches()
        .then((page) => setBranches(page.content))
        .catch(() => setBranches([]));
    }
    fetchLevels();
  }, [isBranchScoped, fetchLevels]);

  function fetchClasses() {
    listClasses(branchId || undefined, levelId || undefined)
      .then((page) => setState({ kind: "loaded", classes: page.content }))
      .catch((error: unknown) =>
        setState({
          kind: "error",
          message: error instanceof ApiError ? error.message : "Failed to load classes",
        }),
      );
  }

  useEffect(fetchClasses, [branchId, levelId]);

  function load() {
    setState({ kind: "loading" });
    fetchClasses();
  }

  async function toggleActive(schoolClass: SchoolClassView) {
    setActionError(null);
    try {
      if (schoolClass.status === "ACTIVE") {
        await deactivateClass(schoolClass.id);
      } else {
        await activateClass(schoolClass.id);
      }
      load();
    } catch (error) {
      setActionError(error instanceof ApiError ? error.message : "That action failed");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Classes"
        description="Classes for each level and branch."
        actions={canManage && <Button onClick={() => setCreateOpen(true)}>Add class</Button>}
      />

      <StickySubHeader>
        <div className="grid min-w-0 flex-1 gap-2 lg:grid-flow-col lg:auto-cols-fr lg:gap-4 lg:max-w-xl">
          {!isBranchScoped && (
            <FormField label="Branch" htmlFor="class-branch-filter">
              <Select id="class-branch-filter" value={branchId} onChange={(event) => setBranchId(event.target.value)}>
                <option value="">All branches</option>
                {branches?.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </Select>
            </FormField>
          )}
          <FormField label="Level" htmlFor="class-level-filter">
            <LevelSelect
              id="class-level-filter"
              levels={levels}
              value={levelId}
              onChange={setLevelId}
              allOptionLabel="All levels"
            />
          </FormField>
        </div>
      </StickySubHeader>

      {actionError && <Alert variant="error">{actionError}</Alert>}

      {state.kind === "loading" && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner /> Loading classes…
        </div>
      )}
      {state.kind === "error" && <Alert variant="error">{state.message}</Alert>}
      {state.kind === "loaded" && state.classes.length === 0 && (
        <EmptyState icon={Library} title="No classes yet" description="Add a class to get started." />
      )}
      {state.kind === "loaded" && state.classes.length > 0 && (
        <Card className="p-0">
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Name</TableHeaderCell>
                <TableHeaderCell>Level</TableHeaderCell>
                <TableHeaderCell>Class teacher</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
                {canManage && <TableHeaderCell>Actions</TableHeaderCell>}
                <TableHeaderCell></TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {state.classes.map((schoolClass) => (
                <TableRow key={schoolClass.id} to={`/school/academics/classes/${schoolClass.id}`}>
                  <TableCell label="Name" className="font-medium text-slate-900">
                    {schoolClass.name}
                  </TableCell>
                  <TableCell label="Level">{levelNames.get(schoolClass.levelId) ?? "—"}</TableCell>
                  <TableCell label="Class teacher">{schoolClass.classTeacherName ?? "—"}</TableCell>
                  <TableCell label="Status">
                    <Badge variant={schoolClass.status === "ACTIVE" ? "success" : "neutral"}>
                      {schoolClass.status}
                    </Badge>
                  </TableCell>
                  {canManage && (
                    <TableCell label="Actions">
                      {/* The row itself now navigates to the class detail route (TableRow's `to`) -
                          stop propagation here so a click - or an Enter/Space press while one of
                          these buttons has focus - doesn't also navigate the row. */}
                      <div
                        className="flex gap-3"
                        onClick={(event) => event.stopPropagation()}
                        onKeyDown={(event) => event.stopPropagation()}
                      >
                        <button
                          type="button"
                          className="text-brand-500 hover:text-brand-600"
                          onClick={() => setEditing(schoolClass)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="text-slate-500 hover:text-slate-700"
                          onClick={() => toggleActive(schoolClass)}
                        >
                          {schoolClass.status === "ACTIVE" ? "Deactivate" : "Activate"}
                        </button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {createOpen && (
        <ClassFormModal
          title="Add class"
          branches={branches ?? []}
          levels={levels}
          selectedLevelId={levelId || undefined}
          showBranchField={!isBranchScoped}
          onClose={() => setCreateOpen(false)}
          onSubmit={async (values) => {
            await createClass(values);
          }}
          onSaved={() => {
            setCreateOpen(false);
            load();
          }}
        />
      )}
      {editing && (
        <RenameClassModal
          key={editing.id}
          schoolClass={editing}
          levels={levels}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}

type TeacherClassesState =
  | { kind: "loading" }
  | { kind: "loaded"; classes: TeacherClassView[] }
  | { kind: "error"; message: string };

/** Read-only: only the classes the calling TEACHER class-teaches or subject-teaches (GET /api/v1/me/classes). */
function TeacherClasses() {
  const [state, setState] = useState<TeacherClassesState>({ kind: "loading" });

  useEffect(() => {
    listMyClasses()
      .then((classes) => setState({ kind: "loaded", classes }))
      .catch((error: unknown) =>
        setState({
          kind: "error",
          message: error instanceof ApiError ? error.message : "Failed to load your classes",
        }),
      );
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader title="My classes" description="Classes you class-teach or subject-teach." />

      {state.kind === "loading" && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner /> Loading your classes…
        </div>
      )}
      {state.kind === "error" && <Alert variant="error">{state.message}</Alert>}
      {state.kind === "loaded" && state.classes.length === 0 && (
        <EmptyState
          icon={Library}
          title="No classes yet"
          description="You have no class-teacher or subject-teacher assignments yet."
        />
      )}
      {state.kind === "loaded" && state.classes.length > 0 && (
        <Card className="p-0">
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Name</TableHeaderCell>
                <TableHeaderCell>Level</TableHeaderCell>
                <TableHeaderCell>Your role</TableHeaderCell>
                <TableHeaderCell></TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {state.classes.map((schoolClass) => (
                <TableRow key={schoolClass.classId} to={`/school/academics/classes/${schoolClass.classId}`}>
                  <TableCell label="Name" className="font-medium text-slate-900">
                    {schoolClass.className}
                  </TableCell>
                  <TableCell label="Level">{schoolClass.levelName ?? "—"}</TableCell>
                  <TableCell label="Your role">
                    <div className="flex flex-wrap gap-2">
                      {schoolClass.isClassTeacher && <Badge variant="success">Class teacher</Badge>}
                      {schoolClass.subjectIds.length > 0 && (
                        <Badge variant="neutral">
                          Subject teacher ({schoolClass.subjectIds.length})
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

interface ClassFormValues {
  branchId?: string;
  levelId: string;
  name: string;
}

interface ClassFormModalProps {
  title: string;
  branches: BranchView[];
  levels: LevelView[];
  showBranchField: boolean;
  onClose: () => void;
  onSubmit: (values: ClassFormValues) => Promise<void>;
  onSaved: () => void;
  selectedLevelId?: string;
}

function ClassFormModal({
  title,
  branches,
  levels,
  showBranchField,
  onClose,
  onSubmit,
  onSaved,
  selectedLevelId,
}: ClassFormModalProps) {
  const [branchId, setBranchId] = useState(branches[0]?.id ?? "");
  const [levelId, setLevelId] = useState(
    selectedLevelId || (levels.find((level) => level.status === "ACTIVE")?.id ?? "")
  );
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({ branchId: showBranchField ? branchId : undefined, levelId, name });
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save class");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={title}>
      <form className="space-y-4" onSubmit={handleSubmit}>
        {error && <Alert variant="error">{error}</Alert>}
        {showBranchField && (
          <FormField label="Branch" htmlFor="class-branch">
            <Select
              id="class-branch"
              required
              value={branchId}
              onChange={(event) => setBranchId(event.target.value)}
            >
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </Select>
          </FormField>
        )}
        <FormField label="Level" htmlFor="class-level">
          <LevelSelect id="class-level" levels={levels} value={levelId} onChange={setLevelId} activeOnly required />
        </FormField>
        <FormField label="Name" htmlFor="class-name">
          <Input
            id="class-name"
            required
            placeholder="Little Star 1"
            value={name}
            onChange={(event) => setName(event.target.value)}
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

interface RenameClassModalProps {
  schoolClass: SchoolClassView;
  levels: LevelView[];
  onClose: () => void;
  onSaved: () => void;
}

function RenameClassModal({ schoolClass, levels, onClose, onSaved }: RenameClassModalProps) {
  const [name, setName] = useState(schoolClass.name);
  const [levelId, setLevelId] = useState(schoolClass.levelId);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await updateClass(schoolClass.id, { name, levelId });
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save class");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Edit class">
      <form className="space-y-4" onSubmit={handleSubmit}>
        {error && <Alert variant="error">{error}</Alert>}
        <FormField label="Name" htmlFor="class-rename">
          <Input id="class-rename" required value={name} onChange={(event) => setName(event.target.value)} />
        </FormField>
        <FormField label="Level" htmlFor="class-level">
          <LevelSelect id="class-level" levels={levels} value={levelId} onChange={setLevelId} activeOnly required />
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
