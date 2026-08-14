import { Cake } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { type BirthdayView, listClassBirthdays, listUpcomingBirthdays } from "@/api/birthdays";
import { downloadFile } from "@/api/files";
import { ApiError } from "@/api/client";
import { Alert } from "@/components/ui/Alert";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { useObjectUrl } from "@/hooks/useObjectUrl";
import { formatDayAndMonth, formatDaysUntil } from "@/utils/date";
import { initialsOfFullName } from "@/utils/initials";

interface UpcomingBirthdaysCardProps {
  /** Narrows to one class's birthdays (the class detail page). Omitted for the role-shaped dashboard list. */
  classId?: string;
  /** Renders nothing when there's nothing to show - the dashboard card's convention (`NeedsAttentionCard`'s precedent). Off by default for the class-page section, which shows an explicit empty message instead since its `Accordion` header is already there. */
  hideWhenEmpty?: boolean;
  /** Whether a row links to the student's detail page - an admin caller only; a TEACHER has no such route. */
  linkable?: boolean;
  /** Off for the class detail page, whose `Accordion` already supplies the "Upcoming birthdays" title - a second header would double up. On (with its own `Card` chrome) for the dashboard's standalone usage. */
  showHeader?: boolean;
}

type LoadState = { kind: "loading" } | { kind: "loaded"; rows: BirthdayView[] } | { kind: "error"; message: string };

/** Rows shown before "View more" - and the increment revealed per click. */
const PAGE_SIZE = 5;

/**
 * A compact "who has a birthday coming up" list, shared verbatim by the
 * school dashboard (`SchoolDashboardPage`, self-fetching the role-shaped
 * `GET /api/v1/birthdays`) and the class detail page (`classId` set, narrowed
 * to `GET /api/v1/classes/{classId}/birthdays`) - the same "one component,
 * two callers" precedent `AttendanceSummaryPanel`/`ThreadCard` set.
 */
export function UpcomingBirthdaysCard({
  classId,
  hideWhenEmpty = false,
  linkable = false,
  showHeader = true,
}: UpcomingBirthdaysCardProps) {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // A classId change resets to loading during render rather than as a
  // synchronous setState in the effect below - the same selectionKey/
  // lastSelectionKey pattern AttendanceTodayCard documents. The reveal
  // count resets alongside it, so a new class starts back at PAGE_SIZE
  // rather than inheriting the previous class's expanded state.
  const selectionKey = classId ?? "";
  const [lastSelectionKey, setLastSelectionKey] = useState(selectionKey);
  if (selectionKey !== lastSelectionKey) {
    setLastSelectionKey(selectionKey);
    setState({ kind: "loading" });
    setVisibleCount(PAGE_SIZE);
  }

  useEffect(() => {
    let cancelled = false;
    const request = classId ? listClassBirthdays(classId) : listUpcomingBirthdays();
    request
      .then((rows) => {
        if (!cancelled) setState({ kind: "loaded", rows });
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({
            kind: "error",
            message: error instanceof ApiError ? error.message : "Failed to load upcoming birthdays",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [classId]);

  if (state.kind === "loaded" && state.rows.length === 0 && hideWhenEmpty) {
    return null;
  }

  const rows = state.kind === "loaded" ? state.rows : [];
  const total = rows.length;
  const shown = rows.slice(0, visibleCount);
  const remaining = total - shown.length;
  const indentClass = showHeader ? "px-6" : "";

  const body = (
    <>
      {state.kind === "error" && (
        <Alert variant="error" className={showHeader ? "mx-6 mb-6 mt-3" : ""}>
          {state.message}
        </Alert>
      )}
      {state.kind === "loading" && (
        <div className={`flex items-center gap-2 text-sm text-slate-500 ${showHeader ? "mb-6 mt-3 px-6" : ""}`}>
          <Spinner /> Loading…
        </div>
      )}
      {state.kind === "loaded" && total === 0 && (
        <p className={`text-sm text-slate-500 ${showHeader ? "px-6 pb-6 pt-3" : ""}`}>
          No birthdays in the next 7 days.
        </p>
      )}
      {state.kind === "loaded" && total > 0 && (
        <>
          {/* Headerless (Accordion) usage has no header badge to carry the
              total, so it gets its own count line instead. */}
          {!showHeader && (
            <p className={`text-xs text-slate-500 ${indentClass}`}>
              {total} upcoming birthday{total === 1 ? "" : "s"}
            </p>
          )}
          <ul className={`divide-y divide-slate-100 ${showHeader ? "mt-3 pb-2" : "mt-2"}`}>
            {shown.map((row) => (
              <BirthdayRow
                key={row.studentId}
                row={row}
                linkable={linkable}
                showClass={!classId}
                indent={showHeader}
              />
            ))}
          </ul>
          {total > PAGE_SIZE && (
            <div className={`flex justify-center border-t border-slate-100 py-2 ${indentClass}`}>
              {remaining > 0 ? (
                <Button variant="ghost" size="sm" onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}>
                  View more ({remaining})
                </Button>
              ) : (
                <Button variant="ghost" size="sm" onClick={() => setVisibleCount(PAGE_SIZE)}>
                  Show less
                </Button>
              )}
            </div>
          )}
        </>
      )}
    </>
  );

  if (!showHeader) {
    return body;
  }

  return (
    <Card className="p-0">
      <div className="flex items-center gap-2 p-6 pb-0">
        <h2 className="text-sm font-semibold text-slate-900">
          {state.kind === "loaded" && total > 0 && <Badge variant="neutral">{total}</Badge>}{" "}
          Upcoming birthday{ total > 1 ? 's': ''}
        </h2>
        <Cake className="h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
      </div>
      {body}
    </Card>
  );
}

interface BirthdayRowProps {
  row: BirthdayView;
  linkable: boolean;
  showClass: boolean;
  /** Horizontal padding to align with the `Card` header above it - off when there's no such header (embedded in an `Accordion`, which already pads its own body). */
  indent: boolean;
}

function BirthdayRow({ row, linkable, showClass, indent }: BirthdayRowProps) {
  const photoUrl = useObjectUrl(row.photoFileId, downloadFile);
  const content = (
    <div className={`flex min-h-14 items-center gap-3 py-2 ${indent ? "px-6" : ""}`}>
      <Avatar initials={initialsOfFullName(row.fullName)} url={photoUrl} size="lg" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-900">{row.fullName}</p>
        {showClass && <p className="truncate text-xs text-slate-500">{row.className}</p>}
        <p className="truncate text-xs text-slate-500">Turning {row.turningAge} years old</p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className="text-xs text-slate-500">{formatDayAndMonth(row.dateOfBirth)}</span>
        <Badge variant={row.daysUntil === 0 ? "success" : "neutral"}>
          {formatDaysUntil(row.daysUntil)}
        </Badge>
      </div>
    </div>
  );

  if (linkable) {
    return (
      <li>
        <Link to={`/school/students/${row.studentId}`} className="block rounded-control hover:bg-slate-50">
          {content}
        </Link>
      </li>
    );
  }
  return <li>{content}</li>;
}
