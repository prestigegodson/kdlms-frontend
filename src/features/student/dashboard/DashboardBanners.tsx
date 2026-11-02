import { ClipboardList, Lightbulb, PartyPopper, ShieldCheck, X } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { DUE_SOON_DAYS } from "@/features/student/dashboard/studentDashboardStats";

/** "You have N incomplete quizzes nearing their due date" - or a calm all-caught-up note at zero. */
export function DueSoonBanner({ count }: { count: number }) {
  if (count === 0) {
    return (
      <div className="flex items-center rounded-card border border-slate-200 bg-white p-4 sm:p-5">
        <span className="mr-4 flex h-11 w-11 shrink-0 items-center justify-center rounded-panel bg-brand-50">
          <PartyPopper className="h-5 w-5 text-brand-600" aria-hidden="true" />
        </span>
        <p className="text-sm text-slate-700">
          You&apos;re all caught up - no quizzes due in the next {DUE_SOON_DAYS} days.
        </p>
      </div>
    );
  }
  return (
    <Link
      to="/student/quizzes"
      className="flex items-center rounded-card border border-slate-200 bg-white p-4 transition-colors hover:border-brand-200 hover:bg-brand-50/40 sm:p-5"
    >
      <span className="mr-4 flex h-11 w-11 shrink-0 items-center justify-center rounded-panel bg-brand-50">
        <ClipboardList className="h-5 w-5 text-brand-600" aria-hidden="true" />
      </span>
      <p className="text-sm text-slate-700">
        You have{" "}
        <strong className="font-semibold text-brand-700">
          {count} incomplete {count === 1 ? "quiz" : "quizzes"}
        </strong>{" "}
        nearing {count === 1 ? "its" : "their"} due date.
      </p>
    </Link>
  );
}

export function PrivacyNote() {
  return (
    <div className="flex items-center rounded-card border border-slate-200 bg-white p-4 sm:p-5">
      <span className="mr-4 flex h-11 w-11 shrink-0 items-center justify-center rounded-panel bg-brand-50">
        <ShieldCheck className="h-5 w-5 text-brand-600" aria-hidden="true" />
      </span>
      <p className="text-sm text-slate-700">
        This page is only viewable <strong className="font-semibold text-slate-900">by you and your teachers.</strong>
      </p>
    </div>
  );
}

const TIP_DISMISSED_KEY = "kdlms.student.home.tipDismissed";

function readTipDismissed(): boolean {
  try {
    return window.localStorage.getItem(TIP_DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

/** A one-line study tip; dismissing it is a per-device convenience, so storage failure just shows it again. */
export function StudyTip() {
  const [dismissed, setDismissed] = useState(readTipDismissed);
  if (dismissed) {
    return null;
  }
  function dismiss() {
    setDismissed(true);
    try {
      window.localStorage.setItem(TIP_DISMISSED_KEY, "1");
    } catch {
      // Private mode / blocked storage - the tip simply returns next visit.
    }
  }
  return (
    <div className="flex items-center rounded-panel border border-brand-100 bg-brand-50 px-4 py-2.5">
      <Lightbulb className="mr-3 h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
      <p className="min-w-0 flex-1 text-sm text-brand-800">
        Learners generally perform better when they submit quizzes well before the deadline.
      </p>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss tip"
        className="ml-3 cursor-pointer rounded-control p-1 text-brand-600 hover:bg-brand-100 mobile:min-h-11 mobile:min-w-11"
      >
        <X className="mx-auto h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}
