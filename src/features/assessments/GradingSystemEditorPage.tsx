import { type FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ApiError } from "@/api/client";
import {
  type AssessmentMode,
  type GradeBoundary,
  getGradingSystem,
  type GradingSystemView,
  saveNumericGradingSystem,
  saveQualitativeGradingSystem,
} from "@/api/gradingSystems";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Checkbox } from "@/components/ui/Checkbox";
import { Spinner } from "@/components/ui/Spinner";
import { GradeBoundaryRows } from "@/features/assessments/components/GradeBoundaryRows";
import { type RatingScaleRow, RatingScaleRows } from "@/features/assessments/components/RatingScaleRows";
import { type WeightingValues, WeightingFields } from "@/features/assessments/components/WeightingFields";

type LoadState = { kind: "loading" } | { kind: "loaded"; system: GradingSystemView } | { kind: "error"; message: string };

/** Boundaries must be non-overlapping and cover 0-100 with no gaps - mirrors GradingSystem.requireBoundaries server-side. */
function validateBoundaries(boundaries: GradeBoundary[]): string | null {
  if (boundaries.length === 0) return "Add at least one grade boundary.";
  const sorted = [...boundaries].sort((a, b) => a.minScore - b.minScore);
  const grades = new Set(sorted.map((boundary) => boundary.grade.trim().toUpperCase()));
  if (grades.size !== sorted.length) return "Grade letters must be unique.";
  let expectedStart = 0;
  for (const boundary of sorted) {
    if (!boundary.grade.trim() || !boundary.remark.trim()) return "Every boundary needs a grade and a remark.";
    if (boundary.minScore > boundary.maxScore) return `"${boundary.grade}" has a min score greater than its max.`;
    if (Math.round(boundary.minScore * 100) !== Math.round(expectedStart * 100)) {
      return "Boundaries must be contiguous and cover 0-100 with no gaps or overlaps.";
    }
    expectedStart = boundary.maxScore + 0.01;
  }
  if (Math.round(sorted[sorted.length - 1].maxScore * 100) !== 10000) {
    return "Boundaries must cover up to 100.";
  }
  return null;
}

function validateRatingOptions(options: RatingScaleRow[]): string | null {
  if (options.length < 2) return "Add at least two ratings.";
  if (options.some((option) => !option.label.trim())) return "Every rating needs a label.";
  const labels = new Set(options.map((option) => option.label.trim().toLowerCase()));
  if (labels.size !== options.length) return "Rating labels must be unique.";
  return null;
}

/**
 * Full-page editor for one level's grading system - a mode toggle swaps
 * between the numeric editor (weightings + boundaries) and the qualitative
 * one (ordered rating scale). Lives on its own page, not a modal - this
 * app's Modal doesn't stack, and the boundary/rating row editors are too
 * involved for one.
 */
export function GradingSystemEditorPage() {
  const { levelId } = useParams<{ levelId: string }>();
  const navigate = useNavigate();

  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [mode, setMode] = useState<AssessmentMode>("NUMERIC");
  const [weighting, setWeighting] = useState<WeightingValues>({
    quizWeight: 30,
    examWeight: 70,
    quizMax: 100,
    examMax: 100,
  });
  const [showPosition, setShowPosition] = useState(true);
  const [boundaries, setBoundaries] = useState<GradeBoundary[]>([]);
  const [ratingOptions, setRatingOptions] = useState<RatingScaleRow[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!levelId) return;
    getGradingSystem(levelId)
      .then((system) => {
        setState({ kind: "loaded", system });
        setMode(system.assessmentMode);
        setWeighting({
          quizWeight: system.quizWeight ?? 30,
          examWeight: system.examWeight ?? 70,
          quizMax: system.quizMax ?? 100,
          examMax: system.examMax ?? 100,
        });
        setShowPosition(system.showPosition);
        setBoundaries(system.boundaries);
        setRatingOptions(system.ratingOptions.map((option) => ({ label: option.label, description: option.description ?? "" })));
      })
      .catch((err: unknown) =>
        setState({ kind: "error", message: err instanceof ApiError ? err.message : "Failed to load grading system" }),
      );
  }, [levelId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!levelId) return;
    setError(null);
    setSaved(false);

    if (mode === "NUMERIC") {
      if (weighting.quizWeight + weighting.examWeight !== 100) {
        setError("Quiz and exam weight must sum to 100.");
        return;
      }
      const boundaryError = validateBoundaries(boundaries);
      if (boundaryError) {
        setError(boundaryError);
        return;
      }
    } else {
      const ratingError = validateRatingOptions(ratingOptions);
      if (ratingError) {
        setError(ratingError);
        return;
      }
    }

    setSubmitting(true);
    try {
      if (mode === "NUMERIC") {
        await saveNumericGradingSystem(levelId, { ...weighting, showPosition, boundaries });
      } else {
        await saveQualitativeGradingSystem(levelId, {
          ratingOptions: ratingOptions.map((option, index) => ({
            label: option.label,
            description: option.description || undefined,
            rank: index + 1,
          })),
        });
      }
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save grading system");
    } finally {
      setSubmitting(false);
    }
  }

  if (state.kind === "loading") {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Spinner /> Loading…
      </div>
    );
  }
  if (state.kind === "error") {
    return <Alert variant="error">{state.message}</Alert>;
  }

  const { system } = state;

  return (
    <div className="space-y-6">
      <Link to="/school/assessments/grading" className="text-sm text-brand-500 hover:text-brand-600">
        &larr; All grading systems
      </Link>

      <div>
        <h1 className="font-display text-3xl font-medium text-slate-900">{system.levelName}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {system.configured ? "Editing this level's saved grading system." : "Starting from the school default."}
        </p>
      </div>

      <form className="space-y-6" onSubmit={handleSubmit}>
        {error && <Alert variant="error">{error}</Alert>}
        {saved && <Alert variant="success">Grading system saved.</Alert>}

        <div className="inline-flex rounded-control border border-slate-200 bg-white p-1">
          <button
            type="button"
            className={`rounded-control px-3 py-1.5 text-sm font-medium ${mode === "NUMERIC" ? "bg-brand-50 text-brand-800" : "text-slate-600"}`}
            onClick={() => setMode("NUMERIC")}
          >
            Numeric
          </button>
          <button
            type="button"
            className={`rounded-control px-3 py-1.5 text-sm font-medium ${mode === "QUALITATIVE" ? "bg-brand-50 text-brand-800" : "text-slate-600"}`}
            onClick={() => setMode("QUALITATIVE")}
          >
            Qualitative
          </button>
        </div>

        {mode === "NUMERIC" ? (
          <>
            <Card>
              <WeightingFields values={weighting} onChange={setWeighting} />
            </Card>
            <Card>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <Checkbox checked={showPosition} onChange={(e) => setShowPosition(e.target.checked)} />
                Show class position on reports
              </label>
              <p className="mt-1 text-sm text-slate-500">
                Turning this off hides position from the printed report and the guardian portal. Staff still see it
                on the broadsheet.
              </p>
            </Card>
            <Card>
              <GradeBoundaryRows boundaries={boundaries} onChange={setBoundaries} />
            </Card>
          </>
        ) : (
          <Card>
            <RatingScaleRows options={ratingOptions} onChange={setRatingOptions} />
          </Card>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => navigate("/school/assessments/grading")}>
            Cancel
          </Button>
          <Button type="submit" variant="accent" loading={submitting}>
            Save grading system
          </Button>
        </div>
      </form>
    </div>
  );
}
