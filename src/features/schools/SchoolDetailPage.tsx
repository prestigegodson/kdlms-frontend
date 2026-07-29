import { type FormEvent, useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { ApiError } from "@/api/client";
import {
  activateSchool,
  archiveSchool,
  getSchool,
  type SchoolView,
  suspendSchool,
} from "@/api/schools";
import { createSchoolAdmin, type CreateUserResult } from "@/api/users";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Spinner";

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
              {state.school.status !== "ACTIVE" && (
                <Button variant="secondary" onClick={() => runAction(activateSchool)}>
                  Activate
                </Button>
              )}
              {state.school.status === "ACTIVE" && (
                <Button variant="secondary" onClick={() => runAction(suspendSchool)}>
                  Suspend
                </Button>
              )}
              {state.school.status !== "ARCHIVED" && (
                <Button variant="secondary" onClick={() => runAction(archiveSchool)}>
                  Archive
                </Button>
              )}
            </div>
          </Card>

          <CreateSchoolAdminCard schoolId={state.school.id} />
        </>
      )}
    </div>
  );
}

function CreateSchoolAdminCard({ schoolId }: { schoolId: string }) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreateUserResult | null>(null);
  const [copied, setCopied] = useState(false);

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
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create school admin");
    } finally {
      setSubmitting(false);
    }
  }

  async function copyPassword() {
    if (!created) return;
    await navigator.clipboard.writeText(created.temporaryPassword);
    setCopied(true);
  }

  return (
    <Card>
      <h2 className="text-sm font-semibold text-gray-900">Create a school admin</h2>
      <p className="mt-1 text-sm text-gray-500">
        The temporary password is shown once, here, and is never retrievable again - copy it to the
        new admin now.
      </p>

      {created && (
        <Alert variant="success" className="mt-4">
          <p>
            Created <strong>{created.user.email}</strong>. Temporary password:{" "}
            <code className="rounded bg-white px-1.5 py-0.5">{created.temporaryPassword}</code>
          </p>
          <Button type="button" variant="secondary" className="mt-2" onClick={copyPassword}>
            {copied ? "Copied!" : "Copy password"}
          </Button>
        </Alert>
      )}

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
