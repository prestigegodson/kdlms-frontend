import { Eye, EyeOff } from "lucide-react";
import { useState, type InputHTMLAttributes } from "react";
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
 */
export function PasswordInput({ className = "", disabled, ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  const Icon = visible ? EyeOff : Eye;

  return (
    <div className="relative">
      <Input type={visible ? "text" : "password"} disabled={disabled} className={`pr-11 ${className}`} {...props} />
      <button
        type="button"
        aria-label={visible ? "Hide password" : "Show password"}
        disabled={disabled}
        onClick={() => setVisible((current) => !current)}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-400
          hover:text-slate-600 disabled:pointer-events-none disabled:opacity-50"
      >
        <Icon className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}
