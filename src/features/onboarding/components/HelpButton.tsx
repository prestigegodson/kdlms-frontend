import { BookOpen, CircleHelp, Info } from "lucide-react";
import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { AutoStartSwitch } from "@/features/onboarding/components/AutoStartSwitch";
import { GuideStatusBadge } from "@/features/onboarding/components/GuideStatusBadge";
import { guideActionLabel, normalisePath } from "@/features/onboarding/eligibility";
import type { Portal } from "@/features/onboarding/types";
import { useGuides, useStartGuide } from "@/features/onboarding/useGuides";
import { MOBILE_QUERY, useMediaQuery } from "@/hooks/useMediaQuery";
import { useAuthStore } from "@/stores/authStore";

interface HelpButtonProps {
  portal: Portal;
}

/**
 * The header's "?" button: the guides for the page you're on (plus the portal's welcome tour),
 * the "Show guides automatically" switch, and a link to every how-to guide. A dropdown from `md`
 * up, a bottom sheet below it (components/ui/Modal.tsx), mirroring UserMenu's dismissal.
 */
export function HelpButton({ portal }: HelpButtonProps) {
  const mobile = useMediaQuery(MOBILE_QUERY);
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && !mobile) {
      panelRef.current?.focus();
    }
  }, [open, mobile]);

  function close() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      close();
    }
  }

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        data-tour="help"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Help and guides"
        onClick={() => setOpen((value) => !value)}
        className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 mobile:h-11 mobile:w-11"
      >
        <CircleHelp className="h-5 w-5" aria-hidden="true" />
      </button>

      {mobile ? (
        <Modal open={open} onClose={() => setOpen(false)} title="Help & guides" size="md">
          <HelpPanel portal={portal} onDone={() => setOpen(false)} />
        </Modal>
      ) : (
        open && (
          <>
            <div className="fixed inset-0 z-40" onClick={close} aria-hidden="true" />
            <div
              ref={panelRef}
              role="dialog"
              aria-label="Help and guides"
              tabIndex={-1}
              onKeyDown={handleKeyDown}
              className="absolute right-0 z-50 mt-2 w-80 rounded-panel border border-slate-200 bg-white shadow-lg outline-none"
            >
              <div className="border-b border-slate-100 px-4 py-3">
                <p className="font-display text-base font-medium text-slate-900">Help &amp; guides</p>
              </div>
              <div className="px-4 py-3">
                <HelpPanel portal={portal} onDone={() => setOpen(false)} />
              </div>
            </div>
          </>
        )
      )}
    </div>
  );
}

function HelpPanel({ portal, onDone }: { portal: Portal; onDone: () => void }) {
  const location = useLocation();
  const pathname = normalisePath(location.pathname);
  const impersonating = useAuthStore((state) => state.impersonation !== null);
  const startGuide = useStartGuide();
  const guides = useGuides(portal).filter(({ tour }) => tour.kind === "shell" || tour.route === pathname);

  return (
    <div className="space-y-4">
      <section aria-labelledby="help-this-page">
        <h3 id="help-this-page" className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Guides for this page
        </h3>
        <ul className="mt-2 divide-y divide-slate-100">
          {guides.map(({ tour, status }) => (
            <li key={tour.key} className="flex items-center gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-slate-900">{tour.title}</p>
                  <GuideStatusBadge status={status} />
                </div>
                <p className="mt-0.5 text-xs text-slate-500">{tour.description}</p>
              </div>
              <Button
                size="sm"
                variant="secondary"
                aria-label={`${guideActionLabel(status)} ${tour.title}`}
                onClick={() => {
                  onDone();
                  startGuide(tour);
                }}
              >
                {guideActionLabel(status)}
              </Button>
            </li>
          ))}
        </ul>
      </section>
      <div className="border-t border-slate-100 pt-3">
        <AutoStartSwitch />
      </div>
      {impersonating && (
        <p className="flex items-start gap-2 rounded-panel bg-blue-50 px-3 py-2 text-xs text-blue-700">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Guides still play while impersonating, but progress isn't saved.
        </p>
      )}
      <Link
        to={`/${portal}/help`}
        onClick={onDone}
        className="flex items-center gap-2 rounded-control text-sm font-medium text-brand-600 hover:text-brand-800 mobile:min-h-11"
      >
        <BookOpen className="h-4 w-4" aria-hidden="true" />
        All how-to guides
      </Link>
    </div>
  );
}
