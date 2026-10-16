import { useEffect, useMemo } from "react";
import type { SchoolClassView } from "@/api/classes";
import type { TeacherClassView } from "@/api/me";
import type { ClassOption } from "@/features/assessments/components/ClassTermPicker";
import { useLevelStore } from "@/stores/levelStore";

/**
 * A `ClassTermPicker`'s options, each labelled with its level so the Class select groups them -
 * 30 classrooms read as 15 short level headings instead of one flat list. A teacher's classes carry
 * their own level name; an admin's are named from the level store (fetched only for that path). If
 * the levels can't be loaded the options simply stay ungrouped. Both class lists already arrive in
 * level-rank order, which the picker's grouping keeps.
 */
export function useClassOptions(
  isTeacher: boolean,
  teacherClasses: TeacherClassView[] | null,
  adminClasses: SchoolClassView[] | null,
): ClassOption[] {
  const levels = useLevelStore((state) => state.levels);
  const fetchLevels = useLevelStore((state) => state.fetchIfNeeded);

  useEffect(() => {
    if (!isTeacher) fetchLevels();
  }, [isTeacher, fetchLevels]);

  return useMemo(() => {
    if (isTeacher) {
      return (teacherClasses ?? []).map((c) => ({ id: c.classId, name: c.className, group: c.levelName }));
    }
    const levelNames = new Map(levels.map((level) => [level.id, level.displayName]));
    return (adminClasses ?? []).map((c) => ({ id: c.id, name: c.name, group: levelNames.get(c.levelId) }));
  }, [isTeacher, teacherClasses, adminClasses, levels]);
}
