import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as billingApi from "@/api/billing";
import type { BillView, ProspectiveBillOptionsView } from "@/api/billing";
import { ApiError } from "@/api/client";
import * as levelsApi from "@/api/levels";
import type { LevelView } from "@/api/levels";
import * as sessionsApi from "@/api/sessions";
import type { AcademicSessionView, TermView } from "@/api/sessions";
import { ProspectiveBillTab } from "@/features/billing/pages/ProspectiveBillTab";
import { resetAuthStore, useAuthStore } from "@/stores/authStore";
import { resetBranchStore } from "@/stores/branchStore";
import { resetFeatureStore, useFeatureStore } from "@/stores/featureStore";

vi.mock("@/api/billing", async () => {
  const actual = await vi.importActual<typeof import("@/api/billing")>("@/api/billing");
  return {
    ...actual,
    getProspectiveBillOptions: vi.fn(),
    previewProspectiveBill: vi.fn(),
    getProspectiveBillPdf: vi.fn(),
    emailProspectiveBill: vi.fn(),
  };
});

vi.mock("@/api/levels", async () => {
  const actual = await vi.importActual<typeof import("@/api/levels")>("@/api/levels");
  return { ...actual, listLevels: vi.fn() };
});

vi.mock("@/api/sessions", async () => {
  const actual = await vi.importActual<typeof import("@/api/sessions")>("@/api/sessions");
  return { ...actual, listSessions: vi.fn(), listTerms: vi.fn() };
});

const PRIMARY: LevelView = {
  id: "level-primary",
  baseLevel: "PRIMARY",
  displayName: "Primary",
  rank: 1,
  status: "ACTIVE",
  subjectCount: 0,
  classCount: 2,
  subjectGroupCount: 0,
};

const SESSION: AcademicSessionView = {
  id: "session-1",
  schoolId: "school-1",
  name: "2027/2028",
  startDate: "2027-09-01",
  endDate: null,
  current: false,
};

const TERM_1: TermView = {
  id: "term-1",
  schoolId: "school-1",
  sessionId: "session-1",
  termNumber: 1,
  name: "First Term",
  startDate: "2027-09-01",
  endDate: "2027-12-01",
  current: false,
};

const OPTIONS: ProspectiveBillOptionsView = {
  branchId: "branch-1",
  levelId: "level-primary",
  levelName: "Primary",
  termId: "term-1",
  termName: "First Term",
  termNumber: 1,
  sessionId: "session-1",
  sessionName: "2027/2028",
  currency: "NGN",
  fees: [{ feeId: "fee-1", feeName: "Tuition", compulsory: true, priced: true, standardAmount: 10000 }],
  routes: [],
};

const PREVIEW: BillView = {
  studentId: "",
  studentName: "Ada Obi",
  admissionNumber: "",
  classId: "",
  className: "",
  levelId: "level-primary",
  levelName: "Primary",
  sessionId: "session-1",
  sessionName: "2027/2028",
  termId: "term-1",
  termName: "First Term",
  termNumber: 1,
  billReference: "",
  billable: true,
  chargedLines: [{ feeId: "fee-1", feeName: "Tuition", amount: 10000 }],
  optionalLines: [],
  transportFares: [],
  total: 10000,
  currency: "NGN",
  bankAccounts: [],
  instructions: null,
  advance: false,
};

function signIn() {
  resetAuthStore();
  resetFeatureStore();
  resetBranchStore();
  useAuthStore.setState({
    user: {
      id: "user-1",
      email: "admin@school.example",
      firstName: "A",
      lastName: "Dmin",
      role: "BRANCH_ADMIN",
      schoolId: "school-1",
      branchId: "branch-1",
    },
    accessToken: "access",
    refreshToken: "refresh",
  });
  useFeatureStore.setState({ billing: true, status: "loaded" });
}

async function selectLevelAndTerm(user: ReturnType<typeof userEvent.setup>) {
  render(<ProspectiveBillTab />);
  // Both selects exist immediately; their options populate once the async listLevels/
  // listSessions fetches resolve - wait for an actual option before selecting it (the
  // AdvanceBillsTab convention).
  await within(screen.getByLabelText("Level")).findByText("Primary");
  await user.selectOptions(screen.getByLabelText("Level"), "level-primary");
  await within(screen.getByLabelText("Session")).findByText("2027/2028");
  await user.selectOptions(screen.getByLabelText("Session"), "session-1");
  await within(await screen.findByLabelText("Term")).findByText("First Term");
  await user.selectOptions(screen.getByLabelText("Term"), "term-1");
  await waitFor(() => expect(billingApi.getProspectiveBillOptions).toHaveBeenCalled());
}

describe("ProspectiveBillTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    signIn();
    vi.mocked(levelsApi.listLevels).mockResolvedValue([PRIMARY]);
    vi.mocked(sessionsApi.listSessions).mockResolvedValue({
      content: [SESSION],
      totalElements: 1,
      totalPages: 1,
      number: 0,
      size: 50,
    });
    vi.mocked(sessionsApi.listTerms).mockResolvedValue([TERM_1]);
    vi.mocked(billingApi.getProspectiveBillOptions).mockResolvedValue(OPTIONS);
  });

  it("previews the bill with the same total a new admission would get", async () => {
    vi.mocked(billingApi.previewProspectiveBill).mockResolvedValue(PREVIEW);
    const user = userEvent.setup();

    await selectLevelAndTerm(user);
    await user.type(screen.getByLabelText("Child's full name"), "Ada Obi");
    await user.click(screen.getByRole("button", { name: "Preview" }));

    await waitFor(() => expect(billingApi.previewProspectiveBill).toHaveBeenCalledWith(
      expect.objectContaining({
        fullName: "Ada Obi",
        guardianEmail: null,
        levelId: "level-primary",
        termId: "term-1",
        fees: [{ feeId: "fee-1", selected: true, overrideAmount: null }],
      }),
    ));
    expect(await screen.findByText("Ada Obi")).toBeInTheDocument();
    // Appears twice - the Tuition line and the total row both show the same single-fee amount.
    expect(screen.getAllByText("₦10,000.00").length).toBeGreaterThan(0);
  });

  it("disables Email guardian until an email is entered, then sends it", async () => {
    vi.mocked(billingApi.emailProspectiveBill).mockResolvedValue(undefined);
    const user = userEvent.setup();

    await selectLevelAndTerm(user);
    await user.type(screen.getByLabelText("Child's full name"), "Ada Obi");

    expect(screen.getByRole("button", { name: "Email guardian" })).toBeDisabled();

    await user.type(screen.getByLabelText("Guardian email (optional)"), "parent@example.com");
    expect(screen.getByRole("button", { name: "Email guardian" })).not.toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Email guardian" }));

    await waitFor(() => expect(billingApi.emailProspectiveBill).toHaveBeenCalledWith(
      expect.objectContaining({ guardianEmail: "parent@example.com" }),
    ));
    expect(await screen.findByText("Sent to parent@example.com.")).toBeInTheDocument();
  });

  it("shows a server validation error rather than silently failing", async () => {
    vi.mocked(billingApi.previewProspectiveBill).mockRejectedValue(
      new ApiError(422, "This level has no price set for the following compulsory fee(s): Tuition."),
    );
    const user = userEvent.setup();

    await selectLevelAndTerm(user);
    await user.type(screen.getByLabelText("Child's full name"), "Ada Obi");
    await user.click(screen.getByRole("button", { name: "Preview" }));

    expect(await screen.findByText(/no price set for the following compulsory fee/)).toBeInTheDocument();
  });
});
