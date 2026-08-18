import { EllipsisVertical, Share, SquarePlus } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import type { InstallPlatform } from "@/utils/installPrompt";

interface InstallInstructionsModalProps {
  open: boolean;
  onClose: () => void;
  platform: InstallPlatform;
}

interface Step {
  icon: typeof Share;
  text: string;
}

// "chromium" never reaches here in practice - useInstallApp only opens this
// modal for iOS (no native dialog exists) or as the Chromium decline
// fallback, where "other" copy (a generic browser-menu instruction) is the
// safer default than assuming Chrome's own wording.
const STEPS: Record<Exclude<InstallPlatform, "chromium">, Step[]> = {
  ios: [
    { icon: Share, text: "Tap the Share icon in Safari's toolbar." },
    { icon: SquarePlus, text: "Scroll down and tap Add to Home Screen." },
    { icon: SquarePlus, text: "Tap Add to confirm." },
  ],
  other: [
    { icon: EllipsisVertical, text: "Open your browser's menu." },
    { icon: SquarePlus, text: "Tap Install app or Add to Home Screen." },
  ],
};

/**
 * The iOS/fallback counterpart to Chromium's native install dialog - there
 * is no programmatic install path on iOS Safari, so this is the entire
 * "install" experience there. Presents as a bottom sheet below `md` via
 * Modal's own automatic behaviour, which suits a numbered how-to on a phone.
 */
export function InstallInstructionsModal({ open, onClose, platform }: InstallInstructionsModalProps) {
  const steps = STEPS[platform === "chromium" ? "other" : platform];
  const isIOS = platform === "ios";

  return (
    <Modal open={open} onClose={onClose} title="How to install" size="md">
      {isIOS && (
        <p className="mb-4 text-sm text-slate-600">
          Open this page in Safari, then:
        </p>
      )}
      <ol className="space-y-3">
        {steps.map((step, index) => (
          <li key={index} className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-800">
              <step.icon className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="text-sm text-slate-700">{step.text}</span>
          </li>
        ))}
      </ol>
    </Modal>
  );
}
