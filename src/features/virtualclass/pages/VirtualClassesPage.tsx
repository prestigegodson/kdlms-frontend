import { Plus, Presentation } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { getErrorMessage } from "@/api/client";
import {
  type VirtualClassList,
  createVirtualClass,
  listVirtualClasses,
} from "@/api/virtualClasses";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Spinner } from "@/components/ui/Spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/ui/Table";
import { Tabs } from "@/components/ui/Tabs";
import { ClassFormModal } from "../components/ClassFormModal";
import { dateInZone, scheduleSummary } from "../scheduleUtils";

type Filter = "ACTIVE" | "ARCHIVED";

/** The creator's virtual classes (creators.md Phase C4), with the plan's class limit explained. */
export function VirtualClassesPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<VirtualClassList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("ACTIVE");
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => {
    listVirtualClasses()
      .then((list) => {
        setData(list);
        setError(null);
      })
      .catch((loadError: unknown) =>
        setError(getErrorMessage(loadError, "Failed to load your classes.")),
      );
  }, []);

  useEffect(load, [load]);

  const timezone = data?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const atLimit = data !== null && data.maxClasses !== null && data.activeCount >= data.maxClasses;
  const anyOverLimit = data?.classes.some((c) => c.overLimit) ?? false;
  const shown = data?.classes.filter((c) => c.status === filter) ?? [];
  const archivedCount = data?.classes.filter((c) => c.status === "ARCHIVED").length ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Classes"
        description="Your virtual classes and their weekly schedules."
        actions={
          <Button onClick={() => setCreating(true)} disabled={data === null || atLimit}>
            <Plus className="h-4 w-4" /> New class
          </Button>
        }
      />
      {error && <Alert variant="error">{error}</Alert>}
      {data === null && !error && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner /> Loading classes…
        </div>
      )}
      {data && (
        <>
          {data.maxClasses !== null && (
            <p className="text-sm text-slate-600">
              {data.activeCount} of {data.maxClasses} active{" "}
              {data.maxClasses === 1 ? "class" : "classes"} on your plan.
              {atLimit && " Archive a class or upgrade your plan to add another."}
            </p>
          )}
          {anyOverLimit && (
            <Alert variant="warning" title="Some classes are over your plan's limit">
              Classes marked “Over plan limit” are read-only and can't hold sessions. Your oldest
              classes stay live; archive one you no longer need to free its place, or upgrade your
              plan.
            </Alert>
          )}
          {archivedCount > 0 && (
            <Tabs
              ariaLabel="Class status"
              value={filter}
              onChange={setFilter}
              items={[
                { value: "ACTIVE", label: "Active" },
                { value: "ARCHIVED", label: "Archived", badge: archivedCount },
              ]}
            />
          )}
          {shown.length === 0 ? (
            <EmptyState
              icon={Presentation}
              title={filter === "ACTIVE" ? "No classes yet" : "No archived classes"}
              description={
                filter === "ACTIVE"
                  ? "Create a class, then give it a weekly schedule."
                  : "Archived classes appear here."
              }
              action={
                filter === "ACTIVE" && !atLimit ? (
                  <Button onClick={() => setCreating(true)}>
                    <Plus className="h-4 w-4" /> New class
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Class</TableHeaderCell>
                  <TableHeaderCell>Weekly schedule</TableHeaderCell>
                  <TableHeaderCell>Status</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {shown.map((virtualClass) => (
                  <TableRow key={virtualClass.id} to={`/creator/classes/${virtualClass.id}`}>
                    <TableCell label="Class">
                      <div className="font-medium text-slate-900">{virtualClass.name}</div>
                      {virtualClass.subjectLabel && (
                        <div className="text-xs text-slate-500">{virtualClass.subjectLabel}</div>
                      )}
                    </TableCell>
                    <TableCell label="Weekly schedule" className="text-slate-600">
                      {virtualClass.slots.length > 0
                        ? scheduleSummary(virtualClass.slots)
                        : "Not scheduled yet"}
                    </TableCell>
                    <TableCell label="Status">
                      {virtualClass.status === "ARCHIVED" ? (
                        <Badge>Archived</Badge>
                      ) : virtualClass.overLimit ? (
                        <Badge variant="warning">Over plan limit</Badge>
                      ) : (
                        <Badge variant="success">Active</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </>
      )}
      {creating && (
        <ClassFormModal
          existing={null}
          defaultStartDate={dateInZone(new Date(), timezone)}
          onClose={() => setCreating(false)}
          onSubmit={async (input) => {
            const created = await createVirtualClass(input);
            navigate(`/creator/classes/${created.id}`);
          }}
        />
      )}
    </div>
  );
}
