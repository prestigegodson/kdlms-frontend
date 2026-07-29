import { type FormEvent, useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { ApiError } from "@/api/client";
import { listPackages, type PackageView } from "@/api/packages";
import {
  activateSchool,
  archiveSchool,
  getSchool,
  restoreSchool,
  type SchoolView,
  suspendSchool,
} from "@/api/schools";
import {
  assignSubscription,
  cancelSubscription,
  getCurrentSubscription,
  resumeSubscription,
  type SubscriptionView,
  suspendSubscription,
} from "@/api/subscriptions";
import {
  createSchoolAdmin,
  listSchoolAdmins,
  resetUserPassword,
  type CreateUserResult,
  type SchoolUserView,
} from "@/api/users";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { Spinner } from "@/components/ui/Spinner";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/Table";
import { formatDateRange } from "@/utils/date";

type PendingAction =
  | { kind: "suspend" }
  | { kind: "archive" }
  | { kind: "restore" };

type LoadState =
  { kind: "loading" } | { kind: "loaded"; school: SchoolView } | { kind: "error"; message: string };

const STATUS_VARIANT: Record<SchoolView["status"], "success" | "warning" | "danger"> = {
  ACTIVE: "success",
  SUSPENDED: "warning",
  ARCHIVED: "danger",
};

/** System-admin view of a single school: profile summary, lifecycle actions, and creating its first school admin. */
export function SchoolDetailPage() {
  const { schoolId } = useParams<{ schoolId: string }>();
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [actionError, setActionError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [adminsRefreshKey, setAdminsRefreshKey] = useState(0);

  function fetchSchool() {
    if (!schoolId) return;
    getSchool(schoolId)
      .then((school) => setState({ kind: "loaded", school }))
      .catch((error: unknown) =>
        setState({
          kind: "error",
          message: error instanceof ApiError ? error.message : "Failed to load school",
        }),
      );
  }

  // Only fetches - no synchronous setState here, so a schoolId change re-fetches without
  // an extra render; load() below (used after a mutation) resets to "loading" explicitly.
  useEffect(fetchSchool, [schoolId]);

  function load() {
    setState({ kind: "loading" });
    fetchSchool();
  }

  async function runAction(action: (id: string) => Promise<void>) {
    if (!schoolId) return;
    setActionError(null);
    try {
      await action(schoolId);
      load();
    } catch (error) {
      setActionError(error instanceof ApiError ? error.message : "That action failed");
    }
  }

  // Confirmation dialogs call this directly so a failure surfaces inside the
  // dialog (via ConfirmDialog's own error handling) rather than closing it.
  async function confirmAndRun(action: (id: string) => Promise<void>) {
    if (!schoolId) return;
    await action(schoolId);
    setPending(null);
    load();
  }

  return (
    <div className="space-y-6">
      <Link to="/admin/schools" className="text-sm text-brand-600 hover:text-brand-700">
        &larr; All schools
      </Link>

      {state.kind === "loading" && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Spinner /> Loading…
        </div>
      )}
      {state.kind === "error" && <Alert variant="error">{state.message}</Alert>}

      {state.kind === "loaded" && (
        <>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">{state.school.name}</h1>
              <p className="text-sm text-gray-500">Code: {state.school.code}</p>
            </div>
            <Badge variant={STATUS_VARIANT[state.school.status]}>{state.school.status}</Badge>
          </div>

          {actionError && <Alert variant="error">{actionError}</Alert>}

          <Card>
            <h2 className="text-sm font-semibold text-gray-900">Profile</h2>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <dt className="text-gray-500">Email</dt>
              <dd className="text-gray-900">{state.school.email ?? "—"}</dd>
              <dt className="text-gray-500">Phone</dt>
              <dd className="text-gray-900">{state.school.phone ?? "—"}</dd>
              <dt className="text-gray-500">Address</dt>
              <dd className="text-gray-900">{state.school.address ?? "—"}</dd>
            </dl>
            <div className="mt-4 flex gap-2">
              {state.school.status === "SUSPENDED" && (
                <Button variant="secondary" onClick={() => runAction(activateSchool)}>
                  Activate
                </Button>
              )}
              {state.school.status === "ACTIVE" && (
                <Button variant="secondary" onClick={() => setPending({ kind: "suspend" })}>
                  Suspend
                </Button>
              )}
              {state.school.status !== "ARCHIVED" && (
                <Button variant="danger" onClick={() => setPending({ kind: "archive" })}>
                  Archive
                </Button>
              )}
              {state.school.status === "ARCHIVED" && (
                <Button variant="secondary" onClick={() => setPending({ kind: "restore" })}>
                  Restore
                </Button>
              )}
            </div>
          </Card>

          {pending?.kind === "suspend" && (
            <ConfirmDialog
              title="Suspend this school?"
              message={
                <>
                  <strong>{state.school.name}</strong> will lose access to the school portal until it is
                  reactivated. This does not affect its data.
                </>
              }
              confirmLabel="Suspend"
              onConfirm={() => confirmAndRun(suspendSchool)}
              onClose={() => setPending(null)}
            />
          )}
          {pending?.kind === "archive" && (
            <ConfirmDialog
              title="Archive this school?"
              message={
                <>
                  <strong>{state.school.name}</strong> will be archived, not deleted - its data is kept, but
                  the school portal becomes inaccessible. A system admin can restore it later, which returns
                  it to Suspended (it must then be reactivated separately).
                </>
              }
              confirmLabel="Archive"
              variant="danger"
              confirmationText={state.school.code}
              onConfirm={() => confirmAndRun(archiveSchool)}
              onClose={() => setPending(null)}
            />
          )}
          {pending?.kind === "restore" && (
            <ConfirmDialog
              title="Restore this school?"
              message={
                <>
                  <strong>{state.school.name}</strong> will be returned to Suspended. You'll need to
                  Activate it separately to restore full access.
                </>
              }
              confirmLabel="Restore"
              onConfirm={() => confirmAndRun(restoreSchool)}
              onClose={() => setPending(null)}
            />
          )}

          <SubscriptionCard schoolId={state.school.id} />

          <SchoolAdminsCard schoolId={state.school.id} refreshKey={adminsRefreshKey} />

          <CreateSchoolAdminCard
            schoolId={state.school.id}
            onCreated={() => setAdminsRefreshKey((key) => key + 1)}
          />
        </>
      )}
    </div>
  );
}

/**
 * A server-generated temporary password, shown exactly once - the create-school-admin
 * and reset-password flows both surface one of these, so the clipboard logic and the
 * "never retrievable again" copy live here rather than twice.
 */
function TemporaryPasswordAlert({ email, temporaryPassword }: { email: string; temporaryPassword: string }) {
  const [copied, setCopied] = useState(false);

  async function copyPassword() {
    await navigator.clipboard.writeText(temporaryPassword);
    setCopied(true);
  }

  return (
    <Alert variant="success" className="mt-4">
      <p>
        <strong>{email}</strong>&apos;s temporary password:{" "}
        <code className="rounded bg-white px-1.5 py-0.5">{temporaryPassword}</code>
      </p>
      <p className="mt-1 text-xs text-green-700">Shown once, here, and never retrievable again - relay it now.</p>
      <Button type="button" variant="secondary" className="mt-2" onClick={copyPassword}>
        {copied ? "Copied!" : "Copy password"}
      </Button>
    </Alert>
  );
}

function CreateSchoolAdminCard({ schoolId, onCreated }: { schoolId: string; onCreated: () => void }) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreateUserResult | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const result = await createSchoolAdmin(schoolId, { firstName, lastName, email });
      setCreated(result);
      setFirstName("");
      setLastName("");
      setEmail("");
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create school admin");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <h2 className="text-sm font-semibold text-gray-900">Create a school admin</h2>
      <p className="mt-1 text-sm text-gray-500">
        The temporary password is shown once, here, and is never retrievable again - copy it to the
        new admin now.
      </p>

      {created && <TemporaryPasswordAlert email={created.user.email} temporaryPassword={created.temporaryPassword} />}

      <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
        {error && <Alert variant="error">{error}</Alert>}
        <div className="grid grid-cols-2 gap-4">
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
        <Button type="submit" disabled={submitting}>
          {submitting ? "Creating…" : "Create school admin"}
        </Button>
      </form>
    </Card>
  );
}

type SchoolAdminsLoadState =
  | { kind: "loading" }
  | { kind: "loaded"; admins: SchoolUserView[] }
  | { kind: "error"; message: string };

const USER_STATUS_VARIANT: Record<SchoolUserView["status"], "success" | "neutral"> = {
  ACTIVE: "success",
  DISABLED: "neutral",
};

/**
 * The school's SCHOOL_ADMIN/BRANCH_ADMIN users, as the system admin sees them - listing so
 * support can find who to help, and a per-row password reset for when one is locked out.
 * Teachers/guardians aren't shown here; enable/disable stays a school-admin action elsewhere.
 */
function SchoolAdminsCard({ schoolId, refreshKey }: { schoolId: string; refreshKey: number }) {
  const [state, setState] = useState<SchoolAdminsLoadState>({ kind: "loading" });
  const [pendingReset, setPendingReset] = useState<SchoolUserView | null>(null);
  const [justReset, setJustReset] = useState<{ email: string; temporaryPassword: string } | null>(null);

  function fetchAdmins() {
    listSchoolAdmins(schoolId)
      .then((page) => setState({ kind: "loaded", admins: page.content }))
      .catch((error: unknown) =>
        setState({
          kind: "error",
          message: error instanceof ApiError ? error.message : "Failed to load admins",
        }),
      );
  }

  // Only fetches - no synchronous setState here, so a schoolId/refreshKey change re-fetches
  // without an extra render; load() below (used after a mutation) resets to "loading" explicitly.
  useEffect(fetchAdmins, [schoolId, refreshKey]);

  function load() {
    setState({ kind: "loading" });
    fetchAdmins();
  }

  async function confirmReset() {
    if (!pendingReset) return;
    const result = await resetUserPassword(schoolId, pendingReset.id);
    setJustReset({ email: result.user.email, temporaryPassword: result.temporaryPassword });
    setPendingReset(null);
    load();
  }

  return (
    <Card className="p-0">
      <div className="p-6 pb-0">
        <h2 className="text-sm font-semibold text-gray-900">Admins</h2>
        <p className="mt-1 text-sm text-gray-500">
          This school's SCHOOL_ADMIN and BRANCH_ADMIN users. Reset a password for one who's locked out.
        </p>
      </div>

      <div className="p-6">
        {state.kind === "loading" && (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Spinner /> Loading…
          </div>
        )}
        {state.kind === "error" && <Alert variant="error">{state.message}</Alert>}

        {justReset && (
          <TemporaryPasswordAlert email={justReset.email} temporaryPassword={justReset.temporaryPassword} />
        )}

        {state.kind === "loaded" && state.admins.length === 0 && (
          <EmptyState title="No admins yet" description="Create the school's first admin below." />
        )}

        {state.kind === "loaded" && state.admins.length > 0 && (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Name</TableHeaderCell>
                <TableHeaderCell>Email</TableHeaderCell>
                <TableHeaderCell>Role</TableHeaderCell>
                <TableHeaderCell>Branch</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
                <TableHeaderCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {state.admins.map((admin) => (
                <TableRow key={admin.id}>
                  <TableCell>
                    {admin.firstName} {admin.lastName}
                  </TableCell>
                  <TableCell>{admin.email}</TableCell>
                  <TableCell>{admin.role}</TableCell>
                  <TableCell>{admin.branchName ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={USER_STATUS_VARIANT[admin.status]}>{admin.status}</Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="secondary" onClick={() => setPendingReset(admin)}>
                      Reset password
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {pendingReset && (
        <ConfirmDialog
          title="Reset this admin's password?"
          message={
            <>
              <strong>
                {pendingReset.firstName} {pendingReset.lastName}
              </strong>
              &apos;s current password stops working immediately and they're signed out of any active
              session. A new temporary password is shown once, here, for you to relay to them.
            </>
          }
          confirmLabel="Reset password"
          variant="danger"
          onConfirm={confirmReset}
          onClose={() => setPendingReset(null)}
        />
      )}
    </Card>
  );
}

type SubscriptionLoadState =
  | { kind: "loading" }
  | { kind: "none" }
  | { kind: "loaded"; subscription: SubscriptionView }
  | { kind: "error"; message: string };

type SubscriptionPendingAction = "suspend" | "cancel";

const SUBSCRIPTION_STATUS_VARIANT: Record<
  SubscriptionView["status"],
  "success" | "warning" | "danger" | "neutral"
> = {
  ACTIVE: "success",
  SUSPENDED: "warning",
  EXPIRED: "danger",
  CANCELLED: "neutral",
};

/**
 * The school's current subscription, plan/limit enforcement's system-admin
 * side: assign a package, and suspend/resume/cancel the live one. A school
 * with no subscription assigned is locked to read-only elsewhere in the
 * portal (see shared.config.SubscriptionWriteGuardFilter) - this card is
 * where a system admin fixes that.
 */
function SubscriptionCard({ schoolId }: { schoolId: string }) {
  const [state, setState] = useState<SubscriptionLoadState>({ kind: "loading" });
  const [assignOpen, setAssignOpen] = useState(false);
  const [pending, setPending] = useState<SubscriptionPendingAction | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  function fetchSubscription() {
    getCurrentSubscription(schoolId)
      .then((subscription) => setState({ kind: "loaded", subscription }))
      .catch((error: unknown) => {
        if (error instanceof ApiError && error.status === 404) {
          setState({ kind: "none" });
          return;
        }
        setState({
          kind: "error",
          message: error instanceof ApiError ? error.message : "Failed to load subscription",
        });
      });
  }

  // Only fetches - no synchronous setState here, so a schoolId change re-fetches without
  // an extra render; load() below (used after a mutation) resets to "loading" explicitly.
  useEffect(fetchSubscription, [schoolId]);

  function load() {
    setState({ kind: "loading" });
    fetchSubscription();
  }

  async function resume(subscriptionId: string) {
    setActionError(null);
    try {
      await resumeSubscription(schoolId, subscriptionId);
      load();
    } catch (error) {
      setActionError(error instanceof ApiError ? error.message : "That action failed");
    }
  }

  // Confirmation dialogs call this directly so a failure surfaces inside the
  // dialog (via ConfirmDialog's own error handling) rather than closing it.
  async function confirmAndRun(action: (schoolId: string, subscriptionId: string) => Promise<void>,
      subscriptionId: string) {
    await action(schoolId, subscriptionId);
    setPending(null);
    load();
  }

  return (
    <Card>
      <h2 className="text-sm font-semibold text-gray-900">Subscription</h2>

      {state.kind === "loading" && (
        <div className="mt-3 flex items-center gap-2 text-sm text-gray-500">
          <Spinner /> Loading…
        </div>
      )}
      {state.kind === "error" && (
        <Alert variant="error" className="mt-3">
          {state.message}
        </Alert>
      )}
      {actionError && (
        <Alert variant="error" className="mt-3">
          {actionError}
        </Alert>
      )}

      {state.kind === "none" && (
        <>
          <p className="mt-1 text-sm text-gray-500">
            No subscription has been assigned yet - this school's portal is read-only until one is.
          </p>
          <Button className="mt-3" onClick={() => setAssignOpen(true)}>
            Assign package
          </Button>
        </>
      )}

      {state.kind === "loaded" && (
        <>
          <div className="mt-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">{state.subscription.packageName}</p>
              <p className="text-sm text-gray-500">
                {formatDateRange(state.subscription.startDate, state.subscription.endDate)} (
                {state.subscription.daysRemaining} days left)
              </p>
            </div>
            <Badge variant={SUBSCRIPTION_STATUS_VARIANT[state.subscription.status]}>
              {state.subscription.status}
            </Badge>
          </div>
          <div className="mt-4 flex gap-2">
            <Button variant="secondary" onClick={() => setAssignOpen(true)}>
              Assign new package
            </Button>
            {state.subscription.status === "ACTIVE" && (
              <Button variant="secondary" onClick={() => setPending("suspend")}>
                Suspend
              </Button>
            )}
            {state.subscription.status === "SUSPENDED" && (
              <Button variant="secondary" onClick={() => resume(state.subscription.id)}>
                Resume
              </Button>
            )}
            {(state.subscription.status === "ACTIVE" || state.subscription.status === "SUSPENDED") && (
              <Button variant="danger" onClick={() => setPending("cancel")}>
                Cancel
              </Button>
            )}
          </div>
        </>
      )}

      {assignOpen && (
        <AssignSubscriptionModal
          schoolId={schoolId}
          onClose={() => setAssignOpen(false)}
          onAssigned={() => {
            setAssignOpen(false);
            load();
          }}
        />
      )}

      {pending === "suspend" && state.kind === "loaded" && (
        <ConfirmDialog
          title="Suspend this subscription?"
          message={<>The school's portal becomes read-only until the subscription is resumed.</>}
          confirmLabel="Suspend"
          onConfirm={() => confirmAndRun(suspendSubscription, state.subscription.id)}
          onClose={() => setPending(null)}
        />
      )}
      {pending === "cancel" && state.kind === "loaded" && (
        <ConfirmDialog
          title="Cancel this subscription?"
          message={
            <>
              The school's portal becomes read-only immediately. This can't be undone from here -
              assign a new package to restore access.
            </>
          }
          confirmLabel="Cancel subscription"
          variant="danger"
          onConfirm={() => confirmAndRun(cancelSubscription, state.subscription.id)}
          onClose={() => setPending(null)}
        />
      )}
    </Card>
  );
}

interface AssignSubscriptionModalProps {
  schoolId: string;
  onClose: () => void;
  onAssigned: () => void;
}

function AssignSubscriptionModal({ schoolId, onClose, onAssigned }: AssignSubscriptionModalProps) {
  const [packages, setPackages] = useState<PackageView[] | null>(null);
  const [packageId, setPackageId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listPackages(0, 100)
      .then((page) => {
        const active = page.content.filter((pkg) => pkg.status === "ACTIVE");
        setPackages(active);
        setPackageId(active[0]?.id ?? "");
      })
      .catch(() => setPackages([]));
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await assignSubscription(schoolId, {
        packageId,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });
      onAssigned();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to assign package");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Assign a package">
      <form className="space-y-4" onSubmit={handleSubmit}>
        {error && <Alert variant="error">{error}</Alert>}

        {packages === null && (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Spinner /> Loading packages…
          </div>
        )}
        {packages?.length === 0 && (
          <Alert variant="error">No active packages exist yet - create one first.</Alert>
        )}
        {packages !== null && packages.length > 0 && (
          <>
            <FormField label="Package" htmlFor="assign-package">
              <Select
                id="assign-package"
                required
                value={packageId}
                onChange={(event) => setPackageId(event.target.value)}
              >
                {packages.map((pkg) => (
                  <option key={pkg.id} value={pkg.id}>
                    {pkg.name}
                  </option>
                ))}
              </Select>
            </FormField>
            <p className="text-xs text-gray-500">
              Leave the dates blank to start today and run for the package's billing cycle.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Start date (optional)" htmlFor="assign-start-date">
                <Input
                  id="assign-start-date"
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                />
              </FormField>
              <FormField label="End date (optional)" htmlFor="assign-end-date">
                <Input
                  id="assign-end-date"
                  type="date"
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                />
              </FormField>
            </div>
          </>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting || !packages?.length}>
            {submitting ? "Assigning…" : "Assign"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
