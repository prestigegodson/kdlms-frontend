import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { getErrorMessage } from "@/api/client";
import {
  type ContactEnquiryStatus,
  type ContactEnquiryView,
  deleteContactEnquiry,
  getContactEnquiry,
  setContactEnquiryStatus,
} from "@/api/contactEnquiries";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { PageHeader } from "@/components/ui/PageHeader";
import { Spinner } from "@/components/ui/Spinner";
import { useContactEnquiriesUnreadStore } from "@/stores/contactEnquiriesUnreadStore";
import { formatInstant } from "@/utils/date";
import { ENQUIRY_STATUS_LABEL, ENQUIRY_STATUS_VARIANT } from "./enquiryStatus";

const BACK_TO = "/admin/enquiries";

type State =
  | { kind: "loading" }
  | { kind: "loaded"; enquiry: ContactEnquiryView }
  | { kind: "error"; message: string };

/** One "contact us" enquiry. Opening a new one marks it read. */
export function EnquiryDetailPage() {
  const { enquiryId } = useParams<{ enquiryId: string }>();
  const navigate = useNavigate();
  const refreshUnread = useContactEnquiriesUnreadStore((store) => store.refresh);
  const [state, setState] = useState<State>({ kind: "loading" });
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!enquiryId) return;
    let cancelled = false;
    (async () => {
      try {
        let enquiry = await getContactEnquiry(enquiryId);
        if (enquiry.status === "NEW") {
          enquiry = await setContactEnquiryStatus(enquiryId, "READ");
          void refreshUnread();
        }
        if (!cancelled) setState({ kind: "loaded", enquiry });
      } catch (caught) {
        if (!cancelled)
          setState({
            kind: "error",
            message: getErrorMessage(caught, "Failed to load the enquiry"),
          });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enquiryId, refreshUnread]);

  async function changeStatus(status: ContactEnquiryStatus) {
    if (!enquiryId) return;
    setActionError(null);
    setBusy(true);
    try {
      const enquiry = await setContactEnquiryStatus(enquiryId, status);
      setState({ kind: "loaded", enquiry });
      void refreshUnread();
    } catch (caught) {
      setActionError(getErrorMessage(caught, "Couldn't update the enquiry."));
    } finally {
      setBusy(false);
    }
  }

  if (state.kind !== "loaded") {
    return (
      <div className="space-y-6">
        <PageHeader title="Enquiry" backTo={BACK_TO} />
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

  const { enquiry } = state;

  return (
    <div className="space-y-6">
      <PageHeader
        title={enquiry.schoolName}
        description={`Received ${formatInstant(enquiry.createdAt)}`}
        backTo={BACK_TO}
        actions={
          <Badge variant={ENQUIRY_STATUS_VARIANT[enquiry.status]}>
            {ENQUIRY_STATUS_LABEL[enquiry.status]}
          </Badge>
        }
      />

      {actionError && <Alert variant="error">{actionError}</Alert>}

      <Card>
        <h2 className="text-sm font-semibold text-slate-900">Contact</h2>
        <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-2 text-sm sm:grid-cols-[10rem_1fr]">
          <dt className="text-slate-500">Contact person</dt>
          <dd className="text-slate-900">{enquiry.contactPersonName ?? "—"}</dd>
          <dt className="text-slate-500">Phone</dt>
          <dd>
            <a className="text-brand-700 hover:underline" href={`tel:${enquiry.contactPhone}`}>
              {enquiry.contactPhone}
            </a>
          </dd>
          <dt className="text-slate-500">Email</dt>
          <dd>
            {enquiry.contactEmail ? (
              <a
                className="break-all text-brand-700 hover:underline"
                href={`mailto:${enquiry.contactEmail}`}
              >
                {enquiry.contactEmail}
              </a>
            ) : (
              <span className="text-slate-900">—</span>
            )}
          </dd>
          <dt className="text-slate-500">Address</dt>
          <dd className="whitespace-pre-wrap text-slate-900">{enquiry.address ?? "—"}</dd>
        </dl>
      </Card>

      <Card>
        <h2 className="text-sm font-semibold text-slate-900">Message</h2>
        {enquiry.message ? (
          <p className="mt-3 whitespace-pre-wrap break-words text-sm text-slate-700">
            {enquiry.message}
          </p>
        ) : (
          <p className="mt-3 text-sm text-slate-500">No message was included.</p>
        )}
      </Card>

      <div className="flex flex-wrap gap-2">
        {enquiry.status === "RESOLVED" ? (
          <Button variant="secondary" disabled={busy} onClick={() => void changeStatus("READ")}>
            Reopen
          </Button>
        ) : (
          <Button disabled={busy} onClick={() => void changeStatus("RESOLVED")}>
            Mark resolved
          </Button>
        )}
        {enquiry.status !== "NEW" && (
          <Button variant="secondary" disabled={busy} onClick={() => void changeStatus("NEW")}>
            Mark unread
          </Button>
        )}
        <Button variant="danger" disabled={busy} onClick={() => setConfirmDelete(true)}>
          Delete
        </Button>
      </div>

      {confirmDelete && (
        <ConfirmDialog
          title="Delete this enquiry?"
          message={
            <>
              The enquiry from <strong>{enquiry.schoolName}</strong> will be removed for good.
            </>
          }
          confirmLabel="Delete"
          variant="danger"
          onConfirm={async () => {
            await deleteContactEnquiry(enquiry.id);
            void refreshUnread();
            navigate(BACK_TO);
          }}
          onClose={() => setConfirmDelete(false)}
        />
      )}
    </div>
  );
}
