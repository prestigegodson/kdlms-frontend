import { Inbox } from "lucide-react";
import { useEffect, useState } from "react";
import { getErrorMessage } from "@/api/client";
import {
  type ContactEnquiryStatus,
  type ContactEnquiryView,
  listContactEnquiries,
} from "@/api/contactEnquiries";
import type { Page } from "@/api/types";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { SearchInput } from "@/components/ui/SearchInput";
import { StickySubHeader } from "@/components/ui/StickySubHeader";
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
import { useContactEnquiriesUnreadStore } from "@/stores/contactEnquiriesUnreadStore";
import { formatInstant } from "@/utils/date";
import { ENQUIRY_STATUS_LABEL, ENQUIRY_STATUS_VARIANT } from "./enquiryStatus";

const PAGE_SIZE = 20;

type Filter = ContactEnquiryStatus | "ALL";

type State =
  | { kind: "loading" }
  | { kind: "loaded"; page: Page<ContactEnquiryView> }
  | { kind: "error"; message: string };

/** The system admin's inbox of "contact us" enquiries from the public website, newest first. */
export function EnquiriesPage() {
  const unread = useContactEnquiriesUnreadStore((store) => store.count);
  const [filter, setFilter] = useState<Filter>("NEW");
  const [query, setQuery] = useState("");
  const [pageIndex, setPageIndex] = useState(0);
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    listContactEnquiries(query, filter === "ALL" ? "" : filter, pageIndex, PAGE_SIZE)
      .then((page) => {
        if (!cancelled) setState({ kind: "loaded", page });
      })
      .catch((caught: unknown) => {
        if (!cancelled)
          setState({ kind: "error", message: getErrorMessage(caught, "Failed to load enquiries") });
      });
    return () => {
      cancelled = true;
    };
  }, [query, filter, pageIndex]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Enquiries"
        description="Messages sent through the contact form on the KDLMS website."
      />

      <Tabs<Filter>
        ariaLabel="Enquiry status"
        value={filter}
        onChange={(next) => {
          setFilter(next);
          setPageIndex(0);
        }}
        items={[
          { value: "NEW", label: "New", badge: unread },
          { value: "READ", label: "Read" },
          { value: "RESOLVED", label: "Resolved" },
          { value: "ALL", label: "All" },
        ]}
      />

      <StickySubHeader>
        <SearchInput
          value={query}
          onChange={(next) => {
            setQuery(next);
            setPageIndex(0);
          }}
          placeholder="Search by school, person, email or phone"
          className="w-full sm:w-80"
        />
      </StickySubHeader>

      {state.kind === "loading" && (
        <Card className="p-0">
          <TableSkeleton columns={5} />
        </Card>
      )}
      {state.kind === "error" && <Alert variant="error">{state.message}</Alert>}
      {state.kind === "loaded" && state.page.content.length === 0 && (
        <EmptyState
          icon={Inbox}
          title="No enquiries"
          description={
            query
              ? "No enquiries match your search."
              : filter === "NEW"
                ? "You're all caught up."
                : "Enquiries from the website's contact form will appear here."
          }
        />
      )}
      {state.kind === "loaded" && state.page.content.length > 0 && (
        <>
          <Card className="p-0">
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>School</TableHeaderCell>
                  <TableHeaderCell>Contact</TableHeaderCell>
                  <TableHeaderCell>Received</TableHeaderCell>
                  <TableHeaderCell>Status</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {state.page.content.map((enquiry) => (
                  <TableRow key={enquiry.id} to={`/admin/enquiries/${enquiry.id}`}>
                    <TableCell label="School">
                      <span
                        className={
                          enquiry.status === "NEW"
                            ? "font-semibold text-slate-900"
                            : "font-medium text-slate-900"
                        }
                      >
                        {enquiry.schoolName}
                      </span>
                      {enquiry.message && (
                        <p className="line-clamp-1 max-w-md text-xs text-slate-500">
                          {enquiry.message}
                        </p>
                      )}
                    </TableCell>
                    <TableCell label="Contact">
                      {enquiry.contactPersonName && (
                        <p className="text-slate-900">{enquiry.contactPersonName}</p>
                      )}
                      <p className="text-xs text-slate-500">
                        {[enquiry.contactPhone, enquiry.contactEmail].filter(Boolean).join(" · ")}
                      </p>
                    </TableCell>
                    <TableCell label="Received" className="text-sm text-slate-600">
                      {formatInstant(enquiry.createdAt)}
                    </TableCell>
                    <TableCell label="Status">
                      <Badge variant={ENQUIRY_STATUS_VARIANT[enquiry.status]}>
                        {ENQUIRY_STATUS_LABEL[enquiry.status]}
                      </Badge>
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
