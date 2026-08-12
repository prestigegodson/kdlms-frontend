import { can } from "@/auth/permissions";
import { FormField } from "@/components/ui/FormField";
import { Select } from "@/components/ui/Select";
import { useAuthStore } from "@/stores/authStore";
import { useBranchStore } from "@/stores/branchStore";

interface BranchFilterProps {
  /** A stable, caller-supplied id - several of these pages render more than one picker, so a hardcoded id (as ClassTermPicker's `picker-*` ids are) would collide. */
  id: string;
  /**
   * Sizing for the FormField wrapper - defaults to sharing a StickySubHeader
   * row evenly with a sibling picker's own `flex-1` grid, capped from `lg`
   * up so it doesn't grow to dominate the row once there's room to spare.
   */
  className?: string;
}

/**
 * The Branch filter shared by Assessments/Attendance/Reports/Messages/
 * Teachers - a SCHOOL_ADMIN must pick one (no "All branches" option, unlike
 * ClassesPage's/StudentsPage's optional branch filters) before those pages'
 * class/teacher lists narrow to it; a BRANCH_ADMIN/TEACHER gets no control
 * at all here, since their branch is already derived server-side. Renders
 * `null` for every other role, satisfying StickySubHeader's "the caller owns
 * the emptiness guard" contract - a page rendering only this inside a
 * StickySubHeader must itself skip the wrapper when this is the sole child
 * and `can.selectBranch` is false.
 */
export function BranchFilter({ id, className = "min-w-0 flex-1 lg:max-w-[12rem]" }: BranchFilterProps) {
  const role = useAuthStore((state) => state.user?.role);
  const branches = useBranchStore((state) => state.branches);
  const selectedBranchId = useBranchStore((state) => state.selectedBranchId);
  const select = useBranchStore((state) => state.select);

  if (!can.selectBranch(role)) {
    return null;
  }

  return (
    <FormField label="Branch" htmlFor={id} labelClassName="sr-only lg:not-sr-only" className={className}>
      <Select id={id} value={selectedBranchId ?? ""} onChange={(event) => select(event.target.value)}>
        {branches.map((branch) => (
          <option key={branch.id} value={branch.id}>
            {branch.name}
          </option>
        ))}
      </Select>
    </FormField>
  );
}
