import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as billingApi from "@/api/billing";
import type { FeeView } from "@/api/billing";
import { ApiError } from "@/api/client";
import * as levelsApi from "@/api/levels";
import type { LevelView } from "@/api/levels";
import { FeesTab } from "@/features/billing/pages/FeesTab";
import { resetAuthStore, useAuthStore } from "@/stores/authStore";
import { resetFeatureStore, useFeatureStore } from "@/stores/featureStore";

vi.mock("@/api/billing", async () => {
  const actual = await vi.importActual<typeof import("@/api/billing")>("@/api/billing");
  return { ...actual, listFees: vi.fn(), createFee: vi.fn(), updateFee: vi.fn(), deleteFee: vi.fn() };
});

vi.mock("@/api/levels", async () => {
  const actual = await vi.importActual<typeof import("@/api/levels")>("@/api/levels");
  return { ...actual, listLevels: vi.fn() };
});

const PRIMARY: LevelView = {
  id: "level-1",
  baseLevel: "PRIMARY",
  displayName: "Primary",
  rank: 1,
  status: "ACTIVE",
  subjectCount: 0,
  classCount: 0,
  subjectGroupCount: 0,
};

const TUITION: FeeView = {
  id: "fee-1",
  kind: "STANDARD",
  name: "Tuition",
  description: null,
  applicability: "TERMLY",
  termNumbers: [1, 2, 3],
  levels: [{ levelId: "level-1", levelName: "Primary" }],
  compulsory: true,
  active: true,
  position: 0,
  priceVariesByTerm: false,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
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
    },
    accessToken: "access",
    refreshToken: "refresh",
  });
  useFeatureStore.setState({ billing: true, status: "loaded" });
}

describe("FeesTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAuthStore();
    resetFeatureStore();
    signInAs("SCHOOL_ADMIN");
    vi.mocked(levelsApi.listLevels).mockResolvedValue([PRIMARY]);
  });

  it("renders the fee catalogue", async () => {
    vi.mocked(billingApi.listFees).mockResolvedValue([TUITION]);

    render(<FeesTab />);

    expect(await screen.findByText("Tuition")).toBeInTheDocument();
    expect(screen.getByText("Terms 1, 2, 3")).toBeInTheDocument();
    const row = screen.getByText("Tuition").closest("tr")!;
    expect(within(row).getByText("Compulsory")).toBeInTheDocument();
  });

  it("creates a fee through the modal", async () => {
    vi.mocked(billingApi.listFees).mockResolvedValue([]);
    vi.mocked(billingApi.createFee).mockResolvedValue(TUITION);
    const user = userEvent.setup();

    render(<FeesTab />);
    await screen.findByText("No fees yet");

    await user.click(screen.getByRole("button", { name: "Add fee" }));
    const dialog = await screen.findByRole("dialog", { name: "Add fee" });

    await user.type(within(dialog).getByLabelText("Name"), "Tuition");
    await waitFor(() => expect(within(dialog).getByText("Primary")).toBeInTheDocument());
    await user.click(within(dialog).getByLabelText("Primary"));

    vi.mocked(billingApi.listFees).mockResolvedValue([TUITION]);
    await user.click(within(dialog).getByRole("button", { name: "Add fee" }));

    await waitFor(() => expect(billingApi.createFee).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Tuition", levelIds: ["level-1"] }),
    ));
  });

  it("a BRANCH_ADMIN sees no write controls", async () => {
    signInAs("BRANCH_ADMIN");
    vi.mocked(billingApi.listFees).mockResolvedValue([TUITION]);

    render(<FeesTab />);

    await screen.findByText("Tuition");
    expect(screen.queryByRole("button", { name: "Add fee" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
  });

  it("renders a delete rejection's message inline, without closing the confirm dialog", async () => {
    vi.mocked(billingApi.listFees).mockResolvedValue([TUITION]);
    vi.mocked(billingApi.deleteFee).mockRejectedValue(
      new ApiError(422, "'Tuition' has been priced and can no longer be deleted - deactivate it instead."),
    );
    const user = userEvent.setup();

    render(<FeesTab />);
    await screen.findByText("Tuition");

    await user.click(screen.getByRole("button", { name: "Delete" }));
    const dialog = await screen.findByRole("dialog", { name: "Delete fee" });
    await user.click(within(dialog).getByRole("button", { name: "Delete" }));

    expect(
      await screen.findByText("'Tuition' has been priced and can no longer be deleted - deactivate it instead."),
    ).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Delete fee" })).toBeInTheDocument();
  });

  it("the per-term price checkbox is disabled until TERMLY with two or more terms", async () => {
    vi.mocked(billingApi.listFees).mockResolvedValue([]);
    const user = userEvent.setup();

    render(<FeesTab />);
    await screen.findByText("No fees yet");

    await user.click(screen.getByRole("button", { name: "Add fee" }));
    const dialog = await screen.findByRole("dialog", { name: "Add fee" });
    const priceVariesByTerm = within(dialog).getByRole("checkbox", { name: /Price varies by term/ });

    // Every term ticked by default (a fresh TERMLY fee) - the checkbox is enabled.
    expect(priceVariesByTerm).toBeEnabled();

    // Down to one term - disabled, and unticking it first has no lingering effect.
    await user.click(priceVariesByTerm);
    await user.click(within(dialog).getByRole("checkbox", { name: "Term 2" }));
    await user.click(within(dialog).getByRole("checkbox", { name: "Term 3" }));
    expect(priceVariesByTerm).toBeDisabled();
    expect(priceVariesByTerm).not.toBeChecked();
  });

  it("renders the flag-flip refusal message inline", async () => {
    vi.mocked(billingApi.listFees).mockResolvedValue([TUITION]);
    vi.mocked(billingApi.updateFee).mockRejectedValue(
      new ApiError(
        422,
        "'Tuition' is priced differently across terms for 1 level(s): Primary. Equalise or clear those prices on the Prices tab before switching it back to one price for all terms.",
      ),
    );
    const user = userEvent.setup();

    render(<FeesTab />);
    await screen.findByText("Tuition");

    await user.click(screen.getByRole("button", { name: "Edit" }));
    const dialog = await screen.findByRole("dialog", { name: "Edit fee" });
    await user.click(within(dialog).getByRole("button", { name: "Save changes" }));

    expect(
      await screen.findByText(
        "'Tuition' is priced differently across terms for 1 level(s): Primary. Equalise or clear those prices on the Prices tab before switching it back to one price for all terms.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Edit fee" })).toBeInTheDocument();
  });
});
