import { Inbox } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { getErrorMessage } from "@/api/client";
import {
  type JoinRequest,
  type JoinRequestStatus,
  dismissJoinRequest,
  listJoinRequests,
  markJoinRequestAdded,
} from "@/api/joinRequests";
import { type LearnerRoster, addLearner, listLearners } from "@/api/learners";
import type { Page } from "@/api/types";
import { type VirtualClass, listVirtualClasses } from "@/api/virtualClasses";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { Select } from "@/components/ui/Select";
import { Spinner } from "@/components/ui/Spinner";
import { splitName } from "@/features/creators/publicProfile";
import { AddLearnerModal } from "@/features/virtualclass/components/AddLearnerModal";
import { useJoinRequestsPendingStore } from "@/stores/joinRequestsPendingStore";
import { formatInstant } from "@/utils/date";

type StatusFilter = JoinRequestStatus | "ALL";

const FILTER_LABELS: Record<StatusFilter, string> = {
  PENDING: "Pending",
  ADDED: "Added as learner",
  DISMISSED: "Dismissed",
  ALL: "All requests",
};

const STATUS_BADGES: Record<
  JoinRequestStatus,
  { label: string; variant: "warning" | "success" | "neutral" }
> = {
  PENDING: { label: "Pending", variant: "warning" },
  ADDED: { label: "Added", variant: "success" },
  DISMISSED: { label: "Dismissed", variant: "neutral" },
};

/**
 * The tutor's Join requests inbox - people who asked to join from the public profile page. "Add
 * as learner" opens the ordinary add-learner form, prefilled, and marks the request added once
 * the learner is saved.
 */
export function JoinRequestsPage() {
  const [filter, setFilter] = useState<StatusFilter>("PENDING");
  const [pageNumber, setPageNumber] = useState(0);
  const [page, setPage] = useState<Page<JoinRequest> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [adding, setAdding] = useState<{
    request: JoinRequest;
    roster: LearnerRoster;
    classes: VirtualClass[];
  } | null>(null);
  const refreshBadge = useJoinRequestsPendingStore((state) => state.refresh);

  const load = useCallback(() => {
    listJoinRequests(filter === "ALL" ? null : filter, pageNumber)
      .then((loaded) => {
        setPage(loaded);
        setError(null);
      })
      .catch((loadError: unknown) =>
        setError(getErrorMessage(loadError, "Failed to load join requests.")),
      );
  }, [filter, pageNumber]);

  useEffect(load, [load]);

  async function startAdding(request: JoinRequest) {
    setBusyId(request.id);
    setError(null);
    try {
      const [roster, classList] = await Promise.all([listLearners(), listVirtualClasses()]);
      setAdding({
        request,
        roster,
        classes: classList.classes.filter((c) => c.status === "ACTIVE" && !c.overLimit),
      });
    } catch (loadError) {
      setError(getErrorMessage(loadError, "Failed to open the add-learner form."));
    } finally {
      setBusyId(null);
    }
  }

  async function afterAdded(request: JoinRequest) {
    try {
      await markJoinRequestAdded(request.id);
      setNotice(`${request.name} was added as a learner.`);
    } catch (markError) {
      setError(
        getErrorMessage(
          markError,
          "The learner was added, but the request couldn't be marked as added.",
        ),
      );
    }
    void refreshBadge();
    load();
  }

  async function dismiss(request: JoinRequest) {
    setBusyId(request.id);
    setError(null);
    setNotice(null);
    try {
      await dismissJoinRequest(request.id);
      setNotice(`${request.name}'s request was dismissed.`);
      void refreshBadge();
      load();
    } catch (dismissError) {
      setError(getErrorMessage(dismissError, "Failed to dismiss the request."));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title="Join requests"
        description="People who asked to join your classes from your public profile page."
      />
      <div className="flex items-center gap-3">
        <label htmlFor="join-requests-filter" className="text-sm font-medium text-slate-700">
          Show
        </label>
        <Select
          id="join-requests-filter"
          className="w-48"
          value={filter}
          onChange={(event) => {
            setPage(null);
            setFilter(event.target.value as StatusFilter);
            setPageNumber(0);
          }}
        >
          {(Object.keys(FILTER_LABELS) as StatusFilter[]).map((key) => (
            <option key={key} value={key}>
              {FILTER_LABELS[key]}
            </option>
          ))}
        </Select>
      </div>
      {error && <Alert variant="error">{error}</Alert>}
      {notice && <Alert variant="success">{notice}</Alert>}
      {page === null && !error && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner /> Loading join requests…
        </div>
      )}
      {page && page.content.length === 0 && (
        <EmptyState
          icon={Inbox}
          title={filter === "PENDING" ? "No pending requests" : "No requests here"}
          description="Turn on “Accept join requests” on your public page and share its link to start receiving them."
          action={
            <Link
              to="/tutor/profile"
              className="text-sm font-medium text-brand-500 hover:text-brand-600"
            >
              Public page settings
            </Link>
          }
        />
      )}
      {page && page.content.length > 0 && (
        <ul className="space-y-3">
          {page.content.map((request) => (
            <li key={request.id}>
              <Card>
                <div className="space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900">{request.name}</p>
                      <p className="text-sm text-slate-500">
                        <a
                          href={`mailto:${request.email}`}
                          className="text-brand-500 hover:text-brand-600"
                        >
                          {request.email}
                        </a>
                        {request.phone && (
                          <>
                            {" · "}
                            <a
                              href={`tel:${request.phone}`}
                              className="text-brand-500 hover:text-brand-600"
                            >
                              {request.phone}
                            </a>
                          </>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400">
                        {formatInstant(request.updatedAt)}
                      </span>
                      <Badge variant={STATUS_BADGES[request.status].variant}>
                        {STATUS_BADGES[request.status].label}
                      </Badge>
                    </div>
                  </div>
                  {request.message && (
                    <p className="whitespace-pre-line rounded-md bg-slate-50 p-3 text-sm text-slate-700">
                      {request.message}
                    </p>
                  )}
                  {request.status === "PENDING" && (
                    <div className="flex flex-wrap gap-2">
                      <Button loading={busyId === request.id} onClick={() => startAdding(request)}>
                        Add as learner
                      </Button>
                      <Button
                        variant="secondary"
                        disabled={busyId === request.id}
                        onClick={() => dismiss(request)}
                      >
                        Dismiss
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
      {page && (
        <Pagination
          page={page}
          onPageChange={(next) => {
            setPage(null);
            setPageNumber(next);
          }}
        />
      )}
      {adding && (
        <AddLearnerModal
          guardianAccess={adding.roster.guardianAccess}
          classes={adding.classes}
          initial={{ ...splitName(adding.request.name), email: adding.request.email }}
          onClose={() => setAdding(null)}
          onSubmit={async (input) => {
            const result = await addLearner(input);
            void afterAdded(adding.request);
            return result;
          }}
        />
      )}
    </div>
  );
}
