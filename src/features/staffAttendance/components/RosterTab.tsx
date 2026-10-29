import { UserPlus, Users } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { getErrorMessage } from "@/api/client";
import {
  createStaff,
  getRoster,
  linkAcademicStaff,
  linkAllAcademicStaff,
  STAFF_CATEGORIES,
  STAFF_CATEGORY_LABELS,
  type StaffCategory,
  type StaffRowView,
  updateStaff,
} from "@/api/staffAttendance";
import { can } from "@/auth/permissions";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { SearchInput } from "@/components/ui/SearchInput";
import { Select } from "@/components/ui/Select";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/Table";
import { TableSkeleton } from "@/components/ui/TableSkeleton";
import { useAuthStore } from "@/stores/authStore";
import { useBranchStore } from "@/stores/branchStore";
import { useNavigate } from "react-router";
import { staffRoleLabel } from "../format";

type State =
  | { kind: "loading" }
  | { kind: "loaded"; staff: StaffRowView[] }
  | { kind: "error"; message: string };

type KindFilter = "ALL" | "ACADEMIC" | "NON_ACADEMIC";

/**
 * The whole staff roster: login staff (teachers, admins, inventory managers -
 * set up for clock-in with one click) and non-academic records added here.
 */
export function RosterTab({ branchId }: { branchId?: string }) {
  const navigate = useNavigate();
  const role = useAuthStore((state) => state.user?.role);
  const branches = useBranchStore((state) => state.branches);
  const [reloadKey, setReloadKey] = useState(0);
  const requestKey = `${branchId ?? ""}|${reloadKey}`;
  const [result, setResult] = useState<{ key: string; state: State } | null>(null);
  const state: State = result?.key === requestKey ? result.state : { kind: "loading" };
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<KindFilter>("ALL");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<StaffRowView | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [linking, setLinking] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const key = `${branchId ?? ""}|${reloadKey}`;
    getRoster(branchId)
      .then((roster) => {
        if (!cancelled) {
          setResult({ key, state: { kind: "loaded", staff: roster.staff } });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setResult({ key, state: { kind: "error", message: getErrorMessage(error, "Failed to load staff") } });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [branchId, reloadKey]);

  const reload = () => setReloadKey((key) => key + 1);
  const branchName = (id: string | null) =>
    id ? (branches.find((branch) => branch.id === id)?.name ?? "—") : "All branches";

  async function openRow(row: StaffRowView) {
    setActionError(null);
    if (row.staffMemberId) {
      navigate(`/school/staff-attendance/staff/${row.staffMemberId}`);
      return;
    }
    if (!row.userId || row.status === "INACTIVE") {
      return;
    }
    setLinking(row.userId);
    try {
      const linked = await linkAcademicStaff(row.userId);
      navigate(`/school/staff-attendance/staff/${linked.staffMemberId}`);
    } catch (error) {
      setActionError(getErrorMessage(error, "Couldn't set this person up for clock-in"));
    } finally {
      setLinking(null);
    }
  }

  async function linkAll() {
    setActionError(null);
    setLinking("all");
    try {
      const { linked } = await linkAllAcademicStaff(branchId);
      setNotice(
        linked === 0
          ? "Every teacher and administrator is already set up for clock-in."
          : `${linked} teacher${linked === 1 ? "" : "s"} and administrator${linked === 1 ? "" : "s"} set up for clock-in.`,
      );
      reload();
    } catch (error) {
      setActionError(getErrorMessage(error, "Couldn't set up academic staff"));
    } finally {
      setLinking(null);
    }
  }

  const rows =
    state.kind === "loaded"
      ? state.staff.filter((row) => {
          if (kind !== "ALL" && row.kind !== kind) {
            return false;
          }
          const needle = search.trim().toLowerCase();
          return !needle || `${row.firstName} ${row.lastName}`.toLowerCase().includes(needle);
        })
      : [];
  const unlinked = state.kind === "loaded" ? state.staff.filter((row) => row.status === "NOT_LINKED").length : 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search staff"
          className="w-full sm:w-64"
        />
        <FormField label="Type" htmlFor="staff-kind-filter" className="w-full sm:w-48">
          <Select id="staff-kind-filter" value={kind} onChange={(event) => setKind(event.target.value as KindFilter)}>
            <option value="ALL">Everyone</option>
            <option value="ACADEMIC">Teachers & admins</option>
            <option value="NON_ACADEMIC">Non-academic staff</option>
          </Select>
        </FormField>
        <div className="flex flex-1 flex-wrap justify-end gap-2">
          {unlinked > 0 && (
            <Button variant="secondary" onClick={linkAll} loading={linking === "all"}>
              Set up {unlinked} teacher{unlinked === 1 ? "" : "s"} & admin{unlinked === 1 ? "" : "s"}
            </Button>
          )}
          <Button onClick={() => setFormOpen(true)}>
            <UserPlus className="h-4 w-4" aria-hidden="true" />
            Add non-academic staff
          </Button>
        </div>
      </div>
      {notice && <Alert variant="success">{notice}</Alert>}
      {actionError && <Alert variant="error">{actionError}</Alert>}

      {state.kind === "loading" && (
        <Card className="p-0">
          <TableSkeleton columns={6} />
        </Card>
      )}
      {state.kind === "error" && <Alert variant="error">{state.message}</Alert>}
      {state.kind === "loaded" && state.staff.length === 0 && (
        <EmptyState
          icon={Users}
          title="No staff yet"
          description="Add nannies, cleaners, drivers, security and other non-academic staff, or add teachers from the Teachers page."
        />
      )}
      {state.kind === "loaded" && state.staff.length > 0 && (
        <Card className="p-0">
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Name</TableHeaderCell>
                <TableHeaderCell>Role</TableHeaderCell>
                <TableHeaderCell>Branch</TableHeaderCell>
                <TableHeaderCell>Clock-in</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
                <TableHeaderCell>Actions</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.staffMemberId ?? row.userId}>
                  <TableCell label="Name" className="font-medium text-slate-900">
                    {row.firstName} {row.lastName}
                    {row.devicePin !== null && (
                      <span className="ml-2 text-xs font-normal text-slate-400">PIN {row.devicePin}</span>
                    )}
                  </TableCell>
                  <TableCell label="Role">
                    <div className="flex flex-wrap items-center gap-1">
                      {staffRoleLabel(row)}
                      {row.kind === "ACADEMIC" && <Badge variant="brand">Login</Badge>}
                    </div>
                  </TableCell>
                  <TableCell label="Branch">{branchName(row.branchId)}</TableCell>
                  <TableCell label="Clock-in">
                    <EnrollmentBadges row={row} />
                  </TableCell>
                  <TableCell label="Status">
                    <StatusBadge row={row} />
                  </TableCell>
                  <TableCell label="Actions">
                    <div className="flex justify-end gap-3 sm:justify-start">
                      {row.status !== "INACTIVE" || row.staffMemberId ? (
                        <button
                          type="button"
                          className="text-brand-500 hover:text-brand-600 disabled:opacity-50"
                          disabled={linking === row.userId}
                          onClick={() => openRow(row)}
                        >
                          {row.staffMemberId ? "Open" : "Set up clock-in"}
                        </button>
                      ) : null}
                      {row.kind === "NON_ACADEMIC" && (
                        <button
                          type="button"
                          className="text-slate-500 hover:text-slate-700"
                          onClick={() => setEditing(row)}
                        >
                          Edit
                        </button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {rows.length === 0 && <p className="p-4 text-sm text-slate-500">No staff match this search.</p>}
        </Card>
      )}

      {(formOpen || editing) && (
        <StaffFormModal
          key={editing?.staffMemberId ?? "new"}
          initial={editing ?? undefined}
          defaultBranchId={branchId}
          selectsBranch={can.selectBranch(role)}
          onClose={() => {
            setFormOpen(false);
            setEditing(null);
          }}
          onSaved={() => {
            setFormOpen(false);
            setEditing(null);
            reload();
          }}
        />
      )}
    </div>
  );
}

function StatusBadge({ row }: { row: StaffRowView }) {
  if (row.status === "NOT_LINKED") {
    return <Badge variant="neutral">Not set up</Badge>;
  }
  return <Badge variant={row.status === "ACTIVE" ? "success" : "neutral"}>{row.status === "ACTIVE" ? "Active" : "Inactive"}</Badge>;
}

function EnrollmentBadges({ row }: { row: StaffRowView }) {
  if (!row.staffMemberId) {
    return <span className="text-sm text-slate-400">—</span>;
  }
  const none = row.passkeys === 0 && row.fingerprintDevices === 0 && !row.face;
  return (
    <div className="flex flex-wrap gap-1">
      {row.fingerprintDevices > 0 && <Badge variant="success">Fingerprint</Badge>}
      {row.face && <Badge variant="success">Face</Badge>}
      {row.passkeys > 0 && <Badge variant="info">Phone passkey</Badge>}
      {none && <Badge variant="warning">Not enrolled</Badge>}
    </div>
  );
}

interface StaffFormModalProps {
  initial?: StaffRowView;
  defaultBranchId?: string;
  selectsBranch: boolean;
  onClose: () => void;
  onSaved: () => void;
}

function StaffFormModal({ initial, defaultBranchId, selectsBranch, onClose, onSaved }: StaffFormModalProps) {
  const branches = useBranchStore((state) => state.branches);
  const selectedBranchId = useBranchStore((state) => state.selectedBranchId);
  const [firstName, setFirstName] = useState(initial?.firstName ?? "");
  const [lastName, setLastName] = useState(initial?.lastName ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [category, setCategory] = useState<StaffCategory>(initial?.category ?? "CLEANER");
  const [jobTitle, setJobTitle] = useState(initial?.jobTitle ?? "");
  const [branchId, setBranchId] = useState(initial?.branchId ?? defaultBranchId ?? selectedBranchId ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    const request = {
      branchId: selectsBranch ? branchId || undefined : undefined,
      firstName,
      lastName,
      phone: phone || undefined,
      category,
      jobTitle: jobTitle || undefined,
    };
    try {
      if (initial?.staffMemberId) {
        await updateStaff(initial.staffMemberId, request);
      } else {
        await createStaff(request);
      }
      onSaved();
    } catch (err) {
      setError(getErrorMessage(err, "Failed to save staff member"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={initial ? "Edit staff member" : "Add non-academic staff"} size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <Alert variant="error">{error}</Alert>}
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="First name" htmlFor="staff-first-name">
            <Input id="staff-first-name" required maxLength={100} value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          </FormField>
          <FormField label="Last name" htmlFor="staff-last-name">
            <Input id="staff-last-name" required maxLength={100} value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </FormField>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Role" htmlFor="staff-category">
            <Select id="staff-category" value={category} onChange={(e) => setCategory(e.target.value as StaffCategory)}>
              {STAFF_CATEGORIES.map((value) => (
                <option key={value} value={value}>
                  {STAFF_CATEGORY_LABELS[value]}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Job title (optional)" htmlFor="staff-job-title" description={category === "OTHER" ? "Shown instead of “Other”." : undefined}>
            <Input id="staff-job-title" maxLength={100} value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />
          </FormField>
        </div>
        <FormField label="Phone (optional)" htmlFor="staff-phone">
          <Input id="staff-phone" type="tel" maxLength={30} value={phone} onChange={(e) => setPhone(e.target.value)} />
        </FormField>
        {selectsBranch && (
          <FormField label="Branch" htmlFor="staff-branch">
            <Select id="staff-branch" required value={branchId} onChange={(e) => setBranchId(e.target.value)}>
              <option value="" disabled>
                Choose a branch
              </option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </Select>
          </FormField>
        )}
        <p className="text-sm text-slate-500">
          Non-academic staff never get a KDLMS login. They clock in on the fingerprint terminal, or with a passkey on
          their own phone.
        </p>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={submitting}>
            Save
          </Button>
        </div>
      </form>
    </Modal>
  );
}
