import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import {
  type ChangeEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { Input } from "@/components/ui/Input";
import { parseIsoDate, toIso } from "@/utils/date";

interface DateInputProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  /** ISO "YYYY-MM-DD" lower bound, inclusive. */
  min?: string;
  /** ISO "YYYY-MM-DD" upper bound, inclusive. */
  max?: string;
  /**
   * Additional per-day exclusion on top of min/max (e.g. weekends) - see
   * `ClassDatePicker`. Checked everywhere a date is validated: the calendar
   * grid, `selectDay`, and typed-entry (`handleTextChange`/`draftLooksInvalid`),
   * so a disabled day can't be typed in around the grid's disabled cells.
   */
  isDayDisabled?: (day: Date) => boolean;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}

const WEEKDAY_LABELS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const MONTH_LABELS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

// Excludes the day cells' roving tabIndex={-1}, unlike Modal's FOCUSABLE_SELECTOR
// (`button:not([disabled])` alone would match all 42, whether Tab-reachable or not).
const POPUP_FOCUSABLE_SELECTOR = 'button:not([disabled]):not([tabindex="-1"]), select:not([disabled])';

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function clampDayToMonth(day: Date, month: Date): Date {
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  return new Date(month.getFullYear(), month.getMonth(), Math.min(day.getDate(), daysInMonth));
}

function isValidCalendarDate(year: number, month: number, day: number): boolean {
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function formatDigits(digits: string): string {
  return [digits.slice(0, 4), digits.slice(4, 6), digits.slice(6, 8)].filter(Boolean).join("-");
}

/**
 * Monday-first 6-week (42-day) grid covering `month`, including the
 * leading/trailing days of adjacent months needed to fill it. A fixed cell
 * count keeps the popup's height constant across months, which the
 * positioning effect below relies on to avoid a resize flicker on navigation.
 */
function buildGrid(month: Date): Date[] {
  const first = startOfMonth(month);
  const firstWeekday = (first.getDay() + 6) % 7; // 0 = Monday
  const gridStart = new Date(first.getFullYear(), first.getMonth(), 1 - firstWeekday);
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(gridStart);
    day.setDate(gridStart.getDate() + index);
    return day;
  });
}

/**
 * The single date picker used everywhere in the app (attendance register,
 * session/term dates, DOB, subscription dates) - see CLAUDE.md's date-picker
 * note. Draws its own month grid instead of delegating to the browser, since
 * that's what made attendance and session/term dates look different from
 * each other despite identical markup: Chrome and Safari each render native
 * `<input type="date">` differently. Keeps a typable text field (still
 * "YYYY-MM-DD", still walkable by the existing `getByLabelText` + `user.type`
 * tests) with an app-styled calendar behind a trailing button.
 *
 * The popup is portaled to `document.body` because six of the ten call
 * sites live inside `Modal`, whose body is `overflow-y-auto` - an
 * absolutely-positioned popup would be clipped. Because a portal's events
 * still bubble through the *React* tree (not the DOM tree), the popup's own
 * Escape/Tab handling below calls `stopPropagation` so it doesn't also
 * trigger Modal's Escape-closes/Tab-traps handling on the modal underneath.
 */
export function DateInput({
  id,
  value,
  onChange,
  min,
  max,
  isDayDisabled,
  required,
  disabled,
  className = "",
}: DateInputProps) {
  const [draft, setDraft] = useState(value);
  const [lastSeenValue, setLastSeenValue] = useState(value);

  // Adopts an external reset of `value` (e.g. loading a different record
  // into an edit form) the same way SearchInput does - compared during
  // render rather than in an effect, so there's no extra render.
  if (value !== lastSeenValue) {
    setLastSeenValue(value);
    setDraft(value);
  }

  const [open, setOpen] = useState(false);
  const [viewDate, setViewDate] = useState(() => startOfMonth(parseIsoDate(value) ?? new Date()));
  const [focusedDate, setFocusedDate] = useState(() => parseIsoDate(value) ?? new Date());
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  const today = new Date();
  const selectedDate = parseIsoDate(value);

  // Single source of truth for "can this date be picked" - the calendar
  // grid, selectDay, and both typed-entry checks below all defer to this so
  // a disabled day can never be typed in around the grid's disabled cells.
  function isIsoDisabled(iso: string): boolean {
    if (min !== undefined && iso < min) {
      return true;
    }
    if (max !== undefined && iso > max) {
      return true;
    }
    if (isDayDisabled) {
      const date = parseIsoDate(iso);
      if (date && isDayDisabled(date)) {
        return true;
      }
    }
    return false;
  }

  function isDisabledDay(day: Date): boolean {
    return isIsoDisabled(toIso(day));
  }

  function computePosition() {
    const rect = wrapperRef.current?.getBoundingClientRect();
    const popupEl = popupRef.current;
    if (!rect) {
      return;
    }
    const popupHeight = popupEl?.offsetHeight ?? 0;
    const popupWidth = popupEl?.offsetWidth ?? rect.width;
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = popupHeight > 0 && spaceBelow < popupHeight + 8 && rect.top > popupHeight + 8;
    const top = openUp ? rect.top - popupHeight - 8 : rect.bottom + 8;
    const maxLeft = window.innerWidth - popupWidth - 8;
    const left = Math.min(Math.max(rect.left, 8), Math.max(maxLeft, 8));
    setPosition({ top, left });
  }

  // Two-pass placement: the popup mounts off-screen (see the inline style
  // below) so its real height is measurable, then this effect - running
  // before paint - moves it to its final, possibly-flipped position.
  useLayoutEffect(() => {
    if (!open) {
      return;
    }
    computePosition();
  }, [open, viewDate]);

  useEffect(() => {
    if (!open) {
      return;
    }
    function reposition() {
      computePosition();
    }
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (wrapperRef.current?.contains(target) || popupRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  // Roving tabindex: whichever cell `focusedDate` names gets real DOM focus,
  // both on open and after arrow-key navigation moves it.
  useEffect(() => {
    if (!open) {
      return;
    }
    const iso = toIso(focusedDate);
    const cell = popupRef.current?.querySelector<HTMLButtonElement>(`[data-iso="${iso}"]`);
    cell?.focus();
  }, [open, focusedDate, viewDate]);

  function openCalendar() {
    if (disabled) {
      return;
    }
    const base = parseIsoDate(value) ?? today;
    setFocusedDate(base);
    setViewDate(startOfMonth(base));
    setPosition(null);
    setOpen(true);
  }

  function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    openCalendar();
  }

  function selectDay(day: Date) {
    if (isDisabledDay(day)) {
      return;
    }
    const iso = toIso(day);
    onChange(iso);
    setDraft(iso);
    setLastSeenValue(iso);
    setOpen(false);
    inputRef.current?.focus();
  }

  function moveMonth(delta: number) {
    const next = new Date(viewDate.getFullYear(), viewDate.getMonth() + delta, 1);
    setViewDate(next);
    setFocusedDate(clampDayToMonth(focusedDate, next));
  }

  function jumpToMonth(month: number) {
    const next = new Date(viewDate.getFullYear(), month, 1);
    setViewDate(next);
    setFocusedDate(clampDayToMonth(focusedDate, next));
  }

  function jumpToYear(year: number) {
    const next = new Date(year, viewDate.getMonth(), 1);
    setViewDate(next);
    setFocusedDate(clampDayToMonth(focusedDate, next));
  }

  function moveFocus(deltaDays: number) {
    const next = new Date(focusedDate);
    next.setDate(next.getDate() + deltaDays);
    setFocusedDate(next);
    if (next.getMonth() !== viewDate.getMonth() || next.getFullYear() !== viewDate.getFullYear()) {
      setViewDate(startOfMonth(next));
    }
  }

  function handleGridKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    switch (event.key) {
      case "ArrowLeft":
        event.preventDefault();
        moveFocus(-1);
        break;
      case "ArrowRight":
        event.preventDefault();
        moveFocus(1);
        break;
      case "ArrowUp":
        event.preventDefault();
        moveFocus(-7);
        break;
      case "ArrowDown":
        event.preventDefault();
        moveFocus(7);
        break;
      case "PageUp":
        event.preventDefault();
        moveMonth(-1);
        break;
      case "PageDown":
        event.preventDefault();
        moveMonth(1);
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        selectDay(focusedDate);
        break;
      default:
        break;
    }
  }

  function handlePopupKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    // Shields Modal's own Escape/Tab handling underneath - see the file doc comment.
    event.stopPropagation();
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      inputRef.current?.focus();
      return;
    }
    if (event.key !== "Tab") {
      return;
    }
    const focusable = popupRef.current?.querySelectorAll<HTMLElement>(POPUP_FOCUSABLE_SELECTOR);
    if (!focusable || focusable.length === 0) {
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function handleTextChange(event: ChangeEvent<HTMLInputElement>) {
    const digits = event.target.value.replace(/\D/g, "").slice(0, 8);
    const formatted = formatDigits(digits);
    setDraft(formatted);

    if (digits.length === 0) {
      onChange("");
      return;
    }
    if (digits.length !== 8) {
      return;
    }
    const year = Number(digits.slice(0, 4));
    const month = Number(digits.slice(4, 6));
    const day = Number(digits.slice(6, 8));
    if (!isValidCalendarDate(year, month, day)) {
      return;
    }
    const iso = formatted;
    if (!isIsoDisabled(iso)) {
      onChange(iso);
    }
  }

  const draftDigits = draft.replace(/\D/g, "");
  const draftLooksInvalid =
    draftDigits.length === 8 &&
    (() => {
      const year = Number(draftDigits.slice(0, 4));
      const month = Number(draftDigits.slice(4, 6));
      const day = Number(draftDigits.slice(6, 8));
      if (!isValidCalendarDate(year, month, day)) {
        return true;
      }
      const iso = formatDigits(draftDigits);
      return isIsoDisabled(iso);
    })();

  const grid = buildGrid(viewDate);
  const currentYear = today.getFullYear();
  const minYear = min !== undefined ? (parseIsoDate(min)?.getFullYear() ?? currentYear - 100) : currentYear - 100;
  const maxYear = max !== undefined ? (parseIsoDate(max)?.getFullYear() ?? currentYear + 10) : currentYear + 10;
  const yearOptions = Array.from({ length: Math.max(maxYear - minYear + 1, 1) }, (_, index) => minYear + index);

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      <Input
        id={id}
        ref={inputRef}
        type="text"
        inputMode="numeric"
        placeholder="YYYY-MM-DD"
        maxLength={10}
        required={required}
        disabled={disabled}
        value={draft}
        onChange={handleTextChange}
        aria-invalid={draftLooksInvalid || undefined}
        className="pr-9"
      />
      <button
        type="button"
        aria-label="Open calendar"
        aria-haspopup="dialog"
        aria-expanded={open}
        disabled={disabled}
        onClick={toggle}
        className="absolute right-2.5 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center text-slate-400
          hover:text-slate-600 disabled:pointer-events-none disabled:opacity-50"
      >
        <CalendarIcon className="h-4 w-4" aria-hidden="true" />
      </button>

      {open &&
        createPortal(
          <div
            ref={popupRef}
            role="dialog"
            aria-label="Choose date"
            tabIndex={-1}
            onKeyDown={handlePopupKeyDown}
            className="fixed z-[60] w-72 max-w-[calc(100vw-1rem)] rounded-panel border border-slate-200 bg-white shadow-lg outline-none mobile:w-[21rem]"
            style={{
              top: position?.top ?? -9999,
              left: position?.left ?? -9999,
              visibility: position ? "visible" : "hidden",
            }}
          >
            <div className="flex items-center justify-between gap-2 px-3 pt-3">
              <button
                type="button"
                aria-label="Previous month"
                onClick={() => moveMonth(-1)}
                className="flex h-7 w-7 items-center justify-center rounded-control text-slate-500 hover:bg-slate-100"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              </button>
              <div className="flex items-center gap-1">
                <select
                  aria-label="Month"
                  value={viewDate.getMonth()}
                  onChange={(event) => jumpToMonth(Number(event.target.value))}
                  className="rounded-control border border-slate-200 bg-white px-1.5 py-1 text-sm text-slate-700
                    focus:border-brand-500"
                >
                  {MONTH_LABELS.map((label, index) => (
                    <option key={label} value={index}>
                      {label}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Year"
                  value={viewDate.getFullYear()}
                  onChange={(event) => jumpToYear(Number(event.target.value))}
                  className="rounded-control border border-slate-200 bg-white px-1.5 py-1 text-sm text-slate-700
                    focus:border-brand-500"
                >
                  {yearOptions.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                aria-label="Next month"
                onClick={() => moveMonth(1)}
                className="flex h-7 w-7 items-center justify-center rounded-control text-slate-500 hover:bg-slate-100"
              >
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="mt-2 grid grid-cols-7 gap-1 px-3 text-center text-xs font-medium text-slate-400 mobile:gap-0.5">
              {WEEKDAY_LABELS.map((label) => (
                <div key={label}>{label}</div>
              ))}
            </div>

            <div
              role="grid"
              aria-label="Day"
              onKeyDown={handleGridKeyDown}
              className="grid grid-cols-7 gap-1 px-3 pb-3 pt-1 mobile:gap-0.5"
            >
              {grid.map((day) => {
                const inCurrentMonth = day.getMonth() === viewDate.getMonth();
                const isToday = isSameDay(day, today);
                const isSelected = selectedDate !== null && isSameDay(day, selectedDate);
                const isFocused = isSameDay(day, focusedDate);
                const dayDisabled = isDisabledDay(day);

                let toneClasses = "text-slate-700 hover:bg-slate-100";
                if (!inCurrentMonth) {
                  toneClasses = "text-slate-300 hover:bg-slate-100";
                }
                if (isToday && !isSelected) {
                  toneClasses = "border border-brand-400 text-brand-600 hover:bg-brand-50";
                }
                if (isSelected) {
                  toneClasses = "bg-brand-500 text-white hover:bg-brand-600";
                }
                if (dayDisabled) {
                  toneClasses = "cursor-not-allowed text-slate-300 hover:bg-transparent";
                }

                return (
                  <button
                    key={toIso(day)}
                    type="button"
                    data-iso={toIso(day)}
                    role="gridcell"
                    aria-selected={isSelected}
                    aria-current={isToday ? "date" : undefined}
                    aria-disabled={dayDisabled || undefined}
                    tabIndex={isFocused ? 0 : -1}
                    disabled={dayDisabled}
                    onClick={() => selectDay(day)}
                    onFocus={() => setFocusedDate(day)}
                    // mobile:w-full, not a fixed width: the popup is
                    // mobile:w-[21rem] (336px) with px-3 (24px) and a
                    // 7-column gap-0.5 grid (12px), leaving 300px / 7 ≈
                    // 43px per column - a fixed w-11 (44px) would overflow
                    // that. h-11 (44px) still clears the touch-target floor.
                    className={`flex h-8 w-8 items-center justify-center rounded-control text-sm transition-colors mobile:h-11 mobile:w-full ${toneClasses}`}
                  >
                    {day.getDate()}
                  </button>
                );
              })}
            </div>

            <div className="border-t border-slate-100 px-3 py-2">
              <button
                type="button"
                onClick={() => selectDay(today)}
                disabled={isDisabledDay(today)}
                className="text-xs font-medium text-brand-600 hover:text-brand-800 disabled:cursor-not-allowed
                  disabled:text-slate-300"
              >
                Today
              </button>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
