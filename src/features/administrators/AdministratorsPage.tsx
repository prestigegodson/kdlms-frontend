import { type FormEvent, useEffect, useState } from "react";
import type { BranchView } from "@/api/branches";
import { ApiError } from "@/api/client";
import {
  createBranchAdmin,
  disableUser,
  enableUser,
  listAdmins,
  updateBranchAdmin,
  type CreateUserResult,
  type SchoolUserView,
} from "@/api/users";
import { can } from "@/auth/permissions";
import { ShieldCheck } from "lucide-react";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { CredentialsReveal } from "@/components/ui/CredentialsReveal";
import { EmptyState } from "@/components/ui/EmptyState";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { Select } from "@/components/ui/Select";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/Table";
import { TableSkeleton } from "@/components/ui/TableSkeleton";
import { useBranchScope } from "@/features/branches/useBranchScope";
import { useAuthStore } from "@/stores/authStore";
import { useBranchStore } from "@/stores/branchStore";

type ListState =
  | { kind: "loading" }
  | { kind: "loaded"; admins: SchoolUserView[] }
  | { kind: "error"; message: string };

const STATUS_VARIANT: Record<SchoolUserView["status"], "success" | "neutral"> = {
  ACTIVE: "success",
  DISABLED: "neutral",
};

/**
 * The school's own admin directory: its SCHOOL_ADMIN(s) plus every
 * BRANCH_ADMIN. Provisioning, editing, and enabling/disabling is
 * BRANCH_ADMIN-only - a peer SCHOOL_ADMIN can only be created by
 * SYSTEM_ADMIN at onboarding, and password reset for either role stays a
 * SYSTEM_ADMIN support action (see CLAUDE.md's Roles table).
 */
export function AdministratorsPage() {
  const role = useAuthStore((state) => state.user?.role);
  const canManage = can.manageBranchAdmins(role);
  const currentUserId = useAuthStore((state) => state.user?.id);
  // Triggers the shared branchStore fetch (and its "select the main branch"
  // default) - this page doesn't need branch-scoped reads itself, but the
  // create form's Branch select does.
  useBranchScope();
  const branches = useBranchStore((storeState) => storeState.branches);

  const [state, setState] = useState<ListState>({ kind: "loading" });
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<SchoolUserView | null>(null);
  const [pendingToggle, setPendingToggle] = useState<SchoolUserView | null>(null);

  function fetchAdmins() {
    listAdmins()
      .then((page) => setState({ kind: "loaded", admins: page.content }))
      .catch((error: unknown) =>
        setState({
          kind: "error",
          message: error instanceof ApiError ? error.message : "Failed to load administrators",
        }),
      );
  }

  useEffect(fetchAdmins, []);

  function load() {
    setState({ kind: "loading" });
    fetchAdmins();
  }

  function branchName(branchId?: string) {
    return branches.find((branch) => branch.id === branchId)?.name ?? "—";
  }

  async function confirmToggle() {
    if (!pendingToggle) return;
    if (pendingToggle.status === "ACTIVE") {
      await disableUser(pendingToggle.id);
    } else {
      await enableUser(pendingToggle.id);
    }
    setPendingToggle(null);
    load();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Administrators"
        description="School and branch admins for your school."
        actions={canManage && <Button onClick={() => setCreateOpen(true)}>Add branch admin</Button>}
      />

      {state.kind === "loading" && (
        <Card className="p-0">
          <TableSkeleton columns={5} />
        </Card>
      )}
      {state.kind === "error" && <Alert variant="error">{state.message}</Alert>}
      {state.kind === "loaded" && state.admins.length === 0 && (
        <EmptyState icon={ShieldCheck} title="No administrators yet" description="Add a branch admin to get started." />
      )}
      {state.kind === "loaded" && state.admins.length > 0 && (
        <Card className="p-0">
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Name</TableHeaderCell>
                <TableHeaderCell>Email</TableHeaderCell>
                <TableHeaderCell>Branch</TableHeaderCell>
                <TableHeaderCell>Role</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
                <TableHeaderCell>Actions</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {state.admins.map((admin) => {
                const isBranchAdmin = admin.role === "BRANCH_ADMIN";
                const isSelf = admin.id === currentUserId;
                return (
                  <TableRow key={admin.id}>
                    <TableCell label="Name" className="font-medium text-slate-900">
                      {admin.firstName} {admin.lastName}
                    </TableCell>
                    <TableCell label="Email">{admin.email}</TableCell>
                    <TableCell label="Branch">{branchName(admin.branchId)}</TableCell>
                    <TableCell label="Role">
                      <Badge variant={isBranchAdmin ? "neutral" : "brand"}>{admin.role}</Badge>
                    </TableCell>
                    <TableCell label="Status">
                      <Badge variant={STATUS_VARIANT[admin.status]}>{admin.status}</Badge>
                    </TableCell>
                    <TableCell label="Actions">
                      {canManage && isBranchAdmin && (
                        <div className="flex justify-end gap-3 sm:justify-start">
                          <button
                            type="button"
                            className="text-brand-500 hover:text-brand-600"
                            onClick={() => setEditing(admin)}
                          >
                            Edit
                          </button>
                          {!isSelf && (
                            <button
                              type="button"
                              className="text-slate-500 hover:text-slate-700"
                              onClick={() => setPendingToggle(admin)}
                            >
                              {admin.status === "ACTIVE" ? "Disable" : "Enable"}
                            </button>
                          )}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {createOpen && (
        <AdminFormModal branches={branches} onClose={() => setCreateOpen(false)} onSaved={load} />
      )}
      {editing && (
        <AdminFormModal
          key={editing.id}
          initial={editing}
          branches={branches}
          onClose={() => setEditing(null)}
          onSaved={load}
        />
      )}
      {pendingToggle && (
        <ConfirmDialog
          title={pendingToggle.status === "ACTIVE" ? "Disable this administrator?" : "Enable this administrator?"}
          message={
            pendingToggle.status === "ACTIVE" ? (
              <>
                <strong>
                  {pendingToggle.firstName} {pendingToggle.lastName}
                </strong>{" "}
                immediately loses access and is signed out of any active session.
              </>
            ) : (
              <>
                <strong>
                  {pendingToggle.firstName} {pendingToggle.lastName}
                </strong>{" "}
                can sign in again.
              </>
            )
          }
          confirmLabel={pendingToggle.status === "ACTIVE" ? "Disable" : "Enable"}
          variant={pendingToggle.status === "ACTIVE" ? "danger" : "default"}
          onConfirm={confirmToggle}
          onClose={() => setPendingToggle(null)}
        />
      )}
    </div>
  );
}

interface AdminFormValues {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  branchId?: string;
}

interface AdminFormModalProps {
  /** Present when editing an existing branch admin; absent when creating one. */
  initial?: SchoolUserView;
  branches: BranchView[];
  onClose: () => void;
  /** Called once the save succeeds, so the caller can refresh its list - the modal itself decides when to close. */
  onSaved: () => void;
}

/**
 * Shared Add/Edit branch admin form. Creating continues on to a one-time
 * temporary-password reveal after saving; editing closes immediately since
 * there's nothing new to show. The branch field only ever appears when
 * creating - a branch admin's branch isn't editable, mirroring the teacher
 * directory's form.
 */
function AdminFormModal({ initial, branches, onClose, onSaved }: AdminFormModalProps) {
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
      const values: AdminFormValues = {
        firstName,
        lastName,
        email,
        phone: phone || undefined,
        branchId: !isEdit ? branchId : undefined,
      };
      if (isEdit) {
        await updateBranchAdmin(initial.id, values);
        onSaved();
        onClose();
      } else {
        const result = await createBranchAdmin({ ...values, branchId: values.branchId ?? "" });
        onSaved();
        setCreated(result);
      }
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : isEdit ? "Failed to update administrator" : "Failed to create administrator",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (created) {
    return (
      <Modal open onClose={onClose} title="Branch admin created">
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
    <Modal open onClose={onClose} title={isEdit ? "Edit administrator" : "Add branch admin"}>
      <form className="space-y-4" onSubmit={handleSubmit}>
        {error && <Alert variant="error">{error}</Alert>}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="First name" htmlFor="admin-first-name">
            <Input
              id="admin-first-name"
              required
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
            />
          </FormField>
          <FormField label="Last name" htmlFor="admin-last-name">
            <Input
              id="admin-last-name"
              required
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
            />
          </FormField>
        </div>
        <FormField label="Email" htmlFor="admin-email">
          <Input
            id="admin-email"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </FormField>
        {isEdit && (
          <p className="-mt-2 text-xs text-slate-500">
            Changing the email signs this administrator out of their current session.
          </p>
        )}
        <FormField label="Phone" htmlFor="admin-phone">
          <Input id="admin-phone" value={phone} onChange={(event) => setPhone(event.target.value)} />
        </FormField>
        {!isEdit && (
          <FormField label="Branch" htmlFor="admin-branch">
            <Select
              id="admin-branch"
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
            {submitting ? "Saving…" : isEdit ? "Save changes" : "Create branch admin"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
