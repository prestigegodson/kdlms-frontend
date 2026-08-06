import { useEffect, useState } from "react";
import { Link } from "react-router";
import { ApiError } from "@/api/client";
import { type GradingSystemView, listGradingSystems } from "@/api/gradingSystems";
import { Scale } from "lucide-react";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Spinner } from "@/components/ui/Spinner";

type ListState =
  | { kind: "loading" }
  | { kind: "loaded"; systems: GradingSystemView[] }
  | { kind: "error"; message: string };

/**
 * One card per active level - each shows its current grading mode (school
 * default until explicitly saved) and links to the editor. School-wide, not
 * branch-scoped, like Levels itself.
 */
export function GradingSystemsPage() {
  const [state, setState] = useState<ListState>({ kind: "loading" });

  useEffect(() => {
    listGradingSystems()
      .then((systems) => setState({ kind: "loaded", systems }))
      .catch((error: unknown) =>
        setState({
          kind: "error",
          message: error instanceof ApiError ? error.message : "Failed to load grading systems",
        }),
      );
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Grading systems"
        description="How each level is graded - numeric scores or a qualitative rating scale."
      />

      {state.kind === "loading" && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner /> Loading grading systems…
        </div>
      )}
      {state.kind === "error" && <Alert variant="error">{state.message}</Alert>}
      {state.kind === "loaded" && state.systems.length === 0 && (
        <EmptyState
          icon={Scale}
          title="No levels yet"
          description="Add a level on the Levels page before configuring grading."
        />
      )}
      {state.kind === "loaded" && state.systems.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {state.systems.map((system) => (
            <Link key={system.levelId} to={`/school/assessments/grading/${system.levelId}`} className="block">
              <Card className="h-full transition-shadow hover:shadow-md">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-display text-lg font-medium text-slate-900">{system.levelName}</h2>
                  <Badge variant={system.assessmentMode === "NUMERIC" ? "brand" : "info"}>
                    {system.assessmentMode === "NUMERIC" ? "Numeric" : "Qualitative"}
                  </Badge>
                </div>
                <p className="mt-2 text-sm text-slate-500">
                  {system.configured
                    ? system.assessmentMode === "NUMERIC"
                      ? `Quiz ${system.quizWeight}% · Exam ${system.examWeight}% · ${system.boundaries.length} grade${system.boundaries.length === 1 ? "" : "s"}${system.showPosition ? "" : " · Position hidden on reports"}`
                      : `${system.ratingOptions.length} rating${system.ratingOptions.length === 1 ? "" : "s"}`
                    : "Using the school default - not yet customized."}
                </p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
