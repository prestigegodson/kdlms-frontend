import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as billingApi from "@/api/billing";
import type { BillingSettingsView, FeePriceGridView } from "@/api/billing";
import * as branchesApi from "@/api/branches";
import { ApiError } from "@/api/client";
import * as sessionsApi from "@/api/sessions";
import type { AcademicSessionView } from "@/api/sessions";
import { PricesTab } from "@/features/billing/pages/PricesTab";
import { resetAuthStore, useAuthStore } from "@/stores/authStore";
import { resetBranchStore } from "@/stores/branchStore";
import { resetFeatureStore, useFeatureStore } from "@/stores/featureStore";

vi.mock("@/api/billing", async () => {
  const actual = await vi.importActual<typeof import("@/api/billing")>("@/api/billing");
  return {
    ...actual,
    getFeePriceGrid: vi.fn(),
    getBillingSettings: vi.fn(),
    saveFeePrices: vi.fn(),
    copyFeePrices: vi.fn(),
  };
});

vi.mock("@/api/sessions", async () => {
  const actual = await vi.importActual<typeof import("@/api/sessions")>("@/api/sessions");
  return { ...actual, listSessions: vi.fn() };
});

vi.mock("@/api/branches", async () => {
  const actual = await vi.importActual<typeof import("@/api/branches")>("@/api/branches");
  return { ...actual, listBranches: vi.fn() };
});

const SESSION: AcademicSessionView = {
  id: "session-1",
  schoolId: "school-1",
  name: "2026/2027",
  startDate: "2026-09-01",
  endDate: null,
  current: true,
};

const SETTINGS: BillingSettingsView = {
  currency: "NGN",
  instructions: null,
  accounts: [],
};

const GRID: FeePriceGridView = {
  branchId: "branch-1",
  branchName: "Main Campus",
  sessionId: "session-1",
  sessionName: "2026/2027",
  levels: [{ levelId: "level-1", levelName: "Primary" }],
  fees: [
    {
      feeId: "fee-1",
      feeName: "Tuition",
      applicability: "TERMLY",
      termNumbers: [1, 2, 3],
      compulsory: true,
      priceVariesByTerm: false,
      applicableLevelIds: ["level-1"],
      prices: [{ levelId: "level-1", termNumber: null, amount: 1000 }],
    },
  ],
};

function signInAs(role: "SCHOOL_ADMIN" | "BRANCH_ADMIN") {
  useAuthStore.setState({
    user: {
      id: "user-1",
      email: "admin@school.example",
      firstName: "Ada",
      lastName: "Obi",
      role,
      schoolId: "school-1",
      branchId: role === "BRANCH_ADMIN" ? "branch-1" : undefined,
    },
    accessToken: "access",
    refreshToken: "refresh",
  });
  useFeatureStore.setState({ billing: true, status: "loaded" });
}

describe("PricesTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAuthStore();
    resetFeatureStore();
    resetBranchStore();
    signInAs("SCHOOL_ADMIN");
    vi.mocked(sessionsApi.listSessions).mockResolvedValue({
      content: [SESSION],
      totalElements: 1,
      totalPages: 1,
      number: 0,
      size: 50,
    });
    vi.mocked(branchesApi.listBranches).mockResolvedValue({
      content: [{ id: "branch-1", schoolId: "school-1", name: "Main Campus", main: true, status: "ACTIVE" }],
      totalElements: 1,
      totalPages: 1,
      number: 0,
      size: 50,
    });
    vi.mocked(billingApi.getFeePriceGrid).mockResolvedValue(GRID);
    vi.mocked(billingApi.getBillingSettings).mockResolvedValue(SETTINGS);
  });

  it("lists a fee with its priced count and formatted amount", async () => {
    render(<PricesTab />);

    expect(await screen.findByText("Tuition")).toBeInTheDocument();
    expect(await screen.findByText("1 of 1")).toBeInTheDocument();
    expect(await screen.findByText("₦1,000.00")).toBeInTheDocument();
  });

  it("clicking a fee row opens the pricing modal pre-filled with its amounts", async () => {
    const user = userEvent.setup();
    render(<PricesTab />);

    await user.click(await screen.findByText("Tuition"));

    expect(await screen.findByRole("heading", { name: "Edit prices · Tuition" })).toBeInTheDocument();
    const input = (await screen.findByLabelText("Tuition price for Primary")) as HTMLInputElement;
    expect(input.value).toBe("1000");
  });

  it("a compulsory fee left partly unpriced shows the not-fully-priced badge", async () => {
    vi.mocked(billingApi.getFeePriceGrid).mockResolvedValue({
      ...GRID,
      levels: [
        { levelId: "level-1", levelName: "Primary" },
        { levelId: "level-2", levelName: "Secondary" },
      ],
      fees: [{ ...GRID.fees[0], applicableLevelIds: ["level-1", "level-2"] }],
    });
    render(<PricesTab />);

    expect(await screen.findByText("1 of 2")).toBeInTheDocument();
    expect(await screen.findByText("Not fully priced")).toBeInTheDocument();
  });

  it("saving in the modal refreshes the list and shows a success dialog", async () => {
    const user = userEvent.setup();
    vi.mocked(billingApi.saveFeePrices).mockResolvedValue({
      outcomes: [{ feeId: "fee-1", levelId: "level-1", termNumber: null, success: true, message: null }],
    });
    vi.mocked(billingApi.getFeePriceGrid).mockResolvedValueOnce(GRID).mockResolvedValueOnce({
      ...GRID,
      fees: [{ ...GRID.fees[0], prices: [{ levelId: "level-1", termNumber: null, amount: 1500 }] }],
    });
    render(<PricesTab />);

    await user.click(await screen.findByText("Tuition"));
    const input = await screen.findByLabelText("Tuition price for Primary");
    await user.clear(input);
    await user.type(input, "1500");
    await user.click(screen.getByRole("button", { name: "Save prices" }));

    await waitFor(() =>
      expect(billingApi.saveFeePrices).toHaveBeenCalledWith(
        "session-1",
        [{ feeId: "fee-1", levelId: "level-1", termNumber: null, amount: 1500 }],
        "branch-1",
      ),
    );
    expect(await screen.findByText("1 price saved.")).toBeInTheDocument();
    expect(await screen.findByText("₦1,500.00")).toBeInTheDocument();
  });

  it("a BRANCH_ADMIN sees no branch picker", async () => {
    signInAs("BRANCH_ADMIN");
    render(<PricesTab />);

    await screen.findByText("Tuition");
    expect(screen.queryByLabelText("Branch")).not.toBeInTheDocument();
  });

  it("a SCHOOL_ADMIN sees the branch picker", async () => {
    render(<PricesTab />);

    expect(await screen.findByLabelText("Branch")).toBeInTheDocument();
  });

  it("renders a load rejection inline", async () => {
    vi.mocked(billingApi.getFeePriceGrid).mockRejectedValue(new ApiError(422, "Select a branch."));
    render(<PricesTab />);

    expect(await screen.findByText("Select a branch.")).toBeInTheDocument();
  });

  it("shows an empty state before a session is selected", async () => {
    vi.mocked(sessionsApi.listSessions).mockResolvedValue({
      content: [],
      totalElements: 0,
      totalPages: 0,
      number: 0,
      size: 50,
    });
    render(<PricesTab />);

    await waitFor(() => expect(sessionsApi.listSessions).toHaveBeenCalled());
    expect(await screen.findByText("Select a session")).toBeInTheDocument();
  });

  it("a per-term fee's priced count counts levels times terms", async () => {
    vi.mocked(billingApi.getFeePriceGrid).mockResolvedValue({
      ...GRID,
      fees: [
        {
          ...GRID.fees[0],
          priceVariesByTerm: true,
          prices: [
            { levelId: "level-1", termNumber: 1, amount: 15000 },
            { levelId: "level-1", termNumber: 2, amount: 15000 },
          ],
        },
      ],
    });
    render(<PricesTab />);

    // 1 level x 3 terms = 3 slots; 2 are priced.
    expect(await screen.findByText("2 of 3")).toBeInTheDocument();
    expect(await screen.findByText("Per term")).toBeInTheDocument();
  });

  it("the amount summary ranges across term slots", async () => {
    vi.mocked(billingApi.getFeePriceGrid).mockResolvedValue({
      ...GRID,
      fees: [
        {
          ...GRID.fees[0],
          priceVariesByTerm: true,
          prices: [
            { levelId: "level-1", termNumber: 1, amount: 15000 },
            { levelId: "level-1", termNumber: 3, amount: 18000 },
          ],
        },
      ],
    });
    render(<PricesTab />);

    expect(await screen.findByText("₦15,000.00 – ₦18,000.00")).toBeInTheDocument();
  });
});
