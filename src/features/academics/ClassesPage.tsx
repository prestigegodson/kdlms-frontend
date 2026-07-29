import { type FormEvent, useEffect, useState } from "react";
import { Link } from "react-router";
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
import { listLevels, type LevelView } from "@/api/levels";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { Spinner } from "@/components/ui/Spinner";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/Table";
import { useAuthStore } from "@/stores/authStore";

type ListState =
  | { kind: "loading" }
  | { kind: "loaded"; classes: SchoolClassView[] }
  | { kind: "error"; message: string };

/** Class management per branch/level for the caller's own school. */
export function ClassesPage() {
  const role = useAuthStore((state) => state.user?.role);
  const canManage = role === "SCHOOL_ADMIN" || role === "BRANCH_ADMIN";
  const isBranchScoped = role === "BRANCH_ADMIN" || role === "TEACHER";

  const [branches, setBranches] = useState<BranchView[] | null>(null);
  const [levels, setLevels] = useState<LevelView[] | null>(null);
  const [branchId, setBranchId] = useState("");
  const [levelId, setLevelId] = useState("");
  const [state, setState] = useState<ListState>({ kind: "loading" });
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<SchoolClassView | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (!isBranchScoped) {
      listBranches()
        .then((page) => setBranches(page.content))
        .catch(() => setBranches([]));
    }
    listLevels()
      .then(setLevels)
      .catch(() => setLevels([]));
  }, [isBranchScoped]);

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
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Classes</h1>
        {canManage && <Button onClick={() => setCreateOpen(true)}>Add class</Button>}
      </div>

      <div className="grid max-w-xl grid-cols-2 gap-4">
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
          <Select id="class-level-filter" value={levelId} onChange={(event) => setLevelId(event.target.value)}>
            <option value="">All levels</option>
            {levels?.map((level) => (
              <option key={level.id} value={level.id}>
                {level.displayName}
              </option>
            ))}
          </Select>
        </FormField>
      </div>

      {actionError && <Alert variant="error">{actionError}</Alert>}

      {state.kind === "loading" && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Spinner /> Loading classes…
        </div>
      )}
      {state.kind === "error" && <Alert variant="error">{state.message}</Alert>}
      {state.kind === "loaded" && state.classes.length === 0 && (
        <EmptyState title="No classes yet" description="Add a class to get started." />
      )}
      {state.kind === "loaded" && state.classes.length > 0 && (
        <Card className="p-0">
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Name</TableHeaderCell>
                <TableHeaderCell>Class teacher</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
                {canManage && <TableHeaderCell>Actions</TableHeaderCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {state.classes.map((schoolClass) => (
                <TableRow key={schoolClass.id}>
                  <TableCell className="font-medium text-gray-900">
                    <Link to={`/school/academics/classes/${schoolClass.id}`} className="hover:underline">
                      {schoolClass.name}
                    </Link>
                  </TableCell>
                  <TableCell>{schoolClass.classTeacherName ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={schoolClass.status === "ACTIVE" ? "success" : "neutral"}>
                      {schoolClass.status}
                    </Badge>
                  </TableCell>
                  {canManage && (
                    <TableCell>
                      <div className="flex gap-3">
                        <button
                          type="button"
                          className="text-brand-600 hover:text-brand-700"
                          onClick={() => setEditing(schoolClass)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="text-gray-500 hover:text-gray-700"
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
          levels={levels ?? []}
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
}

function ClassFormModal({
  title,
  branches,
  levels,
  showBranchField,
  onClose,
  onSubmit,
  onSaved,
}: ClassFormModalProps) {
  const [branchId, setBranchId] = useState(branches[0]?.id ?? "");
  const [levelId, setLevelId] = useState(levels[0]?.id ?? "");
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
          <Select id="class-level" required value={levelId} onChange={(event) => setLevelId(event.target.value)}>
            {levels.map((level) => (
              <option key={level.id} value={level.id}>
                {level.displayName}
              </option>
            ))}
          </Select>
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
  onClose: () => void;
  onSaved: () => void;
}

function RenameClassModal({ schoolClass, onClose, onSaved }: RenameClassModalProps) {
  const [name, setName] = useState(schoolClass.name);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await updateClass(schoolClass.id, { name });
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
