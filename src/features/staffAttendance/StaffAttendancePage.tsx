import { useState } from "react";
import { can } from "@/auth/permissions";
import { Alert } from "@/components/ui/Alert";
import { FormField } from "@/components/ui/FormField";
import { PageHeader } from "@/components/ui/PageHeader";
import { Select } from "@/components/ui/Select";
import { Tabs } from "@/components/ui/Tabs";
import { useBranchScope } from "@/features/branches/useBranchScope";
import { useAuthStore } from "@/stores/authStore";
import { useBranchStore } from "@/stores/branchStore";
import { useFeatureStore } from "@/stores/featureStore";
import { HardwareTab } from "./components/HardwareTab";
import { RegisterTab } from "./components/RegisterTab";
import { RosterTab } from "./components/RosterTab";
import { ShiftRulesTab } from "./components/ShiftRulesTab";

type Tab = "today" | "staff" | "hardware" | "rules";

const TABS: Array<{ value: Tab; label: string }> = [
  { value: "today", label: "Today" },
  { value: "staff", label: "Staff" },
  { value: "hardware", label: "Terminals & gates" },
  { value: "rules", label: "Working hours" },
];

/**
 * Staff & clock-in (Phase 46): the daily register, the staff roster (academic
 * login staff plus non-academic records), biometric terminals and gate
 * displays, and each branch's working hours. SCHOOL_ADMIN picks a branch (or
 * all of them); a BRANCH_ADMIN is always on their own, server-side.
 */
export function StaffAttendancePage() {
  const role = useAuthStore((state) => state.user?.role);
  const entitled = useFeatureStore((state) => state.staffAttendance);
  const featuresStatus = useFeatureStore((state) => state.status);
  useBranchScope();
  const branches = useBranchStore((state) => state.branches);
  const selectsBranch = can.selectBranch(role);
  const [branchId, setBranchId] = useState<string>("");
  const [tab, setTab] = useState<Tab>("today");

  if (featuresStatus === "loaded" && !can.manageStaffAttendance(role, entitled)) {
    return (
      <div className="space-y-6">
        <PageHeader title="Staff & clock-in" />
        <Alert variant="info">
          Staff biometric clock-in isn&apos;t included in your school&apos;s plan. Upgrade your subscription to add
          non-academic staff and let everyone clock in with a fingerprint.
        </Alert>
      </div>
    );
  }

  const scopedBranch = selectsBranch ? branchId || undefined : undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Staff & clock-in"
        description="Who's in today, your whole staff - teaching and non-teaching - and how they clock in."
        actions={
          selectsBranch && branches.length > 1 ? (
            <FormField label="Branch" htmlFor="staff-attendance-branch" className="min-w-[12rem]">
              <Select
                id="staff-attendance-branch"
                value={branchId}
                onChange={(event) => setBranchId(event.target.value)}
              >
                <option value="">All branches</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </Select>
            </FormField>
          ) : undefined
        }
      />
      <Tabs ariaLabel="Staff & clock-in sections" value={tab} onChange={setTab} items={TABS} />
      {tab === "today" && <RegisterTab branchId={scopedBranch} />}
      {tab === "staff" && <RosterTab branchId={scopedBranch} />}
      {tab === "hardware" && <HardwareTab branchId={scopedBranch} />}
      {tab === "rules" && <ShiftRulesTab branchId={scopedBranch} />}
    </div>
  );
}
