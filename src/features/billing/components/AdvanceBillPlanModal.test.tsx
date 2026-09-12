import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as billingApi from "@/api/billing";
import type { AdvanceBillPlanView } from "@/api/billing";
import { ApiError } from "@/api/client";
import { AdvanceBillPlanModal } from "@/features/billing/components/AdvanceBillPlanModal";

vi.mock("@/api/billing", async () => {
  const actual = await vi.importActual<typeof import("@/api/billing")>("@/api/billing");
  return { ...actual, saveAdvanceBillPlans: vi.fn() };
});

// Primary 6 has two classes agreeing on Secondary (folds to one row); Junior Secondary has one
// class, unplanned; Senior Secondary has two classes that disagree - a Mixed row.
const VIEW: AdvanceBillPlanView = {
  branchId: "branch-1",
  branchName: "Main Campus",
  sessionId: "session-2",
  sessionName: "2027/2028",
  levels: [
    { levelId: "level-secondary", displayName: "Secondary" },
    { levelId: "level-tertiary", displayName: "Tertiary" },
  ],
  classes: [
    {
      classId: "class-1",
      className: "Primary 6A",
      currentLevelId: "level-primary-6",
      currentLevelName: "Primary 6",
      billingLevelId: "level-secondary",
      billingLevelName: "Secondary",
      activeStudents: 30,
      alreadyEnrolled: 0,
    },
    {
      classId: "class-2",
      className: "Primary 6B",
      currentLevelId: "level-primary-6",
      currentLevelName: "Primary 6",
      billingLevelId: "level-secondary",
      billingLevelName: "Secondary",
      activeStudents: 28,
      alreadyEnrolled: 0,
    },
    {
      classId: "class-3",
      className: "JSS 3",
      currentLevelId: "level-jss3",
      currentLevelName: "Junior Secondary 3",
      billingLevelId: null,
      billingLevelName: null,
      activeStudents: 25,
      alreadyEnrolled: 0,
    },
    {
      classId: "class-4",
      className: "SSS 3A",
      currentLevelId: "level-sss3",
      currentLevelName: "Senior Secondary 3",
      billingLevelId: "level-tertiary",
      billingLevelName: "Tertiary",
      activeStudents: 20,
      alreadyEnrolled: 0,
    },
    {
      classId: "class-5",
      className: "SSS 3B",
      currentLevelId: "level-sss3",
      currentLevelName: "Senior Secondary 3",
      billingLevelId: null,
      billingLevelName: null,
      activeStudents: 18,
      alreadyEnrolled: 0,
    },
  ],
};

function renderModal() {
  const onClose = vi.fn();
  const onSaved = vi.fn();
  render(<AdvanceBillPlanModal view={VIEW} branchId="branch-1" onClose={onClose} onSaved={onSaved} />);
  return { onClose, onSaved };
}

describe("AdvanceBillPlanModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("folds classes into one row per current level, seeding a shared billing level and Exclude for an unplanned level", async () => {
    renderModal();

    expect(await screen.findByLabelText("Primary 6 bills at")).toHaveValue("level-secondary");
    expect(screen.getByLabelText("Junior Secondary 3 bills at")).toHaveValue("");
  });

  it("shows Mixed for a level whose classes don't already agree, and treats it as not dirty until changed", async () => {
    renderModal();

    expect(await screen.findByLabelText("Senior Secondary 3 bills at")).toHaveValue("__mixed__");
    expect(screen.queryByText(/unsaved change/)).not.toBeInTheDocument();
  });

  it("shows no unsaved-changes bar until a level actually changes", async () => {
    renderModal();
    await screen.findByLabelText("Primary 6 bills at");

    expect(screen.queryByText(/unsaved change/)).not.toBeInTheDocument();
  });

  it("planning a previously-excluded level saves every one of its classes as dirty rows", async () => {
    const user = userEvent.setup();
    vi.mocked(billingApi.saveAdvanceBillPlans).mockResolvedValue({
      outcomes: [{ classId: "class-3", success: true, message: null }],
    });
    const { onSaved } = renderModal();

    await user.selectOptions(await screen.findByLabelText("Junior Secondary 3 bills at"), "level-secondary");
    expect(await screen.findByText("1 unsaved change")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(billingApi.saveAdvanceBillPlans).toHaveBeenCalledWith(
        "session-2",
        [{ classId: "class-3", levelId: "level-secondary" }],
        "branch-1",
      ),
    );
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith("1 level saved."));
  });

  it("planning a level with two classes sends one row per class of that level", async () => {
    const user = userEvent.setup();
    vi.mocked(billingApi.saveAdvanceBillPlans).mockResolvedValue({
      outcomes: [
        { classId: "class-1", success: true, message: null },
        { classId: "class-2", success: true, message: null },
      ],
    });
    renderModal();

    await user.selectOptions(await screen.findByLabelText("Primary 6 bills at"), "level-tertiary");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(billingApi.saveAdvanceBillPlans).toHaveBeenCalledWith(
        "session-2",
        [
          { classId: "class-1", levelId: "level-tertiary" },
          { classId: "class-2", levelId: "level-tertiary" },
        ],
        "branch-1",
      ),
    );
  });

  it("excluding a planned level sends a null levelId for every class of that level", async () => {
    const user = userEvent.setup();
    vi.mocked(billingApi.saveAdvanceBillPlans).mockResolvedValue({
      outcomes: [
        { classId: "class-1", success: true, message: null },
        { classId: "class-2", success: true, message: null },
      ],
    });
    renderModal();

    await user.selectOptions(await screen.findByLabelText("Primary 6 bills at"), "");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(billingApi.saveAdvanceBillPlans).toHaveBeenCalledWith(
        "session-2",
        [
          { classId: "class-1", levelId: null },
          { classId: "class-2", levelId: null },
        ],
        "branch-1",
      ),
    );
  });

  it("discarding reverts every edited select", async () => {
    const user = userEvent.setup();
    renderModal();

    await user.selectOptions(await screen.findByLabelText("Junior Secondary 3 bills at"), "level-secondary");
    await user.click(screen.getByRole("button", { name: "Discard" }));

    expect(await screen.findByLabelText("Junior Secondary 3 bills at")).toHaveValue("");
    expect(screen.queryByText(/unsaved change/)).not.toBeInTheDocument();
  });

  it("a rejected save surfaces the error inline", async () => {
    const user = userEvent.setup();
    vi.mocked(billingApi.saveAdvanceBillPlans).mockRejectedValue(new ApiError(500, "Failed to save the plan"));
    renderModal();

    await user.selectOptions(await screen.findByLabelText("Junior Secondary 3 bills at"), "level-secondary");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByText("Failed to save the plan")).toBeInTheDocument();
  });
});
