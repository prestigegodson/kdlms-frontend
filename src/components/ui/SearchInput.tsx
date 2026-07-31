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
export function SearchInput({ value, onChange, placeholder, className = "", debounceMs = 300 }: SearchInputProps) {
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
        type="search"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        placeholder={placeholder}
        className="pl-9"
        aria-label={placeholder ?? "Search"}
      />
    </div>
  );
}
