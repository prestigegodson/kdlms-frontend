import type { BroadsheetView } from "@/api/assessments";

interface BroadsheetTableProps {
  broadsheet: BroadsheetView;
}

/**
 * The whole-class results grid - the one bespoke table in this phase. N
 * subject columns can't collapse into stacked cards the way a 3-4 column
 * form can (see index.css's `.responsive-table` rules), so this
 * deliberately opts out: a plain `<table>` in its own `overflow-x-auto`
 * wrapper with a sticky student column, rather than `components/ui/Table`.
 * Subject headers abbreviate to their code, with the full name in `title`.
 */
export function BroadsheetTable({ broadsheet }: BroadsheetTableProps) {
  const isNumeric = broadsheet.assessmentMode === "NUMERIC";
  const rows = isNumeric
    ? [...broadsheet.rows].sort((a, b) => (a.position ?? Infinity) - (b.position ?? Infinity))
    : broadsheet.rows;

  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-500 sm:hidden">Scroll sideways to see every subject &rarr;</p>
      <div className="overflow-x-auto rounded-card border border-slate-200">
        <table className="min-w-full border-collapse text-sm">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr>
              <th
                scope="col"
                className="sticky left-0 z-10 bg-slate-50 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
              >
                Student
              </th>
              {broadsheet.subjects.map((subject) => (
                <th
                  key={subject.subjectId}
                  scope="col"
                  title={subject.name}
                  className="whitespace-nowrap px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500"
                >
                  {subject.code || subject.name}
                </th>
              ))}
              {isNumeric && (
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
                  <td className="sticky left-0 z-10 bg-white px-4 py-3 font-medium text-slate-900">
                    {row.studentName}
                    <span className="block text-xs font-normal text-slate-500">{row.admissionNumber}</span>
                  </td>
                  {broadsheet.subjects.map((subject) => {
                    const result = resultBySubject.get(subject.subjectId);
                    return (
                      <td key={subject.subjectId} className="whitespace-nowrap px-3 py-3 text-center tabular-nums text-slate-700">
                        {isNumeric
                          ? (result?.finalScore ?? "—")
                          : (result?.ratingLabel ?? "—")}
                        {isNumeric && result?.grade && <span className="ml-1 text-xs text-slate-500">({result.grade})</span>}
                      </td>
                    );
                  })}
                  {isNumeric && (
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
        </table>
      </div>
    </div>
  );
}
