import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as notificationPreferencesApi from "@/api/notificationPreferences";
import { NotificationSettingsPage } from "@/features/guardian/NotificationSettingsPage";

vi.mock("@/api/notificationPreferences", async () => {
  const actual =
    await vi.importActual<typeof import("@/api/notificationPreferences")>("@/api/notificationPreferences");
  return { ...actual, getMyNotificationPreferences: vi.fn(), updateMyNotificationPreferences: vi.fn() };
});

describe("NotificationSettingsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads the current value, toggles it, saves, and shows a success alert", async () => {
    vi.mocked(notificationPreferencesApi.getMyNotificationPreferences).mockResolvedValue({
      communicationEmailsEnabled: true,
    });
    vi.mocked(notificationPreferencesApi.updateMyNotificationPreferences).mockResolvedValue({
      communicationEmailsEnabled: false,
    });
    const user = userEvent.setup();
    render(<NotificationSettingsPage />);

    const checkbox = await screen.findByRole("checkbox", { name: "Send email notifications for new messages" });
    expect(checkbox).toBeChecked();

    await user.click(checkbox);
    expect(checkbox).not.toBeChecked();

    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(notificationPreferencesApi.updateMyNotificationPreferences).toHaveBeenCalledWith({
      communicationEmailsEnabled: false,
    });
    expect(await screen.findByText("Notification preferences updated.")).toBeInTheDocument();
  });

  it("shows an error alert when loading fails", async () => {
    vi.mocked(notificationPreferencesApi.getMyNotificationPreferences).mockRejectedValue(new Error("boom"));
    render(<NotificationSettingsPage />);

    expect(await screen.findByText("Failed to load notification preferences")).toBeInTheDocument();
  });
});
