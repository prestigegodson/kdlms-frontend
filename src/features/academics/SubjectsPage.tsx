import { type FormEvent, useEffect, useState } from "react";
import { ApiError } from "@/api/client";
import { listLevels, type LevelView } from "@/api/levels";
import {
  activateSubject,
  createSubject,
  deactivateSubject,
  listSubjects,
  type SubjectView,
  updateSubject,
} from "@/api/subjects";
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
  | { kind: "loaded"; subjects: SubjectView[] }
  | { kind: "error"; message: string };

/** Subject management per level for the caller's own school. */
export function SubjectsPage() {
  const role = useAuthStore((state) => state.user?.role);
  const canManage = role === "SCHOOL_ADMIN" || role === "BRANCH_ADMIN";

  const [levels, setLevels] = useState<LevelView[] | null>(null);
  const [levelId, setLevelId] = useState("");
  const [state, setState] = useState<ListState>({ kind: "loading" });
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<SubjectView | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    listLevels()
      .then((result) => {
        setLevels(result);
        setLevelId(result[0]?.id ?? "");
      })
      .catch(() => setLevels([]));
  }, []);

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

  useEffect(fetchSubjects, [levelId]);

  function load() {
    setState({ kind: "loading" });
    fetchSubjects();
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Subjects</h1>
        {canManage && (
          <Button onClick={() => setCreateOpen(true)} disabled={!levelId}>
            Add subject
          </Button>
        )}
      </div>

      {levels === null && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Spinner /> Loading levels…
        </div>
      )}
      {levels !== null && levels.length > 0 && (
        <FormField label="Level" htmlFor="subject-level-filter" className="max-w-xs">
          <Select id="subject-level-filter" value={levelId} onChange={(event) => setLevelId(event.target.value)}>
            {levels.map((level) => (
              <option key={level.id} value={level.id}>
                {level.displayName}
              </option>
            ))}
          </Select>
        </FormField>
      )}

      {actionError && <Alert variant="error">{actionError}</Alert>}

      {state.kind === "loading" && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Spinner /> Loading subjects…
        </div>
      )}
      {state.kind === "error" && <Alert variant="error">{state.message}</Alert>}
      {state.kind === "loaded" && state.subjects.length === 0 && (
        <EmptyState title="No subjects yet" description="Add a subject for this level to get started." />
      )}
      {state.kind === "loaded" && state.subjects.length > 0 && (
        <Card className="p-0">
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Name</TableHeaderCell>
                <TableHeaderCell>Code</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
                {canManage && <TableHeaderCell>Actions</TableHeaderCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {state.subjects.map((subject) => (
                <TableRow key={subject.id}>
                  <TableCell className="font-medium text-gray-900">{subject.name}</TableCell>
                  <TableCell>{subject.code ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={subject.status === "ACTIVE" ? "success" : "neutral"}>{subject.status}</Badge>
                  </TableCell>
                  {canManage && (
                    <TableCell>
                      <div className="flex gap-3">
                        <button
                          type="button"
                          className="text-brand-600 hover:text-brand-700"
                          onClick={() => setEditing(subject)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="text-gray-500 hover:text-gray-700"
                          onClick={() => toggleActive(subject)}
                        >
                          {subject.status === "ACTIVE" ? "Deactivate" : "Activate"}
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

      {createOpen && levelId && (
        <SubjectFormModal
          title="Add subject"
          onClose={() => setCreateOpen(false)}
          onSubmit={async (values) => {
            await createSubject({ levelId, name: values.name, code: values.code });
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
          onClose={() => setEditing(null)}
          onSubmit={async (values) => {
            await updateSubject(editing.id, { name: values.name, code: values.code });
          }}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}

interface SubjectFormValues {
  name: string;
  code?: string;
}

interface SubjectFormModalProps {
  title: string;
  initial?: SubjectFormValues;
  onClose: () => void;
  onSubmit: (values: SubjectFormValues) => Promise<void>;
  onSaved: () => void;
}

function SubjectFormModal({ title, initial, onClose, onSubmit, onSaved }: SubjectFormModalProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [code, setCode] = useState(initial?.code ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({ name, code: code || undefined });
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
