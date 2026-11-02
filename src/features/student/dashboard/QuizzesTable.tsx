import { ClipboardList } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import type { MyTakeHomeQuizSummaryView } from "@/api/myTakeHomeQuizzes";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/Table";
import { Tabs } from "@/components/ui/Tabs";
import { ProgressBar } from "@/features/student/dashboard/ProgressBar";
import { QUIZ_STATUS, quizStatus, scorePercent, type QuizStatusKey } from "@/features/student/dashboard/studentDashboardStats";
import { formatInstantDate } from "@/utils/date";

type Filter = "all" | "todo" | QuizStatusKey;

const FILTERS: Array<{ value: Filter; label: string }> = [
  { value: "all", label: "All" },
  { value: "todo", label: "To do" },
  { value: "completed", label: "Completed" },
  { value: "upcoming", label: "Upcoming" },
  { value: "missed", label: "Missed" },
];

function matches(filter: Filter, status: QuizStatusKey): boolean {
  if (filter === "all") {
    return true;
  }
  if (filter === "todo") {
    return status === "available" || status === "inProgress";
  }
  return status === filter;
}

/** The mockup's assignment table, fed by take-home quizzes - due soonest first. */
export function QuizzesTable({ quizzes }: { quizzes: MyTakeHomeQuizSummaryView[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const rows = quizzes
    .map((quiz) => ({ quiz, status: quizStatus(quiz), percent: scorePercent(quiz) }))
    .filter((row) => matches(filter, row.status))
    .sort((a, b) => Date.parse(a.quiz.closesAt) - Date.parse(b.quiz.closesAt));

  return (
    <Card className="!p-0">
      <div className="flex flex-wrap items-center justify-between px-4 pt-4 sm:px-6">
        <h2 className="mb-2 mr-4 font-display text-base font-medium text-slate-900">My quizzes</h2>
        <Link to="/student/quizzes" className="mb-2 text-sm font-medium text-brand-600 hover:text-brand-700">
          View all
        </Link>
      </div>
      <div className="px-4 sm:px-6">
        <Tabs ariaLabel="Filter quizzes" value={filter} onChange={setFilter} items={FILTERS} />
      </div>
      {rows.length === 0 ? (
        <div className="p-6">
          <EmptyState icon={ClipboardList} title="No quizzes here" description="Try another filter." />
        </div>
      ) : (
        <Table>
          <TableHead>
            <tr>
              <TableHeaderCell>Quiz</TableHeaderCell>
              <TableHeaderCell>Due</TableHeaderCell>
              <TableHeaderCell>Score</TableHeaderCell>
              <TableHeaderCell>Status</TableHeaderCell>
              <th aria-hidden="true" />
            </tr>
          </TableHead>
          <TableBody>
            {rows.map(({ quiz, status, percent }) => (
              <TableRow key={quiz.id} to={`/student/quizzes/${quiz.id}`}>
                <TableCell label="Quiz">
                  <span className="block font-medium text-slate-900">{quiz.title}</span>
                  <span className="block text-xs text-slate-500">{quiz.subjectName}</span>
                </TableCell>
                <TableCell label="Due" className="whitespace-nowrap">
                  {formatInstantDate(quiz.closesAt)}
                </TableCell>
                <TableCell label="Score">
                  {percent === null ? (
                    <span className="text-slate-400">—</span>
                  ) : (
                    <span className="flex items-center">
                      <span className="w-10 tabular-nums">{percent}%</span>
                      <ProgressBar percent={percent} label={`${quiz.title} score`} className="ml-2 max-w-[8rem]" />
                    </span>
                  )}
                </TableCell>
                <TableCell label="Status">
                  <Badge variant={QUIZ_STATUS[status].variant}>{QUIZ_STATUS[status].label}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Card>
  );
}
