import { Eye, EyeOff } from "lucide-react";
import { useRef, useState, type InputHTMLAttributes } from "react";
import { Input } from "@/components/ui/Input";

type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type">;

/**
 * The one place a reveal-password toggle lives - `type` is deliberately not
 * a prop, since this component owns the masked/unmasked switch itself.
 * Structured like DateInput's trailing calendar button: a `relative`
 * wrapper, the `Input` given right padding to clear the button, and an
 * absolutely positioned bare `<button>` (not `components/ui/Button`, which
 * has no icon-only mode and would render as a wide pill here). Sized
 * `w-11`/full-height rather than DateInput's compact `h-5 w-5` icon box, to
 * clear the 44px touch floor at every width without a `mobile:` special case.
 *
 * The toggle fires on `onPointerDown` (with `preventDefault`), not `onClick`.
 * On touch, a plain `onClick` is unreliable: pressing the button blurs the
 * password input, which dismisses the soft keyboard and reflows the page
 * (both auth screens and the Change password bottom sheet shift noticeably
 * when the keyboard closes) - by the time the finger lifts it's no longer
 * over the button, so the browser never synthesizes a `click` and nothing
 * toggles. Preventing the default on `pointerdown` keeps focus on the input
 * (keyboard stays up, nothing reflows) and flips the state on press instead.
 * `onClick` is kept as the keyboard-activation path (Enter/Space fire
 * `click` with no preceding `pointerdown`), guarded by a timestamp so a
 * pointer tap's own trailing click can't double-toggle - a self-expiring
 * window rather than a boolean latch, so it can never get stuck suppressing
 * a later, genuine keyboard activation.
 */
export function PasswordInput({ className = "", disabled, ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  const lastPointerToggle = useRef(0);
  const Icon = visible ? EyeOff : Eye;
  const toggle = () => setVisible((current) => !current);

  return (
    <div className="relative">
      <Input type={visible ? "text" : "password"} disabled={disabled} className={`pr-11 ${className}`} {...props} />
      <button
        type="button"
        aria-label={visible ? "Hide password" : "Show password"}
        disabled={disabled}
        onPointerDown={(event) => {
          if (event.pointerType === "mouse" && event.button !== 0) return;
          event.preventDefault();
          lastPointerToggle.current = event.timeStamp;
          toggle();
        }}
        onClick={(event) => {
          if (event.timeStamp - lastPointerToggle.current < 500) return;
          toggle();
        }}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-400
          hover:text-slate-600 disabled:pointer-events-none disabled:opacity-50"
      >
        <Icon className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}
