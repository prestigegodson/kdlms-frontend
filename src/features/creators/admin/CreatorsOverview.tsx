import {
  Archive,
  BadgePercent,
  CalendarClock,
  CheckCircle2,
  Clock,
  CreditCard,
  GraduationCap,
  MailWarning,
  PauseCircle,
  Radio,
  RefreshCw,
  ShieldCheck,
  UserRound,
  Users,
  Video,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { ApiError } from "@/api/client";
import {
  type CreatorDashboardCountRow,
  type CreatorDashboardCurrencyRevenue,
  type CreatorDashboardView,
  getCreatorDashboard,
} from "@/api/dashboard";
import { Card } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/ErrorState";
import { StatTile } from "@/components/ui/StatTile";
import { StatTileSkeleton } from "@/components/ui/StatTileSkeleton";
import { Tabs } from "@/components/ui/Tabs";
import { formatMoney, fromMinor } from "@/utils/currency";

type LoadState =
  | { kind: "loading" }
  | { kind: "loaded"; view: CreatorDashboardView }
  | { kind: "error"; message: string };

const MONTH_LABEL = new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "UTC" });

function n(value: number | undefined): string {
  return (value ?? 0).toLocaleString();
}

function hours(value: number | undefined): string {
  return `${(value ?? 0).toLocaleString(undefined, { maximumFractionDigits: 1 })} h`;
}

function percent(part: number, whole: number): string {
  return whole > 0 ? `${Math.round((part / whole) * 100)}%` : "0%";
}

function monthLabel(month: string): string {
  return MONTH_LABEL.format(new Date(`${month}-01T00:00:00Z`));
}

/**
 * The SYSTEM_ADMIN creators overview above the Creators list - creators, plans, classes, learners,
 * revenue and top creators, platform-wide. Loads and fails on its own, so a dashboard error never
 * hides the directory below it.
 */
export function CreatorsOverview() {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [retrying, setRetrying] = useState(false);

  const load = useCallback(() => {
    return getCreatorDashboard()
      .then((view) => setState({ kind: "loaded", view }))
      .catch((error: unknown) =>
        setState({
          kind: "error",
          message: error instanceof ApiError ? error.message : "Failed to load the tutors overview",
        }),
      );
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function retryLoad() {
    setRetrying(true);
    load().finally(() => setRetrying(false));
  }

  if (state.kind === "loading") {
    return (
      <section aria-label="Tutors overview loading" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, index) => (
          <StatTileSkeleton key={index} />
        ))}
      </section>
    );
  }
  if (state.kind === "error") {
    return <ErrorState message={state.message} onRetry={retryLoad} retrying={retrying} />;
  }
  // A partial body (tests stubbing a generic response) renders as zeros rather than crashing.
  if (!state.view?.creators) {
    return null;
  }
  return <Overview view={state.view} />;
}

function Overview({ view }: { view: CreatorDashboardView }) {
  const { creators, plans, classes, learners } = view;
  const liveCreators = creators.active + creators.suspended;

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-900">Overview</h2>
          <p className="text-xs text-slate-500">All-time totals &middot; updated every few minutes</p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            icon={Users}
            label="Total tutors"
            value={n(creators.total)}
            hint={`${n(creators.active)} active · ${n(creators.suspended)} suspended`}
          />
          <StatTile
            icon={Video}
            label="Classes created"
            value={n(classes.total)}
            hint={`${n(classes.active)} active · ${n(classes.archived)} archived`}
          />
          <StatTile
            icon={GraduationCap}
            label="Learners"
            value={n(learners.total)}
            hint={`${n(learners.activeEnrollments)} active enrollments`}
          />
          <StatTile
            icon={Clock}
            label="Hours taught"
            value={hours(classes.hoursDelivered)}
            hint={`${n(classes.sessionsHeld)} sessions held`}
          />
        </div>
      </section>

      <RevenueSection revenue={view.revenue ?? []} topByRevenue={view.top?.byRevenue ?? []} />

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">Tutors</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile icon={CheckCircle2} label="Active" value={n(creators.active)} />
          <StatTile icon={PauseCircle} label="Suspended" value={n(creators.suspended)} />
          <StatTile icon={Archive} label="Archived" value={n(creators.archived)} />
          <StatTile
            icon={MailWarning}
            label="Email not verified"
            value={n(creators.unverifiedEmail)}
            hint="Signed up but never confirmed"
          />
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <h3 className="text-sm font-semibold text-slate-900">New sign-ups</h3>
            <p className="text-xs text-slate-500">Per month, last six months</p>
            <MonthBars months={creators.signupsByMonth ?? []} />
          </Card>
          <Card>
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-900">Plans</h3>
              <p className="text-xs text-slate-500">
                {percent(plans.onPaidPlan, liveCreators)} on a paid plan
              </p>
            </div>
            <p className="text-xs text-slate-500">Tutors on each plan today</p>
            <HorizontalBars
              ariaLabel="Tutors per plan"
              rows={[
                ...(plans.plans ?? []).map((plan) => ({
                  key: plan.packageId,
                  label: plan.free ? `${plan.name} (free)` : plan.name,
                  value: plan.creators,
                })),
                ...(plans.withoutPlan > 0
                  ? [{ key: "none", label: "No plan", value: plans.withoutPlan, muted: true }]
                  : []),
              ]}
              empty="No tutor is on a plan yet."
            />
            <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-3 text-sm">
              <div className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4 text-brand-400" aria-hidden="true" />
                <dt className="text-slate-500">Auto-renew on</dt>
                <dd className="ml-auto font-medium tabular-nums text-slate-900">{n(plans.autoRenewOn)}</dd>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-brand-400" aria-hidden="true" />
                <dt className="text-slate-500">Renewal in grace</dt>
                <dd className="ml-auto font-medium tabular-nums text-slate-900">{n(plans.inGrace)}</dd>
              </div>
            </dl>
          </Card>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">Sessions</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile icon={Radio} label="Live now" value={n(classes.sessionsLive)} />
          <StatTile
            icon={CalendarClock}
            label="Next 7 days"
            value={n(classes.sessionsUpcoming)}
            hint={`${hours(classes.hoursUpcoming)} scheduled`}
          />
          <StatTile icon={XCircle} label="Cancelled" value={n(classes.sessionsCancelled)} />
          <StatTile
            icon={Clock}
            label="Learner attendance"
            value={hours(learners.attendanceHours)}
            hint="Time learners spent in live sessions"
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">Learners</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            icon={UserRound}
            label="Adults · Minors"
            value={`${n(learners.adults)} / ${n(learners.minors)}`}
          />
          <StatTile
            icon={CheckCircle2}
            label="With a login"
            value={n(learners.withLogin)}
            hint={`${percent(learners.withLogin, learners.total)} of learners`}
          />
          <StatTile icon={Users} label="Guardians" value={n(learners.guardians)} hint="Following a minor learner" />
          <StatTile icon={MailWarning} label="Pending invites" value={n(learners.pendingInvites)} />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">Top tutors</h2>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <TopList title="Most classes" rows={view.top?.byClasses ?? []} unit="classes" />
          <TopList title="Most learners" rows={view.top?.byLearners ?? []} unit="learners" />
        </div>
      </section>
    </div>
  );
}

interface RevenueSectionProps {
  revenue: CreatorDashboardCurrencyRevenue[];
  topByRevenue: CreatorDashboardView["top"]["byRevenue"];
}

/** Revenue stays per currency - a switch picks which one when creators paid in more than one. */
function RevenueSection({ revenue, topByRevenue }: RevenueSectionProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const current = revenue.find((row) => row.currency === selected) ?? revenue[0];

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-900">Payments received</h2>
        {revenue.length > 1 && current && (
          <Tabs
            ariaLabel="Currency"
            value={current.currency}
            onChange={setSelected}
            items={revenue.map((row) => ({ value: row.currency, label: row.currency }))}
          />
        )}
      </div>
      {!current ? (
        <Card>
          <p className="text-sm text-slate-500">No tutor has paid for a plan yet.</p>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile
              icon={CreditCard}
              label="Total received"
              value={formatMoney(fromMinor(current.receivedMinor), current.currency)}
              hint={`${n(current.successfulCharges)} successful payments`}
            />
            <StatTile
              icon={CalendarClock}
              label="Last 30 days"
              value={formatMoney(fromMinor(current.last30DaysMinor), current.currency)}
            />
            <StatTile
              icon={BadgePercent}
              label="Coupon discounts"
              value={formatMoney(fromMinor(current.discountMinor), current.currency)}
            />
            <StatTile
              icon={XCircle}
              label="Failed · Abandoned"
              value={`${n(current.failedCharges)} / ${n(current.abandonedCharges)}`}
              hint={`${percent(current.successfulCharges, current.successfulCharges + current.failedCharges + current.abandonedCharges)} of attempts succeed`}
            />
          </div>
          <TopList
            title={`Top tutors by payments (${current.currency})`}
            rows={topByRevenue
              .filter((row) => row.currency === current.currency)
              .map((row) => ({ schoolId: row.schoolId, name: row.name, count: row.amountMinor }))}
            format={(amountMinor) => formatMoney(fromMinor(amountMinor), current.currency)}
          />
        </>
      )}
    </section>
  );
}

interface TopListProps {
  title: string;
  rows: CreatorDashboardCountRow[];
  unit?: string;
  format?: (value: number) => string;
}

function TopList({ title, rows, unit, format }: TopListProps) {
  return (
    <Card>
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">Nothing yet.</p>
      ) : (
        <ol className="mt-2 divide-y divide-slate-100">
          {rows.map((row, index) => (
            <li key={row.schoolId}>
              <Link
                to={`/admin/tutors/${row.schoolId}`}
                className="flex items-center gap-3 py-2 text-sm hover:text-brand-600 mobile:min-h-11"
              >
                <span className="w-4 shrink-0 text-xs tabular-nums text-slate-400">{index + 1}</span>
                <span className="min-w-0 flex-1 truncate font-medium text-slate-900">{row.name}</span>
                <span className="shrink-0 tabular-nums text-slate-600">
                  {format ? format(row.count) : `${n(row.count)}${unit ? ` ${unit}` : ""}`}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

/** Single-series column chart: one brand hue, value labelled on every column (there are only six). */
function MonthBars({ months }: { months: CreatorDashboardView["creators"]["signupsByMonth"] }) {
  const max = Math.max(1, ...months.map((month) => month.count));
  return (
    <div className="mt-4">
      <ol className="flex h-36 items-end gap-2" aria-label="New sign-ups per month">
        {months.map((month) => (
          <li
            key={month.month}
            className="flex h-full min-w-0 flex-1 flex-col items-center justify-end"
            title={`${monthLabel(month.month)}: ${month.count} sign-ups`}
          >
            <span className="mb-1 text-xs font-medium tabular-nums text-slate-700">{n(month.count)}</span>
            <span
              className="block w-full max-w-10 rounded-t bg-brand-500"
              style={{ height: `${Math.max(month.count > 0 ? 4 : 1, (month.count / max) * 100)}%` }}
              aria-hidden="true"
            />
          </li>
        ))}
      </ol>
      <div className="mt-1 flex gap-2 border-t border-slate-200 pt-1">
        {months.map((month) => (
          <span key={month.month} className="min-w-0 flex-1 truncate text-center text-xs text-slate-500">
            {monthLabel(month.month)}
          </span>
        ))}
      </div>
    </div>
  );
}

interface BarRow {
  key: string;
  label: string;
  value: number;
  muted?: boolean;
}

/** Single-series bar list; each row's label and value are text, so the bar is never the only cue. */
function HorizontalBars({ ariaLabel, rows, empty }: { ariaLabel: string; rows: BarRow[]; empty: string }) {
  if (rows.length === 0) {
    return <p className="mt-3 text-sm text-slate-500">{empty}</p>;
  }
  const max = Math.max(1, ...rows.map((row) => row.value));
  return (
    <ul className="mt-3 space-y-2" aria-label={ariaLabel}>
      {rows.map((row) => (
        <li key={row.key} title={`${row.label}: ${row.value}`}>
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="min-w-0 truncate text-slate-700">{row.label}</span>
            <span className="shrink-0 font-medium tabular-nums text-slate-900">{n(row.value)}</span>
          </div>
          <div className="mt-1 h-2 w-full rounded bg-slate-100">
            <div
              className={`h-2 rounded ${row.muted ? "bg-slate-300" : "bg-brand-500"}`}
              style={{ width: `${Math.max(row.value > 0 ? 2 : 0, (row.value / max) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
