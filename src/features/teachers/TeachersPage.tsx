import { type FormEvent, useEffect, useState } from "react";
import type { UserSummary } from "@/api/auth";
import { listBranches, type BranchView } from "@/api/branches";
import { ApiError } from "@/api/client";
import { createTeacher, listTeachers, type CreateUserResult } from "@/api/users";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CredentialsReveal } from "@/components/ui/CredentialsReveal";
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
  | { kind: "loaded"; teachers: UserSummary[] }
  | { kind: "error"; message: string };

/** School-portal teacher directory: list and provision teacher accounts. */
export function TeachersPage() {
  const role = useAuthStore((state) => state.user?.role);
  const canManage = role === "SCHOOL_ADMIN" || role === "BRANCH_ADMIN";
  const isBranchScoped = role === "BRANCH_ADMIN";

  const [branches, setBranches] = useState<BranchView[] | null>(null);
  const [state, setState] = useState<ListState>({ kind: "loading" });
  const [createOpen, setCreateOpen] = useState(false);

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
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Teachers</h1>
        {canManage && <Button onClick={() => setCreateOpen(true)}>Add teacher</Button>}
      </div>

      {state.kind === "loading" && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Spinner /> Loading teachers…
        </div>
      )}
      {state.kind === "error" && <Alert variant="error">{state.message}</Alert>}
      {state.kind === "loaded" && state.teachers.length === 0 && (
        <EmptyState title="No teachers yet" description="Add a teacher to get started." />
      )}
      {state.kind === "loaded" && state.teachers.length > 0 && (
        <Card className="p-0">
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Name</TableHeaderCell>
                <TableHeaderCell>Email</TableHeaderCell>
                {!isBranchScoped && <TableHeaderCell>Branch</TableHeaderCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {state.teachers.map((teacher) => (
                <TableRow key={teacher.id}>
                  <TableCell className="font-medium text-gray-900">
                    {teacher.firstName} {teacher.lastName}
                  </TableCell>
                  <TableCell>{teacher.email}</TableCell>
                  {!isBranchScoped && <TableCell>{branchName(teacher.branchId)}</TableCell>}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {createOpen && (
        <CreateTeacherModal
          branches={branches ?? []}
          showBranchField={!isBranchScoped}
          onClose={() => setCreateOpen(false)}
          onCreated={load}
        />
      )}
    </div>
  );
}

interface CreateTeacherModalProps {
  branches: BranchView[];
  showBranchField: boolean;
  onClose: () => void;
  onCreated: () => void;
}

function CreateTeacherModal({ branches, showBranchField, onClose, onCreated }: CreateTeacherModalProps) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [branchId, setBranchId] = useState(branches[0]?.id ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreateUserResult | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const result = await createTeacher({
        firstName,
        lastName,
        email,
        phone: phone || undefined,
        branchId: showBranchField ? branchId : undefined,
      });
      setCreated(result);
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create teacher");
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
    <Modal open onClose={onClose} title="Add teacher">
      <form className="space-y-4" onSubmit={handleSubmit}>
        {error && <Alert variant="error">{error}</Alert>}
        <div className="grid grid-cols-2 gap-4">
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
        <FormField label="Phone" htmlFor="teacher-phone">
          <Input id="teacher-phone" value={phone} onChange={(event) => setPhone(event.target.value)} />
        </FormField>
        {showBranchField && (
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
            {submitting ? "Creating…" : "Create teacher"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
