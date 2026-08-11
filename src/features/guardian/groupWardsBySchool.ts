import type { MyWardView } from "@/api/wards";

/** Groups wards by school, preserving each ward's original (name-sorted) relative order within its group. */
export function groupWardsBySchool(wards: MyWardView[]): [string, MyWardView[]][] {
  const groups = new Map<string, MyWardView[]>();
  for (const ward of wards) {
    const group = groups.get(ward.schoolName);
    if (group) {
      group.push(ward);
    } else {
      groups.set(ward.schoolName, [ward]);
    }
  }
  return [...groups.entries()];
}
