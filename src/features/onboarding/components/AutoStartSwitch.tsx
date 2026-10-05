import { useState } from "react";
import { getErrorMessage } from "@/api/client";
import { Switch } from "@/components/ui/Switch";
import { useAuthStore } from "@/stores/authStore";
import { useOnboardingStore } from "@/stores/onboardingStore";

/** "Show guides automatically" - off means no guide starts on its own; all stay replayable. */
export function AutoStartSwitch() {
  const autoStart = useOnboardingStore((state) => state.autoStart);
  const setAutoStart = useOnboardingStore((state) => state.setAutoStart);
  const impersonating = useAuthStore((state) => state.impersonation !== null);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setError(null);
    try {
      await setAutoStart(!autoStart);
    } catch (caught) {
      setError(getErrorMessage(caught, "Couldn't save your preference. Please try again."));
    }
  }

  return (
    <div>
      <Switch
        checked={autoStart}
        onChange={toggle}
        label="Show guides automatically"
        hint="Start a page's guide the first time you open it."
        disabled={impersonating}
      />
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
