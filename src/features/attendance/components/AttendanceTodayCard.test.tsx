import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as attendanceApi from "@/api/attendance";
import type { AttendanceOverviewView } from "@/api/attendance";
import * as levelsApi from "@/api/levels";
import type { LevelView } from "@/api/levels";
import { AttendanceTodayCard } from "@/features/attendance/components/AttendanceTodayCard";
import { resetLevelStore } from "@/stores/levelStore";

vi.mock("@/api/attendance", async () => {
  const actual = await vi.importActual<typeof import("@/api/attendance")>("@/api/attendance");
  return { ...actual, getDailyOverview: vi.fn() };
});

vi.mock("@/api/levels", async () => {
  const actual = await vi.importActual<typeof import("@/api/levels")>("@/api/levels");
  return { ...actual, listLevels: vi.fn() };
});

const LEVELS: LevelView[] = [
  { id: "level-primary", baseLevel: "PRIMARY", displayName: "Primary", rank: 1, status: "ACTIVE", subjectCount: 0, classCount: 0, subjectGroupCount: 0 },
  { id: "level-secondary", baseLevel: "SECONDARY", displayName: "Secondary", rank: 2, status: "ACTIVE", subjectCount: 0, classCount: 0, subjectGroupCount: 0 },
];

const OVERVIEW: AttendanceOverviewView = {
  date: "2026-08-11",
  totalClasses: 3,
  classesMarked: 2,
  classes: [
    { classId: "class-sec-1", className: "SS1", levelId: "level-secondary", levelName: "Secondary", marked: true, studentsMarked: 20, present: 18, absent: 1, late: 1, excused: 0 },
    { classId: "class-pri-1", className: "Primary 1", levelId: "level-primary", levelName: "Primary", marked: true, studentsMarked: 15, present: 15, absent: 0, late: 0, excused: 0 },
    { classId: "class-pri-2", className: "Primary 2", levelId: "level-primary", levelName: "Primary", marked: false, studentsMarked: 0, present: 0, absent: 0, late: 0, excused: 0 },
  ],
};

describe("AttendanceTodayCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetLevelStore();
    vi.mocked(levelsApi.listLevels).mockResolvedValue(LEVELS);
    vi.mocked(attendanceApi.getDailyOverview).mockResolvedValue(OVERVIEW);
  });

  it("groups classes by level, collapsed by default and ordered by level rank", async () => {
    render(<AttendanceTodayCard date="2026-08-11" />);

    const primaryHeader = await screen.findByRole("button", { name: /Primary.*1 of 2 marked/ });
    const secondaryHeader = screen.getByRole("button", { name: /Secondary.*1 of 1 marked/ });

    // Ordered by level rank (Primary before Secondary), not by row order in the overview.
    const headers = screen.getAllByRole("button", { name: /marked/ });
    expect(headers[0]).toBe(primaryHeader);
    expect(headers[1]).toBe(secondaryHeader);

    // Collapsed by default: no class rows visible until a header is clicked.
    expect(screen.queryByText("SS1")).not.toBeInTheDocument();
    expect(screen.queryByText("Primary 1")).not.toBeInTheDocument();
  });

  it("expands a level group on click to reveal its class rows", async () => {
    const user = userEvent.setup();
    render(<AttendanceTodayCard date="2026-08-11" />);

    const primaryHeader = await screen.findByRole("button", { name: /Primary.*1 of 2 marked/ });
    await user.click(primaryHeader);

    expect(screen.getByText("Primary 1")).toBeInTheDocument();
    expect(screen.getByText("Primary 2")).toBeInTheDocument();
    expect(screen.getByText("Not marked yet")).toBeInTheDocument();
    expect(screen.queryByText("SS1")).not.toBeInTheDocument();
  });
});
