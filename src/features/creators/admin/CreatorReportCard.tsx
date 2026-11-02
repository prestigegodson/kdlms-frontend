import {
  BookOpen,
  CalendarClock,
  CircleCheck,
  Clock,
  CreditCard,
  FileQuestion,
  Hourglass,
  TriangleAlert,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { getErrorMessage } from "@/api/client";
import { type CreatorReportView, getCreatorReport } from "@/api/dashboard";
import { listAdminPaymentTransactions, type PaymentTransactionView } from "@/api/subscriptionBilling";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { StatTile } from "@/components/ui/StatTile";
import { StatTileSkeleton } from "@/components/ui/StatTileSkeleton";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/Table";
import { Tabs } from "@/components/ui/Tabs";
import { PAYMENT_STATUS_LABEL, PAYMENT_STATUS_VARIANT } from "@/features/subscriptionBilling/paymentStatus";
import { quizStatusLabel, quizStatusVariant } from "@/features/takeHomeQuizzes/takeHomeQuizStatus";
import { formatMoney, fromMinor } from "@/utils/currency";
import { formatInstant } from "@/utils/date";

const RECENT_TRANSACTIONS = 5;

type State =
  | { kind: "loading" }
  | { kind: "loaded"; report: CreatorReportView; transactions: PaymentTransactionView[] }
  | { kind: "error"; message: string };

const n = (value: number) => value.toLocaleString();

const hours = (value: number) => `${value.toLocaleString()} h`;

/**
 * The system admin's report on one tutor: classes, learners, hours taught, quizzes and who attempted
 * them, and what the tutor has
 * paid the platform for their plan. Loads on its own, so a failure here never blocks the rest of
 * the tutor detail page. Render it with `key={schoolId}` so a different tutor starts from loading.
 */
export function CreatorReportCard({ schoolId }: { schoolId: string }) {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      getCreatorReport(schoolId),
      listAdminPaymentTransactions("", 0, RECENT_TRANSACTIONS, schoolId),
    ])
      .then(([report, page]) => {
        if (!cancelled) setState({ kind: "loaded", report, transactions: page.content });
      })
      .catch((error: unknown) => {
        if (!cancelled) setState({ kind: "error", message: getErrorMessage(error, "Failed to load the tutor report") });
      });
    return () => {
      cancelled = true;
    };
  }, [schoolId]);

  return (
    <section className="space-y-4" aria-labelledby="tutor-report-heading">
      <h2 id="tutor-report-heading" className="text-sm font-semibold text-slate-900">
        Report
      </h2>
      {state.kind === "error" && <Alert variant="error">{state.message}</Alert>}
      {state.kind === "loading" && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <StatTileSkeleton key={index} />
          ))}
        </div>
      )}
      {state.kind === "loaded" && (
        <>
          <ActivityTiles report={state.report} />
          <QuizzesSection report={state.report} />
          <PaymentsSection report={state.report} transactions={state.transactions} />
        </>
      )}
    </section>
  );
}

function ActivityTiles({ report }: { report: CreatorReportView }) {
  const { classes, learners } = report;
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatTile
        icon={BookOpen}
        label="Classes created"
        value={n(classes.total)}
        hint={`${n(classes.active)} active · ${n(classes.archived)} archived`}
      />
      <StatTile
        icon={Users}
        label="Learners"
        value={n(learners.total)}
        hint={`${n(learners.activeEnrollments)} active enrolments`}
      />
      <StatTile
        icon={Clock}
        label="Hours taught"
        value={hours(classes.hoursDelivered)}
        hint={`${n(classes.sessionsHeld)} sessions held`}
      />
      <StatTile
        icon={CalendarClock}
        label="Upcoming sessions"
        value={n(classes.sessionsUpcoming)}
        hint={`${hours(classes.hoursUpcoming)} in the next 7 days`}
      />
    </div>
  );
}

function QuizzesSection({ report }: { report: CreatorReportView }) {
  const { quizzes, recentQuizzes } = report;
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-slate-900">Quizzes</h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          icon={FileQuestion}
          label="Quizzes created"
          value={n(quizzes.total)}
          hint={`${n(quizzes.published)} published · ${n(quizzes.drafts)} drafts`}
        />
        <StatTile
          icon={Users}
          label="Learners attempted"
          value={n(quizzes.learnersAttempted)}
          hint="Distinct learners across all quizzes"
        />
        <StatTile
          icon={CircleCheck}
          label="Quiz attempts"
          value={n(quizzes.attempts)}
          hint={`${n(quizzes.submittedAttempts)} submitted`}
        />
      </div>

      {recentQuizzes.length === 0 ? (
        <Card>
          <p className="text-sm text-slate-500">No quizzes yet.</p>
        </Card>
      ) : (
        <Card className="p-0">
          <h3 className="px-5 pt-4 text-sm font-semibold text-slate-900">Recent quizzes</h3>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Quiz</TableHeaderCell>
                <TableHeaderCell>Class</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
                <TableHeaderCell>Created</TableHeaderCell>
                <TableHeaderCell numeric>Learners attempted</TableHeaderCell>
                <TableHeaderCell numeric>Submitted</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {recentQuizzes.map((quiz) => (
                <TableRow key={quiz.quizId}>
                  <TableCell label="Quiz" className="font-medium text-slate-900">
                    {quiz.title}
                  </TableCell>
                  <TableCell label="Class">{quiz.className ?? "—"}</TableCell>
                  <TableCell label="Status">
                    <Badge variant={quizStatusVariant(quiz.status, null)}>{quizStatusLabel(quiz.status, null)}</Badge>
                  </TableCell>
                  <TableCell label="Created">{formatInstant(quiz.createdAt)}</TableCell>
                  <TableCell label="Learners attempted" numeric>
                    {n(quiz.learnersAttempted)}
                  </TableCell>
                  <TableCell label="Submitted" numeric>
                    {n(quiz.submitted)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

function PaymentsSection({
  report,
  transactions,
}: {
  report: CreatorReportView;
  transactions: PaymentTransactionView[];
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const current = report.payments.find((row) => row.currency === selected) ?? report.payments[0];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Plan payments</h3>
          <p className="text-xs text-slate-500">
            {report.lastPaidAt ? `Last payment ${formatInstant(report.lastPaidAt)}` : "No successful payment yet"}
          </p>
        </div>
        {report.payments.length > 1 && current && (
          <Tabs
            ariaLabel="Currency"
            value={current.currency}
            onChange={setSelected}
            items={report.payments.map((row) => ({ value: row.currency, label: row.currency }))}
          />
        )}
      </div>

      {!current ? (
        <Card>
          <p className="text-sm text-slate-500">No payments yet.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            icon={CreditCard}
            label="Total paid"
            value={formatMoney(fromMinor(current.paidMinor), current.currency)}
            hint={`${n(current.successfulCharges)} successful payments`}
          />
          <StatTile
            icon={CalendarClock}
            label="Last 30 days"
            value={formatMoney(fromMinor(current.last30DaysMinor), current.currency)}
          />
          <StatTile
            icon={Hourglass}
            label="Pending"
            value={formatMoney(fromMinor(current.pendingMinor), current.currency)}
            hint={`${n(current.pendingCharges)} pending transactions`}
          />
          <StatTile
            icon={TriangleAlert}
            label="Failed / abandoned"
            value={n(current.failedCharges + current.abandonedCharges)}
            hint={`${n(current.failedCharges)} failed · ${n(current.abandonedCharges)} abandoned`}
          />
        </div>
      )}

      {transactions.length > 0 && (
        <Card className="p-0">
          <h3 className="px-5 pt-4 text-sm font-semibold text-slate-900">Recent transactions</h3>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Date</TableHeaderCell>
                <TableHeaderCell>Plan</TableHeaderCell>
                <TableHeaderCell numeric>Amount</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
                <TableHeaderCell>Reference</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {transactions.map((payment) => (
                <TableRow key={payment.id}>
                  <TableCell label="Date">{formatInstant(payment.paidAt ?? payment.createdAt)}</TableCell>
                  <TableCell label="Plan">
                    {payment.planName ?? "—"}
                    {payment.purpose === "RENEWAL" && <span className="ml-1 text-xs text-slate-500">(renewal)</span>}
                  </TableCell>
                  <TableCell label="Amount" numeric>
                    {formatMoney(fromMinor(payment.amountMinor), payment.currency)}
                  </TableCell>
                  <TableCell label="Status">
                    <Badge variant={PAYMENT_STATUS_VARIANT[payment.status]}>{PAYMENT_STATUS_LABEL[payment.status]}</Badge>
                  </TableCell>
                  <TableCell label="Reference" className="font-mono text-xs text-slate-500">
                    {payment.reference}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
