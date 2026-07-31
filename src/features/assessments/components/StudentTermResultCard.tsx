import type { StudentTermResultView } from "@/api/assessments";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/Table";

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
                      {subject.finalScore ?? "—"}
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

        {isNumeric && (
          <div className="mt-4 flex gap-6 text-sm text-slate-600">
            <span>
              Total: <span className="font-medium text-slate-900">{result.total ?? "—"}</span>
            </span>
            <span>
              Average: <span className="font-medium text-slate-900">{result.average ?? "—"}</span>
            </span>
          </div>
        )}
      </div>
    </Card>
  );
}
