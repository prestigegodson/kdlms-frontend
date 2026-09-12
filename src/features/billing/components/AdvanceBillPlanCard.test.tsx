import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as billingApi from "@/api/billing";
import type { AdvanceBillPlanView } from "@/api/billing";
import * as sessionsApi from "@/api/sessions";
import type { AcademicSessionView } from "@/api/sessions";
import { AdvanceBillPlanCard } from "@/features/billing/components/AdvanceBillPlanCard";

vi.mock("@/api/billing", async () => {
  const actual = await vi.importActual<typeof import("@/api/billing")>("@/api/billing");
  return { ...actual, getAdvanceBillPlans: vi.fn() };
});

vi.mock("@/api/sessions", async () => {
  const actual = await vi.importActual<typeof import("@/api/sessions")>("@/api/sessions");
  return { ...actual, listSessions: vi.fn() };
});

const CURRENT_SESSION: AcademicSessionView = {
  id: "session-1",
  schoolId: "school-1",
  name: "2026/2027",
  startDate: "2026-09-01",
  endDate: null,
  current: true,
};

const UPCOMING_SESSION: AcademicSessionView = {
  id: "session-2",
  schoolId: "school-1",
  name: "2027/2028",
  startDate: "2027-09-01",
  endDate: null,
  current: false,
};

const VIEW: AdvanceBillPlanView = {
  branchId: "branch-1",
  branchName: "Main Campus",
  sessionId: "session-2",
  sessionName: "2027/2028",
  levels: [{ levelId: "level-secondary", displayName: "Secondary" }],
  // Two distinct current levels, one class each, so the level-grouped view has one planned row
  // and one unplanned row - distinct from a single level folded from two classes.
  classes: [
    {
      classId: "class-1",
      className: "Primary 6A",
      currentLevelId: "level-primary-a",
      currentLevelName: "Primary A",
      billingLevelId: "level-secondary",
      billingLevelName: "Secondary",
      activeStudents: 30,
      alreadyEnrolled: 0,
    },
    {
      classId: "class-2",
      className: "Primary 6B",
      currentLevelId: "level-primary-b",
      currentLevelName: "Primary B",
      billingLevelId: null,
      billingLevelName: null,
      activeStudents: 28,
      alreadyEnrolled: 0,
    },
  ],
};

describe("AdvanceBillPlanCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(sessionsApi.listSessions).mockResolvedValue({
      content: [CURRENT_SESSION, UPCOMING_SESSION],
      totalElements: 2,
      totalPages: 1,
      number: 0,
      size: 50,
    });
    vi.mocked(billingApi.getAdvanceBillPlans).mockResolvedValue(VIEW);
  });

  it("does not default to the current session - nothing is shown until one is explicitly picked", async () => {
    render(<AdvanceBillPlanCard branchId="branch-1" />);

    await screen.findByLabelText("Session to advance-bill");
    expect(billingApi.getAdvanceBillPlans).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Configure" })).not.toBeInTheDocument();
  });

  it("shows the planned/total level count once a session is picked", async () => {
    const user = userEvent.setup();
    render(<AdvanceBillPlanCard branchId="branch-1" />);

    await user.selectOptions(await screen.findByLabelText("Session to advance-bill"), "session-2");

    expect(await screen.findByText("1 of 2 levels planned for 2027/2028.")).toBeInTheDocument();
    expect(billingApi.getAdvanceBillPlans).toHaveBeenCalledWith("session-2", "branch-1");
  });

  it("clicking Configure opens the plan editor with the session's levels", async () => {
    const user = userEvent.setup();
    render(<AdvanceBillPlanCard branchId="branch-1" />);

    await user.selectOptions(await screen.findByLabelText("Session to advance-bill"), "session-2");
    await user.click(await screen.findByRole("button", { name: "Configure" }));

    expect(await screen.findByLabelText("Primary A bills at")).toHaveValue("level-secondary");
    expect(screen.getByLabelText("Primary B bills at")).toHaveValue("");
  });
});
