import { useEffect, useMemo, useRef, useState } from "react";
import { ACTIONS, EVENTS, type EventData, Joyride, STATUS, type Step } from "react-joyride";
import { useLocation } from "react-router";
import type { Role } from "@/api/types";
import { TourCard } from "@/features/onboarding/components/TourCard";
import {
  isAvailable,
  isResolved,
  needsAutoStart,
  normalisePath,
  stepsFor,
} from "@/features/onboarding/eligibility";
import { findTour, shellTourFor, TOURS } from "@/features/onboarding/tours/registry";
import type { Portal, TourDefinition } from "@/features/onboarding/types";
import { BELOW_LG_QUERY, useMediaQuery } from "@/hooks/useMediaQuery";
import { useAuthStore } from "@/stores/authStore";
import { useOnboardingStore } from "@/stores/onboardingStore";

/** Shell targets live in sticky/fixed chrome - joyride positions those without scrolling. */
const FIXED_TARGETS = new Set(["sidebar", "tabbar", "more", "help", "account-menu", "context"]);

/** Lets a page render its data before its guide spotlights anything. */
const PAGE_TOUR_DELAY_MS = 700;

const BRAND_500 = "#3b4fd9";

interface TourRunnerProps {
  portal: Portal;
  role: Role;
}

/**
 * Runs whichever onboarding guide is active, through one controlled react-joyride instance mounted
 * in PortalShell, and decides when a guide starts on its own:
 *
 * - the portal's shell guide first - a brand-new user gets WelcomeModal instead; a guide left
 *   part-way, or updated since, resumes directly;
 * - then, once the shell guide is finished or skipped, a page guide the first time its page opens.
 *
 * A step whose target isn't on screen is skipped. Leaving a page guide's page mid-way stops it
 * (it stays in progress and resumes on the next visit). Progress is saved per step.
 */
export function TourRunner({ portal, role }: TourRunnerProps) {
  const location = useLocation();
  const pathname = normalisePath(location.pathname);
  const belowLg = useMediaQuery(BELOW_LG_QUERY);
  const impersonating = useAuthStore((state) => state.impersonation !== null);
  const status = useOnboardingStore((state) => state.status);
  const autoStart = useOnboardingStore((state) => state.autoStart);
  const progress = useOnboardingStore((state) => state.progress);
  const active = useOnboardingStore((state) => state.active);
  const visibleNavHrefs = useOnboardingStore((state) => state.visibleNavHrefs);
  const start = useOnboardingStore((state) => state.start);
  const stop = useOnboardingStore((state) => state.stop);
  const record = useOnboardingStore((state) => state.record);

  const tour = active ? findTour(active.key) : undefined;
  const steps = useMemo(() => (tour ? stepsFor(tour, role, belowLg) : []), [tour, role, belowLg]);
  const onTourPage = !!tour && (tour.kind === "shell" || tour.route === pathname);

  const [stepIndex, setStepIndex] = useState(0);
  const [runningKey, setRunningKey] = useState<string | null>(null);
  /** The activeId already recorded as finished/skipped - joyride can report the end twice. */
  const finishedRef = useRef<string | null>(null);

  // (Re)initialise whenever a different guide becomes active - adjusted during render, React's
  // "reset state when a prop changes" pattern, so the first frame already has the right step.
  const activeId = active ? `${active.key}:${active.startIndex}:${active.manual}` : null;
  const [initialisedFor, setInitialisedFor] = useState<string | null>(null);
  if (activeId !== initialisedFor) {
    setInitialisedFor(activeId);
    setStepIndex(active ? Math.min(active.startIndex, Math.max(steps.length - 1, 0)) : 0);
    setRunningKey(null);
  }
  // A page guide starts running once its page is showing (a replay navigates there first).
  if (active && onTourPage && runningKey !== active.key) {
    setRunningKey(active.key);
  }

  // An unknown key or a guide with no steps for this role/screen - nothing to run.
  useEffect(() => {
    if (active && (!tour || steps.length === 0)) {
      stop();
    }
  }, [active, tour, steps.length, stop]);

  // Leaving a running page guide's page stops it; it stays in progress and resumes next visit.
  useEffect(() => {
    if (active && !onTourPage && runningKey === active.key) {
      stop();
    }
  }, [active, onTourPage, runningKey, stop]);

  // Auto-start: resume the shell guide if it's part-way or updated (never when brand new - that's
  // WelcomeModal's job), else the current page's guide once the shell guide is resolved.
  useEffect(() => {
    if (status !== "loaded" || active || impersonating || !autoStart) {
      return;
    }
    const context = { portal, role, visibleNavHrefs };
    const shell = shellTourFor(portal);
    if (shell && isAvailable(shell, context) && !isResolved(shell, progress[shell.key])) {
      const saved = progress[shell.key];
      if (saved && needsAutoStart(shell, saved, autoStart, impersonating)) {
        start(shell.key, { startIndex: saved.version === shell.version ? saved.stepIndex : 0 });
      }
      return;
    }
    const pageTour = TOURS.find(
      (candidate: TourDefinition) =>
        candidate.kind === "page" &&
        candidate.route === pathname &&
        isAvailable(candidate, context) &&
        needsAutoStart(candidate, progress[candidate.key], autoStart, impersonating),
    );
    if (!pageTour) {
      return;
    }
    const saved = progress[pageTour.key];
    const timer = window.setTimeout(() => {
      start(pageTour.key, {
        startIndex: saved && saved.version === pageTour.version && saved.status === "IN_PROGRESS" ? saved.stepIndex : 0,
      });
    }, PAGE_TOUR_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [status, active, impersonating, autoStart, portal, role, visibleNavHrefs, progress, pathname, start]);

  const joyrideSteps: Step[] = useMemo(
    () =>
      steps.map((step) => {
        const target = (belowLg && step.mobileTarget) || step.target;
        return {
          target: target ? `[data-tour="${target}"]` : "body",
          placement: target ? "auto" : "center",
          title: step.title,
          content: step.body,
          isFixed: target ? FIXED_TARGETS.has(target) : true,
          data: { guideTitle: tour?.title },
        };
      }),
    [steps, belowLg, tour],
  );

  function finish(status: "COMPLETED" | "SKIPPED", index: number) {
    if (!tour || finishedRef.current === activeId) {
      return;
    }
    finishedRef.current = activeId;
    record(tour.key, tour.version, status, Math.max(0, Math.min(index, steps.length - 1)));
    stop();
  }

  function handleEvent(data: EventData) {
    if (!tour) {
      return;
    }
    if (data.action === ACTIONS.SKIP || data.status === STATUS.SKIPPED) {
      finish("SKIPPED", data.index);
      return;
    }
    if (data.status === STATUS.FINISHED) {
      finish("COMPLETED", data.index);
      return;
    }
    if (data.type === EVENTS.STEP_AFTER || data.type === EVENTS.TARGET_NOT_FOUND) {
      const back = data.action === ACTIONS.PREV;
      const next = data.index + (back ? -1 : 1);
      if (next >= steps.length) {
        finish("COMPLETED", data.index);
        return;
      }
      const clamped = Math.max(0, next);
      setStepIndex(clamped);
      record(tour.key, tour.version, "IN_PROGRESS", clamped);
    }
  }

  if (!active || !tour || steps.length === 0 || runningKey !== active.key) {
    return null;
  }

  return (
    <Joyride
      key={activeId ?? undefined}
      run
      continuous
      steps={joyrideSteps}
      stepIndex={stepIndex}
      onEvent={handleEvent}
      tooltipComponent={TourCard}
      loaderComponent={null}
      scrollToFirstStep
      locale={{ back: "Back", close: "Skip guide", last: "Finish", next: "Next", skip: "Skip tour" }}
      floatingOptions={{ hideArrow: belowLg }}
      options={{
        buttons: ["back", "close", "primary", "skip"],
        closeButtonAction: "skip",
        dismissKeyAction: false,
        overlayClickAction: false,
        skipBeacon: true,
        overlayColor: "rgba(15, 23, 42, 0.55)",
        primaryColor: BRAND_500,
        arrowColor: "#ffffff",
        spotlightRadius: 12,
        spotlightPadding: 6,
        scrollOffset: 88,
        targetWaitTimeout: 2500,
        disableFocusTrap: belowLg,
        zIndex: 60,
      }}
    />
  );
}
