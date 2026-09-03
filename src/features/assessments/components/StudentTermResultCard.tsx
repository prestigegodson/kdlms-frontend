import type { StudentTermResultView } from "@/api/assessments";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/Table";
import { scoreCellText } from "@/features/assessments/finalScore";

interface StudentTermResultCardProps {
  result: StudentTermResultView;
}

/** One student's term result - a per-subject table plus (NUMERIC only) total/average/position. */
export function StudentTermResultCard({ result }: StudentTermResultCardProps) {
  const isNumeric = result.assessmentMode === "NUMERIC";
  const subjectName = (subjectId: string) => result.subjects.find((subject) => subject.subjectId === subjectId)?.name ?? subjectId;

  return (
    <Card className="p-0">
      <div className="flex flex-wrap items-center justify-between gap-2 p-6 pb-0">
        <div>
          <h2 className="font-display text-lg font-medium text-slate-900">{result.studentName}</h2>
          <p className="text-sm text-slate-500">{result.admissionNumber}</p>
        </div>
        {isNumeric && result.position != null && <Badge variant="brand">Position {result.position}</Badge>}
      </div>

      <div className="p-6">
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Subject</TableHeaderCell>
              {isNumeric ? (
                <>
                  <TableHeaderCell numeric>Score</TableHeaderCell>
                  <TableHeaderCell>Grade</TableHeaderCell>
                </>
              ) : (
                <>
                  <TableHeaderCell>Rating</TableHeaderCell>
                  <TableHeaderCell>Observation</TableHeaderCell>
                </>
              )}
            </TableRow>
          </TableHead>
          <TableBody>
            {result.subjectResults.map((subject) => (
              <TableRow key={subject.subjectId}>
                <TableCell label="Subject" className="font-medium text-slate-900">
                  {subjectName(subject.subjectId)}
                </TableCell>
                {isNumeric ? (
                  <>
                    <TableCell label="Score" numeric>
                      {scoreCellText(subject)}
                    </TableCell>
                    <TableCell label="Grade">{subject.grade ?? "—"}</TableCell>
                  </>
                ) : (
                  <>
                    <TableCell label="Rating">{subject.ratingLabel ?? "—"}</TableCell>
                    <TableCell label="Observation" className="text-slate-500">
                      {subject.observation ?? "—"}
                    </TableCell>
                  </>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {isNumeric && (result.total != null || result.average != null) && (
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-600">
            <span>
              Total: <span className="font-medium text-slate-900">{result.total ?? "—"}</span>
            </span>
            <span>
              Average: <span className="font-medium text-slate-900">{result.average ?? "—"}</span>
            </span>
          </div>
        )}

        {(result.classTeacherRemark || result.principalRemark) && (
          <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
            {result.classTeacherRemark && (
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Class teacher's remark</h3>
                <p className="mt-1 text-sm text-slate-700">{result.classTeacherRemark}</p>
              </div>
            )}
            {result.principalRemark && (
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Principal's remark</h3>
                <p className="mt-1 text-sm text-slate-700">{result.principalRemark}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
