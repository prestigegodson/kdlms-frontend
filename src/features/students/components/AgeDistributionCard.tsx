import { CalendarDays, ChartNoAxesColumn } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { type AgeDistribution, getStudentAgeDistribution } from "@/api/students";
import { ApiError } from "@/api/client";
import { Alert } from "@/components/ui/Alert";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Spinner } from "@/components/ui/Spinner";

interface AgeDistributionCardProps {
  /** Renders nothing when there's nothing to show - the dashboard card's convention (`NeedsAttentionCard`/`UpcomingBirthdaysCard`'s precedent). */
  hideWhenEmpty?: boolean;
}

type LoadState =
  | { kind: "loading" }
  | { kind: "loaded"; distribution: AgeDistribution }
  | { kind: "error"; message: string };

/**
 * The school dashboard's "Age distribution" card - one horizontal bar per
 * whole-year age among ACTIVE students, self-fetching `GET
 * /api/v1/students/age-distribution` (SCHOOL_ADMIN/BRANCH_ADMIN only, scoped
 * server-side exactly like the "Active students" stat tile it complements).
 * Built from the same CSS-rail idiom as `RegisterProgress` rather than a
 * charting library - the repo has none, and style_guide.md's "honest
 * information, not decoration" stance fits a plain rail better than a new
 * dependency for one card.
 */
export function AgeDistributionCard({ hideWhenEmpty = false }: AgeDistributionCardProps) {
  const [state, setState] = useState<LoadState>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    getStudentAgeDistribution()
      .then((distribution) => {
        if (!cancelled) setState({ kind: "loaded", distribution });
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({
            kind: "error",
            message: error instanceof ApiError ? error.message : "Failed to load the age distribution",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.kind === "loaded" && state.distribution.totalStudents === 0 && hideWhenEmpty) {
    return null;
  }

  const distribution = state.kind === "loaded" ? state.distribution : undefined;
  const maxCount = distribution ? Math.max(0, ...distribution.bands.map((band) => band.count)) : 0;

  return (
    <Card className="p-0">
      <div className="flex items-center justify-between gap-2 p-6 pb-0">
        <h2 className="text-sm font-semibold text-slate-900">Age Distribution</h2>
        <ChartNoAxesColumn className="h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
      </div>

      {state.kind === "error" && (
        <Alert variant="error" className="mx-6 mb-6 mt-3">
          {state.message}
        </Alert>
      )}

      {state.kind === "loading" && (
        <div className="mb-6 mt-3 flex items-center gap-2 px-6 text-sm text-slate-500">
          <Spinner /> Loading…
        </div>
      )}

      {state.kind === "loaded" && distribution && distribution.totalStudents === 0 && (
        <div className="px-6 pb-6 pt-3">
          <EmptyState
            icon={ChartNoAxesColumn}
            title="No students yet"
            description="Register students to see how your school's ages break down."
            action={
              <Link to="/school/students" className="text-sm font-medium text-brand-700">
                Go to students
              </Link>
            }
          />
        </div>
      )}

      {state.kind === "loaded" && distribution && distribution.totalStudents > 0 && distribution.bands.length === 0 && (
        <div className="px-6 pb-6 pt-3">
          <EmptyState
            icon={CalendarDays}
            title="No dates of birth on file"
            description={`None of your ${distribution.totalStudents} active student${distribution.totalStudents === 1 ? "" : "s"} has a date of birth recorded, so there's no age breakdown to show.`}
            action={
              <Link to="/school/students" className="text-sm font-medium text-brand-700">
                Go to students
              </Link>
            }
          />
        </div>
      )}

      {state.kind === "loaded" && distribution && distribution.totalStudents > 0 && distribution.bands.length > 0 && (
        <div className="px-6 pb-6 pt-3">
          <ul className="space-y-2">
            {distribution.bands.map((band) => {
              // The rail's width is relative to the tallest band (maxCount),
              // so the largest group always fills the row - the printed
              // percentage is of totalStudents instead, so the numbers still
              // read as a share of the whole school.
              const railPercent = maxCount === 0 ? 0 : Math.round((band.count / maxCount) * 100);
              const sharePercent = Math.round((band.count / distribution.totalStudents) * 100);
              return (
                <li key={band.age} className="grid grid-cols-[2.50rem_1fr_auto] items-center gap-3">
                  <span className="text-xs tabular-nums text-slate-500">{band.age} yr{band.age > 1 ? 's':''}</span>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
                    <div
                      className="h-full rounded-full bg-brand-500 transition-[width] duration-300"
                      style={{ width: `${railPercent}%` }}
                    />
                  </div>
                  <span className="text-xs tabular-nums text-slate-500">
                    {band.count} / <span className="text-slate-400">{sharePercent}%</span>
                  </span>
                </li>
              );
            })}
          </ul>

          {distribution.unknownAge > 0 && (
            <p className="mt-4 text-xs text-slate-500">
              {distribution.unknownAge === 1
                ? "1 student has no date of birth on file."
                : `${distribution.unknownAge} students have no date of birth on file.`}
            </p>
          )}
        </div>
      )}
    </Card>
  );
}
