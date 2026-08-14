import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as levelsApi from "@/api/levels";
import type { LevelView } from "@/api/levels";
import * as timetableApi from "@/api/timetable";
import { PeriodGridPage } from "@/features/timetable/PeriodGridPage";
import { resetLevelStore } from "@/stores/levelStore";

vi.mock("@/api/levels", async () => {
  const actual = await vi.importActual<typeof import("@/api/levels")>("@/api/levels");
  return { ...actual, listLevels: vi.fn() };
});

vi.mock("@/api/timetable", async () => {
  const actual = await vi.importActual<typeof import("@/api/timetable")>("@/api/timetable");
  return { ...actual, getPeriodGrid: vi.fn(), savePeriodGrid: vi.fn() };
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

describe("PeriodGridPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetLevelStore();
    vi.mocked(levelsApi.listLevels).mockResolvedValue([PRIMARY]);
  });

  it("loads the first level's grid, adds a period, and saves the expected payload", async () => {
    vi.mocked(timetableApi.getPeriodGrid).mockResolvedValue({
      levelId: "level-1",
      levelName: "Primary",
      periods: [
        {
          id: "period-1",
          position: 1,
          label: "Period 1",
          startTime: "08:00",
          endTime: "08:40",
          kind: "TEACHING",
          inUse: false,
        },
      ],
    });
    vi.mocked(timetableApi.savePeriodGrid).mockResolvedValue({
      levelId: "level-1",
      levelName: "Primary",
      periods: [
        {
          id: "period-1",
          position: 1,
          label: "Period 1",
          startTime: "08:00",
          endTime: "08:40",
          kind: "TEACHING",
          inUse: false,
        },
        {
          id: "period-2",
          position: 2,
          label: "Period 2",
          startTime: "08:40",
          endTime: "09:20",
          kind: "TEACHING",
          inUse: false,
        },
      ],
    });
    const user = userEvent.setup();
    render(<PeriodGridPage />);

    expect(await screen.findByLabelText("Label")).toHaveValue("Period 1");

    await user.click(screen.getByRole("button", { name: "Add period" }));
    const rows = screen.getAllByRole("listitem");
    const secondRow = rows[1];
    await user.type(within(secondRow).getByLabelText("Label"), "Period 2");
    await user.type(within(secondRow).getByLabelText("Start time"), "08:40");
    await user.type(within(secondRow).getByLabelText("End time"), "09:20");

    await user.click(screen.getByRole("button", { name: "Save period grid" }));

    expect(timetableApi.savePeriodGrid).toHaveBeenCalledWith("level-1", {
      periods: [
        { id: "period-1", label: "Period 1", startTime: "08:00", endTime: "08:40", kind: "TEACHING" },
        { id: null, label: "Period 2", startTime: "08:40", endTime: "09:20", kind: "TEACHING" },
      ],
    });
    expect(await screen.findByText("Period grid saved.")).toBeInTheDocument();
  });

  it("shows a disabled delete with a tooltip for a period that is in use", async () => {
    vi.mocked(timetableApi.getPeriodGrid).mockResolvedValue({
      levelId: "level-1",
      levelName: "Primary",
      periods: [
        {
          id: "period-1",
          position: 1,
          label: "Period 1",
          startTime: "08:00",
          endTime: "08:40",
          kind: "TEACHING",
          inUse: true,
        },
      ],
    });
    render(<PeriodGridPage />);

    const removeButton = await screen.findByRole("button", { name: "Remove" });
    expect(removeButton).toBeDisabled();
    expect(removeButton.closest("span")).toHaveAttribute(
      "title",
      "This period has scheduled entries - clear those cells before deleting it.",
    );
  });

  it("shows a validation error for an overlapping pair without calling save", async () => {
    vi.mocked(timetableApi.getPeriodGrid).mockResolvedValue({
      levelId: "level-1",
      levelName: "Primary",
      periods: [
        {
          id: "period-1",
          position: 1,
          label: "Period 1",
          startTime: "08:00",
          endTime: "09:00",
          kind: "TEACHING",
          inUse: false,
        },
      ],
    });
    const user = userEvent.setup();
    render(<PeriodGridPage />);

    await screen.findByDisplayValue("Period 1");
    await user.click(screen.getByRole("button", { name: "Add period" }));
    const rows = screen.getAllByRole("listitem");
    const secondRow = rows[1];
    await user.type(within(secondRow).getByLabelText("Label"), "Period 2");
    await user.type(within(secondRow).getByLabelText("Start time"), "08:30");
    await user.type(within(secondRow).getByLabelText("End time"), "09:30");

    await user.click(screen.getByRole("button", { name: "Save period grid" }));

    expect(await screen.findByText(/overlap/)).toBeInTheDocument();
    expect(timetableApi.savePeriodGrid).not.toHaveBeenCalled();
  });
});
