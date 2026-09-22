import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/Input";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  /** Milliseconds of typing pause before `onChange` fires. Defaults to 300ms. */
  debounceMs?: number;
  /**
   * Pass when this field sits under an external `<label htmlFor>` (e.g. a
   * `FormField`), so it lines up with labelled sibling controls instead of
   * floating above them. When set, the fallback `aria-label` is dropped so
   * it doesn't shadow the visible label for assistive tech.
   */
  id?: string;
  /**
   * The WAI-ARIA combobox attributes, all optional - a plain search field
   * (every call site but `StudentSearchField`) leaves these unset. Forwarded
   * straight onto the underlying `<Input>`, which is where its own debounced
   * `onKeyDown` also lands, so a combobox owner can drive Up/Down/Enter/
   * Escape off the same element the person is typing into.
   */
  role?: string;
  "aria-expanded"?: boolean;
  "aria-controls"?: string;
  "aria-activedescendant"?: string;
  onKeyDown?: (event: ReactKeyboardEvent<HTMLInputElement>) => void;
  disabled?: boolean;
}

/**
 * A text filter that only calls `onChange` (and so only triggers a fetch)
 * once typing pauses, rather than on every keystroke - the first search
 * input in the app, backing the student registry's server-side `?q=`. Keeps
 * its own draft value so the field never stutters while debouncing; an
 * external reset of `value` (e.g. a "Clear filters" action) is adopted by
 * comparing against the last-seen `value` during render - the "adjust state
 * while rendering" case React's docs call out, same technique PortalShell's
 * drawer-close-on-navigate uses - rather than an effect, so there's no extra
 * render. Committing a debounced change also sets `value` to that same
 * draft, so this is a no-op in the common case.
 */
export function SearchInput({
  value,
  onChange,
  placeholder,
  className = "",
  debounceMs = 300,
  id,
  role,
  "aria-expanded": ariaExpanded,
  "aria-controls": ariaControls,
  "aria-activedescendant": ariaActiveDescendant,
  onKeyDown,
  disabled,
}: SearchInputProps) {
  const [draft, setDraft] = useState(value);
  const [lastSeenValue, setLastSeenValue] = useState(value);

  if (value !== lastSeenValue) {
    setLastSeenValue(value);
    setDraft(value);
  }

  useEffect(() => {
    if (draft === value) {
      return;
    }
    const timeout = setTimeout(() => onChange(draft), debounceMs);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-arm only on draft changes; onChange/value identity shouldn't reset the timer
  }, [draft, debounceMs]);

  return (
    <div className={`relative ${className}`}>
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
        aria-hidden="true"
      />
      <Input
        id={id}
        type="search"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        className="pl-9"
        role={role}
        aria-expanded={ariaExpanded}
        aria-controls={ariaControls}
        aria-activedescendant={ariaActiveDescendant}
        disabled={disabled}
        aria-label={id ? undefined : (placeholder ?? "Search")}
      />
    </div>
  );
}
