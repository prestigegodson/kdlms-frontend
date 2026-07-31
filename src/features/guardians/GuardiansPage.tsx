import { type FormEvent, useEffect, useState } from "react";
import {
  createGuardian,
  disableGuardian,
  enableGuardian,
  type GuardianCreateResult,
  type GuardianView,
  listGuardians,
  listGuardianWards,
  type WardView,
} from "@/api/guardians";
import { ApiError } from "@/api/client";
import type { Page } from "@/api/types";
import { can } from "@/auth/permissions";
import { Contact } from "lucide-react";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CredentialsReveal } from "@/components/ui/CredentialsReveal";
import { EmptyState } from "@/components/ui/EmptyState";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { SearchInput } from "@/components/ui/SearchInput";
import { Spinner } from "@/components/ui/Spinner";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/Table";
import { useAuthStore } from "@/stores/authStore";

const PAGE_SIZE = 20;

type ListState =
  | { kind: "loading" }
  | { kind: "loaded"; page: Page<GuardianView> }
  | { kind: "error"; message: string };

/** School-portal guardian directory: provision guardian accounts and manage ward links. */
export function GuardiansPage() {
  const role = useAuthStore((state) => state.user?.role);
  const canManage = can.manageGuardians(role);

  const [query, setQuery] = useState("");
  const [pageIndex, setPageIndex] = useState(0);
  const [state, setState] = useState<ListState>({ kind: "loading" });
  const [createOpen, setCreateOpen] = useState(false);
  const [viewingWardsOf, setViewingWardsOf] = useState<GuardianView | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  function fetchGuardians() {
    listGuardians(query, pageIndex, PAGE_SIZE)
      .then((page) => setState({ kind: "loaded", page }))
      .catch((error: unknown) =>
        setState({
          kind: "error",
          message: error instanceof ApiError ? error.message : "Failed to load guardians",
        }),
      );
  }

  useEffect(fetchGuardians, [query, pageIndex]);

  function load() {
    setState({ kind: "loading" });
    fetchGuardians();
  }

  async function toggleActive(guardian: GuardianView) {
    setActionError(null);
    try {
      if (guardian.active) {
        await disableGuardian(guardian.id);
      } else {
        await enableGuardian(guardian.id);
      }
      load();
    } catch (error) {
      setActionError(error instanceof ApiError ? error.message : "That action failed");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Guardians"
        description="Parents and guardians with a portal login, and the students they're linked to."
        actions={canManage && <Button onClick={() => setCreateOpen(true)}>Add guardian</Button>}
      />

      <SearchInput
        value={query}
        onChange={(value) => {
          setQuery(value);
          setPageIndex(0);
        }}
        placeholder="Search name or email"
        className="max-w-sm"
      />

      {actionError && <Alert variant="error">{actionError}</Alert>}

      {state.kind === "loading" && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner /> Loading guardians…
        </div>
      )}
      {state.kind === "error" && <Alert variant="error">{state.message}</Alert>}
      {state.kind === "loaded" && state.page.content.length === 0 && (
        <EmptyState
          icon={Contact}
          title="No guardians found"
          description="Add a guardian, or adjust your search."
        />
      )}
      {state.kind === "loaded" && state.page.content.length > 0 && (
        <>
          <Card className="p-0">
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Name</TableHeaderCell>
                  <TableHeaderCell>Email</TableHeaderCell>
                  <TableHeaderCell>Phone</TableHeaderCell>
                  <TableHeaderCell>Status</TableHeaderCell>
                  <TableHeaderCell>Actions</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {state.page.content.map((guardian) => (
                  <TableRow key={guardian.id}>
                    <TableCell label="Name" className="font-medium text-slate-900">
                      {guardian.fullName}
                    </TableCell>
                    <TableCell label="Email">{guardian.email}</TableCell>
                    <TableCell label="Phone">{guardian.phone ?? "—"}</TableCell>
                    <TableCell label="Status">
                      <Badge variant={guardian.active ? "success" : "neutral"}>
                        {guardian.active ? "ACTIVE" : "DISABLED"}
                      </Badge>
                    </TableCell>
                    <TableCell label="Actions">
                      <div className="flex gap-3">
                        <button
                          type="button"
                          className="text-brand-500 hover:text-brand-600"
                          onClick={() => setViewingWardsOf(guardian)}
                        >
                          View wards
                        </button>
                        {canManage && (
                          <button
                            type="button"
                            className="text-slate-500 hover:text-slate-700"
                            onClick={() => toggleActive(guardian)}
                          >
                            {guardian.active ? "Disable" : "Enable"}
                          </button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
          <Pagination page={state.page} onPageChange={setPageIndex} />
        </>
      )}

      {createOpen && (
        <CreateGuardianModal
          onClose={() => setCreateOpen(false)}
          onSaved={() => {
            load();
          }}
        />
      )}
      {viewingWardsOf && <WardsModal guardian={viewingWardsOf} onClose={() => setViewingWardsOf(null)} />}
    </div>
  );
}

function CreateGuardianModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [occupation, setOccupation] = useState("");
  const [address, setAddress] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<GuardianCreateResult | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const result = await createGuardian({
        email,
        firstName,
        lastName,
        phone: phone || undefined,
        occupation: occupation || undefined,
        address: address || undefined,
      });
      onSaved();
      setCreated(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create guardian");
    } finally {
      setSubmitting(false);
    }
  }

  if (created) {
    return (
      <Modal open onClose={onClose} title="Guardian created">
        <div className="space-y-4">
          <Alert variant="success">
            {created.guardian.fullName} can now sign in with {created.guardian.email}. An invitation email has been
            sent to them. Link them to a student from that student's profile, or come back here later.
          </Alert>
          <CredentialsReveal email={created.guardian.email} temporaryPassword={created.temporaryPassword} />
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
    <Modal open onClose={onClose} title="Add guardian">
      <form className="space-y-4" onSubmit={handleSubmit}>
        {error && <Alert variant="error">{error}</Alert>}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="First name" htmlFor="guardian-first-name">
            <Input id="guardian-first-name" required value={firstName} onChange={(event) => setFirstName(event.target.value)} />
          </FormField>
          <FormField label="Last name" htmlFor="guardian-last-name">
            <Input id="guardian-last-name" required value={lastName} onChange={(event) => setLastName(event.target.value)} />
          </FormField>
        </div>
        <FormField label="Email" htmlFor="guardian-email">
          <Input id="guardian-email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
        </FormField>
        <FormField label="Phone" htmlFor="guardian-phone">
          <Input id="guardian-phone" value={phone} onChange={(event) => setPhone(event.target.value)} />
        </FormField>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Occupation" htmlFor="guardian-occupation">
            <Input id="guardian-occupation" value={occupation} onChange={(event) => setOccupation(event.target.value)} />
          </FormField>
          <FormField label="Address" htmlFor="guardian-address">
            <Input id="guardian-address" value={address} onChange={(event) => setAddress(event.target.value)} />
          </FormField>
        </div>
        <p className="text-xs text-slate-500">
          Link this guardian to a student afterward from the student's profile page.
        </p>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Creating…" : "Create guardian"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function WardsModal({ guardian, onClose }: { guardian: GuardianView; onClose: () => void }) {
  const [wards, setWards] = useState<WardView[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listGuardianWards(guardian.id)
      .then(setWards)
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : "Failed to load wards"));
  }, [guardian.id]);

  return (
    <Modal open onClose={onClose} title={`${guardian.fullName}'s wards`}>
      {error && <Alert variant="error">{error}</Alert>}
      {wards === null && !error && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner /> Loading…
        </div>
      )}
      {wards !== null && wards.length === 0 && (
        <EmptyState title="No wards linked" description="Link a student from their profile page." />
      )}
      {wards !== null && wards.length > 0 && (
        <ul className="divide-y divide-slate-100">
          {wards.map((ward) => (
            <li key={ward.studentId} className="flex items-center justify-between py-2 text-sm">
              <div>
                <p className="font-medium text-slate-900">{ward.studentName}</p>
                <p className="text-slate-500">{ward.admissionNumber}</p>
              </div>
              <Badge variant="neutral">{ward.relationship}</Badge>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
