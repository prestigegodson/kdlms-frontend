import { Coins, Files, HardDrive, PiggyBank, Play } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiError } from "@/api/client";
import {
  type ClassShare,
  getStorageBySchool,
  getStorageOverview,
  getTieringRuns,
  type SchoolStorage,
  STORAGE_CLASSES,
  type StorageClass,
  type StorageOverview,
  type StorageTieringRun,
  startTieringRun,
} from "@/api/storage";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatTile } from "@/components/ui/StatTile";
import { StatTileSkeleton } from "@/components/ui/StatTileSkeleton";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/Table";
import { TableSkeleton } from "@/components/ui/TableSkeleton";
import { Tabs } from "@/components/ui/Tabs";
import { formatStorageSize } from "@/features/storage/format";
import { formatMoney } from "@/utils/currency";

/** How often the page refreshes while a run is queued or running. */
const ACTIVE_RUN_POLL_MS = 5000;

/**
 * The classes are ordered (warm to cold), so they take one hue light to dark rather than
 * categorical colors - the darker the segment, the colder the storage.
 */
const CLASS_META: Record<StorageClass, { label: string; hint: string; swatch: string }> = {
  STANDARD: { label: "Standard", hint: "Read recently", swatch: "bg-brand-200" },
  STANDARD_IA: { label: "Infrequent Access", hint: "Rarely read", swatch: "bg-brand-500" },
  GLACIER_IR: { label: "Glacier Instant Retrieval", hint: "Archived, still instant to open", swatch: "bg-brand-800" },
};

type Measure = "files" | "bytes";
type SchoolSort = "bytes" | "files" | "cold";

type LoadState =
  | { kind: "loading" }
  | { kind: "loaded"; overview: StorageOverview; schools: SchoolStorage[]; runs: StorageTieringRun[] }
  | { kind: "error"; message: string };

function formatUsd(amount: number): string {
  return formatMoney(amount, "USD");
}

function formatDateTime(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString() : "—";
}

function coldPercent(school: SchoolStorage): number {
  if (school.bytes === 0) {
    return 0;
  }
  const cold = (school.byClass.STANDARD_IA?.bytes ?? 0) + (school.byClass.GLACIER_IR?.bytes ?? 0);
  return (cold / school.bytes) * 100;
}

/** SYSTEM_ADMIN storage page - how many files the platform holds and how they split across S3 storage classes. */
export function AdminStoragePage() {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [retrying, setRetrying] = useState(false);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [measure, setMeasure] = useState<Measure>("bytes");
  const [schoolSort, setSchoolSort] = useState<SchoolSort>("bytes");

  const load = useCallback(() => {
    return Promise.all([getStorageOverview(), getStorageBySchool(), getTieringRuns()])
      .then(([overview, schools, runs]) => setState({ kind: "loaded", overview, schools, runs }))
      .catch((error: unknown) =>
        setState({
          kind: "error",
          message: error instanceof ApiError ? error.message : "Failed to load storage",
        }),
      );
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const activeRun = state.kind === "loaded" ? state.overview.activeRun : null;

  useEffect(() => {
    if (!activeRun) {
      return undefined;
    }
    const timer = window.setInterval(() => {
      void load();
    }, ACTIVE_RUN_POLL_MS);
    return () => window.clearInterval(timer);
  }, [activeRun, load]);

  function retryLoad() {
    setRetrying(true);
    load().finally(() => setRetrying(false));
  }

  function runNow() {
    setStarting(true);
    setStartError(null);
    startTieringRun()
      .then(() => load())
      .catch((error: unknown) =>
        setStartError(error instanceof ApiError ? error.message : "Could not start a tiering run"),
      )
      .finally(() => setStarting(false));
  }

  const tieringEnabled = state.kind === "loaded" && state.overview.tieringEnabled;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Storage"
        description="Files stored across every school and how they are tiered across S3 storage classes."
        actions={
          state.kind === "loaded" && (
            <Button
              onClick={runNow}
              loading={starting}
              disabled={!tieringEnabled || activeRun !== null}
              title={
                !tieringEnabled
                  ? "Tiering is turned off on this server"
                  : activeRun
                    ? "A run is already in progress"
                    : undefined
              }
            >
              <Play className="h-4 w-4" aria-hidden="true" />
              Run now
            </Button>
          )
        }
      />

      {state.kind === "error" && <ErrorState message={state.message} onRetry={retryLoad} retrying={retrying} />}

      {state.kind === "loading" && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <StatTileSkeleton key={index} />
            ))}
          </div>
          <Card className="p-0">
            <TableSkeleton rows={3} columns={5} />
          </Card>
        </>
      )}

      {state.kind === "loaded" && (
        <>
          {!state.overview.tieringEnabled && (
            <Alert variant="info" title="Tiering is turned off">
              Files stay in Standard until <code>FILE_TIERING_ENABLED</code> is set on a server backed by real S3.
            </Alert>
          )}
          {startError && <Alert variant="error">{startError}</Alert>}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile icon={Files} label="Files" value={state.overview.totalFiles.toLocaleString()} />
            <StatTile icon={HardDrive} label="Total size" value={formatStorageSize(state.overview.totalBytes)} />
            <StatTile
              icon={Coins}
              label="Est. monthly cost"
              value={formatUsd(state.overview.estimatedMonthlyCost)}
              hint="Storage only, at list prices"
            />
            <StatTile
              icon={PiggyBank}
              label="Saved by tiering"
              value={formatUsd(
                Math.max(0, state.overview.estimatedMonthlyCostIfAllStandard - state.overview.estimatedMonthlyCost),
              )}
              hint={`vs ${formatUsd(state.overview.estimatedMonthlyCostIfAllStandard)} all in Standard`}
            />
          </div>

          <StorageClassesCard overview={state.overview} measure={measure} onMeasureChange={setMeasure} />

          <TieringRunsCard activeRun={state.overview.activeRun} runs={state.runs} />

          <SchoolsCard schools={state.schools} sort={schoolSort} onSortChange={setSchoolSort} />
        </>
      )}
    </div>
  );
}

function StorageClassesCard({
  overview,
  measure,
  onMeasureChange,
}: {
  overview: StorageOverview;
  measure: Measure;
  onMeasureChange: (measure: Measure) => void;
}) {
  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-sm font-semibold text-slate-900">Storage classes</h2>
        <Tabs
          ariaLabel="Measure"
          value={measure}
          onChange={onMeasureChange}
          items={[
            { value: "bytes", label: "By size" },
            { value: "files", label: "By files" },
          ]}
        />
      </div>

      <StorageSplitBar shares={overview.byClass} measure={measure} />

      <Table>
        <TableHead>
          <tr>
            <TableHeaderCell>Class</TableHeaderCell>
            <TableHeaderCell numeric>Files</TableHeaderCell>
            <TableHeaderCell numeric>Size</TableHeaderCell>
            <TableHeaderCell numeric>Share</TableHeaderCell>
            <TableHeaderCell numeric>Est. monthly cost</TableHeaderCell>
          </tr>
        </TableHead>
        <TableBody>
          {overview.byClass.map((share) => (
            <TableRow key={share.storageClass}>
              <TableCell label="Class">
                <span className="flex items-center gap-2">
                  <span
                    className={`h-3 w-3 shrink-0 rounded-sm ${CLASS_META[share.storageClass].swatch}`}
                    aria-hidden="true"
                  />
                  <span>
                    <span className="block text-slate-900">{CLASS_META[share.storageClass].label}</span>
                    <span className="block text-xs text-slate-500">{CLASS_META[share.storageClass].hint}</span>
                  </span>
                </span>
              </TableCell>
              <TableCell label="Files" numeric>
                {share.files.toLocaleString()}
              </TableCell>
              <TableCell label="Size" numeric>
                {formatStorageSize(share.bytes)}
              </TableCell>
              <TableCell label="Share" numeric>
                {(measure === "files" ? share.filePercent : share.bytePercent).toFixed(1)}%
              </TableCell>
              <TableCell label="Est. monthly cost" numeric>
                {formatUsd(share.estimatedMonthlyCost)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

/** A single 100% bar split by class, with a hover/focus tooltip per segment and a legend underneath. */
function StorageSplitBar({ shares, measure }: { shares: ClassShare[]; measure: Measure }) {
  const [hovered, setHovered] = useState<StorageClass | null>(null);
  const visible = shares.filter((share) => (measure === "files" ? share.files : share.bytes) > 0);
  const percentOf = (share: ClassShare) => (measure === "files" ? share.filePercent : share.bytePercent);
  const hoveredShare = visible.find((share) => share.storageClass === hovered);

  if (visible.length === 0) {
    return <p className="text-sm text-slate-500">No files stored yet.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <div
          className="flex h-4 w-full gap-[2px] overflow-hidden rounded bg-white"
          role="img"
          aria-label={visible
            .map((share) => `${CLASS_META[share.storageClass].label} ${percentOf(share).toFixed(1)}%`)
            .join(", ")}
        >
          {visible.map((share) => (
            <div
              key={share.storageClass}
              data-testid={`segment-${share.storageClass}`}
              tabIndex={0}
              className={`h-full min-w-[4px] cursor-default outline-none first:rounded-l last:rounded-r focus-visible:ring-2 focus-visible:ring-brand-400 ${CLASS_META[share.storageClass].swatch}`}
              style={{ flexGrow: percentOf(share), flexBasis: 0 }}
              onMouseEnter={() => setHovered(share.storageClass)}
              onMouseLeave={() => setHovered(null)}
              onFocus={() => setHovered(share.storageClass)}
              onBlur={() => setHovered(null)}
            />
          ))}
        </div>
        {hoveredShare && (
          <div
            role="tooltip"
            className="pointer-events-none absolute bottom-full left-1/2 mb-2 -translate-x-1/2 whitespace-nowrap rounded-control border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm"
          >
            <p className="font-semibold text-slate-900">{CLASS_META[hoveredShare.storageClass].label}</p>
            <p className="tabular-nums text-slate-600">
              {hoveredShare.files.toLocaleString()} files &middot; {formatStorageSize(hoveredShare.bytes)} &middot;{" "}
              {percentOf(hoveredShare).toFixed(1)}%
            </p>
          </div>
        )}
      </div>
      <ul className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-600">
        {shares.map((share) => (
          <li key={share.storageClass} className="flex items-center gap-1.5">
            <span className={`h-2.5 w-2.5 rounded-sm ${CLASS_META[share.storageClass].swatch}`} aria-hidden="true" />
            <span>{CLASS_META[share.storageClass].label}</span>
            <span className="tabular-nums text-slate-900">{percentOf(share).toFixed(1)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const RUN_STATUS_BADGE: Record<StorageTieringRun["status"], "neutral" | "info" | "success" | "danger"> = {
  QUEUED: "neutral",
  RUNNING: "info",
  SUCCEEDED: "success",
  FAILED: "danger",
};

const RUN_STATUS_LABEL: Record<StorageTieringRun["status"], string> = {
  QUEUED: "Queued",
  RUNNING: "Running",
  SUCCEEDED: "Succeeded",
  FAILED: "Failed",
};

function TieringRunsCard({ activeRun, runs }: { activeRun: StorageTieringRun | null; runs: StorageTieringRun[] }) {
  return (
    <Card className="space-y-3 p-0">
      <div className="flex flex-wrap items-baseline justify-between gap-2 px-5 pt-5">
        <h2 className="text-sm font-semibold text-slate-900">Tiering runs</h2>
        <p className="text-xs text-slate-500">
          {activeRun
            ? activeRun.status === "QUEUED"
              ? "A run is queued and starts within a minute."
              : `Running - ${activeRun.tally.scanned.toLocaleString()} files checked so far.`
            : "Runs every day at 02:00 (Africa/Lagos)."}
        </p>
      </div>
      {runs.length === 0 ? (
        <div className="px-5 pb-5">
          <EmptyState title="No runs yet" description="The first nightly run will appear here." />
        </div>
      ) : (
        <Table>
          <TableHead>
            <tr>
              <TableHeaderCell>Started</TableHeaderCell>
              <TableHeaderCell>Trigger</TableHeaderCell>
              <TableHeaderCell>Status</TableHeaderCell>
              <TableHeaderCell numeric>Checked</TableHeaderCell>
              <TableHeaderCell numeric>To Standard</TableHeaderCell>
              <TableHeaderCell numeric>To Infrequent</TableHeaderCell>
              <TableHeaderCell numeric>To Glacier IR</TableHeaderCell>
              <TableHeaderCell numeric>Failed</TableHeaderCell>
            </tr>
          </TableHead>
          <TableBody>
            {runs.map((run) => (
              <TableRow key={run.id}>
                <TableCell label="Started">{formatDateTime(run.startedAt ?? run.queuedAt)}</TableCell>
                <TableCell label="Trigger">{run.trigger === "MANUAL" ? "Manual" : "Nightly"}</TableCell>
                <TableCell label="Status">
                  <span title={run.error ?? undefined}>
                    <Badge variant={RUN_STATUS_BADGE[run.status]}>{RUN_STATUS_LABEL[run.status]}</Badge>
                  </span>
                </TableCell>
                <TableCell label="Checked" numeric>
                  {run.tally.scanned.toLocaleString()}
                </TableCell>
                <TableCell label="To Standard" numeric>
                  {run.tally.toStandard.toLocaleString()}
                </TableCell>
                <TableCell label="To Infrequent" numeric>
                  {run.tally.toStandardIa.toLocaleString()}
                </TableCell>
                <TableCell label="To Glacier IR" numeric>
                  {run.tally.toGlacierIr.toLocaleString()}
                </TableCell>
                <TableCell label="Failed" numeric>
                  {run.tally.failed.toLocaleString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Card>
  );
}

function SchoolsCard({
  schools,
  sort,
  onSortChange,
}: {
  schools: SchoolStorage[];
  sort: SchoolSort;
  onSortChange: (sort: SchoolSort) => void;
}) {
  const sorted = useMemo(() => {
    const key: Record<SchoolSort, (school: SchoolStorage) => number> = {
      bytes: (school) => school.bytes,
      files: (school) => school.files,
      cold: coldPercent,
    };
    return [...schools].sort((a, b) => key[sort](b) - key[sort](a));
  }, [schools, sort]);

  return (
    <Card className="space-y-3 p-0">
      <div className="flex flex-wrap items-end justify-between gap-3 px-5 pt-5">
        <h2 className="text-sm font-semibold text-slate-900">By school</h2>
        <Tabs
          ariaLabel="Sort schools by"
          value={sort}
          onChange={onSortChange}
          items={[
            { value: "bytes", label: "Size" },
            { value: "files", label: "Files" },
            { value: "cold", label: "% tiered" },
          ]}
        />
      </div>
      {sorted.length === 0 ? (
        <div className="px-5 pb-5">
          <EmptyState title="No files yet" description="Schools' uploads will appear here." />
        </div>
      ) : (
        <Table>
          <TableHead>
            <tr>
              <TableHeaderCell>School</TableHeaderCell>
              <TableHeaderCell numeric>Files</TableHeaderCell>
              <TableHeaderCell numeric>Size</TableHeaderCell>
              {STORAGE_CLASSES.map((storageClass) => (
                <TableHeaderCell key={storageClass} numeric>
                  {CLASS_META[storageClass].label}
                </TableHeaderCell>
              ))}
              <TableHeaderCell numeric>% tiered</TableHeaderCell>
            </tr>
          </TableHead>
          <TableBody>
            {sorted.map((school) => (
              <TableRow key={school.schoolId ?? "system"}>
                <TableCell label="School" className="text-slate-900">
                  {school.schoolId === null ? "Platform (system assets)" : (school.schoolName ?? "Unknown school")}
                </TableCell>
                <TableCell label="Files" numeric>
                  {school.files.toLocaleString()}
                </TableCell>
                <TableCell label="Size" numeric>
                  {formatStorageSize(school.bytes)}
                </TableCell>
                {STORAGE_CLASSES.map((storageClass) => (
                  <TableCell key={storageClass} label={CLASS_META[storageClass].label} numeric>
                    {formatStorageSize(school.byClass[storageClass]?.bytes ?? 0)}
                  </TableCell>
                ))}
                <TableCell label="% tiered" numeric>
                  {coldPercent(school).toFixed(1)}%
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Card>
  );
}
