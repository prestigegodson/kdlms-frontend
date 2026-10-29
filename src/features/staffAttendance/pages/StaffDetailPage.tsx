import { type FormEvent, useCallback, useEffect, useState } from "react";
import { useParams } from "react-router";
import { getErrorMessage } from "@/api/client";
import {
  addManualEvent,
  type ClockEventView,
  type DeviceView,
  enrollOnDevice,
  type EnrollmentLinkView,
  getRoster,
  getStaffHistory,
  issueEnrollmentLink,
  listDevices,
  listPasskeys,
  type PasskeyView,
  revokePasskey,
  setStaffActive,
  setStaffShift,
  type StaffHistoryView,
  type StaffRowView,
  voidEvent,
} from "@/api/staffAttendance";
import { can } from "@/auth/permissions";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DateInput } from "@/components/ui/DateInput";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/Table";
import { Textarea } from "@/components/ui/Textarea";
import { useAuthStore } from "@/stores/authStore";
import { useBranchStore } from "@/stores/branchStore";
import { QrCode } from "../components/QrCode";
import {
  DAY_STATUS_LABEL,
  DAY_STATUS_VARIANT,
  dayFlags,
  formatClockTime,
  formatDuration,
  shortTime,
  staffRoleLabel,
  todayIn,
} from "../format";

const SOURCE_LABEL: Record<ClockEventView["source"], string> = {
  DEVICE: "Terminal",
  PASSKEY: "Phone at gate",
  MANUAL: "Added by admin",
};

/** One staff member: how they clock in, their personal hours, and their last 30 days with corrections. */
export function StaffDetailPage() {
  const { staffMemberId = "" } = useParams();
  const [row, setRow] = useState<StaffRowView | null>(null);
  const [history, setHistory] = useState<StaffHistoryView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const reload = useCallback(() => setReloadKey((key) => key + 1), []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getRoster(), getStaffHistory(staffMemberId)])
      .then(([roster, loaded]) => {
        if (cancelled) {
          return;
        }
        setRow(roster.staff.find((staff) => staff.staffMemberId === staffMemberId) ?? null);
        setHistory(loaded);
      })
      .catch((err: unknown) => !cancelled && setError(getErrorMessage(err, "Failed to load this staff member")));
    return () => {
      cancelled = true;
    };
  }, [staffMemberId, reloadKey]);

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader title="Staff member" backTo="/school/staff-attendance" backLabel="Staff & clock-in" />
        <Alert variant="error">{error}</Alert>
      </div>
    );
  }
  if (!history) {
    return <Skeleton className="h-96 w-full" />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={history.name}
        description={row ? `${staffRoleLabel(row)}${row.devicePin ? ` · Terminal PIN ${row.devicePin}` : ""}` : undefined}
        backTo="/school/staff-attendance"
        backLabel="Staff & clock-in"
        actions={row && <ActiveToggle row={row} onChanged={reload} />}
      />
      {row?.status === "INACTIVE" && (
        <Alert variant="warning">This person can't clock in. Their history is kept.</Alert>
      )}
      <div className="grid gap-6 lg:grid-cols-2">
        <EnrollmentCard staffMemberId={staffMemberId} row={row} onChanged={reload} />
        {row && <PersonalShiftCard row={row} onChanged={reload} />}
      </div>
      <HistorySection history={history} row={row} onChanged={reload} />
    </div>
  );
}

function ActiveToggle({ row, onChanged }: { row: StaffRowView; onChanged: () => void }) {
  const [confirming, setConfirming] = useState(false);
  if (!row.staffMemberId) {
    return null;
  }
  const active = row.status === "ACTIVE";
  return (
    <>
      <Button variant={active ? "secondary" : "primary"} onClick={() => setConfirming(true)}>
        {active ? "Deactivate" : "Reactivate"}
      </Button>
      {confirming && (
        <ConfirmDialog
          title={active ? "Stop this person clocking in?" : "Let this person clock in again?"}
          message={
            active
              ? "They're removed from every terminal and their passkeys stop working. Their history stays."
              : "They're added back to the terminals of their branch."
          }
          confirmLabel={active ? "Deactivate" : "Reactivate"}
          variant={active ? "danger" : "default"}
          onConfirm={async () => {
            await setStaffActive(row.staffMemberId as string, !active);
            setConfirming(false);
            onChanged();
          }}
          onClose={() => setConfirming(false)}
        />
      )}
    </>
  );
}

function EnrollmentCard({
  staffMemberId,
  row,
  onChanged,
}: {
  staffMemberId: string;
  row: StaffRowView | null;
  onChanged: () => void;
}) {
  const [passkeys, setPasskeys] = useState<PasskeyView[] | null>(null);
  const [devices, setDevices] = useState<DeviceView[]>([]);
  const [link, setLink] = useState<EnrollmentLinkView | null>(null);
  const [deviceId, setDeviceId] = useState("");
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [revoking, setRevoking] = useState<PasskeyView | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    listPasskeys(staffMemberId).then(setPasskeys).catch(() => setPasskeys([]));
    listDevices()
      .then((list) => {
        const usable = list.filter(
          (device) => device.status === "ACTIVE" && (!row?.branchId || device.branchId === row.branchId),
        );
        setDevices(usable);
        setDeviceId((current) => current || usable[0]?.id || "");
      })
      .catch(() => setDevices([]));
  }, [staffMemberId, row?.branchId, reloadKey]);

  const canEnroll = row?.status === "ACTIVE";
  const enrollUrl = link ? `${window.location.origin}/staff-enroll/${link.token}` : "";

  async function handleLink() {
    setBusy(true);
    setMessage(null);
    try {
      setLink(await issueEnrollmentLink(staffMemberId));
    } catch (err) {
      setMessage({ kind: "error", text: getErrorMessage(err, "Couldn't create an enrollment link") });
    } finally {
      setBusy(false);
    }
  }

  async function handleDeviceEnroll() {
    setBusy(true);
    setMessage(null);
    try {
      await enrollOnDevice(deviceId, staffMemberId);
      setMessage({
        kind: "success",
        text: "Sent to the terminal. Within a minute it asks for the finger - if your model doesn't, enroll this PIN from the terminal's own menu.",
      });
    } catch (err) {
      setMessage({ kind: "error", text: getErrorMessage(err, "Couldn't reach that terminal") });
    } finally {
      setBusy(false);
    }
  }

  const activePasskeys = passkeys?.filter((passkey) => !passkey.revokedAt) ?? [];

  return (
    <Card className="space-y-5 p-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">How they clock in</h2>
        <div className="mt-2 flex flex-wrap gap-1">
          {row && row.fingerprintDevices > 0 && <Badge variant="success">Fingerprint on {row.fingerprintDevices} terminal(s)</Badge>}
          {row?.face && <Badge variant="success">Face</Badge>}
          {activePasskeys.length > 0 && <Badge variant="info">{activePasskeys.length} phone passkey(s)</Badge>}
          {row && row.fingerprintDevices === 0 && !row.face && activePasskeys.length === 0 && (
            <Badge variant="warning">Not enrolled yet</Badge>
          )}
        </div>
      </div>
      {message && <Alert variant={message.kind}>{message.text}</Alert>}

      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-slate-700">Fingerprint terminal</h3>
        {devices.length === 0 ? (
          <p className="text-sm text-slate-500">No terminal in this branch yet - add one under Terminals &amp; gates.</p>
        ) : (
          <div className="flex flex-wrap items-end gap-2">
            {devices.length > 1 && (
              <FormField label="Terminal" htmlFor="enroll-device" className="w-full sm:w-56">
                <Select id="enroll-device" value={deviceId} onChange={(e) => setDeviceId(e.target.value)}>
                  {devices.map((device) => (
                    <option key={device.id} value={device.id}>
                      {device.name}
                    </option>
                  ))}
                </Select>
              </FormField>
            )}
            <Button variant="secondary" onClick={handleDeviceEnroll} disabled={!canEnroll || !deviceId} loading={busy && !link}>
              Enroll fingerprint{devices.length === 1 ? ` on ${devices[0].name}` : ""}
            </Button>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-slate-700">Their own phone</h3>
        {!link ? (
          <>
            <p className="text-sm text-slate-500">
              A one-time link (valid 24 hours) sets up a passkey that unlocks with their fingerprint or face. They
              then clock in by scanning the gate screen.
            </p>
            <Button variant="secondary" onClick={handleLink} disabled={!canEnroll} loading={busy && !link}>
              Create phone enrollment link
            </Button>
          </>
        ) : (
          <div className="space-y-3 rounded-panel border border-slate-200 p-4">
            <p className="text-sm text-slate-600">Have them scan this with their phone camera, or send them the link.</p>
            <div className="flex justify-center">
              <QrCode value={enrollUrl} size={200} label="Passkey enrollment link" />
            </div>
            <Input readOnly value={enrollUrl} onFocus={(e) => e.target.select()} aria-label="Enrollment link" />
            <div className="flex flex-wrap justify-end gap-2">
              <Button size="sm" variant="secondary" onClick={() => void navigator.clipboard?.writeText(enrollUrl)}>
                Copy link
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setLink(null);
                  setReloadKey((key) => key + 1);
                  onChanged();
                }}
              >
                Done
              </Button>
            </div>
          </div>
        )}
        {activePasskeys.length > 0 && (
          <ul className="divide-y divide-slate-100 text-sm">
            {activePasskeys.map((passkey) => (
              <li key={passkey.id} className="flex items-center justify-between gap-2 py-2">
                <span className="text-slate-700">
                  {passkey.label || "Phone passkey"}
                  <span className="ml-2 text-slate-400">
                    {passkey.lastUsedAt
                      ? `last used ${new Date(passkey.lastUsedAt).toLocaleDateString()}`
                      : `added ${new Date(passkey.createdAt).toLocaleDateString()}`}
                  </span>
                </span>
                <button type="button" className="text-red-600 hover:text-red-700" onClick={() => setRevoking(passkey)}>
                  Revoke
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {revoking && (
        <ConfirmDialog
          title="Revoke this passkey?"
          message="It stops working at the gate at once. Issue a new link if they've changed phone."
          confirmLabel="Revoke"
          variant="danger"
          onConfirm={async () => {
            await revokePasskey(revoking.id);
            setRevoking(null);
            setReloadKey((key) => key + 1);
            onChanged();
          }}
          onClose={() => setRevoking(null)}
        />
      )}
    </Card>
  );
}

function PersonalShiftCard({ row, onChanged }: { row: StaffRowView; onChanged: () => void }) {
  const [start, setStart] = useState(shortTime(row.shiftStart));
  const [end, setEnd] = useState(shortTime(row.shiftEnd));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  async function save(clear: boolean) {
    if (!row.staffMemberId) {
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      await setStaffShift(row.staffMemberId, clear ? null : start, clear ? null : end);
      if (clear) {
        setStart("");
        setEnd("");
      }
      setMessage({ kind: "success", text: clear ? "Back on the branch hours." : "Personal hours saved." });
      onChanged();
    } catch (err) {
      setMessage({ kind: "error", text: getErrorMessage(err, "Failed to save hours") });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="space-y-4 p-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Personal hours</h2>
        <p className="text-sm text-slate-500">
          {row.shiftStart
            ? `Works ${shortTime(row.shiftStart)}–${shortTime(row.shiftEnd)} instead of the branch hours.`
            : "On the branch's working hours. Set personal hours for shift workers such as security."}
        </p>
      </div>
      {message && <Alert variant={message.kind}>{message.text}</Alert>}
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(event: FormEvent<HTMLFormElement>) => {
          event.preventDefault();
          void save(false);
        }}
      >
        <FormField label="Starts" htmlFor="personal-shift-start" className="w-36">
          <Input id="personal-shift-start" type="time" required value={start} onChange={(e) => setStart(e.target.value)} />
        </FormField>
        <FormField label="Ends" htmlFor="personal-shift-end" className="w-36">
          <Input id="personal-shift-end" type="time" required value={end} onChange={(e) => setEnd(e.target.value)} />
        </FormField>
        <Button type="submit" variant="secondary" loading={saving}>
          Save
        </Button>
        {row.shiftStart && (
          <Button type="button" variant="ghost" onClick={() => void save(true)} disabled={saving}>
            Use branch hours
          </Button>
        )}
      </form>
    </Card>
  );
}

function HistorySection({
  history,
  row,
  onChanged,
}: {
  history: StaffHistoryView;
  row: StaffRowView | null;
  onChanged: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [voiding, setVoiding] = useState<ClockEventView | null>(null);
  const zone = history.timezone;
  const recentDays = history.days.filter((day) => day.status !== "OFF_DAY" || day.punches > 0);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-900">Last 30 days</h2>
        <Button variant="secondary" onClick={() => setAdding(true)}>
          Add a missed clock-in/out
        </Button>
      </div>
      <Card className="p-0">
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Date</TableHeaderCell>
              <TableHeaderCell>Status</TableHeaderCell>
              <TableHeaderCell numeric>In</TableHeaderCell>
              <TableHeaderCell numeric>Out</TableHeaderCell>
              <TableHeaderCell numeric>Worked</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {recentDays.map((day) => (
              <TableRow key={day.date}>
                <TableCell label="Date" className="font-medium text-slate-900">
                  {new Date(`${day.date}T12:00:00`).toLocaleDateString(undefined, {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                  })}
                </TableCell>
                <TableCell label="Status">
                  <div className="flex flex-wrap gap-1">
                    <Badge variant={DAY_STATUS_VARIANT[day.status]}>{DAY_STATUS_LABEL[day.status]}</Badge>
                    {dayFlags(day).map((flag) => (
                      <Badge key={flag.label} variant={flag.variant}>
                        {flag.label}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell label="In" numeric>
                  {formatClockTime(day.clockIn, zone)}
                </TableCell>
                <TableCell label="Out" numeric>
                  {formatClockTime(day.clockOut, zone)}
                </TableCell>
                <TableCell label="Worked" numeric>
                  {formatDuration(day.workedMinutes)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <h3 className="text-base font-semibold text-slate-900">Every punch</h3>
      {history.events.length === 0 ? (
        <p className="text-sm text-slate-500">No punches in this period.</p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-panel border border-slate-200 bg-white">
          {history.events.map((event) => (
            <li key={event.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
              <div className={event.voidedAt ? "text-slate-400 line-through" : "text-slate-700"}>
                <span className="font-medium">
                  {event.localDate} {formatClockTime(event.occurredAt, zone)}
                </span>
                <span className="ml-2">{SOURCE_LABEL[event.source]}</span>
                {event.reason && <span className="ml-2 text-slate-500">- {event.reason}</span>}
                {event.recordedByName && <span className="ml-1 text-slate-400">({event.recordedByName})</span>}
              </div>
              {event.voidedAt ? (
                <span className="text-xs text-slate-500">
                  Voided{event.voidedByName ? ` by ${event.voidedByName}` : ""}: {event.voidReason}
                </span>
              ) : (
                <button type="button" className="text-slate-500 hover:text-red-600" onClick={() => setVoiding(event)}>
                  Void
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {adding && (
        <ManualEventModal
          staffMemberId={history.staffMemberId}
          needsBranch={!row?.branchId}
          timezone={zone}
          onClose={() => setAdding(false)}
          onSaved={() => {
            setAdding(false);
            onChanged();
          }}
        />
      )}
      {voiding && (
        <VoidEventModal
          event={voiding}
          timezone={zone}
          onClose={() => setVoiding(null)}
          onSaved={() => {
            setVoiding(null);
            onChanged();
          }}
        />
      )}
    </section>
  );
}

function ManualEventModal({
  staffMemberId,
  needsBranch,
  timezone,
  onClose,
  onSaved,
}: {
  staffMemberId: string;
  needsBranch: boolean;
  timezone: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const role = useAuthStore((state) => state.user?.role);
  const branches = useBranchStore((state) => state.branches);
  const selectedBranchId = useBranchStore((state) => state.selectedBranchId);
  const [date, setDate] = useState(() => todayIn(timezone));
  const [time, setTime] = useState("");
  const [reason, setReason] = useState("");
  const [branchId, setBranchId] = useState(selectedBranchId ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const showBranch = needsBranch && can.selectBranch(role);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await addManualEvent(staffMemberId, { date, time, reason, branchId: showBranch ? branchId : undefined });
      onSaved();
    } catch (err) {
      setError(getErrorMessage(err, "Failed to add the correction"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Add a missed clock-in or clock-out" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <Alert variant="error">{error}</Alert>}
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Date" htmlFor="manual-date">
            <DateInput id="manual-date" value={date} onChange={setDate} max={todayIn(timezone)} required />
          </FormField>
          <FormField label={`Time (${timezone})`} htmlFor="manual-time">
            <Input id="manual-time" type="time" required value={time} onChange={(e) => setTime(e.target.value)} />
          </FormField>
        </div>
        {showBranch && (
          <FormField label="Branch" htmlFor="manual-branch">
            <Select id="manual-branch" required value={branchId} onChange={(e) => setBranchId(e.target.value)}>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </Select>
          </FormField>
        )}
        <FormField label="Reason" htmlFor="manual-reason" description="Kept in the audit log with your name.">
          <Textarea id="manual-reason" required maxLength={500} rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
        </FormField>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={submitting}>
            Add
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function VoidEventModal({
  event,
  timezone,
  onClose,
  onSaved,
}: {
  event: ClockEventView;
  timezone: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await voidEvent(event.id, reason);
      onSaved();
    } catch (err) {
      setError(getErrorMessage(err, "Failed to void this punch"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Void this punch?" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <Alert variant="error">{error}</Alert>}
        <p className="text-sm text-slate-600">
          The {SOURCE_LABEL[event.source].toLowerCase()} punch at {event.localDate}{" "}
          {formatClockTime(event.occurredAt, timezone)} stops counting. It stays visible, struck through.
        </p>
        <FormField label="Reason" htmlFor="void-reason" description="Kept in the audit log with your name.">
          <Textarea id="void-reason" required maxLength={500} rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
        </FormField>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="danger" loading={submitting}>
            Void punch
          </Button>
        </div>
      </form>
    </Modal>
  );
}
