import { type FormEvent, useEffect, useState } from "react";
import type { UserSummary } from "@/api/auth";
import { listBranches, type BranchView } from "@/api/branches";
import { ApiError } from "@/api/client";
import { createTeacher, listTeachers, updateTeacher, type CreateUserResult } from "@/api/users";
import { can } from "@/auth/permissions";
import { Users } from "lucide-react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CredentialsReveal } from "@/components/ui/CredentialsReveal";
import { EmptyState } from "@/components/ui/EmptyState";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { Select } from "@/components/ui/Select";
import { Spinner } from "@/components/ui/Spinner";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/Table";
import { useAuthStore } from "@/stores/authStore";

type ListState =
  | { kind: "loading" }
  | { kind: "loaded"; teachers: UserSummary[] }
  | { kind: "error"; message: string };

/** School-portal teacher directory: list and provision teacher accounts. */
export function TeachersPage() {
  const role = useAuthStore((state) => state.user?.role);
  const canManage = can.manageTeachers(role);
  const isBranchScoped = role === "BRANCH_ADMIN";

  const [branches, setBranches] = useState<BranchView[] | null>(null);
  const [state, setState] = useState<ListState>({ kind: "loading" });
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<UserSummary | null>(null);

  useEffect(() => {
    if (!isBranchScoped) {
      listBranches()
        .then((page) => setBranches(page.content))
        .catch(() => setBranches([]));
    }
  }, [isBranchScoped]);

  function fetchTeachers() {
    listTeachers()
      .then((page) => setState({ kind: "loaded", teachers: page.content }))
      .catch((error: unknown) =>
        setState({
          kind: "error",
          message: error instanceof ApiError ? error.message : "Failed to load teachers",
        }),
      );
  }

  useEffect(fetchTeachers, []);

  function load() {
    setState({ kind: "loading" });
    fetchTeachers();
  }

  function branchName(branchId?: string) {
    return branches?.find((branch) => branch.id === branchId)?.name ?? "—";
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Teachers"
        description="Every teacher account at your school."
        actions={canManage && <Button onClick={() => setCreateOpen(true)}>Add teacher</Button>}
      />

      {state.kind === "loading" && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner /> Loading teachers…
        </div>
      )}
      {state.kind === "error" && <Alert variant="error">{state.message}</Alert>}
      {state.kind === "loaded" && state.teachers.length === 0 && (
        <EmptyState icon={Users} title="No teachers yet" description="Add a teacher to get started." />
      )}
      {state.kind === "loaded" && state.teachers.length > 0 && (
        <Card className="p-0">
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Name</TableHeaderCell>
                <TableHeaderCell>Email</TableHeaderCell>
                {!isBranchScoped && <TableHeaderCell>Branch</TableHeaderCell>}
                {canManage && <TableHeaderCell>Actions</TableHeaderCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {state.teachers.map((teacher) => (
                <TableRow key={teacher.id}>
                  <TableCell label="Name" className="font-medium text-slate-900">
                    {teacher.firstName} {teacher.lastName}
                  </TableCell>
                  <TableCell label="Email">{teacher.email}</TableCell>
                  {!isBranchScoped && (
                    <TableCell label="Branch">{branchName(teacher.branchId)}</TableCell>
                  )}
                  {canManage && (
                    <TableCell label="Actions">
                      <button
                        type="button"
                        className="text-brand-500 hover:text-brand-600"
                        onClick={() => setEditing(teacher)}
                      >
                        Edit
                      </button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {createOpen && (
        <TeacherFormModal
          branches={branches ?? []}
          showBranchField={!isBranchScoped}
          onClose={() => setCreateOpen(false)}
          onSubmit={createTeacher}
          onSaved={load}
        />
      )}
      {editing && (
        <TeacherFormModal
          key={editing.id}
          initial={editing}
          branches={branches ?? []}
          showBranchField={!isBranchScoped}
          onClose={() => setEditing(null)}
          onSubmit={(values) => updateTeacher(editing.id, values)}
          onSaved={load}
        />
      )}
    </div>
  );
}

interface TeacherFormValues {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  branchId?: string;
}

interface TeacherFormModalProps {
  /** Present when editing an existing teacher; absent when creating one. */
  initial?: UserSummary;
  branches: BranchView[];
  showBranchField: boolean;
  onClose: () => void;
  onSubmit: (values: TeacherFormValues) => Promise<CreateUserResult | UserSummary>;
  /** Called once the save succeeds, so the caller can refresh its list - the modal itself decides when to close. */
  onSaved: () => void;
}

/**
 * Shared Add/Edit teacher form. Creating a teacher continues on to a
 * one-time temporary-password reveal after saving; editing closes
 * immediately since there's nothing new to show. The branch field only
 * ever appears when creating (see {@code CLAUDE.md}: a teacher's branch
 * isn't editable - moving one would strand their class-teacher/subject-
 * teacher assignments).
 */
function TeacherFormModal({
  initial,
  branches,
  showBranchField,
  onClose,
  onSubmit,
  onSaved,
}: TeacherFormModalProps) {
  const isEdit = initial != null;
  const [firstName, setFirstName] = useState(initial?.firstName ?? "");
  const [lastName, setLastName] = useState(initial?.lastName ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [branchId, setBranchId] = useState(branches[0]?.id ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreateUserResult | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const result = await onSubmit({
        firstName,
        lastName,
        email,
        phone: phone || undefined,
        branchId: showBranchField && !isEdit ? branchId : undefined,
      });
      onSaved();
      if (isEdit) {
        onClose();
      } else {
        setCreated(result as CreateUserResult);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : isEdit ? "Failed to update teacher" : "Failed to create teacher");
    } finally {
      setSubmitting(false);
    }
  }

  if (created) {
    return (
      <Modal open onClose={onClose} title="Teacher created">
        <div className="space-y-4">
          <Alert variant="success">
            {created.user.firstName} {created.user.lastName} can now sign in with {created.user.email}. A welcome
            email has been sent to them.
          </Alert>
          <CredentialsReveal email={created.user.email} temporaryPassword={created.temporaryPassword} />
          <div className="flex justify-end">
            <Button type="button" onClick={onClose}>
              Done
            </Button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open onClose={onClose} title={isEdit ? "Edit teacher" : "Add teacher"}>
      <form className="space-y-4" onSubmit={handleSubmit}>
        {error && <Alert variant="error">{error}</Alert>}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="First name" htmlFor="teacher-first-name">
            <Input
              id="teacher-first-name"
              required
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
            />
          </FormField>
          <FormField label="Last name" htmlFor="teacher-last-name">
            <Input
              id="teacher-last-name"
              required
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
            />
          </FormField>
        </div>
        <FormField label="Email" htmlFor="teacher-email">
          <Input
            id="teacher-email"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </FormField>
        {isEdit && (
          <p className="-mt-2 text-xs text-slate-500">
            Changing the email signs this teacher out of their current session.
          </p>
        )}
        <FormField label="Phone" htmlFor="teacher-phone">
          <Input id="teacher-phone" value={phone} onChange={(event) => setPhone(event.target.value)} />
        </FormField>
        {showBranchField && !isEdit && (
          <FormField label="Branch" htmlFor="teacher-branch">
            <Select
              id="teacher-branch"
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
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving…" : isEdit ? "Save changes" : "Create teacher"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
