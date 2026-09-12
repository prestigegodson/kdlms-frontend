import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import {
  deleteTransportRoute,
  getTransportFareGrid,
  getTransportRiders,
  listTransportRoutes,
  type TransportFareGridView,
  type TransportRidersView,
  type TransportRouteView,
} from "@/api/billing";
import { ApiError } from "@/api/client";
import { listClasses, type SchoolClassView } from "@/api/classes";
import { type AcademicSessionView, listSessions } from "@/api/sessions";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { FormField } from "@/components/ui/FormField";
import { ResultDialog } from "@/components/ui/ResultDialog";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { StickySubHeader, useFilterChip } from "@/components/ui/StickySubHeader";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { BranchFilter } from "@/features/branches/components/BranchFilter";
import { useBranchScope } from "@/features/branches/useBranchScope";
import { CopyFaresModal } from "@/features/billing/components/CopyFaresModal";
import { RouteFormModal } from "@/features/billing/components/RouteFormModal";
import { TransportFareTable } from "@/features/billing/components/TransportFareTable";
import { TransportRidersTable } from "@/features/billing/components/TransportRidersTable";

/**
 * The school-bus fee's own surface (Phase 22) - three stacked sections sharing one
 * branch+session selector: **Routes** (the branch's pickup areas), **Fares** (each route's
 * one-way/to-and-fro amount for the session), and **Riders** (per-class rider assignment, which
 * additionally needs a class picked from the same branch). Routes and Fares share the top
 * `StickySubHeader`; Riders gets its own inline Class select, since a rider assignment is scoped
 * to one class at a time, not the whole branch.
 */
export function TransportTab() {
  const { ready: branchReady, branchId } = useBranchScope();

  const [sessions, setSessions] = useState<AcademicSessionView[]>([]);
  const [sessionId, setSessionId] = useState("");

  useEffect(() => {
    listSessions(0, 50).then((page) => {
      setSessions(page.content);
      const current = page.content.find((session) => session.current);
      if (current) setSessionId(current.id);
    });
  }, []);

  useFilterChip("session", sessions.find((session) => session.id === sessionId)?.name);

  const [result, setResult] = useState<{ variant: "success" | "error"; message: string } | null>(null);

  // ---------------- Routes ----------------
  const [routes, setRoutes] = useState<TransportRouteView[] | null>(null);
  const [routesError, setRoutesError] = useState<string | null>(null);
  const [editingRoute, setEditingRoute] = useState<TransportRouteView | "new" | null>(null);
  const [deletingRoute, setDeletingRoute] = useState<TransportRouteView | null>(null);

  function loadRoutes() {
    if (!branchReady) return;
    listTransportRoutes(branchId)
      .then(setRoutes)
      .catch((err: unknown) => setRoutesError(err instanceof ApiError ? err.message : "Failed to load routes"));
  }

  useEffect(loadRoutes, [branchReady, branchId]);

  async function confirmDeleteRoute(route: TransportRouteView) {
    await deleteTransportRoute(route.id, branchId);
    setDeletingRoute(null);
    loadRoutes();
    loadFares();
  }

  // ---------------- Fares ----------------
  const [fareGrid, setFareGrid] = useState<TransportFareGridView | null>(null);
  const [fareGridError, setFareGridError] = useState<string | null>(null);
  const [copyFaresOpen, setCopyFaresOpen] = useState(false);

  function loadFares() {
    if (!branchReady || !sessionId) return;
    getTransportFareGrid(sessionId, branchId)
      .then(setFareGrid)
      .catch((err: unknown) => setFareGridError(err instanceof ApiError ? err.message : "Failed to load fares"));
  }

  useEffect(loadFares, [branchReady, branchId, sessionId]);

  // ---------------- Riders ----------------
  const [classes, setClasses] = useState<SchoolClassView[]>([]);
  const [classId, setClassId] = useState("");
  const [ridersView, setRidersView] = useState<TransportRidersView | null>(null);
  const [ridersError, setRidersError] = useState<string | null>(null);

  useEffect(() => {
    if (!branchReady) return;
    listClasses(branchId, undefined, 0, 200).then((page) => {
      setClasses(page.content);
      setClassId((current) => (current && page.content.some((c) => c.id === current) ? current : ""));
    });
  }, [branchReady, branchId]);

  // classId/sessionId reset ridersView during render (the PricesTab/ScoreEntryGrid idiom) rather
  // than inside the effect below, so a cleared selection never briefly renders stale data before
  // the render-gated EmptyState (`!classId || !sessionId`) takes over.
  const ridersSelectionKey = `${classId}|${sessionId}`;
  const [lastRidersSelectionKey, setLastRidersSelectionKey] = useState(ridersSelectionKey);
  if (ridersSelectionKey !== lastRidersSelectionKey) {
    setLastRidersSelectionKey(ridersSelectionKey);
    setRidersView(null);
    setRidersError(null);
  }

  function loadRiders() {
    if (!classId || !sessionId) return;
    getTransportRiders(classId, sessionId)
      .then(setRidersView)
      .catch((err: unknown) => setRidersError(err instanceof ApiError ? err.message : "Failed to load riders"));
  }

  useEffect(loadRiders, [classId, sessionId]);

  function handleSaved(message: string) {
    setResult({ variant: "success", message });
  }

  return (
    <div className="space-y-6">
      <StickySubHeader>
        <BranchFilter id="billing-transport-branch" />
        <FormField label="Session" htmlFor="billing-transport-session" className="min-w-0 flex-1 lg:max-w-[14rem]">
          <Select
            id="billing-transport-session"
            value={sessionId}
            onChange={(event) => setSessionId(event.target.value)}
          >
            <option value="">Select a session…</option>
            {sessions.map((session) => (
              <option key={session.id} value={session.id}>
                {session.name}
              </option>
            ))}
          </Select>
        </FormField>
      </StickySubHeader>

      <Card>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-slate-900">Routes</h2>
          <Button type="button" variant="secondary" onClick={() => setEditingRoute("new")}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add route
          </Button>
        </div>

        {routesError && <Alert variant="error">{routesError}</Alert>}

        {!routes ? (
          <Skeleton className="h-10 w-full" />
        ) : routes.length === 0 ? (
          <EmptyState title="No routes yet" description="Add your school bus's first pickup area." />
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Route</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
                <TableHeaderCell>Actions</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {routes.map((route) => (
                <TableRow key={route.id}>
                  <TableCell label="Route">{route.name}</TableCell>
                  <TableCell label="Status">
                    <Badge variant={route.active ? "success" : "neutral"}>
                      {route.active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell label="Actions">
                    <div className="flex gap-3">
                      <Button variant="ghost" size="sm" onClick={() => setEditingRoute(route)}>
                        Edit
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setDeletingRoute(route)}>
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <Card>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-slate-900">Fares</h2>
          {sessionId && (
            <Button type="button" variant="secondary" onClick={() => setCopyFaresOpen(true)}>
              Copy from another session
            </Button>
          )}
        </div>

        {fareGridError && <Alert variant="error">{fareGridError}</Alert>}

        {!sessionId ? (
          <EmptyState title="Select a session" description="Pick a session to view or price fares." />
        ) : !routes || routes.length === 0 ? (
          <EmptyState title="No routes yet" description="Add a route above before pricing it." />
        ) : !fareGrid ? (
          <Skeleton className="h-10 w-full" />
        ) : (
          <TransportFareTable grid={fareGrid} branchId={branchId} onSaved={handleSaved} />
        )}
      </Card>

      <Card>
        <h2 className="mb-4 font-display text-lg font-semibold text-slate-900">Riders</h2>

        <FormField label="Class" htmlFor="billing-transport-class" className="mb-4 max-w-sm">
          <Select id="billing-transport-class" value={classId} onChange={(event) => setClassId(event.target.value)}>
            <option value="">Select a class…</option>
            {classes.map((schoolClass) => (
              <option key={schoolClass.id} value={schoolClass.id}>
                {schoolClass.name}
              </option>
            ))}
          </Select>
        </FormField>

        {ridersError && <Alert variant="error">{ridersError}</Alert>}

        {!classId || !sessionId ? (
          <EmptyState title="Select a class" description="Pick a class to assign its riders." />
        ) : !ridersView ? (
          <Skeleton className="h-10 w-full" />
        ) : ridersView.students.length === 0 ? (
          <EmptyState title="No students" description="This class has no active roster for this session." />
        ) : ridersView.routes.length === 0 ? (
          <EmptyState title="No routes yet" description="Add a route above before assigning riders." />
        ) : (
          <TransportRidersTable view={ridersView} onSaved={handleSaved} />
        )}
      </Card>

      {editingRoute && (
        <RouteFormModal
          route={editingRoute === "new" ? undefined : editingRoute}
          branchId={branchId}
          nextPosition={routes?.length ?? 0}
          onClose={() => setEditingRoute(null)}
          onSaved={() => {
            loadRoutes();
            loadFares();
          }}
        />
      )}

      {deletingRoute && (
        <ConfirmDialog
          title="Delete route"
          message={`Delete "${deletingRoute.name}"? This can't be undone.`}
          confirmLabel="Delete"
          variant="danger"
          onConfirm={() => confirmDeleteRoute(deletingRoute)}
          onClose={() => setDeletingRoute(null)}
        />
      )}

      {sessionId && (
        <CopyFaresModal
          open={copyFaresOpen}
          onClose={() => setCopyFaresOpen(false)}
          targetSessionId={sessionId}
          onCopied={() => {
            setCopyFaresOpen(false);
            loadFares();
          }}
        />
      )}

      {result && <ResultDialog variant={result.variant} message={result.message} onClose={() => setResult(null)} />}
    </div>
  );
}
