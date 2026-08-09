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
      schools: [{ schoolId: "school-1", schoolName: "Bright Star Academy", communicationEmailsEnabled: true }],
    });
    vi.mocked(notificationPreferencesApi.updateMyNotificationPreferences).mockResolvedValue({
      schools: [{ schoolId: "school-1", schoolName: "Bright Star Academy", communicationEmailsEnabled: false }],
    });
    const user = userEvent.setup();
    render(<NotificationSettingsPage />);

    const checkbox = await screen.findByRole("checkbox", { name: "Send email notifications for new messages" });
    expect(checkbox).toBeChecked();

    await user.click(checkbox);
    expect(checkbox).not.toBeChecked();

    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(notificationPreferencesApi.updateMyNotificationPreferences).toHaveBeenCalledWith({
      schoolId: "school-1",
      communicationEmailsEnabled: false,
    });
    expect(await screen.findByText("Notification preferences updated.")).toBeInTheDocument();
  });

  it("renders one independent toggle per school for a guardian with wards at more than one school", async () => {
    vi.mocked(notificationPreferencesApi.getMyNotificationPreferences).mockResolvedValue({
      schools: [
        { schoolId: "school-1", schoolName: "Bright Star Academy", communicationEmailsEnabled: true },
        { schoolId: "school-2", schoolName: "Sunrise Academy", communicationEmailsEnabled: false },
      ],
    });
    render(<NotificationSettingsPage />);

    expect(await screen.findByText("Bright Star Academy")).toBeInTheDocument();
    expect(screen.getByText("Sunrise Academy")).toBeInTheDocument();
    const checkboxes = screen.getAllByRole("checkbox", { name: "Send email notifications for new messages" });
    expect(checkboxes).toHaveLength(2);
    expect(checkboxes[0]).toBeChecked();
    expect(checkboxes[1]).not.toBeChecked();
  });

  it("shows an error alert when loading fails", async () => {
    vi.mocked(notificationPreferencesApi.getMyNotificationPreferences).mockRejectedValue(new Error("boom"));
    render(<NotificationSettingsPage />);

    expect(await screen.findByText("Failed to load notification preferences")).toBeInTheDocument();
  });

  it("keeps the page heading mounted through loading and error states, not just once loaded", async () => {
    vi.mocked(notificationPreferencesApi.getMyNotificationPreferences).mockRejectedValue(new Error("boom"));
    render(<NotificationSettingsPage />);

    // Present immediately (loading state) and still present once the load fails -
    // PageHeader (and the mobile app bar title it feeds) must never go missing.
    expect(screen.getByRole("heading", { name: "Notifications" })).toBeInTheDocument();
    await screen.findByText("Failed to load notification preferences");
    expect(screen.getByRole("heading", { name: "Notifications" })).toBeInTheDocument();
  });
});
