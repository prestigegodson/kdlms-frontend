import { type FormEvent, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { ApiError } from "@/api/client";
import {
  type AssessmentMode,
  type GradeBoundary,
  getGradingSystem,
  type GradingSystemView,
  saveNumericGradingSystem,
  saveQualitativeGradingSystem,
} from "@/api/gradingSystems";
import { getTraitConfiguration, saveTraitConfiguration, type TraitConfigurationView } from "@/api/traits";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Checkbox } from "@/components/ui/Checkbox";
import { PageHeader } from "@/components/ui/PageHeader";
import { Spinner } from "@/components/ui/Spinner";
import { GradeBoundaryRows } from "@/features/assessments/components/GradeBoundaryRows";
import { type RatingScaleRow, RatingScaleRows } from "@/features/assessments/components/RatingScaleRows";
import { type TraitDefinitionRow } from "@/features/assessments/components/TraitDefinitionRows";
import { TraitCategoryEditor } from "@/features/assessments/components/TraitCategoryEditor";
import { type TraitScaleRow } from "@/features/assessments/components/TraitScaleRows";
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

/** Mirrors TraitConfiguration.requireScaleOptions/requireTraits server-side - an enabled category needs >=2 scale options and >=1 active trait. */
function validateTraitCategory(
  label: string,
  enabled: boolean,
  scaleOptions: TraitScaleRow[],
  traits: TraitDefinitionRow[],
): string | null {
  if (!enabled) return null;
  if (scaleOptions.length < 2) return `Add at least two ${label} rating scale options.`;
  if (scaleOptions.some((option) => !option.value.trim() || !option.label.trim())) {
    return `Every ${label} rating needs a value and a label.`;
  }
  const values = new Set(scaleOptions.map((option) => option.value.trim().toLowerCase()));
  if (values.size !== scaleOptions.length) return `${label} rating values must be unique.`;
  const labels = new Set(scaleOptions.map((option) => option.label.trim().toLowerCase()));
  if (labels.size !== scaleOptions.length) return `${label} rating labels must be unique.`;
  if (traits.some((trait) => !trait.name.trim())) return `Every ${label} trait needs a name.`;
  const names = new Set(traits.map((trait) => trait.name.trim().toLowerCase()));
  if (names.size !== traits.length) return `${label} trait names must be unique.`;
  if (!traits.some((trait) => trait.active)) return `Add at least one active ${label} trait.`;
  return null;
}

function toScaleRows(config: TraitConfigurationView, category: "affective" | "psychomotor"): TraitScaleRow[] {
  return config[category].scaleOptions.map((option) => ({
    id: option.id,
    value: option.value,
    label: option.label,
    description: option.description ?? "",
  }));
}

function toTraitRows(config: TraitConfigurationView, category: "affective" | "psychomotor"): TraitDefinitionRow[] {
  return config[category].traits.map((trait) => ({ id: trait.id, name: trait.name, active: trait.active }));
}

/**
 * Full-page editor for one level's grading system - a mode toggle swaps
 * between the numeric editor (weightings + boundaries) and the qualitative
 * one (ordered rating scale). Lives on its own page, not a modal - this
 * app's Modal doesn't stack, and the boundary/rating row editors are too
 * involved for one.
 * <p>
 * The behavioural-traits section (Phase 15) sits outside the NUMERIC/
 * QUALITATIVE ternary - it's mode-agnostic, unlike everything above it -
 * and is backed by its own endpoint (`PUT /api/v1/levels/{id}/traits`), so
 * one Save issues both requests in sequence.
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
  const [showMidtermGrade, setShowMidtermGrade] = useState(true);
  const [boundaries, setBoundaries] = useState<GradeBoundary[]>([]);
  const [ratingOptions, setRatingOptions] = useState<RatingScaleRow[]>([]);

  const [affectiveEnabled, setAffectiveEnabled] = useState(false);
  const [affectiveScale, setAffectiveScale] = useState<TraitScaleRow[]>([]);
  const [affectiveTraits, setAffectiveTraits] = useState<TraitDefinitionRow[]>([]);
  const [psychomotorEnabled, setPsychomotorEnabled] = useState(false);
  const [psychomotorScale, setPsychomotorScale] = useState<TraitScaleRow[]>([]);
  const [psychomotorTraits, setPsychomotorTraits] = useState<TraitDefinitionRow[]>([]);

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
        setShowMidtermGrade(system.showMidtermGrade);
        setBoundaries(system.boundaries);
        setRatingOptions(
          system.ratingOptions.map((option) => ({
            id: option.id,
            label: option.label,
            description: option.description ?? "",
          })),
        );
      })
      .catch((err: unknown) =>
        setState({ kind: "error", message: err instanceof ApiError ? err.message : "Failed to load grading system" }),
      );
  }, [levelId]);

  useEffect(() => {
    if (!levelId) return;
    getTraitConfiguration(levelId)
      .then((config) => {
        setAffectiveEnabled(config.affectiveEnabled);
        setAffectiveScale(toScaleRows(config, "affective"));
        setAffectiveTraits(toTraitRows(config, "affective"));
        setPsychomotorEnabled(config.psychomotorEnabled);
        setPsychomotorScale(toScaleRows(config, "psychomotor"));
        setPsychomotorTraits(toTraitRows(config, "psychomotor"));
      })
      .catch(() => undefined);
  }, [levelId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!levelId) return;
    setError(null);
    setSaved(false);

    if (mode === "NUMERIC") {
      if (weighting.quizWeight + weighting.examWeight !== 100) {
        setError("Midterm quiz and exam weight must sum to 100.");
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

    const affectiveError = validateTraitCategory("affective disposition", affectiveEnabled, affectiveScale, affectiveTraits);
    if (affectiveError) {
      setError(affectiveError);
      return;
    }
    const psychomotorError = validateTraitCategory(
      "psychomotor skills",
      psychomotorEnabled,
      psychomotorScale,
      psychomotorTraits,
    );
    if (psychomotorError) {
      setError(psychomotorError);
      return;
    }

    setSubmitting(true);
    try {
      if (mode === "NUMERIC") {
        await saveNumericGradingSystem(levelId, { ...weighting, showPosition, showMidtermGrade, boundaries });
      } else {
        await saveQualitativeGradingSystem(levelId, {
          ratingOptions: ratingOptions.map((option, index) => ({
            id: option.id,
            label: option.label,
            description: option.description || undefined,
            rank: index + 1,
          })),
        });
      }
      await saveTraitConfiguration(levelId, {
        affective: {
          enabled: affectiveEnabled,
          scaleOptions: affectiveScale.map((option) => ({
            id: option.id,
            value: option.value,
            label: option.label,
            description: option.description || undefined,
          })),
          traits: affectiveTraits.map((trait) => ({ id: trait.id, name: trait.name, active: trait.active })),
        },
        psychomotor: {
          enabled: psychomotorEnabled,
          scaleOptions: psychomotorScale.map((option) => ({
            id: option.id,
            value: option.value,
            label: option.label,
            description: option.description || undefined,
          })),
          traits: psychomotorTraits.map((trait) => ({ id: trait.id, name: trait.name, active: trait.active })),
        },
      });
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
      <PageHeader
        title={system.levelName}
        description={
          system.configured ? "Editing this level's saved grading system." : "Starting from the school default."
        }
        backTo="/school/assessments/grading"
      />

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
            <Card className="space-y-4">
              <div>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <Checkbox checked={showPosition} onChange={(e) => setShowPosition(e.target.checked)} />
                  Show class position on reports
                </label>
                <p className="mt-1 text-sm text-slate-500">
                  Turning this off hides position from the printed report and the guardian portal. Staff still see it
                  on the broadsheet.
                </p>
              </div>
              <div>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <Checkbox checked={showMidtermGrade} onChange={(e) => setShowMidtermGrade(e.target.checked)} />
                  Show grade on mid-term results
                </label>
                <p className="mt-1 text-sm text-slate-500">
                  Turning this off hides the grade letter from mid-term results everywhere, including the
                  broadsheet - unlike class position, which staff always see.
                </p>
              </div>
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

        <Card>
          <h2 className="mb-4 font-display text-base font-medium text-slate-900">Behavioural traits</h2>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <TraitCategoryEditor
              title="Affective disposition"
              description="e.g. punctuality, neatness, honesty - rated once per term by the class teacher."
              enabled={affectiveEnabled}
              onEnabledChange={setAffectiveEnabled}
              scaleOptions={affectiveScale}
              onScaleOptionsChange={setAffectiveScale}
              traits={affectiveTraits}
              onTraitsChange={setAffectiveTraits}
            />
            <TraitCategoryEditor
              title="Psychomotor skills"
              description="e.g. handwriting, sports, verbal fluency - rated once per term by the class teacher."
              enabled={psychomotorEnabled}
              onEnabledChange={setPsychomotorEnabled}
              scaleOptions={psychomotorScale}
              onScaleOptionsChange={setPsychomotorScale}
              traits={psychomotorTraits}
              onTraitsChange={setPsychomotorTraits}
            />
          </div>
        </Card>

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
