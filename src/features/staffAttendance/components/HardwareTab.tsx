import { Fingerprint, MonitorSmartphone } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { getErrorMessage } from "@/api/client";
import {
  createStation,
  type DeviceCommandView,
  type DeviceView,
  listDeviceCommands,
  listDevices,
  listStations,
  pairStation,
  registerDevice,
  removeStation,
  type StationView,
  syncDevice,
  updateDevice,
} from "@/api/staffAttendance";
import { can } from "@/auth/permissions";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAuthStore } from "@/stores/authStore";
import { useBranchStore } from "@/stores/branchStore";
import { QrCode } from "./QrCode";

/**
 * Fingerprint/face terminals (ZKTeco ADMS push) and gate displays (the
 * rotating QR staff scan with their phone passkey), side by side.
 */
export function HardwareTab({ branchId }: { branchId?: string }) {
  return (
    <div className="space-y-8">
      <DevicesSection branchId={branchId} />
      <StationsSection branchId={branchId} />
    </div>
  );
}

function useBranchName() {
  const branches = useBranchStore((state) => state.branches);
  return (id: string) => branches.find((branch) => branch.id === id)?.name ?? "";
}

function formatSeen(iso: string | null): string {
  if (!iso) {
    return "Never";
  }
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function DevicesSection({ branchId }: { branchId?: string }) {
  const branchName = useBranchName();
  const [devices, setDevices] = useState<DeviceView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [adding, setAdding] = useState(false);
  const [showingCommands, setShowingCommands] = useState<DeviceView | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listDevices(branchId)
      .then((list) => !cancelled && setDevices(list))
      .catch((err: unknown) => !cancelled && setError(getErrorMessage(err, "Failed to load terminals")));
    return () => {
      cancelled = true;
    };
  }, [branchId, reloadKey]);

  const reload = () => setReloadKey((key) => key + 1);

  async function act(device: DeviceView, action: "sync" | "toggle") {
    setBusy(device.id);
    setError(null);
    setNotice(null);
    try {
      if (action === "sync") {
        const { queued } = await syncDevice(device.id);
        setNotice(`${queued} staff queued for ${device.name}. The terminal picks them up within a minute.`);
      } else {
        await updateDevice(device.id, {
          name: device.name,
          active: device.status !== "ACTIVE",
          allowedCidr: device.allowedCidr ?? undefined,
        });
      }
      reload();
    } catch (err) {
      setError(getErrorMessage(err, "That didn't work"));
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Fingerprint terminals</h2>
          <p className="text-sm text-slate-500">
            ZKTeco-compatible terminals with ADMS (&ldquo;cloud server&rdquo;) push. Fingerprints stay on the terminal.
          </p>
        </div>
        <Button onClick={() => setAdding(true)}>Add terminal</Button>
      </div>
      {notice && <Alert variant="success">{notice}</Alert>}
      {error && <Alert variant="error">{error}</Alert>}
      {devices === null && !error && <Skeleton className="h-24 w-full" />}
      {devices?.length === 0 && (
        <EmptyState
          icon={Fingerprint}
          title="No terminals yet"
          description="Register a terminal by its serial number, then point it at this server (see the setup steps when you add one)."
        />
      )}
      {devices && devices.length > 0 && (
        <div className="grid gap-3 md:grid-cols-2">
          {devices.map((device) => (
            <Card key={device.id} className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-slate-900">{device.name}</p>
                  <p className="text-sm text-slate-500">
                    {device.serialNumber}
                    {branchName(device.branchId) && ` · ${branchName(device.branchId)}`}
                  </p>
                </div>
                {device.status === "DISABLED" ? (
                  <Badge variant="neutral">Off</Badge>
                ) : device.online ? (
                  <Badge variant="success">Online</Badge>
                ) : (
                  <Badge variant="warning">Offline</Badge>
                )}
              </div>
              <p className="text-sm text-slate-500">
                Last heard from: {formatSeen(device.lastSeenAt)}
                {device.lastSeenIp && ` (${device.lastSeenIp})`}
                {device.pendingCommands > 0 && ` · ${device.pendingCommands} change(s) waiting`}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={device.status !== "ACTIVE"}
                  loading={busy === device.id}
                  onClick={() => act(device, "sync")}
                >
                  Send all staff
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setShowingCommands(device)}>
                  Activity
                </Button>
                <Button size="sm" variant="ghost" onClick={() => act(device, "toggle")} disabled={busy === device.id}>
                  {device.status === "ACTIVE" ? "Turn off" : "Turn on"}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
      {adding && (
        <AddDeviceModal
          defaultBranchId={branchId}
          onClose={() => setAdding(false)}
          onSaved={() => {
            setAdding(false);
            reload();
          }}
        />
      )}
      {showingCommands && <CommandsModal device={showingCommands} onClose={() => setShowingCommands(null)} />}
    </section>
  );
}

function AddDeviceModal({
  defaultBranchId,
  onClose,
  onSaved,
}: {
  defaultBranchId?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const role = useAuthStore((state) => state.user?.role);
  const branches = useBranchStore((state) => state.branches);
  const selectedBranchId = useBranchStore((state) => state.selectedBranchId);
  const [serialNumber, setSerialNumber] = useState("");
  const [name, setName] = useState("");
  const [allowedCidr, setAllowedCidr] = useState("");
  const [branchId, setBranchId] = useState(defaultBranchId ?? selectedBranchId ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectsBranch = can.selectBranch(role);
  const server = typeof window === "undefined" ? "" : window.location.hostname;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await registerDevice({
        branchId: selectsBranch ? branchId || undefined : undefined,
        serialNumber,
        name,
        allowedCidr: allowedCidr || undefined,
      });
      onSaved();
    } catch (err) {
      setError(getErrorMessage(err, "Failed to add terminal"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Add a fingerprint terminal" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <Alert variant="error">{error}</Alert>}
        <FormField
          label="Serial number"
          htmlFor="device-serial"
          description="On the terminal: Menu → System Info → Device Info (often labelled SN)."
        >
          <Input id="device-serial" required maxLength={64} value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} />
        </FormField>
        <FormField label="Name" htmlFor="device-name">
          <Input id="device-name" required maxLength={100} placeholder="Main gate" value={name} onChange={(e) => setName(e.target.value)} />
        </FormField>
        {selectsBranch && (
          <FormField label="Branch" htmlFor="device-branch">
            <Select id="device-branch" required value={branchId} onChange={(e) => setBranchId(e.target.value)}>
              <option value="" disabled>
                Choose a branch
              </option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </Select>
          </FormField>
        )}
        <FormField
          label="School network (optional)"
          htmlFor="device-cidr"
          description="Only accept this terminal from your school's internet address, e.g. 102.89.10.0/24."
        >
          <Input id="device-cidr" maxLength={64} value={allowedCidr} onChange={(e) => setAllowedCidr(e.target.value)} />
        </FormField>
        <Alert variant="info" title="Then, on the terminal">
          <ol className="list-decimal space-y-1 pl-5">
            <li>
              Open Menu → Comm. → Cloud Server Setting (ADMS).
            </li>
            <li>
              Set Server Address to <strong>{server}</strong> and Server Port to <strong>80</strong> (or 443 with
              HTTPS on).
            </li>
            <li>Save and restart. It shows as Online here within a minute and receives your staff list.</li>
          </ol>
        </Alert>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={submitting}>
            Add terminal
          </Button>
        </div>
      </form>
    </Modal>
  );
}

const COMMAND_STATUS_VARIANT = {
  PENDING: "neutral",
  SENT: "info",
  DONE: "success",
  FAILED: "danger",
} as const;

function describeCommand(command: string): string {
  if (command.startsWith("DATA UPDATE USERINFO")) {
    const name = /Name=([^\t]*)/.exec(command)?.[1];
    return `Add/update ${name || "staff member"}`;
  }
  if (command.startsWith("DATA DELETE USERINFO")) {
    return `Remove PIN ${/PIN=(\d+)/.exec(command)?.[1] ?? ""}`;
  }
  if (command.startsWith("ENROLL_FP")) {
    return `Start fingerprint enrollment for PIN ${/PIN=(\d+)/.exec(command)?.[1] ?? ""}`;
  }
  return command;
}

function CommandsModal({ device, onClose }: { device: DeviceView; onClose: () => void }) {
  const [commands, setCommands] = useState<DeviceCommandView[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listDeviceCommands(device.id)
      .then(setCommands)
      .catch((err: unknown) => setError(getErrorMessage(err, "Failed to load activity")));
  }, [device.id]);

  return (
    <Modal open onClose={onClose} title={`${device.name} - recent activity`} size="lg">
      {error && <Alert variant="error">{error}</Alert>}
      {commands === null && !error && <Skeleton className="h-24 w-full" />}
      {commands?.length === 0 && <p className="text-sm text-slate-500">Nothing sent to this terminal yet.</p>}
      {commands && commands.length > 0 && (
        <ul className="divide-y divide-slate-100">
          {commands.map((command) => (
            <li key={command.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span className="text-slate-700">{describeCommand(command.command)}</span>
              <span className="flex shrink-0 items-center gap-2 text-slate-400">
                {formatSeen(command.completedAt ?? command.createdAt)}
                <Badge variant={COMMAND_STATUS_VARIANT[command.status]}>{command.status.toLowerCase()}</Badge>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

function StationsSection({ branchId }: { branchId?: string }) {
  const branchName = useBranchName();
  const role = useAuthStore((state) => state.user?.role);
  const branches = useBranchStore((state) => state.branches);
  const selectedBranchId = useBranchStore((state) => state.selectedBranchId);
  const [stations, setStations] = useState<StationView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [name, setName] = useState("");
  const [newBranchId, setNewBranchId] = useState(branchId ?? selectedBranchId ?? "");
  const [creating, setCreating] = useState(false);
  const [pairing, setPairing] = useState<{ station: StationView; link: string } | null>(null);
  const [removing, setRemoving] = useState<StationView | null>(null);
  const selectsBranch = can.selectBranch(role);

  useEffect(() => {
    let cancelled = false;
    listStations(branchId)
      .then((list) => !cancelled && setStations(list))
      .catch((err: unknown) => !cancelled && setError(getErrorMessage(err, "Failed to load gates")));
    return () => {
      cancelled = true;
    };
  }, [branchId, reloadKey]);

  const reload = () => setReloadKey((key) => key + 1);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);
    setError(null);
    try {
      await createStation({ branchId: selectsBranch ? newBranchId || undefined : undefined, name });
      setName("");
      reload();
    } catch (err) {
      setError(getErrorMessage(err, "Failed to add gate"));
    } finally {
      setCreating(false);
    }
  }

  async function handlePair(station: StationView) {
    setError(null);
    try {
      const { token } = await pairStation(station.id);
      // The token rides in the fragment, which browsers never send to a server.
      setPairing({ station, link: `${window.location.origin}/gate#pair=${token}` });
      reload();
    } catch (err) {
      setError(getErrorMessage(err, "Failed to pair gate"));
    }
  }

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Gate screens (phone clock-in)</h2>
        <p className="text-sm text-slate-500">
          A tablet, TV or PC at the entrance shows a QR code that changes every few seconds. Staff scan it and
          confirm with the fingerprint or face unlock on their own phone.
        </p>
      </div>
      {error && <Alert variant="error">{error}</Alert>}
      <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-3">
        <FormField label="New gate name" htmlFor="station-name" className="w-full sm:w-64">
          <Input id="station-name" required maxLength={100} placeholder="Staff entrance" value={name} onChange={(e) => setName(e.target.value)} />
        </FormField>
        {selectsBranch && (
          <FormField label="Branch" htmlFor="station-branch" className="w-full sm:w-48">
            <Select id="station-branch" required value={newBranchId} onChange={(e) => setNewBranchId(e.target.value)}>
              <option value="" disabled>
                Choose a branch
              </option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </Select>
          </FormField>
        )}
        <Button type="submit" variant="secondary" loading={creating}>
          Add gate
        </Button>
      </form>
      {stations === null && !error && <Skeleton className="h-20 w-full" />}
      {stations?.length === 0 && (
        <EmptyState icon={MonitorSmartphone} title="No gate screens yet" description="Add one, then open it on the device at your entrance." />
      )}
      {stations && stations.length > 0 && (
        <div className="grid gap-3 md:grid-cols-2">
          {stations.map((station) => (
            <Card key={station.id} className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-slate-900">{station.name}</p>
                  <p className="text-sm text-slate-500">{branchName(station.branchId)}</p>
                </div>
                {!station.paired ? (
                  <Badge variant="neutral">Not opened yet</Badge>
                ) : station.online ? (
                  <Badge variant="success">Showing</Badge>
                ) : (
                  <Badge variant="warning">Not showing</Badge>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={() => handlePair(station)}>
                  {station.paired ? "Move to another screen" : "Open on a screen"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setRemoving(station)}>
                  Remove
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
      {pairing && (
        <Modal open onClose={() => setPairing(null)} title={`Open “${pairing.station.name}”`} size="md">
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              On the screen at your entrance, scan this code or open the link below. Any screen previously showing
              this gate stops working.
            </p>
            <div className="flex justify-center">
              <QrCode value={pairing.link} size={220} label="Gate pairing link" />
            </div>
            <Input readOnly value={pairing.link} onFocus={(e) => e.target.select()} aria-label="Gate pairing link" />
            <Alert variant="warning">Treat this link like a key - anyone with it can show your gate code.</Alert>
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => void navigator.clipboard?.writeText(pairing.link)}
              >
                Copy link
              </Button>
              <Button onClick={() => window.open(pairing.link, "_blank", "noopener")}>Open on this device</Button>
            </div>
          </div>
        </Modal>
      )}
      {removing && (
        <ConfirmDialog
          title="Remove this gate?"
          message={<>The screen showing <strong>{removing.name}</strong> stops working at once.</>}
          confirmLabel="Remove"
          variant="danger"
          onConfirm={async () => {
            await removeStation(removing.id);
            setRemoving(null);
            reload();
          }}
          onClose={() => setRemoving(null)}
        />
      )}
    </section>
  );
}
