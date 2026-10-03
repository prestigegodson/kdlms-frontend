import { CheckCircle2, Clock, ListChecks, RotateCcw } from "lucide-react";
import { useState } from "react";
import { useLocation } from "react-router";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { PageHeader } from "@/components/ui/PageHeader";
import { AutoStartSwitch } from "@/features/onboarding/components/AutoStartSwitch";
import { GuideStatusBadge } from "@/features/onboarding/components/GuideStatusBadge";
import { guideActionLabel, portalForPath } from "@/features/onboarding/eligibility";
import { type GuideEntry, useGuides, useStartGuide } from "@/features/onboarding/useGuides";
import { useAuthStore } from "@/stores/authStore";
import { useOnboardingStore } from "@/stores/onboardingStore";

/**
 * Every onboarding guide the caller can be offered in this portal, grouped by area, each with its
 * status and a Start/Resume/Replay action - the "how-to guide" a user returns to after finishing
 * (or skipping) the guides that ran on their own. Mounted at /{portal}/help in each portal.
 */
export function HowToGuidesPage() {
  const location = useLocation();
  const portal = portalForPath(location.pathname);
  const guides = useGuides(portal);
  const startGuide = useStartGuide();
  const resetAll = useOnboardingStore((state) => state.resetAll);
  const status = useOnboardingStore((state) => state.status);
  const impersonating = useAuthStore((state) => state.impersonation !== null);
  const [confirmingReset, setConfirmingReset] = useState(false);

  const completed = guides.filter((guide) => guide.status === "done").length;
  const percent = guides.length === 0 ? 0 : Math.round((completed / guides.length) * 100);

  const areas: { name: string; guides: GuideEntry[] }[] = [];
  for (const guide of guides) {
    let area = areas.find((candidate) => candidate.name === guide.tour.area);
    if (!area) {
      area = { name: guide.tour.area, guides: [] };
      areas.push(area);
    }
    area.guides.push(guide);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="How-to guides"
        description="Step-by-step walkthroughs of the pages you use. Replay any of them whenever you need a refresher."
        actions={
          !impersonating && (
            <Button variant="secondary" onClick={() => setConfirmingReset(true)}>
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Reset all guides
            </Button>
          )
        }
      />

      {status === "error" && (
        <Alert variant="error">We couldn't load your guide progress. You can still play any guide.</Alert>
      )}

      <Card className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-slate-900">
            {completed} of {guides.length} guides completed
          </p>
          <div
            className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"
            role="progressbar"
            aria-label="Guides completed"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
          >
            <div className="h-full rounded-full bg-brand-500 transition-[width]" style={{ width: `${percent}%` }} />
          </div>
        </div>
        <div className="sm:w-80 sm:border-l sm:border-slate-100 sm:pl-5">
          <AutoStartSwitch />
        </div>
      </Card>

      {areas.map((area) => (
        <section key={area.name} aria-labelledby={`guides-${area.name}`}>
          <h2
            id={`guides-${area.name}`}
            className="text-xs font-semibold uppercase tracking-wide text-slate-400"
          >
            {area.name}
          </h2>
          <ul className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {area.guides.map(({ tour, status: guideStatus, stepCount }) => (
              <li key={tour.key}>
                <Card className="flex h-full flex-col">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-display text-base font-medium text-slate-900">{tour.title}</h3>
                    <GuideStatusBadge status={guideStatus} />
                  </div>
                  <p className="mt-1 flex-1 text-sm text-slate-600">{tour.description}</p>
                  <div className="mt-4 flex items-center justify-between gap-3">
                    <span className="flex items-center gap-1.5 text-xs text-slate-500">
                      {guideStatus === "done" ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-600" aria-hidden="true" />
                      ) : guideStatus === "in-progress" ? (
                        <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                      ) : (
                        <ListChecks className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                      {stepCount} {stepCount === 1 ? "step" : "steps"}
                    </span>
                    <Button
                      size="sm"
                      variant={guideStatus === "new" || guideStatus === "updated" ? "primary" : "secondary"}
                      aria-label={`${guideActionLabel(guideStatus)} ${tour.title}`}
                      onClick={() => startGuide(tour)}
                    >
                      {guideActionLabel(guideStatus)}
                    </Button>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {confirmingReset && (
        <ConfirmDialog
          title="Reset all guides?"
          message="Every guide will be marked as new again and start on its own the next time you open its page, beginning with the welcome tour."
          confirmLabel="Reset guides"
          onConfirm={resetAll}
          onClose={() => setConfirmingReset(false)}
        />
      )}
    </div>
  );
}
