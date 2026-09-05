import type { StudentTermResultView, TraitRatingView } from "@/api/assessments";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/Table";
import { scoreCellText } from "@/features/assessments/finalScore";

const TRAIT_CATEGORY_LABELS: Record<TraitRatingView["category"], string> = {
  AFFECTIVE: "Affective disposition",
  PSYCHOMOTOR: "Psychomotor skills",
};

/** Groups `traits` by category, preserving each category's own trait order. */
function groupTraitsByCategory(traits: TraitRatingView[]): Array<[TraitRatingView["category"], TraitRatingView[]]> {
  const order: TraitRatingView["category"][] = ["AFFECTIVE", "PSYCHOMOTOR"];
  return order
    .map((category): [TraitRatingView["category"], TraitRatingView[]] => [
      category,
      traits.filter((trait) => trait.category === category),
    ])
    .filter(([, rows]) => rows.length > 0);
}

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

        {result.traits.length > 0 && (
          <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
            {groupTraitsByCategory(result.traits).map(([category, traits]) => (
              <div key={category}>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {TRAIT_CATEGORY_LABELS[category]}
                </h3>
                <dl className="mt-1 grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
                  {traits.map((trait) => (
                    <div key={trait.traitName} className="flex items-baseline justify-between gap-2 text-sm">
                      <dt className="text-slate-600">{trait.traitName}</dt>
                      <dd className="font-medium text-slate-900">
                        {trait.optionValue} - {trait.optionLabel}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
