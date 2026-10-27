import { Mail } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { getErrorMessage } from "@/api/client";
import {
  listNewsletters,
  type NewsletterStatus,
  type NewsletterSummaryView,
} from "@/api/newsletters";
import type { Page } from "@/api/types";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/ui/Table";
import { TableSkeleton } from "@/components/ui/TableSkeleton";
import { Tabs } from "@/components/ui/Tabs";
import { formatInstant } from "@/utils/date";
import {
  describeAudience,
  NEWSLETTER_STATUS_LABEL,
  NEWSLETTER_STATUS_VARIANT,
} from "./newsletterContent";

const PAGE_SIZE = 20;

type Filter = NewsletterStatus | "ALL";

type State =
  | { kind: "loading" }
  | { kind: "loaded"; page: Page<NewsletterSummaryView> }
  | { kind: "error"; message: string };

/** The date that matters for a row: when it went or will go out, else when it was last edited. */
function whenText(newsletter: NewsletterSummaryView): string {
  switch (newsletter.status) {
    case "SCHEDULED":
      return `Goes out ${formatInstant(newsletter.scheduledAt)}`;
    case "SENDING":
    case "SENT":
      return `Sent ${formatInstant(newsletter.startedAt)}`;
    case "CANCELLED":
      return `Cancelled ${formatInstant(newsletter.completedAt)}`;
    default:
      return `Edited ${formatInstant(newsletter.updatedAt)}`;
  }
}

/** The system admin's newsletters to school admins, creators and other addresses - newest first. */
export function NewslettersPage() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Filter>("ALL");
  const [pageIndex, setPageIndex] = useState(0);
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    listNewsletters(filter === "ALL" ? "" : filter, pageIndex, PAGE_SIZE)
      .then((page) => {
        if (!cancelled) setState({ kind: "loaded", page });
      })
      .catch((caught: unknown) => {
        if (!cancelled)
          setState({
            kind: "error",
            message: getErrorMessage(caught, "Failed to load newsletters"),
          });
      });
    return () => {
      cancelled = true;
    };
  }, [filter, pageIndex]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Newsletters"
        description="Email school admins, tutors and anyone else on your list."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              to="/admin/newsletters/unsubscribed"
              className="inline-flex items-center px-1 text-sm text-slate-600 hover:text-slate-900 mobile:min-h-11"
            >
              Unsubscribed
            </Link>
            <Button onClick={() => navigate("/admin/newsletters/new")}>New newsletter</Button>
          </div>
        }
      />

      <Tabs<Filter>
        ariaLabel="Newsletter status"
        value={filter}
        onChange={(next) => {
          setFilter(next);
          setPageIndex(0);
          setState({ kind: "loading" });
        }}
        items={[
          { value: "ALL", label: "All" },
          { value: "DRAFT", label: "Drafts" },
          { value: "SCHEDULED", label: "Scheduled" },
          { value: "SENT", label: "Sent" },
        ]}
      />

      {state.kind === "loading" && (
        <Card className="p-0">
          <TableSkeleton columns={4} />
        </Card>
      )}
      {state.kind === "error" && <Alert variant="error">{state.message}</Alert>}
      {state.kind === "loaded" && state.page.content.length === 0 && (
        <EmptyState
          icon={Mail}
          title="No newsletters"
          description={
            filter === "ALL" ? "Create your first newsletter to get started." : "Nothing here yet."
          }
        />
      )}
      {state.kind === "loaded" && state.page.content.length > 0 && (
        <>
          <Card className="p-0">
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Subject</TableHeaderCell>
                  <TableHeaderCell>Status</TableHeaderCell>
                  <TableHeaderCell>When</TableHeaderCell>
                  <TableHeaderCell numeric>Delivered</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {state.page.content.map((newsletter) => (
                  <TableRow key={newsletter.id} to={`/admin/newsletters/${newsletter.id}`}>
                    <TableCell label="Subject">
                      <span className="font-medium text-slate-900">{newsletter.subject}</span>
                      <p className="text-xs text-slate-500">
                        {describeAudience(newsletter.audience)}
                      </p>
                    </TableCell>
                    <TableCell label="Status">
                      <Badge variant={NEWSLETTER_STATUS_VARIANT[newsletter.status]}>
                        {NEWSLETTER_STATUS_LABEL[newsletter.status]}
                      </Badge>
                    </TableCell>
                    <TableCell label="When" className="text-sm text-slate-600">
                      {whenText(newsletter)}
                    </TableCell>
                    <TableCell label="Delivered" numeric>
                      {newsletter.status === "DRAFT" || newsletter.status === "SCHEDULED" ? (
                        <span className="text-slate-400">—</span>
                      ) : (
                        <span>
                          {newsletter.sentCount.toLocaleString()} /{" "}
                          {newsletter.recipientCount.toLocaleString()}
                          {newsletter.failedCount > 0 && (
                            <span className="ml-1 text-xs text-red-600">
                              ({newsletter.failedCount} failed)
                            </span>
                          )}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
          <Pagination page={state.page} onPageChange={setPageIndex} />
        </>
      )}
    </div>
  );
}
