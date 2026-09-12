import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as billingApi from "@/api/billing";
import type { BillingSettingsView } from "@/api/billing";
import { SettingsTab } from "@/features/billing/pages/SettingsTab";
import { resetAuthStore, useAuthStore } from "@/stores/authStore";
import { resetFeatureStore, useFeatureStore } from "@/stores/featureStore";

vi.mock("@/api/billing", async () => {
  const actual = await vi.importActual<typeof import("@/api/billing")>("@/api/billing");
  return { ...actual, getBillingSettings: vi.fn(), saveBillingSettings: vi.fn() };
});

const DEFAULTS: BillingSettingsView = { currency: "NGN", instructions: null, accounts: [] };

const WITH_ONE_ACCOUNT: BillingSettingsView = {
  currency: "NGN",
  instructions: "Pay before the term ends.",
  accounts: [{ position: 0, bankName: "GTBank", accountName: "Billing School", accountNumber: "0123456789" }],
};

function signInAsSchoolAdmin() {
  useAuthStore.setState({
    user: {
      id: "user-1",
      email: "admin@school.example",
      firstName: "Ada",
      lastName: "Obi",
      role: "SCHOOL_ADMIN",
      schoolId: "school-1",
    },
    accessToken: "access",
    refreshToken: "refresh",
  });
  useFeatureStore.setState({ billing: true, status: "loaded" });
}

describe("SettingsTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAuthStore();
    resetFeatureStore();
    signInAsSchoolAdmin();
  });

  it("renders the defaults for a school with no saved settings yet", async () => {
    vi.mocked(billingApi.getBillingSettings).mockResolvedValue(DEFAULTS);

    render(<SettingsTab />);

    expect(await screen.findByDisplayValue("NGN")).toBeInTheDocument();
    expect(screen.getByText("No bank accounts added yet.")).toBeInTheDocument();
  });

  it("adds, edits, and removes a bank account, then saves the full list", async () => {
    vi.mocked(billingApi.getBillingSettings).mockResolvedValue(DEFAULTS);
    vi.mocked(billingApi.saveBillingSettings).mockResolvedValue(WITH_ONE_ACCOUNT);
    const user = userEvent.setup();

    render(<SettingsTab />);
    await screen.findByDisplayValue("NGN");

    await user.click(screen.getByRole("button", { name: "Add bank account" }));
    await user.type(screen.getByLabelText("Bank name"), "GTBank");
    await user.type(screen.getByLabelText("Account name"), "Billing School");
    await user.type(screen.getByLabelText("Account number"), "0123456789");

    await user.click(screen.getByRole("button", { name: "Save settings" }));

    expect(billingApi.saveBillingSettings).toHaveBeenCalledWith({
      currency: "NGN",
      instructions: null,
      accounts: [{ bankName: "GTBank", accountName: "Billing School", accountNumber: "0123456789" }],
    });
    expect(await screen.findByText("Settings saved.")).toBeInTheDocument();
  });

  it("reorders two bank accounts before saving", async () => {
    vi.mocked(billingApi.getBillingSettings).mockResolvedValue(WITH_ONE_ACCOUNT);
    vi.mocked(billingApi.saveBillingSettings).mockResolvedValue(WITH_ONE_ACCOUNT);
    const user = userEvent.setup();

    render(<SettingsTab />);
    await screen.findByDisplayValue("GTBank");

    await user.click(screen.getByRole("button", { name: "Add bank account" }));
    const accountNameInputs = screen.getAllByLabelText("Account name");
    await user.type(accountNameInputs[1], "Second Account");
    await user.type(screen.getAllByLabelText("Bank name")[1], "Zenith");
    await user.type(screen.getAllByLabelText("Account number")[1], "9876543210");

    // Move the second (newly added) account up, ahead of the first.
    const moveUpButtons = screen.getAllByRole("button", { name: "Move up" });
    await user.click(moveUpButtons[1]);

    await user.click(screen.getByRole("button", { name: "Save settings" }));

    expect(billingApi.saveBillingSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        accounts: [
          { bankName: "Zenith", accountName: "Second Account", accountNumber: "9876543210" },
          { bankName: "GTBank", accountName: "Billing School", accountNumber: "0123456789" },
        ],
      }),
    );
  });
});
