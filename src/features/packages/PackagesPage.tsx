import { useEffect, useState } from "react";
import {
  createPackage,
  listPackages,
  type PackageAudience,
  type PackageView,
  reactivatePackage,
  retirePackage,
  updatePackage,
} from "@/api/packages";
import { ApiError } from "@/api/client";
import { Package } from "lucide-react";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
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
import { formatMoney, fromMinor } from "@/utils/currency";
import { PackageFormModal } from "./components/PackageFormModal";

type ListState =
  | { kind: "loading" }
  | { kind: "loaded"; packages: PackageView[] }
  | { kind: "error"; message: string };

const AUDIENCE_TABS: Array<{ value: PackageAudience; label: string }> = [
  { value: "SCHOOL", label: "School" },
  { value: "CREATOR", label: "Creator" },
];

/** A limit cell: `null` is unlimited. */
function limitText(limit: number | null): string {
  return limit == null ? "Unlimited" : String(limit);
}

/**
 * System-admin package catalogue: list, create, edit, and retire/reactivate plans - school
 * packages and creator plans on their own tabs (creators Phase C3).
 */
export function PackagesPage() {
  const [audience, setAudience] = useState<PackageAudience>("SCHOOL");
  const [state, setState] = useState<ListState>({ kind: "loading" });
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<PackageView | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  function fetchPackages(forAudience: PackageAudience) {
    listPackages(0, 100, forAudience)
      .then((page) => setState({ kind: "loaded", packages: page.content }))
      .catch((error: unknown) =>
        setState({
          kind: "error",
          message: error instanceof ApiError ? error.message : "Failed to load packages",
        }),
      );
  }

  // Mount-only fetch: the initial state above is already "loading", so no synchronous
  // setState is needed here - only load() (used by user-triggered reloads below) resets it.
  useEffect(() => fetchPackages("SCHOOL"), []);

  function load(forAudience: PackageAudience = audience) {
    setState({ kind: "loading" });
    fetchPackages(forAudience);
  }

  function switchAudience(next: PackageAudience) {
    setAudience(next);
    setActionError(null);
    load(next);
  }

  async function toggleStatus(pkg: PackageView) {
    setActionError(null);
    try {
      if (pkg.status === "ACTIVE") {
        await retirePackage(pkg.id);
      } else {
        await reactivatePackage(pkg.id);
      }
      load();
    } catch (error) {
      setActionError(error instanceof ApiError ? error.message : "That action failed");
    }
  }

  const isCreator = audience === "CREATOR";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Packages"
        description="Plans schools and education creators can subscribe to."
        actions={<Button onClick={() => setCreateOpen(true)}>{isCreator ? "Add creator plan" : "Add package"}</Button>}
      />

      <Tabs ariaLabel="Package audience" value={audience} onChange={switchAudience} items={AUDIENCE_TABS} />

      {actionError && <Alert variant="error">{actionError}</Alert>}

      {state.kind === "loading" && (
        <Card className="p-0">
          <TableSkeleton columns={8} />
        </Card>
      )}
      {state.kind === "error" && <Alert variant="error">{state.message}</Alert>}
      {state.kind === "loaded" && state.packages.length === 0 && (
        <EmptyState
          icon={Package}
          title={isCreator ? "No creator plans yet" : "No packages yet"}
          description="Create one to get started."
        />
      )}
      {state.kind === "loaded" && state.packages.length > 0 && (
        <Card className="p-0">
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Name</TableHeaderCell>
                <TableHeaderCell>Billing</TableHeaderCell>
                <TableHeaderCell numeric>Price</TableHeaderCell>
                {isCreator ? (
                  <>
                    <TableHeaderCell>Classes</TableHeaderCell>
                    <TableHeaderCell>Learners per class</TableHeaderCell>
                  </>
                ) : (
                  <>
                    <TableHeaderCell>Branch limit</TableHeaderCell>
                    <TableHeaderCell>Student limit</TableHeaderCell>
                  </>
                )}
                <TableHeaderCell>Features</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
                <TableHeaderCell>Actions</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {state.packages.map((pkg) => (
                <TableRow key={pkg.id}>
                  <TableCell label="Name" className="font-medium text-slate-900">
                    {pkg.name}
                  </TableCell>
                  <TableCell label="Billing">{pkg.billingCycle}</TableCell>
                  <TableCell label="Price" numeric>
                    {pkg.free ? (
                      <Badge variant="success">Free</Badge>
                    ) : (
                      <div className="flex flex-col items-end gap-0.5">
                        {pkg.prices.map((price) => (
                          <span key={price.currency}>{formatMoney(fromMinor(price.amountMinor), price.currency)}</span>
                        ))}
                      </div>
                    )}
                  </TableCell>
                  {isCreator ? (
                    <>
                      <TableCell label="Classes">{limitText(pkg.maxClasses)}</TableCell>
                      <TableCell label="Learners per class">{limitText(pkg.maxStudentsPerClass)}</TableCell>
                    </>
                  ) : (
                    <>
                      <TableCell label="Branch limit">
                        {pkg.multiBranch ? pkg.branchLimit : "1 (single branch)"}
                      </TableCell>
                      <TableCell label="Student limit">{pkg.activeStudentLimit}</TableCell>
                    </>
                  )}
                  <TableCell label="Features">
                    <div className="flex flex-wrap justify-end gap-1 sm:justify-start">
                      {pkg.onDemandLearning && <Badge variant="neutral">Learning</Badge>}
                      {pkg.communication && <Badge variant="brand">Messaging</Badge>}
                      {pkg.timetable && <Badge variant="brand">Timetables</Badge>}
                      {pkg.lessonNotes && <Badge variant="brand">Lesson notes</Badge>}
                      {pkg.takeHomeQuiz && <Badge variant="brand">CBT/Quizzes</Badge>}
                      {pkg.aiLessonNotes && <Badge variant="brand">AI lesson notes</Badge>}
                      {pkg.billing && <Badge variant="brand">Fees & bills</Badge>}
                      {pkg.learningMedia && <Badge variant="neutral">Learning media</Badge>}
                      {pkg.studentLogins && <Badge variant="neutral">Student logins</Badge>}
                      {pkg.guardianAccess && <Badge variant="neutral">Guardian access</Badge>}
                    </div>
                  </TableCell>
                  <TableCell label="Status">
                    <Badge variant={pkg.status === "ACTIVE" ? "success" : "neutral"}>{pkg.status}</Badge>
                  </TableCell>
                  <TableCell label="Actions">
                    <div className="flex justify-end gap-3 sm:justify-start">
                      <button
                        type="button"
                        className="inline-flex mobile:min-h-11 items-center px-1 text-brand-500 hover:text-brand-600"
                        onClick={() => setEditing(pkg)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="inline-flex mobile:min-h-11 items-center px-1 text-slate-500 hover:text-slate-700"
                        onClick={() => toggleStatus(pkg)}
                      >
                        {pkg.status === "ACTIVE" ? "Retire" : "Reactivate"}
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Rendered only while open, rather than always-mounted with an open flag - a fresh
          mount picks up `initial` naturally, with no reset-on-open effect required. */}
      {createOpen && (
        <PackageFormModal
          title={isCreator ? "Add creator plan" : "Add package"}
          audience={audience}
          onClose={() => setCreateOpen(false)}
          onSubmit={async (values) => {
            await createPackage(values);
          }}
          onSaved={() => {
            setCreateOpen(false);
            load();
          }}
        />
      )}
      {editing && (
        <PackageFormModal
          key={editing.id}
          title={editing.audience === "CREATOR" ? "Edit creator plan" : "Edit package"}
          audience={editing.audience}
          initial={editing}
          onClose={() => setEditing(null)}
          onSubmit={async (values) => {
            await updatePackage(editing.id, values);
          }}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}
