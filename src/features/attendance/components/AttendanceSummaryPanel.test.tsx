import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { StudentAttendanceSummaryView } from "@/api/attendance";
import { AttendanceSummaryPanel } from "@/features/attendance/components/AttendanceSummaryPanel";

const MULTI_MONTH_SUMMARY: StudentAttendanceSummaryView = {
  studentId: "s1",
  studentName: "Ada Obi",
  admissionNumber: "SCH/2026/0001",
  termId: "term-1",
  present: 3,
  absent: 1,
  late: 0,
  excused: 0,
  daysMarked: 4,
  attendanceRate: 75,
  days: [
    { date: "2026-01-05", status: "PRESENT" },
    { date: "2026-02-02", status: "ABSENT" },
    { date: "2026-03-10", status: "PRESENT" },
    { date: "2026-04-01", status: "PRESENT" },
  ],
};

const EMPTY_SUMMARY: StudentAttendanceSummaryView = {
  studentId: "s1",
  studentName: "Ada Obi",
  admissionNumber: "SCH/2026/0001",
  termId: "term-2",
  present: 0,
  absent: 0,
  late: 0,
  excused: 0,
  daysMarked: 0,
  attendanceRate: 0,
  days: [],
};

describe("AttendanceSummaryPanel", () => {
  it("renders one collapsible toggle per month with records, in order", () => {
    render(<AttendanceSummaryPanel summary={MULTI_MONTH_SUMMARY} />);

    expect(screen.getByRole("button", { name: /January/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /February/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /March/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /April/ })).toBeInTheDocument();
  });

  it("keeps earlier months collapsed until their title is clicked", async () => {
    const user = userEvent.setup();
    render(<AttendanceSummaryPanel summary={MULTI_MONTH_SUMMARY} />);

    const januaryToggle = screen.getByRole("button", { name: /January/ });
    expect(januaryToggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("5 January, 2026")).not.toBeInTheDocument();

    await user.click(januaryToggle);

    expect(januaryToggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("5 January, 2026")).toBeInTheDocument();
  });

  it("expands the most recent month by default", () => {
    render(<AttendanceSummaryPanel summary={MULTI_MONTH_SUMMARY} />);

    const aprilToggle = screen.getByRole("button", { name: /April/ });
    expect(aprilToggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("1 April, 2026")).toBeInTheDocument();
  });

  it("renders an empty state and no month toggles when nothing's been marked", () => {
    render(<AttendanceSummaryPanel summary={EMPTY_SUMMARY} />);

    expect(screen.getByText("No attendance recorded")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
