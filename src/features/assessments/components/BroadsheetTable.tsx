import type { BroadsheetView } from "@/api/assessments";
import type { ResultScope } from "@/api/types";
import { broadsheetLayout } from "@/features/assessments/broadsheet";
import { classAverageCellText, scoreCellText, scoreHeader } from "@/features/assessments/finalScore";
import { Badge } from "@/components/ui/Badge";

interface BroadsheetTableProps {
  broadsheet: BroadsheetView;
  /** Defaults to "TERM" - a MIDTERM broadsheet never shows Total/Average/Position columns, since they're always null on that scope (see CLAUDE.md's ResultScope domain rule). */
  scope?: ResultScope;
}

/**
 * The whole-class results grid - the one bespoke table in this phase. N
 * subject columns can't collapse into stacked cards the way a 3-4 column
 * form can (see index.css's `.responsive-table` rules), so this
 * deliberately opts out: a plain `<table>` in its own `overflow-x-auto`
 * wrapper with a sticky student column, rather than `components/ui/Table`.
 * Subject headers abbreviate to their code, with the full name in `title`.
 * Column/row derivation lives in `broadsheetLayout`, shared with the CSV
 * export so the two never disagree. Inside a `BroadsheetPrintArea` the
 * scroll wrapper and sticky column are flattened by index.css's print rules.
 */
export function BroadsheetTable({ broadsheet, scope = "TERM" }: BroadsheetTableProps) {
  const { isNumeric, showsAggregates, showClassAverage, rows, scoreMaxFor } = broadsheetLayout(broadsheet, scope);

  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-500 lg:hidden print:hidden">Scroll sideways to see every subject &rarr;</p>
      <div className="overflow-x-auto overscroll-x-contain rounded-card border border-slate-200">
        <table className="min-w-full border-collapse text-sm">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr>
              <th
                scope="col"
                className="sticky left-0 z-10 bg-slate-50 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 after:absolute after:inset-y-0 after:-right-2 after:w-2 after:bg-gradient-to-r after:from-slate-900/10 after:to-transparent"
              >
                Pupil
              </th>
              {broadsheet.subjects.map((subject) => (
                <th
                  key={subject.subjectId}
                  scope="col"
                  title={subject.name}
                  className="whitespace-nowrap px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500"
                >
                  {isNumeric
                    ? scoreHeader(subject.code || subject.name, scoreMaxFor(subject.subjectId))
                    : subject.code || subject.name}
                </th>
              ))}
              {showsAggregates && (
                <>
                  <th
                    scope="col"
                    className="whitespace-nowrap px-3 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500"
                  >
                    Total
                  </th>
                  <th
                    scope="col"
                    className="whitespace-nowrap px-3 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500"
                  >
                    Average
                  </th>
                  <th
                    scope="col"
                    className="whitespace-nowrap px-3 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500"
                  >
                    Position
                  </th>
                </>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {rows.map((row) => {
              const resultBySubject = new Map(row.subjectResults.map((result) => [result.subjectId, result]));
              return (
                <tr key={row.enrollmentId} className="hover:bg-slate-50">
                  <td className="sticky left-0 z-10 bg-white px-4 py-3 font-medium text-slate-900 after:absolute after:inset-y-0 after:-right-2 after:w-2 after:bg-gradient-to-r after:from-slate-900/10 after:to-transparent">
                    {row.studentName}
                    {row.specialNeeds && (
                      <abbr title="Special needs - only scored subjects shown, not ranked" className="no-underline">
                        <Badge variant="info" className="ml-2">
                          SN
                        </Badge>
                      </abbr>
                    )}
                    <span className="block text-xs font-normal text-slate-500">{row.admissionNumber}</span>
                  </td>
                  {broadsheet.subjects.map((subject) => {
                    const result = resultBySubject.get(subject.subjectId);
                    return (
                      <td key={subject.subjectId} className="whitespace-nowrap px-3 py-3 text-center tabular-nums text-slate-700">
                        {isNumeric ? scoreCellText(result, scoreMaxFor(subject.subjectId)) : (result?.ratingLabel ?? "—")}
                        {isNumeric && result?.grade && <span className="ml-1 text-xs text-slate-500">({result.grade})</span>}
                      </td>
                    );
                  })}
                  {showsAggregates && (
                    <>
                      <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums font-medium text-slate-900">
                        {row.total ?? "—"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-slate-700">
                        {row.average ?? "—"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-slate-700">
                        {row.position ?? "—"}
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
          {showClassAverage && (
            <tfoot className="border-t border-slate-200 bg-slate-50">
              <tr>
                <th
                  scope="row"
                  className="sticky left-0 z-10 bg-slate-50 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 after:absolute after:inset-y-0 after:-right-2 after:w-2 after:bg-gradient-to-r after:from-slate-900/10 after:to-transparent"
                >
                  Class average
                </th>
                {broadsheet.subjects.map((subject) => (
                  <td
                    key={subject.subjectId}
                    className="whitespace-nowrap px-3 py-3 text-center tabular-nums font-medium text-slate-700"
                  >
                    {classAverageCellText(subject.classAverage, scoreMaxFor(subject.subjectId), scoreMaxFor(subject.subjectId))}
                  </td>
                ))}
                {showsAggregates && <td colSpan={3} />}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      {rows.some((row) => row.specialNeeds) && (
        <p className="text-xs text-slate-500">
          SN = special needs: only the subjects they were scored in are shown, they are not ranked, and their
          scores are left out of the class average.
        </p>
      )}
    </div>
  );
}
