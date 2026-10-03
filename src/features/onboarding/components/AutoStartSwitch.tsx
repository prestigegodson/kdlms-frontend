import { useId, useState } from "react";
import { getErrorMessage } from "@/api/client";
import { useAuthStore } from "@/stores/authStore";
import { useOnboardingStore } from "@/stores/onboardingStore";

/** "Show guides automatically" - off means no guide starts on its own; all stay replayable. */
export function AutoStartSwitch() {
  const autoStart = useOnboardingStore((state) => state.autoStart);
  const setAutoStart = useOnboardingStore((state) => state.setAutoStart);
  const impersonating = useAuthStore((state) => state.impersonation !== null);
  const [error, setError] = useState<string | null>(null);
  const labelId = useId();
  const hintId = useId();

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
      <div className="flex items-center justify-between gap-4">
        <div>
          <p id={labelId} className="text-sm font-medium text-slate-900">
            Show guides automatically
          </p>
          <p id={hintId} className="text-xs text-slate-500">
            Start a page's guide the first time you open it.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={autoStart}
          aria-labelledby={labelId}
          aria-describedby={hintId}
          disabled={impersonating}
          onClick={toggle}
          className="-mr-1.5 flex h-11 w-14 shrink-0 items-center justify-center rounded-full disabled:opacity-50"
        >
          <span
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              autoStart ? "bg-brand-500" : "bg-slate-300"
            }`}
          >
            <span
              className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                autoStart ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </span>
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
