import { useState } from "react";
import {
  type SaveTransportFareRow,
  type TransportFareGridView,
  saveTransportFares,
} from "@/api/billing";
import { ApiError } from "@/api/client";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/Table";
import { UnsavedChangesBar } from "@/features/assessments/components/UnsavedChangesBar";

interface TransportFareTableProps {
  grid: TransportFareGridView;
  branchId?: string;
  onSaved: (message: string) => void;
}

type Amounts = Record<string, { oneWay: string; toAndFro: string }>;

function seedAmounts(grid: TransportFareGridView): Amounts {
  const amounts: Amounts = {};
  for (const route of grid.routes) {
    amounts[route.routeId] = {
      oneWay: route.oneWayAmount != null ? String(route.oneWayAmount) : "",
      toAndFro: route.toAndFroAmount != null ? String(route.toAndFroAmount) : "",
    };
  }
  return amounts;
}

/**
 * One branch's one session's school-bus fare grid - a route per row, two amount columns (one-way,
 * to-and-fro), edited inline rather than through a per-route modal the way `FeePriceListTable`/
 * `FeePricesModal` split a fee×level grid: a route only ever has two cells, so there's no column
 * count that grows with the school and forces the modal split `FeePriceListTable`'s own Javadoc
 * explains. Saved via `UnsavedChangesBar`, the entry-grid idiom every other bulk-edit screen in
 * this app uses.
 */
export function TransportFareTable({ grid, branchId, onSaved }: TransportFareTableProps) {
  const [initial, setInitial] = useState(() => seedAmounts(grid));
  const [amounts, setAmounts] = useState<Amounts>(initial);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The grid identity (branch+session) changed under us - reseed rather than carry stale edits.
  const [seededFor, setSeededFor] = useState(`${grid.branchId}|${grid.sessionId}`);
  const gridKey = `${grid.branchId}|${grid.sessionId}`;
  if (gridKey !== seededFor) {
    const fresh = seedAmounts(grid);
    setSeededFor(gridKey);
    setInitial(fresh);
    setAmounts(fresh);
    setRowErrors({});
    setError(null);
  }

  function updateAmount(routeId: string, field: "oneWay" | "toAndFro", value: string) {
    setAmounts((current) => ({ ...current, [routeId]: { ...current[routeId], [field]: value } }));
    setRowErrors((current) => {
      if (!(routeId in current)) return current;
      const next = { ...current };
      delete next[routeId];
      return next;
    });
  }

  const dirtyRouteIds = grid.routes
    .map((route) => route.routeId)
    .filter((routeId) => {
      const a = amounts[routeId] ?? { oneWay: "", toAndFro: "" };
      const i = initial[routeId] ?? { oneWay: "", toAndFro: "" };
      return a.oneWay !== i.oneWay || a.toAndFro !== i.toAndFro;
    });

  function parseAmount(raw: string): number | null | "invalid" {
    if (raw.trim() === "") return null;
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0) return "invalid";
    return value;
  }

  async function handleSave() {
    setError(null);
    const nextRowErrors: Record<string, string> = {};
    const fares: SaveTransportFareRow[] = [];
    for (const routeId of dirtyRouteIds) {
      const a = amounts[routeId] ?? { oneWay: "", toAndFro: "" };
      const oneWay = parseAmount(a.oneWay);
      const toAndFro = parseAmount(a.toAndFro);
      if (oneWay === "invalid" || toAndFro === "invalid") {
        nextRowErrors[routeId] = "Enter a number 0 or greater, or leave blank.";
        continue;
      }
      fares.push({ routeId, oneWayAmount: oneWay, toAndFroAmount: toAndFro });
    }
    if (Object.keys(nextRowErrors).length > 0) {
      setRowErrors(nextRowErrors);
      return;
    }
    if (fares.length === 0) return;

    setSaving(true);
    try {
      const outcome = await saveTransportFares(grid.sessionId, fares, branchId);
      const failed = outcome.outcomes.filter((row) => !row.success);
      if (failed.length === 0) {
        setInitial(amounts);
        onSaved(`${fares.length} fare${fares.length === 1 ? "" : "s"} saved.`);
        return;
      }
      const failedByRoute: Record<string, string> = {};
      for (const row of failed) {
        failedByRoute[row.routeId] = row.message ?? "Failed to save.";
      }
      setRowErrors(failedByRoute);
      setError(
        `${fares.length - failed.length} of ${fares.length} fare${fares.length === 1 ? "" : "s"} saved; ${failed.length} failed - see the highlighted route${failed.length === 1 ? "" : "s"}.`,
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save fares");
    } finally {
      setSaving(false);
    }
  }

  function handleDiscard() {
    setAmounts(initial);
    setRowErrors({});
    setError(null);
  }

  return (
    <div className="space-y-4">
      {error && <Alert variant="error">{error}</Alert>}

      <Table>
        <TableHead>
          <TableRow>
            <TableHeaderCell>Route</TableHeaderCell>
            <TableHeaderCell>Status</TableHeaderCell>
            <TableHeaderCell numeric>One way</TableHeaderCell>
            <TableHeaderCell numeric>Two ways</TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {grid.routes.map((route) => {
            const a = amounts[route.routeId] ?? { oneWay: "", toAndFro: "" };
            const rowError = rowErrors[route.routeId];
            return (
              <TableRow key={route.routeId}>
                <TableCell label="Route">{route.routeName}</TableCell>
                <TableCell label="Status">
                  <Badge variant={route.active ? "success" : "neutral"}>
                    {route.active ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell label="One way" numeric>
                  <Input
                    type="number"
                    inputMode="decimal"
                    step="any"
                    min="0"
                    aria-label={`${route.routeName} one-way fare`}
                    aria-invalid={rowError ? "true" : undefined}
                    className="text-right tabular-nums"
                    value={a.oneWay}
                    onChange={(event) => updateAmount(route.routeId, "oneWay", event.target.value)}
                  />
                </TableCell>
                <TableCell label="Two ways" numeric>
                  <Input
                    type="number"
                    inputMode="decimal"
                    step="any"
                    min="0"
                    aria-label={`${route.routeName} to-and-fro fare`}
                    aria-invalid={rowError ? "true" : undefined}
                    className="text-right tabular-nums"
                    value={a.toAndFro}
                    onChange={(event) => updateAmount(route.routeId, "toAndFro", event.target.value)}
                  />
                  {rowError && <p className="mt-1 text-right text-xs text-red-600">{rowError}</p>}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <p className="text-xs text-slate-500">
        Leave a direction blank to stop offering it on that route - it won't appear as a choice when assigning
        riders.
      </p>

      <UnsavedChangesBar
        count={dirtyRouteIds.length}
        saving={saving}
        onSave={handleSave}
        onDiscard={handleDiscard}
        saveVariant="primary"
      />
    </div>
  );
}
