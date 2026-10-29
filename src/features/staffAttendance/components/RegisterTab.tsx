import { Download, Fingerprint } from "lucide-react";
import { useEffect, useState } from "react";
import { getErrorMessage } from "@/api/client";
import { type DailyRegisterView, exportRegister, getRegister } from "@/api/staffAttendance";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DateInput } from "@/components/ui/DateInput";
import { EmptyState } from "@/components/ui/EmptyState";
import { FormField } from "@/components/ui/FormField";
import { StatTile } from "@/components/ui/StatTile";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/Table";
import { TableSkeleton } from "@/components/ui/TableSkeleton";
import { downloadBlob } from "@/utils/download";
import {
  DAY_STATUS_LABEL,
  DAY_STATUS_VARIANT,
  DEFAULT_TIMEZONE,
  dayFlags,
  formatClockTime,
  formatDuration,
  ROLE_LABELS,
  todayIn,
} from "../format";
import { STAFF_CATEGORY_LABELS } from "@/api/staffAttendance";

type State =
  | { kind: "loading" }
  | { kind: "loaded"; register: DailyRegisterView }
  | { kind: "error"; message: string };

/** A result tagged with the request it answers, so a date/branch change reads as loading without a reset in the effect. */
type Keyed = { key: string; state: State };

/** The derived daily register - who's in, who's late, who hasn't shown - plus a CSV export of any range. */
export function RegisterTab({ branchId }: { branchId?: string }) {
  const [date, setDate] = useState(() => todayIn(DEFAULT_TIMEZONE));
  const requestKey = `${date}|${branchId ?? ""}`;
  const [result, setResult] = useState<Keyed | null>(null);
  const state: State = result?.key === requestKey ? result.state : { kind: "loading" };
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const key = `${date}|${branchId ?? ""}`;
    getRegister(date, branchId)
      .then((register) => {
        if (!cancelled) {
          setResult({ key, state: { kind: "loaded", register } });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setResult({ key, state: { kind: "error", message: getErrorMessage(error, "Failed to load the register") } });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [date, branchId]);

  async function handleExport() {
    setExporting(true);
    setExportError(null);
    try {
      // The month to date of the chosen day - the shape payroll usually wants.
      const from = `${date.slice(0, 8)}01`;
      downloadBlob(await exportRegister(from, date, branchId), `staff-attendance-${from}-to-${date}.csv`);
    } catch (error) {
      setExportError(getErrorMessage(error, "Export failed"));
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <FormField label="Date" htmlFor="staff-register-date" className="w-full sm:w-48">
          <DateInput id="staff-register-date" value={date} onChange={setDate} required />
        </FormField>
        <Button variant="secondary" onClick={handleExport} loading={exporting}>
          <Download className="h-4 w-4" aria-hidden="true" />
          Export month to date (CSV)
        </Button>
      </div>
      {exportError && <Alert variant="error">{exportError}</Alert>}

      {state.kind === "loading" && (
        <Card className="p-0">
          <TableSkeleton columns={6} />
        </Card>
      )}
      {state.kind === "error" && <Alert variant="error">{state.message}</Alert>}
      {state.kind === "loaded" && <RegisterView register={state.register} />}
    </div>
  );
}

function RegisterView({ register }: { register: DailyRegisterView }) {
  const { summary, rows, timezone } = register;
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Fingerprint}
        title="No one is set up for clock-in yet"
        description="Add your non-academic staff and link your teachers on the Staff tab, then enroll their fingerprints."
      />
    );
  }
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatTile label="Expected" value={summary.total} />
        <StatTile label="On site now" value={summary.onSite} />
        <StatTile label="Present" value={summary.present} />
        <StatTile label="Late" value={summary.late} />
        <StatTile label="Absent / not in" value={summary.absent + summary.notClockedIn} />
      </div>
      <Card className="p-0">
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Name</TableHeaderCell>
              <TableHeaderCell>Role</TableHeaderCell>
              <TableHeaderCell>Status</TableHeaderCell>
              <TableHeaderCell numeric>In</TableHeaderCell>
              <TableHeaderCell numeric>Out</TableHeaderCell>
              <TableHeaderCell numeric>Worked</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.staffMemberId} to={`/school/staff-attendance/staff/${row.staffMemberId}`}>
                <TableCell label="Name" className="font-medium text-slate-900">
                  {row.name}
                </TableCell>
                <TableCell label="Role">
                  {row.role ? ROLE_LABELS[row.role] ?? row.role : row.category ? STAFF_CATEGORY_LABELS[row.category] : "—"}
                </TableCell>
                <TableCell label="Status">
                  <div className="flex flex-wrap gap-1">
                    <Badge variant={DAY_STATUS_VARIANT[row.day.status]}>{DAY_STATUS_LABEL[row.day.status]}</Badge>
                    {dayFlags(row.day).map((flag) => (
                      <Badge key={flag.label} variant={flag.variant}>
                        {flag.label}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell label="In" numeric>
                  {formatClockTime(row.day.clockIn, timezone)}
                </TableCell>
                <TableCell label="Out" numeric>
                  {formatClockTime(row.day.clockOut, timezone)}
                </TableCell>
                <TableCell label="Worked" numeric>
                  {formatDuration(row.day.workedMinutes)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
      <p className="text-xs text-slate-500">Times are shown in {timezone}.</p>
    </div>
  );
}
