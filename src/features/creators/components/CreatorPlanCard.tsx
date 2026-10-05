import { useEffect, useState } from "react";
import { Link } from "react-router";
import { getMyCreatorPlan, type CreatorPlanView } from "@/api/creatorPlan";
import { ApiError } from "@/api/client";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { formatLongDate } from "@/utils/date";

type LoadState =
  | { kind: "loading" }
  | { kind: "loaded"; plan: CreatorPlanView }
  | { kind: "error"; message: string };

function limitText(limit: number | null, unit?: string): string {
  if (limit == null) {
    return "Unlimited";
  }
  return unit ? `${limit} ${unit}` : String(limit);
}

function endText(plan: CreatorPlanView): string {
  if (!plan.endDate) {
    return "No end date";
  }
  return plan.autoRenew
    ? `Renews ${formatLongDate(plan.endDate)}`
    : `Ends ${formatLongDate(plan.endDate)}`;
}

/** The creator's own effective plan and what it allows (creators Phase C3), with a way to change it (C8). */
export function CreatorPlanCard() {
  const [state, setState] = useState<LoadState>({ kind: "loading" });

  useEffect(() => {
    getMyCreatorPlan()
      .then((plan) => setState({ kind: "loaded", plan }))
      .catch((error: unknown) =>
        setState({
          kind: "error",
          message: error instanceof ApiError ? error.message : "Failed to load your plan",
        }),
      );
  }, []);

  if (state.kind === "loading") {
    return (
      <Card>
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner /> Loading your plan…
        </div>
      </Card>
    );
  }
  if (state.kind === "error") {
    return <Alert variant="error">{state.message}</Alert>;
  }

  const { plan } = state;
  if (plan.source === "NONE") {
    return (
      <Card>
        <h2 className="text-sm font-semibold text-slate-900">Your plan</h2>
        <p className="mt-1 text-sm text-slate-500">You don't have a plan yet. Contact support to get one.</p>
      </Card>
    );
  }

  const limits: Array<{ label: string; value: string }> = [
    { label: "Classes", value: limitText(plan.maxClasses) },
    { label: "Learners per class", value: limitText(plan.maxStudentsPerClass) },
    { label: "Session length", value: limitText(plan.maxSessionMinutes, "min") },
    { label: "Participants per session", value: limitText(plan.maxParticipantsPerSession) },
    { label: "Live hours per month", value: limitText(plan.maxMonthlySessionHours) },
  ];
  const features: Array<{ label: string; included: boolean }> = [
    { label: "Class messaging", included: plan.communication },
    { label: "Lesson notes", included: plan.lessonNotes },
    {
      label: plan.aiLessonNotes ? `AI lesson notes (${plan.aiGenerationLimit}/month)` : "AI lesson notes",
      included: plan.aiLessonNotes,
    },
    { label: "Quizzes", included: plan.takeHomeQuiz },
    { label: "Learning resources", included: plan.onDemandLearning },
    { label: "Audio & video", included: plan.learningMedia },
    { label: "Guardian access", included: plan.guardianAccess },
  ];

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Your plan</h2>
          <p className="mt-1 font-display text-xl font-medium text-slate-900">{plan.planName}</p>
          <p className="text-sm text-slate-500">{endText(plan)}</p>
        </div>
        <div className="flex items-center gap-3">
          {plan.free && <Badge variant="success">Free</Badge>}
          <Link className="text-sm font-medium text-brand-500 hover:text-brand-600" to="/creator/billing">
            {plan.free || plan.source === "FREE_FALLBACK" ? "Upgrade" : "Manage plan"}
          </Link>
        </div>
      </div>
      {plan.graceUntil && (
        <Alert variant="warning" className="mt-3">
          We couldn't renew this plan. It stays active until {formatLongDate(plan.graceUntil)} while we retry your
          card.
        </Alert>
      )}

      <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {limits.map((limit) => (
          <div key={limit.label}>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{limit.label}</dt>
            <dd className="mt-0.5 text-sm text-slate-900">{limit.value}</dd>
          </div>
        ))}
      </dl>

      <ul className="mt-4 flex flex-wrap gap-2" aria-label="Plan features">
        {features.map((feature) => (
          <li key={feature.label}>
            <Badge variant={feature.included ? "success" : "neutral"}>
              {feature.included ? feature.label : `No ${feature.label.toLowerCase()}`}
            </Badge>
          </li>
        ))}
      </ul>
    </Card>
  );
}
