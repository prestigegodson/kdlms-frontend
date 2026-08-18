import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useInstallApp } from "@/hooks/useInstallApp";
import { InstallInstructionsModal } from "@/layouts/InstallInstructionsModal";

/**
 * A one-time, dismissible install prompt, rendered by PortalShell above the
 * routed content for every portal. Deliberately built from Card + Button
 * rather than components/ui/Alert.tsx, which has no dismiss affordance.
 * `lg:hidden` per the "mobile widths only" decision - desktop admins are
 * never interrupted, and the drawer's own Install entry (PortalShell) is the
 * fallback for anyone who dismisses this or comes back later.
 *
 * `variant="primary"` on its CTA, never `accent` - style_guide.md's "one
 * amber per view" rule means this banner must not compete with whatever
 * accent CTA the underlying page already owns.
 */
export function InstallBanner() {
  const { platform, shouldShowBanner, install, dismiss, instructionsOpen, closeInstructions } =
    useInstallApp();

  if (!shouldShowBanner) {
    return null;
  }

  return (
    <>
      <Card className="mb-6 flex items-start gap-3 lg:hidden">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-800">
          <Download className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-sm font-medium text-slate-900">Install KDLMS</p>
          <p className="mt-0.5 text-sm text-slate-600">
            Add it to your home screen for faster access and a full-screen app experience.
          </p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={install}>
              {platform === "ios" ? "How to install" : "Install"}
            </Button>
            <Button size="sm" variant="ghost" onClick={dismiss}>
              Not now
            </Button>
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="-mr-1 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-control text-slate-400 hover:bg-slate-100 hover:text-slate-600 mobile:h-11 mobile:w-11"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </Card>
      <InstallInstructionsModal open={instructionsOpen} onClose={closeInstructions} platform={platform} />
    </>
  );
}
