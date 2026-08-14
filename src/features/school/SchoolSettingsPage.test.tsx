import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as schoolSettingsApi from "@/api/schoolSettings";
import { SchoolSettingsPage } from "@/features/school/SchoolSettingsPage";
import { resetSchoolSettingsStore } from "@/stores/schoolSettingsStore";

vi.mock("@/api/schoolSettings", async () => {
  const actual = await vi.importActual<typeof import("@/api/schoolSettings")>("@/api/schoolSettings");
  return { ...actual, getSchoolSettings: vi.fn(), updateSchoolSettings: vi.fn() };
});

describe("SchoolSettingsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSchoolSettingsStore();
  });

  it("loads the current value, toggles it, saves, and shows a success alert", async () => {
    vi.mocked(schoolSettingsApi.getSchoolSettings).mockResolvedValue({
      schoolId: "school-1",
      allowWeekendAttendance: false,
      allowWeekendTimetable: false,
    });
    vi.mocked(schoolSettingsApi.updateSchoolSettings).mockResolvedValue({
      schoolId: "school-1",
      allowWeekendAttendance: true,
      allowWeekendTimetable: false,
    });
    const user = userEvent.setup();
    render(<SchoolSettingsPage />);

    const checkbox = await screen.findByRole("checkbox", { name: "Allow attendance on weekends" });
    expect(checkbox).not.toBeChecked();

    await user.click(checkbox);
    expect(checkbox).toBeChecked();

    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(schoolSettingsApi.updateSchoolSettings).toHaveBeenCalledWith({
      allowWeekendAttendance: true,
      allowWeekendTimetable: false,
    });
    expect(await screen.findByText("Settings updated.")).toBeInTheDocument();
  });

  it("toggles the timetable weekend setting independently of the attendance one", async () => {
    vi.mocked(schoolSettingsApi.getSchoolSettings).mockResolvedValue({
      schoolId: "school-1",
      allowWeekendAttendance: false,
      allowWeekendTimetable: false,
    });
    vi.mocked(schoolSettingsApi.updateSchoolSettings).mockResolvedValue({
      schoolId: "school-1",
      allowWeekendAttendance: false,
      allowWeekendTimetable: true,
    });
    const user = userEvent.setup();
    render(<SchoolSettingsPage />);

    const checkbox = await screen.findByRole("checkbox", { name: "Allow timetable periods on weekends" });
    expect(checkbox).not.toBeChecked();

    await user.click(checkbox);
    expect(checkbox).toBeChecked();

    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(schoolSettingsApi.updateSchoolSettings).toHaveBeenCalledWith({
      allowWeekendAttendance: false,
      allowWeekendTimetable: true,
    });
    expect(await screen.findByText("Settings updated.")).toBeInTheDocument();
  });

  it("shows an error alert when loading fails", async () => {
    vi.mocked(schoolSettingsApi.getSchoolSettings).mockRejectedValue(new Error("boom"));
    render(<SchoolSettingsPage />);

    expect(await screen.findByText("Failed to load settings")).toBeInTheDocument();
  });
});
