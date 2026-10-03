import { X } from "lucide-react";
import { useEffect, useId } from "react";
import { createPortal } from "react-dom";
import type { TooltipRenderProps } from "react-joyride";
import { Button } from "@/components/ui/Button";
import { MOBILE_QUERY, useMediaQuery } from "@/hooks/useMediaQuery";

/**
 * The step card every onboarding guide renders through (react-joyride's `tooltipComponent`).
 * Floats beside its spotlighted target from `md` up; below `md` it docks as a bottom sheet above
 * the tab bar instead - the same treatment components/ui/Modal.tsx gives dialogs - portalled to
 * `document.body` so the floating wrapper's positioning can't drag it around, while the spotlight
 * stays on the target. Close and Escape both skip the guide (TourRunner records it as skipped).
 */
export function TourCard({
  index,
  size,
  step,
  isLastStep,
  backProps,
  primaryProps,
  skipProps,
  closeProps,
  tooltipProps,
  controls,
}: TooltipRenderProps) {
  const mobile = useMediaQuery(MOBILE_QUERY);
  const titleId = useId();
  const bodyId = useId();
  const guideTitle = (step.data as { guideTitle?: string } | undefined)?.guideTitle;

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        controls.skip("button_close");
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [controls]);

  const card = (
    <div
      {...tooltipProps}
      aria-labelledby={titleId}
      aria-describedby={bodyId}
      data-testid="tour-card"
      data-layout={mobile ? "sheet" : "floating"}
      className={`tour-card relative flex flex-col bg-white text-left shadow-xl ring-1 ring-slate-900/5 ${
        mobile
          ? "tour-card-sheet fixed inset-x-3 z-[70] rounded-card"
          : "w-[min(360px,calc(100vw-2rem))] rounded-card"
      }`}
      style={mobile ? { bottom: "calc(var(--spacing-tabbar-safe) + 0.75rem)" } : undefined}
    >
      <div className="h-1 overflow-hidden rounded-t-card bg-brand-50" aria-hidden="true">
        <div
          className="h-full bg-brand-500 transition-[width] duration-300"
          style={{ width: `${((index + 1) / size) * 100}%` }}
        />
      </div>
      <div className="flex items-start gap-3 px-5 pt-4">
        <div className="min-w-0 flex-1">
          {guideTitle && (
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">{guideTitle}</p>
          )}
          <h2 id={titleId} className="mt-1 font-display text-lg font-medium text-slate-900">
            {step.title}
          </h2>
        </div>
        <button
          type="button"
          {...closeProps}
          aria-label="Skip guide"
          title="Skip guide"
          className="-mr-2 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-control text-slate-400 hover:bg-slate-100 hover:text-slate-600 mobile:h-11 mobile:w-11"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      <div id={bodyId} className="px-5 pt-2 text-sm leading-6 text-slate-600">
        {step.content}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 px-5 py-3">
        <p className="mr-auto text-xs font-medium text-slate-500" aria-live="polite">
          {index + 1} of {size}
        </p>
        {!isLastStep && (
          <button
            type="button"
            {...skipProps}
            className="rounded-control px-2 py-1.5 text-sm font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700 mobile:min-h-11"
          >
            Skip tour
          </button>
        )}
        {index > 0 && (
          <Button variant="secondary" size="sm" {...backProps}>
            Back
          </Button>
        )}
        <Button size="sm" {...primaryProps}>
          {isLastStep ? "Finish" : "Next"}
        </Button>
      </div>
    </div>
  );

  return mobile ? createPortal(card, document.body) : card;
}
