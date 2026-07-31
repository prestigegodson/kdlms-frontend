import { type FormEvent, useEffect, useState } from "react";
import {
  activateBranch,
  type BranchView,
  createBranch,
  deactivateBranch,
  listBranches,
  updateBranch,
} from "@/api/branches";
import { ApiError } from "@/api/client";
import { can } from "@/auth/permissions";
import { Building2 } from "lucide-react";
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
import { Spinner } from "@/components/ui/Spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/ui/Table";
import { useAuthStore } from "@/stores/authStore";

type ListState =
  | { kind: "loading" }
  | { kind: "loaded"; branches: BranchView[] }
  | { kind: "error"; message: string };

/** School-portal branch management: list, create, edit, and deactivate/reactivate branches for the caller's own school. */
export function BranchesPage() {
  const role = useAuthStore((state) => state.user?.role);
  const canManage = can.manageBranches(role);

  const [state, setState] = useState<ListState>({ kind: "loading" });
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<BranchView | null>(null);
  const [deactivating, setDeactivating] = useState<BranchView | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  function fetchBranches() {
    listBranches()
      .then((page) => setState({ kind: "loaded", branches: page.content }))
      .catch((error: unknown) =>
        setState({
          kind: "error",
          message: error instanceof ApiError ? error.message : "Failed to load branches",
        }),
      );
  }

  // Mount-only fetch: the initial state above is already "loading", so no synchronous
  // setState is needed here - only load() (used by user-triggered reloads below) resets it.
  useEffect(fetchBranches, []);

  function load() {
    setState({ kind: "loading" });
    fetchBranches();
  }

  async function activate(branch: BranchView) {
    setActionError(null);
    try {
      await activateBranch(branch.id);
      load();
    } catch (error) {
      setActionError(error instanceof ApiError ? error.message : "That action failed");
    }
  }

  // Called from the ConfirmDialog - a rejection surfaces inside the dialog
  // instead of closing it, matching how SchoolDetailPage's confirmAndRun works.
  async function confirmDeactivate(branch: BranchView) {
    await deactivateBranch(branch.id);
    setDeactivating(null);
    load();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Branches"
        description="Locations your school operates under."
        actions={canManage && <Button onClick={() => setCreateOpen(true)}>Add branch</Button>}
      />

      {actionError && <Alert variant="error">{actionError}</Alert>}

      {state.kind === "loading" && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner /> Loading branches…
        </div>
      )}
      {state.kind === "error" && <Alert variant="error">{state.message}</Alert>}
      {state.kind === "loaded" && state.branches.length === 0 && (
        <EmptyState icon={Building2} title="No branches yet" description="Add a branch to get started." />
      )}
      {state.kind === "loaded" && state.branches.length > 0 && (
        <Card className="p-0">
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Name</TableHeaderCell>
                <TableHeaderCell>Address</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
                {canManage && <TableHeaderCell>Actions</TableHeaderCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {state.branches.map((branch) => (
                <TableRow key={branch.id}>
                  <TableCell label="Name" className="font-medium text-slate-900">
                    {branch.name}
                    {branch.main && (
                      <Badge variant="neutral" className="ml-2">
                        Main
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell label="Address">{branch.address ?? "—"}</TableCell>
                  <TableCell label="Status">
                    <Badge variant={branch.status === "ACTIVE" ? "success" : "neutral"}>
                      {branch.status}
                    </Badge>
                  </TableCell>
                  {canManage && (
                    <TableCell label="Actions">
                      <div className="flex gap-3">
                        <button
                          type="button"
                          className="text-brand-500 hover:text-brand-600"
                          onClick={() => setEditing(branch)}
                        >
                          Edit
                        </button>
                        {!branch.main && (
                          <button
                            type="button"
                            className="text-slate-500 hover:text-slate-700"
                            onClick={() =>
                              branch.status === "ACTIVE" ? setDeactivating(branch) : activate(branch)
                            }
                          >
                            {branch.status === "ACTIVE" ? "Deactivate" : "Activate"}
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
      )}

      {/* Rendered only while open, rather than always-mounted with an open flag - a fresh
          mount picks up `initial` naturally, with no reset-on-open effect required. */}
      {createOpen && (
        <BranchFormModal
          title="Add branch"
          onClose={() => setCreateOpen(false)}
          onSubmit={async (values) => {
            await createBranch(values);
          }}
          onSaved={() => {
            setCreateOpen(false);
            load();
          }}
        />
      )}
      {editing && (
        <BranchFormModal
          key={editing.id}
          title="Edit branch"
          initial={editing}
          onClose={() => setEditing(null)}
          onSubmit={async (values) => {
            await updateBranch(editing.id, values);
          }}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
      {deactivating && (
        <ConfirmDialog
          title="Deactivate this branch?"
          message={
            <>
              <strong>{deactivating.name}</strong> will be deactivated. Staff and students there keep their
              records but the branch stops appearing for new registrations until it's reactivated.
            </>
          }
          confirmLabel="Deactivate"
          variant="danger"
          onConfirm={() => confirmDeactivate(deactivating)}
          onClose={() => setDeactivating(null)}
        />
      )}
    </div>
  );
}

interface BranchFormValues {
  name: string;
  address?: string;
  phone?: string;
}

interface BranchFormModalProps {
  title: string;
  initial?: BranchFormValues;
  onClose: () => void;
  onSubmit: (values: BranchFormValues) => Promise<void>;
  onSaved: () => void;
}

function BranchFormModal({ title, initial, onClose, onSubmit, onSaved }: BranchFormModalProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({ name, address: address || undefined, phone: phone || undefined });
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save branch");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={title}>
      <form className="space-y-4" onSubmit={handleSubmit}>
        {error && <Alert variant="error">{error}</Alert>}
        <FormField label="Name" htmlFor="branch-name">
          <Input
            id="branch-name"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </FormField>
        <FormField label="Address" htmlFor="branch-address">
          <Input
            id="branch-address"
            value={address}
            onChange={(event) => setAddress(event.target.value)}
          />
        </FormField>
        <FormField label="Phone" htmlFor="branch-phone">
          <Input
            id="branch-phone"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
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
