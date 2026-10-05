import { Compass } from "lucide-react";
import { useState } from "react";
import type { Role } from "@/api/types";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { isAvailable, needsAutoStart } from "@/features/onboarding/eligibility";
import { shellTourFor } from "@/features/onboarding/tours/registry";
import type { Portal } from "@/features/onboarding/types";
import { useAuthStore } from "@/stores/authStore";
import { useOnboardingStore } from "@/stores/onboardingStore";

const BLURB: Record<Role, string> = {
  SYSTEM_ADMIN: "Run the platform: onboard schools, set up packages and design result templates.",
  SCHOOL_ADMIN: "Set up your school's calendar, classes and staff, then follow every result, bill and message in one place.",
  BRANCH_ADMIN: "Run your branch day to day, from classes and students to results and fees.",
  TEACHER: "Record scores and attendance, write remarks and keep in touch with guardians, all for the classes you teach.",
  INVENTORY_MANAGER: "Keep your branch's store stocked: issue items and raise purchase requests.",
  GUARDIAN: "Follow your children's results, bills and messages from school, all in one place.",
  STUDENT: "Find your learning resources, take your quizzes and see your results.",
  // No creator- or learner-portal guide yet (portalForPath has neither portal), so these two are never shown today.
  CREATOR: "Run your online classes: schedule sessions, enroll learners and share your materials.",
  LEARNER: "See your online classes and upcoming sessions from every tutor you learn with.",
};

interface WelcomeModalProps {
  portal: Portal;
  role: Role;
}

/**
 * The first thing a brand-new user sees once signed in (after any forced password change): an
 * invitation to take the portal's shell guide. "Skip for now" records the guide as skipped, so it
 * never reappears on its own - it stays replayable from the help menu.
 */
export function WelcomeModal({ portal, role }: WelcomeModalProps) {
  const firstName = useAuthStore((state) => state.user?.firstName);
  const impersonating = useAuthStore((state) => state.impersonation !== null);
  const status = useOnboardingStore((state) => state.status);
  const autoStart = useOnboardingStore((state) => state.autoStart);
  const progress = useOnboardingStore((state) => state.progress);
  const active = useOnboardingStore((state) => state.active);
  const visibleNavHrefs = useOnboardingStore((state) => state.visibleNavHrefs);
  const start = useOnboardingStore((state) => state.start);
  const record = useOnboardingStore((state) => state.record);
  const [dismissed, setDismissed] = useState(false);

  const shell = shellTourFor(portal);
  const open =
    !dismissed &&
    status === "loaded" &&
    !active &&
    !!shell &&
    !progress[shell.key] &&
    isAvailable(shell, { portal, role, visibleNavHrefs }) &&
    needsAutoStart(shell, undefined, autoStart, impersonating);

  if (!shell) {
    return null;
  }

  function takeTour() {
    setDismissed(true);
    start(shell!.key);
  }

  function skip() {
    setDismissed(true);
    record(shell!.key, shell!.version, "SKIPPED", 0);
  }

  return (
    <Modal open={open} onClose={skip} size="md">
      <div className="flex flex-col items-center text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand-600">
          <Compass className="h-7 w-7" aria-hidden="true" />
        </span>
        <h2 className="mt-4 font-display text-2xl font-medium text-slate-900">
          Welcome to KDLMS{firstName ? `, ${firstName}` : ""}
        </h2>
        <p className="mt-2 max-w-sm text-sm leading-6 text-slate-600">{BLURB[role]}</p>
        <p className="mt-3 text-sm text-slate-500">Take a one-minute tour to find your way around.</p>
        <div className="mt-6 flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-center">
          <Button variant="ghost" onClick={skip}>
            Skip for now
          </Button>
          <Button variant="accent" onClick={takeTour} autoFocus>
            Take the tour
          </Button>
        </div>
        <p className="mt-4 text-xs text-slate-400">You can replay it any time from the help menu.</p>
      </div>
    </Modal>
  );
}
