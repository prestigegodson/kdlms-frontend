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
      guardianLessonNotesEnabled: false,
      allowStudentPasswordChange: true,
      twoSessionAttendance: false,
    });
    vi.mocked(schoolSettingsApi.updateSchoolSettings).mockResolvedValue({
      schoolId: "school-1",
      allowWeekendAttendance: true,
      allowWeekendTimetable: false,
      guardianLessonNotesEnabled: false,
      allowStudentPasswordChange: true,
      twoSessionAttendance: false,
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
      guardianLessonNotesEnabled: false,
      allowStudentPasswordChange: true,
      twoSessionAttendance: false,
    });
    expect(await screen.findByText("Settings updated.")).toBeInTheDocument();
  });

  it("toggles the timetable weekend setting independently of the attendance one", async () => {
    vi.mocked(schoolSettingsApi.getSchoolSettings).mockResolvedValue({
      schoolId: "school-1",
      allowWeekendAttendance: false,
      allowWeekendTimetable: false,
      guardianLessonNotesEnabled: false,
      allowStudentPasswordChange: true,
      twoSessionAttendance: false,
    });
    vi.mocked(schoolSettingsApi.updateSchoolSettings).mockResolvedValue({
      schoolId: "school-1",
      allowWeekendAttendance: false,
      allowWeekendTimetable: true,
      guardianLessonNotesEnabled: false,
      allowStudentPasswordChange: true,
      twoSessionAttendance: false,
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
      guardianLessonNotesEnabled: false,
      allowStudentPasswordChange: true,
      twoSessionAttendance: false,
    });
    expect(await screen.findByText("Settings updated.")).toBeInTheDocument();
  });

  it("toggles the guardian lesson notes setting independently of the weekend ones", async () => {
    vi.mocked(schoolSettingsApi.getSchoolSettings).mockResolvedValue({
      schoolId: "school-1",
      allowWeekendAttendance: false,
      allowWeekendTimetable: false,
      guardianLessonNotesEnabled: false,
      allowStudentPasswordChange: true,
      twoSessionAttendance: false,
    });
    vi.mocked(schoolSettingsApi.updateSchoolSettings).mockResolvedValue({
      schoolId: "school-1",
      allowWeekendAttendance: false,
      allowWeekendTimetable: false,
      guardianLessonNotesEnabled: true,
      allowStudentPasswordChange: true,
      twoSessionAttendance: false,
    });
    const user = userEvent.setup();
    render(<SchoolSettingsPage />);

    const checkbox = await screen.findByRole("checkbox", { name: "Let guardians view approved lesson notes" });
    expect(checkbox).not.toBeChecked();

    await user.click(checkbox);
    expect(checkbox).toBeChecked();

    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(schoolSettingsApi.updateSchoolSettings).toHaveBeenCalledWith({
      allowWeekendAttendance: false,
      allowWeekendTimetable: false,
      guardianLessonNotesEnabled: true,
      allowStudentPasswordChange: true,
      twoSessionAttendance: false,
    });
    expect(await screen.findByText("Settings updated.")).toBeInTheDocument();
  });

  it("toggles the student password change setting, which is on by default", async () => {
    vi.mocked(schoolSettingsApi.getSchoolSettings).mockResolvedValue({
      schoolId: "school-1",
      allowWeekendAttendance: false,
      allowWeekendTimetable: false,
      guardianLessonNotesEnabled: false,
      allowStudentPasswordChange: true,
      twoSessionAttendance: false,
    });
    vi.mocked(schoolSettingsApi.updateSchoolSettings).mockResolvedValue({
      schoolId: "school-1",
      allowWeekendAttendance: false,
      allowWeekendTimetable: false,
      guardianLessonNotesEnabled: false,
      allowStudentPasswordChange: false,
      twoSessionAttendance: false,
    });
    const user = userEvent.setup();
    render(<SchoolSettingsPage />);

    const checkbox = await screen.findByRole("checkbox", { name: "Allow pupils to change password" });
    expect(checkbox).toBeChecked();

    await user.click(checkbox);
    expect(checkbox).not.toBeChecked();

    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(schoolSettingsApi.updateSchoolSettings).toHaveBeenCalledWith({
      allowWeekendAttendance: false,
      allowWeekendTimetable: false,
      guardianLessonNotesEnabled: false,
      allowStudentPasswordChange: false,
      twoSessionAttendance: false,
    });
    expect(await screen.findByText("Settings updated.")).toBeInTheDocument();
  });

  it("shows an error alert when loading fails", async () => {
    vi.mocked(schoolSettingsApi.getSchoolSettings).mockRejectedValue(new Error("boom"));
    render(<SchoolSettingsPage />);

    expect(await screen.findByText("Failed to load settings")).toBeInTheDocument();
  });

  it("asks what this term's attendance becomes when two-session attendance is turned on, and sends the choice", async () => {
    vi.mocked(schoolSettingsApi.getSchoolSettings).mockResolvedValue({
      schoolId: "school-1",
      allowWeekendAttendance: false,
      allowWeekendTimetable: false,
      guardianLessonNotesEnabled: false,
      allowStudentPasswordChange: true,
      twoSessionAttendance: false,
    });
    vi.mocked(schoolSettingsApi.updateSchoolSettings).mockResolvedValue({
      schoolId: "school-1",
      allowWeekendAttendance: false,
      allowWeekendTimetable: false,
      guardianLessonNotesEnabled: false,
      allowStudentPasswordChange: true,
      twoSessionAttendance: true,
    });
    const user = userEvent.setup();
    render(<SchoolSettingsPage />);

    await user.click(
      await screen.findByRole("checkbox", { name: "Take attendance twice a day (morning and afternoon)" }),
    );
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(schoolSettingsApi.updateSchoolSettings).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Existing attendance this term" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Morning and afternoon" }));

    expect(schoolSettingsApi.updateSchoolSettings).toHaveBeenCalledWith({
      allowWeekendAttendance: false,
      allowWeekendTimetable: false,
      guardianLessonNotesEnabled: false,
      allowStudentPasswordChange: true,
      twoSessionAttendance: true,
      existingAttendanceConversion: "MORNING_AND_AFTERNOON",
    });
    expect(await screen.findByText("Settings updated.")).toBeInTheDocument();
  });

  it("turns two-session attendance off without asking, noting afternoon registers are kept", async () => {
    vi.mocked(schoolSettingsApi.getSchoolSettings).mockResolvedValue({
      schoolId: "school-1",
      allowWeekendAttendance: false,
      allowWeekendTimetable: false,
      guardianLessonNotesEnabled: false,
      allowStudentPasswordChange: true,
      twoSessionAttendance: true,
    });
    vi.mocked(schoolSettingsApi.updateSchoolSettings).mockResolvedValue({
      schoolId: "school-1",
      allowWeekendAttendance: false,
      allowWeekendTimetable: false,
      guardianLessonNotesEnabled: false,
      allowStudentPasswordChange: true,
      twoSessionAttendance: false,
    });
    const user = userEvent.setup();
    render(<SchoolSettingsPage />);

    await user.click(
      await screen.findByRole("checkbox", { name: "Take attendance twice a day (morning and afternoon)" }),
    );
    expect(screen.getByText(/Afternoon registers already taken are kept/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(schoolSettingsApi.updateSchoolSettings).toHaveBeenCalledWith(
      expect.objectContaining({ twoSessionAttendance: false }),
    );
  });
});
