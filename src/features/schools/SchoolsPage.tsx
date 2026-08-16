import { type FormEvent, useEffect, useState } from "react";
import { ApiError } from "@/api/client";
import { createSchool, listSchools, type SchoolView } from "@/api/schools";
import { Building2 } from "lucide-react";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/ui/Table";
import { TableSkeleton } from "@/components/ui/TableSkeleton";

type ListState =
  | { kind: "loading" }
  | { kind: "loaded"; schools: SchoolView[] }
  | { kind: "error"; message: string };

const STATUS_VARIANT: Record<SchoolView["status"], "success" | "warning" | "danger"> = {
  ACTIVE: "success",
  SUSPENDED: "warning",
  ARCHIVED: "danger",
};

/** System-admin school directory: list every tenant, onboard a new one. */
export function SchoolsPage() {
  const [state, setState] = useState<ListState>({ kind: "loading" });
  const [modalOpen, setModalOpen] = useState(false);

  function fetchSchools() {
    listSchools()
      .then((page) => setState({ kind: "loaded", schools: page.content }))
      .catch((error: unknown) =>
        setState({
          kind: "error",
          message: error instanceof ApiError ? error.message : "Failed to load schools",
        }),
      );
  }

  // Mount-only fetch: the initial state above is already "loading", so no synchronous
  // setState is needed here - only load() (used by user-triggered reloads below) resets it.
  useEffect(fetchSchools, []);

  function load() {
    setState({ kind: "loading" });
    fetchSchools();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Schools"
        description="Every school (tenant) on the platform."
        actions={<Button onClick={() => setModalOpen(true)}>Onboard school</Button>}
      />

      {state.kind === "loading" && (
        <Card className="p-0">
          <TableSkeleton columns={4} />
        </Card>
      )}
      {state.kind === "error" && <Alert variant="error">{state.message}</Alert>}
      {state.kind === "loaded" && state.schools.length === 0 && (
        <EmptyState
          icon={Building2}
          title="No schools yet"
          description="Onboard the first school to get started."
        />
      )}
      {state.kind === "loaded" && state.schools.length > 0 && (
        <Card className="p-0">
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Name</TableHeaderCell>
                <TableHeaderCell>Code</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
                <TableHeaderCell></TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {state.schools.map((school) => (
                <TableRow key={school.id} to={`/admin/schools/${school.id}`}>
                  <TableCell label="Name" className="font-medium text-slate-900">
                    {school.name}
                  </TableCell>
                  <TableCell label="Code">{school.code}</TableCell>
                  <TableCell label="Status">
                    <Badge variant={STATUS_VARIANT[school.status]}>{school.status}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <CreateSchoolModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={() => {
          setModalOpen(false);
          load();
        }}
      />
    </div>
  );
}

interface CreateSchoolModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

function CreateSchoolModal({ open, onClose, onCreated }: CreateSchoolModalProps) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");
  const [mainBranchName, setMainBranchName] = useState("");
  const [subdomain, setSubdomain] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await createSchool({
        name,
        code,
        email: email || undefined,
        mainBranchName: mainBranchName || undefined,
        subdomain: subdomain || undefined,
      });
      setName("");
      setCode("");
      setEmail("");
      setMainBranchName("");
      setSubdomain("");
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create school");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Onboard a school">
      <form className="space-y-4" onSubmit={handleSubmit}>
        {error && <Alert variant="error">{error}</Alert>}
        <FormField label="School name" htmlFor="school-name">
          <Input
            id="school-name"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </FormField>
        <FormField label="Code" htmlFor="school-code">
          <Input
            id="school-code"
            required
            placeholder="e.g. BSA"
            value={code}
            onChange={(event) => setCode(event.target.value)}
          />
        </FormField>
        <FormField label="Email" htmlFor="school-email">
          <Input
            id="school-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </FormField>
        <FormField label="Main branch name" htmlFor="main-branch-name">
          <Input
            id="main-branch-name"
            placeholder="Main Branch"
            value={mainBranchName}
            onChange={(event) => setMainBranchName(event.target.value)}
          />
        </FormField>
        <FormField label="Subdomain (optional)" htmlFor="school-subdomain">
          <Input
            id="school-subdomain"
            placeholder="greenwood"
            pattern="[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?"
            autoCapitalize="none"
            value={subdomain}
            onChange={(event) => setSubdomain(event.target.value)}
          />
          {subdomain && <p className="mt-1 text-xs text-slate-500">Login page: {subdomain.toLowerCase()}.kdlms.com</p>}
        </FormField>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Creating…" : "Create school"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
