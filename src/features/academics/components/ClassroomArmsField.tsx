import type { ReactNode } from "react";
import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { ClassroomChecklist } from "@/features/academics/components/ClassroomChecklist";

interface ClassroomArmsFieldProps {
  /** Every classroom of the home classroom's class (level) the item may reach, home included. */
  classes: { classId: string; className: string }[];
  homeClassId: string;
  /** The other classrooms picked - the home classroom is always included and never listed here. */
  selected: ReadonlySet<string>;
  onChange: (next: Set<string>) => void;
  /** A classroom that can't be unticked any more (e.g. its pupils have already submitted). */
  isLocked?: (classId: string) => boolean;
  disabled?: boolean;
  /** Prefixes each checkbox id. */
  idPrefix: string;
  /** What sharing means for this kind of item - shown under the list. */
  hint: ReactNode;
}

/**
 * The editors' "which classrooms of this class" field, collapsed to a one-line summary of the
 * classrooms reached until the author chooses to change it. Most items stay in one classroom, so
 * the list only opens on demand - and when it does, it's the bounded {@link ClassroomChecklist}.
 */
export function ClassroomArmsField({
  classes,
  homeClassId,
  selected,
  onChange,
  isLocked,
  disabled = false,
  idPrefix,
  hint,
}: ClassroomArmsFieldProps) {
  const [open, setOpen] = useState(false);
  const reached = classes.filter((sharedClass) => sharedClass.classId === homeClassId || selected.has(sharedClass.classId));
  const others = classes.length - 1;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-slate-700">Classrooms</span>
        {reached.map((sharedClass) => (
          <Badge key={sharedClass.classId} variant={sharedClass.classId === homeClassId ? "neutral" : "brand"}>
            {sharedClass.className}
          </Badge>
        ))}
        {!disabled && (
          <button
            type="button"
            className="text-sm font-medium text-brand-600 hover:underline"
            aria-expanded={open}
            onClick={() => setOpen((current) => !current)}
          >
            {open ? "Done" : reached.length > 1 ? "Change classrooms" : `Share with other classrooms (${others})`}
          </button>
        )}
      </div>
      {open && !disabled && (
        <ClassroomChecklist
          legend="Classrooms of this class"
          idPrefix={idPrefix}
          items={classes.map((sharedClass) => {
            const isHome = sharedClass.classId === homeClassId;
            return {
              classId: sharedClass.classId,
              className: sharedClass.className,
              locked: isHome || (isLocked?.(sharedClass.classId) ?? false),
              note: isHome ? "this classroom" : undefined,
            };
          })}
          selected={selected}
          onChange={onChange}
        />
      )}
      <p className="text-xs text-slate-500">{hint}</p>
    </div>
  );
}
