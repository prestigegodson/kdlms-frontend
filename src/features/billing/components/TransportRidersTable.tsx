import { useState } from "react";
import {
  TRANSPORT_DIRECTION_LABELS,
  type SaveTransportRiderRow,
  type TransportDirection,
  type TransportRidersView,
  saveTransportRiders,
} from "@/api/billing";
import { ApiError } from "@/api/client";
import { Alert } from "@/components/ui/Alert";
import { Select } from "@/components/ui/Select";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/Table";
import { UnsavedChangesBar } from "@/features/assessments/components/UnsavedChangesBar";

interface TransportRidersTableProps {
  view: TransportRidersView;
  onSaved: (message: string) => void;
}

interface RiderEdit {
  routeId: string | null;
  direction: TransportDirection | null;
}

type Edits = Record<string, RiderEdit>;

function seedEdits(view: TransportRidersView): Edits {
  const edits: Edits = {};
  for (const student of view.students) {
    edits[student.enrollmentId] = { routeId: student.routeId, direction: student.direction };
  }
  return edits;
}

/**
 * One class's roster, each row a route + direction pair - the per-class rider-assignment screen
 * (`ManageTransportRidersUseCase`). A student's route and direction are independent selects, not
 * one combined dropdown, since a route's own fare availability (`route.oneWayPriced`/
 * `toAndFroPriced`) determines which directions make sense to offer - an unpriced direction is
 * still shown, disabled, so an admin sees it needs a fare rather than wondering where it went.
 */
export function TransportRidersTable({ view, onSaved }: TransportRidersTableProps) {
  const [initial, setInitial] = useState(() => seedEdits(view));
  const [edits, setEdits] = useState<Edits>(initial);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [seededFor, setSeededFor] = useState(`${view.classId}|${view.sessionId}`);
  const viewKey = `${view.classId}|${view.sessionId}`;
  if (viewKey !== seededFor) {
    const fresh = seedEdits(view);
    setSeededFor(viewKey);
    setInitial(fresh);
    setEdits(fresh);
    setRowErrors({});
    setError(null);
  }

  function updateRoute(enrollmentId: string, routeId: string) {
    setEdits((current) => {
      const route = view.routes.find((r) => r.routeId === routeId);
      const currentDirection = current[enrollmentId]?.direction ?? null;
      // Keep the chosen direction only if the new route still offers it - otherwise clear it so
      // an unpriced/impossible combination is never silently submitted.
      const directionStillOffered =
        route != null &&
        currentDirection != null &&
        ((currentDirection === "ONE_WAY" && route.oneWayPriced) ||
          (currentDirection === "TO_AND_FRO" && route.toAndFroPriced));
      return {
        ...current,
        [enrollmentId]: {
          routeId: routeId || null,
          direction: routeId ? (directionStillOffered ? currentDirection : null) : null,
        },
      };
    });
    setRowErrors((current) => {
      if (!(enrollmentId in current)) return current;
      const next = { ...current };
      delete next[enrollmentId];
      return next;
    });
  }

  function updateDirection(enrollmentId: string, direction: string) {
    setEdits((current) => ({
      ...current,
      [enrollmentId]: { ...current[enrollmentId], direction: (direction || null) as TransportDirection | null },
    }));
  }

  const dirtyEnrollmentIds = view.students
    .map((student) => student.enrollmentId)
    .filter((enrollmentId) => {
      const e = edits[enrollmentId] ?? { routeId: null, direction: null };
      const i = initial[enrollmentId] ?? { routeId: null, direction: null };
      return e.routeId !== i.routeId || e.direction !== i.direction;
    });

  async function handleSave() {
    setError(null);
    const nextRowErrors: Record<string, string> = {};
    const riders: SaveTransportRiderRow[] = [];
    for (const enrollmentId of dirtyEnrollmentIds) {
      const e = edits[enrollmentId] ?? { routeId: null, direction: null };
      if (e.routeId && !e.direction) {
        nextRowErrors[enrollmentId] = "Choose a direction.";
        continue;
      }
      riders.push({ enrollmentId, routeId: e.routeId, direction: e.direction });
    }
    if (Object.keys(nextRowErrors).length > 0) {
      setRowErrors(nextRowErrors);
      return;
    }
    if (riders.length === 0) return;

    setSaving(true);
    try {
      const outcome = await saveTransportRiders(view.classId, view.sessionId, riders);
      const failed = outcome.outcomes.filter((row) => !row.success);
      if (failed.length === 0) {
        setInitial(edits);
        onSaved(`${riders.length} rider${riders.length === 1 ? "" : "s"} saved.`);
        return;
      }
      const failedByEnrollment: Record<string, string> = {};
      for (const row of failed) {
        failedByEnrollment[row.enrollmentId] = row.message ?? "Failed to save.";
      }
      setRowErrors(failedByEnrollment);
      setError(
        `${riders.length - failed.length} of ${riders.length} rider${riders.length === 1 ? "" : "s"} saved; ${failed.length} failed - see the highlighted student${failed.length === 1 ? "" : "s"}.`,
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save riders");
    } finally {
      setSaving(false);
    }
  }

  function handleDiscard() {
    setEdits(initial);
    setRowErrors({});
    setError(null);
  }

  return (
    <div className="space-y-4">
      {error && <Alert variant="error">{error}</Alert>}

      <Table>
        <TableHead>
          <TableRow>
            <TableHeaderCell>Student</TableHeaderCell>
            <TableHeaderCell>Admission no.</TableHeaderCell>
            <TableHeaderCell>Route</TableHeaderCell>
            <TableHeaderCell>Direction</TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {view.students.map((student) => {
            const edit = edits[student.enrollmentId] ?? { routeId: null, direction: null };
            const route = view.routes.find((r) => r.routeId === edit.routeId);
            const rowError = rowErrors[student.enrollmentId];
            return (
              <TableRow key={student.enrollmentId}>
                <TableCell label="Student">{student.studentName}</TableCell>
                <TableCell label="Admission no.">{student.admissionNumber}</TableCell>
                <TableCell label="Route">
                  <Select
                    aria-label={`${student.studentName} route`}
                    value={edit.routeId ?? ""}
                    onChange={(event) => updateRoute(student.enrollmentId, event.target.value)}
                  >
                    <option value="">Not riding</option>
                    {view.routes.map((r) => (
                      <option key={r.routeId} value={r.routeId}>
                        {r.routeName}
                      </option>
                    ))}
                  </Select>
                </TableCell>
                <TableCell label="Direction">
                  <Select
                    aria-label={`${student.studentName} direction`}
                    aria-invalid={rowError ? "true" : undefined}
                    disabled={!edit.routeId}
                    value={edit.direction ?? ""}
                    onChange={(event) => updateDirection(student.enrollmentId, event.target.value)}
                  >
                    <option value="">Select…</option>
                    <option value="ONE_WAY" disabled={route != null && !route.oneWayPriced}>
                      {TRANSPORT_DIRECTION_LABELS.ONE_WAY}
                      {route != null && !route.oneWayPriced ? " (not priced)" : ""}
                    </option>
                    <option value="TO_AND_FRO" disabled={route != null && !route.toAndFroPriced}>
                      {TRANSPORT_DIRECTION_LABELS.TO_AND_FRO}
                      {route != null && !route.toAndFroPriced ? " (not priced)" : ""}
                    </option>
                  </Select>
                  {rowError && <p className="mt-1 text-xs text-red-600">{rowError}</p>}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <UnsavedChangesBar
        count={dirtyEnrollmentIds.length}
        saving={saving}
        onSave={handleSave}
        onDiscard={handleDiscard}
        saveVariant="primary"
      />
    </div>
  );
}
