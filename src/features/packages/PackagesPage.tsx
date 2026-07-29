import { type FormEvent, useEffect, useState } from "react";
import {
  createPackage,
  listPackages,
  type PackageView,
  reactivatePackage,
  retirePackage,
  type SavePackageRequest,
  updatePackage,
} from "@/api/packages";
import { ApiError } from "@/api/client";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Checkbox } from "@/components/ui/Checkbox";
import { EmptyState } from "@/components/ui/EmptyState";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { Spinner } from "@/components/ui/Spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/ui/Table";

type ListState =
  | { kind: "loading" }
  | { kind: "loaded"; packages: PackageView[] }
  | { kind: "error"; message: string };

/** System-admin package catalogue: list, create, edit, and retire/reactivate plans. */
export function PackagesPage() {
  const [state, setState] = useState<ListState>({ kind: "loading" });
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<PackageView | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  function fetchPackages() {
    listPackages()
      .then((page) => setState({ kind: "loaded", packages: page.content }))
      .catch((error: unknown) =>
        setState({
          kind: "error",
          message: error instanceof ApiError ? error.message : "Failed to load packages",
        }),
      );
  }

  // Mount-only fetch: the initial state above is already "loading", so no synchronous
  // setState is needed here - only load() (used by user-triggered reloads below) resets it.
  useEffect(fetchPackages, []);

  function load() {
    setState({ kind: "loading" });
    fetchPackages();
  }

  async function toggleStatus(pkg: PackageView) {
    setActionError(null);
    try {
      if (pkg.status === "ACTIVE") {
        await retirePackage(pkg.id);
      } else {
        await reactivatePackage(pkg.id);
      }
      load();
    } catch (error) {
      setActionError(error instanceof ApiError ? error.message : "That action failed");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Packages</h1>
        <Button onClick={() => setCreateOpen(true)}>Add package</Button>
      </div>

      {actionError && <Alert variant="error">{actionError}</Alert>}

      {state.kind === "loading" && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Spinner /> Loading packages…
        </div>
      )}
      {state.kind === "error" && <Alert variant="error">{state.message}</Alert>}
      {state.kind === "loaded" && state.packages.length === 0 && (
        <EmptyState title="No packages yet" description="Create a package to get started." />
      )}
      {state.kind === "loaded" && state.packages.length > 0 && (
        <Card className="p-0">
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Name</TableHeaderCell>
                <TableHeaderCell>Billing</TableHeaderCell>
                <TableHeaderCell>Price</TableHeaderCell>
                <TableHeaderCell>Branch limit</TableHeaderCell>
                <TableHeaderCell>Student limit</TableHeaderCell>
                <TableHeaderCell>Features</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
                <TableHeaderCell>Actions</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {state.packages.map((pkg) => (
                <TableRow key={pkg.id}>
                  <TableCell className="font-medium text-gray-900">{pkg.name}</TableCell>
                  <TableCell>{pkg.billingCycle}</TableCell>
                  <TableCell>
                    {pkg.currency} {pkg.price.toFixed(2)}
                  </TableCell>
                  <TableCell>{pkg.multiBranch ? pkg.branchLimit : "1 (single branch)"}</TableCell>
                  <TableCell>{pkg.activeStudentLimit}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {pkg.quizSupport && <Badge variant="neutral">Quiz</Badge>}
                      {pkg.onDemandLearning && <Badge variant="neutral">Learning</Badge>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={pkg.status === "ACTIVE" ? "success" : "neutral"}>{pkg.status}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        className="text-brand-600 hover:text-brand-700"
                        onClick={() => setEditing(pkg)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="text-gray-500 hover:text-gray-700"
                        onClick={() => toggleStatus(pkg)}
                      >
                        {pkg.status === "ACTIVE" ? "Retire" : "Reactivate"}
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Rendered only while open, rather than always-mounted with an open flag - a fresh
          mount picks up `initial` naturally, with no reset-on-open effect required. */}
      {createOpen && (
        <PackageFormModal
          title="Add package"
          onClose={() => setCreateOpen(false)}
          onSubmit={async (values) => {
            await createPackage(values);
          }}
          onSaved={() => {
            setCreateOpen(false);
            load();
          }}
        />
      )}
      {editing && (
        <PackageFormModal
          key={editing.id}
          title="Edit package"
          initial={editing}
          onClose={() => setEditing(null)}
          onSubmit={async (values) => {
            await updatePackage(editing.id, values);
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

interface PackageFormModalProps {
  title: string;
  initial?: PackageView;
  onClose: () => void;
  onSubmit: (values: SavePackageRequest) => Promise<void>;
  onSaved: () => void;
}

function PackageFormModal({ title, initial, onClose, onSubmit, onSaved }: PackageFormModalProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [billingCycle, setBillingCycle] = useState(initial?.billingCycle ?? "MONTHLY");
  const [price, setPrice] = useState(initial ? String(initial.price) : "");
  const [currency, setCurrency] = useState(initial?.currency ?? "NGN");
  const [multiBranch, setMultiBranch] = useState(initial?.multiBranch ?? false);
  const [branchLimit, setBranchLimit] = useState(initial ? String(initial.branchLimit) : "1");
  const [activeStudentLimit, setActiveStudentLimit] = useState(
    initial ? String(initial.activeStudentLimit) : "",
  );
  const [quizSupport, setQuizSupport] = useState(initial?.quizSupport ?? false);
  const [onDemandLearning, setOnDemandLearning] = useState(initial?.onDemandLearning ?? false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        name,
        description: description || undefined,
        billingCycle,
        price: Number(price),
        currency,
        multiBranch,
        branchLimit: multiBranch ? Number(branchLimit) : 1,
        activeStudentLimit: Number(activeStudentLimit),
        quizSupport,
        onDemandLearning,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save package");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={title}>
      <form className="space-y-4" onSubmit={handleSubmit}>
        {error && <Alert variant="error">{error}</Alert>}
        <FormField label="Name" htmlFor="package-name">
          <Input id="package-name" required value={name} onChange={(event) => setName(event.target.value)} />
        </FormField>
        <FormField label="Description" htmlFor="package-description">
          <Input
            id="package-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Billing cycle" htmlFor="package-billing-cycle">
            <Select
              id="package-billing-cycle"
              value={billingCycle}
              onChange={(event) => setBillingCycle(event.target.value as "MONTHLY" | "ANNUAL")}
            >
              <option value="MONTHLY">Monthly</option>
              <option value="ANNUAL">Annual</option>
            </Select>
          </FormField>
          <FormField label="Currency" htmlFor="package-currency">
            <Input
              id="package-currency"
              required
              maxLength={3}
              value={currency}
              onChange={(event) => setCurrency(event.target.value.toUpperCase())}
            />
          </FormField>
        </div>
        <FormField label="Price" htmlFor="package-price">
          <Input
            id="package-price"
            type="number"
            min="0"
            step="0.01"
            required
            value={price}
            onChange={(event) => setPrice(event.target.value)}
          />
        </FormField>

        <label className="flex items-center gap-2 text-sm text-gray-700">
          <Checkbox checked={multiBranch} onChange={(event) => setMultiBranch(event.target.checked)} />
          Allow multiple branches
        </label>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Branch limit" htmlFor="package-branch-limit">
            <Input
              id="package-branch-limit"
              type="number"
              min="1"
              required
              disabled={!multiBranch}
              value={multiBranch ? branchLimit : "1"}
              onChange={(event) => setBranchLimit(event.target.value)}
            />
          </FormField>
          <FormField label="Active student limit" htmlFor="package-student-limit">
            <Input
              id="package-student-limit"
              type="number"
              min="1"
              required
              value={activeStudentLimit}
              onChange={(event) => setActiveStudentLimit(event.target.value)}
            />
          </FormField>
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-700">
          <Checkbox checked={quizSupport} onChange={(event) => setQuizSupport(event.target.checked)} />
          Quiz support
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <Checkbox
            checked={onDemandLearning}
            onChange={(event) => setOnDemandLearning(event.target.checked)}
          />
          On-demand learning
        </label>

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
