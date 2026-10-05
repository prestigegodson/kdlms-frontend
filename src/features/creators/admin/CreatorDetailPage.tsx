import { useEffect, useState } from "react";
import { useParams } from "react-router";
import { ApiError } from "@/api/client";
import { type CreatorAdminView, getCreator } from "@/api/creators";
import { activateSchool, suspendSchool } from "@/api/schools";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { PageHeader } from "@/components/ui/PageHeader";
import { Spinner } from "@/components/ui/Spinner";
import { CREATOR_STATUS_VARIANT } from "@/features/creators/admin/creatorStatus";
import { ImpersonateDialog } from "@/features/schools/components/ImpersonateDialog";
import { SubscriptionCard } from "@/features/schools/SchoolDetailPage";
import { formatInstant } from "@/utils/date";

type LoadState =
  | { kind: "loading" }
  | { kind: "loaded"; creator: CreatorAdminView }
  | { kind: "error"; message: string };

/**
 * System-admin view of one creator: profile, suspend/resume, subscription, and impersonation.
 * A creator's tenant id is a school id, so suspend/activate, the subscription card, and
 * impersonation all reuse the school endpoints unchanged.
 */
export function CreatorDetailPage() {
  const { schoolId } = useParams<{ schoolId: string }>();
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmSuspend, setConfirmSuspend] = useState(false);
  const [impersonating, setImpersonating] = useState(false);

  function fetchCreator() {
    if (!schoolId) return;
    getCreator(schoolId)
      .then((creator) => setState({ kind: "loaded", creator }))
      .catch((error: unknown) =>
        setState({ kind: "error", message: error instanceof ApiError ? error.message : "Failed to load creator" }),
      );
  }

  useEffect(fetchCreator, [schoolId]);

  function load() {
    setState({ kind: "loading" });
    fetchCreator();
  }

  async function activate() {
    if (!schoolId) return;
    setActionError(null);
    try {
      await activateSchool(schoolId);
      load();
    } catch (error) {
      setActionError(error instanceof ApiError ? error.message : "That action failed");
    }
  }

  if (state.kind !== "loaded") {
    return (
      <div className="space-y-6">
        <PageHeader title="Creator" backTo="/admin/creators" />
        {state.kind === "loading" ? (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Spinner /> Loading…
          </div>
        ) : (
          <Alert variant="error">{state.message}</Alert>
        )}
      </div>
    );
  }

  const { creator } = state;

  return (
    <div className="space-y-6">
      <PageHeader
        title={creator.businessName}
        description={`${creator.firstName} ${creator.lastName}`}
        backTo="/admin/creators"
        actions={<Badge variant={CREATOR_STATUS_VARIANT[creator.status]}>{creator.status}</Badge>}
      />

      {actionError && <Alert variant="error">{actionError}</Alert>}

      <Card>
        <h2 className="text-sm font-semibold text-slate-900">Profile</h2>
        <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
          <dt className="text-slate-500">Login email</dt>
          <dd className="text-slate-900">
            {creator.email ?? "—"}{" "}
            {creator.emailVerified ? (
              <Badge variant="success">Verified</Badge>
            ) : (
              <Badge variant="warning">Unverified</Badge>
            )}
          </dd>
          <dt className="text-slate-500">Mobile</dt>
          <dd className="text-slate-900">{creator.mobile}</dd>
          <dt className="text-slate-500">Address</dt>
          <dd className="text-slate-900">{creator.contactAddress}</dd>
          <dt className="text-slate-500">Timezone</dt>
          <dd className="text-slate-900">{creator.timezone}</dd>
          <dt className="text-slate-500">Currency</dt>
          <dd className="text-slate-900">{creator.currency}</dd>
          <dt className="text-slate-500">Joined</dt>
          <dd className="text-slate-900">{formatInstant(creator.createdAt)}</dd>
        </dl>
        <div className="mt-4 flex flex-wrap gap-2">
          {creator.status === "SUSPENDED" && (
            <Button variant="secondary" onClick={activate}>
              Resume
            </Button>
          )}
          {creator.status === "ACTIVE" && (
            <Button variant="secondary" onClick={() => setConfirmSuspend(true)}>
              Suspend
            </Button>
          )}
          {creator.status === "ACTIVE" && creator.userId && creator.email && (
            <Button variant="secondary" onClick={() => setImpersonating(true)}>
              Impersonate
            </Button>
          )}
        </div>
      </Card>

      <SubscriptionCard schoolId={creator.schoolId} audience="CREATOR" />

      {confirmSuspend && (
        <ConfirmDialog
          title="Suspend this creator?"
          message={
            <>
              <strong>{creator.businessName}</strong> will lose access to the creator portal until resumed. This
              does not affect their data.
            </>
          }
          confirmLabel="Suspend"
          onConfirm={async () => {
            await suspendSchool(creator.schoolId);
            setConfirmSuspend(false);
            load();
          }}
          onClose={() => setConfirmSuspend(false)}
        />
      )}

      {impersonating && creator.userId && creator.email && (
        <ImpersonateDialog
          schoolId={creator.schoolId}
          admin={{
            id: creator.userId,
            firstName: creator.firstName,
            lastName: creator.lastName,
            email: creator.email,
          }}
          portalLabel="creator portal"
          onClose={() => setImpersonating(false)}
        />
      )}
    </div>
  );
}
