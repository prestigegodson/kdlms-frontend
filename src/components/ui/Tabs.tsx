interface TabsProps<T extends string> {
  ariaLabel: string;
  value: T;
  onChange: (value: T) => void;
  items: Array<{ value: T; label: string }>;
}

/**
 * A shared tablist row - the `role="tablist"` + underlined `TabButton` shape
 * repeated by hand across AssessmentsPage/TeacherTimetablePanel/
 * AdminLessonNotePanel/AdminAttendancePanel. `overflow-x-auto` paired with
 * `overscroll-x-contain` (CLAUDE.md's scroll-container rule) so a longer
 * label set (e.g. "Affective disposition"/"Psychomotor skills") scrolls
 * within the row instead of forcing the page to scroll below 375px.
 */
export function Tabs<T extends string>({ ariaLabel, value, onChange, items }: TabsProps<T>) {
  return (
    <div role="tablist" aria-label={ariaLabel} className="flex gap-1 overflow-x-auto overscroll-x-contain border-b border-slate-200">
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          role="tab"
          aria-selected={value === item.value}
          onClick={() => onChange(item.value)}
          className={`cursor-pointer whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium mobile:min-h-11 ${
            value === item.value ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
