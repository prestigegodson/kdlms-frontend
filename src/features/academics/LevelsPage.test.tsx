import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as levelsApi from "@/api/levels";
import type { LevelView } from "@/api/levels";
import { LevelsPage } from "@/features/academics/LevelsPage";
import { resetAuthStore, useAuthStore } from "@/stores/authStore";
import { resetLevelStore } from "@/stores/levelStore";

vi.mock("@/api/levels", async () => {
  const actual = await vi.importActual<typeof import("@/api/levels")>("@/api/levels");
  return {
    ...actual,
    listLevels: vi.fn(),
    createLevel: vi.fn(),
    renameLevel: vi.fn(),
    reorderLevels: vi.fn(),
    activateLevel: vi.fn(),
    deactivateLevel: vi.fn(),
    deleteLevel: vi.fn(),
  };
});

const PRE_SCHOOL: LevelView = {
  id: "level-1",
  baseLevel: "PRE_SCHOOL",
  displayName: "Pre School",
  rank: 1,
  status: "ACTIVE",
  subjectCount: 0,
  classCount: 0,
  subjectGroupCount: 0,
};

const PRIMARY: LevelView = {
  id: "level-2",
  baseLevel: "PRIMARY",
  displayName: "Primary",
  rank: 2,
  status: "ACTIVE",
  subjectCount: 0,
  classCount: 0,
  subjectGroupCount: 0,
};

// Renamed away from its stage's default label ("Secondary") so the stage
// badge shows up - see LevelsPage's "only show when it adds information" rule.
const JUNIOR_SECONDARY: LevelView = {
  id: "level-3",
  baseLevel: "SECONDARY",
  displayName: "Junior Secondary",
  rank: 3,
  status: "ACTIVE",
  subjectCount: 2,
  classCount: 1,
  subjectGroupCount: 0,
};

function renderAsSchoolAdmin() {
  resetAuthStore();
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
  const router = createMemoryRouter([{ path: "/", element: <LevelsPage /> }], { initialEntries: ["/"] });
  render(<RouterProvider router={router} />);
}

describe("LevelsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetLevelStore();
    vi.mocked(levelsApi.listLevels).mockResolvedValue([PRE_SCHOOL, PRIMARY, JUNIOR_SECONDARY]);
  });

  it("lists levels in rank order, with a stage badge only where the name has diverged from it", async () => {
    renderAsSchoolAdmin();

    expect(await screen.findByText("Pre School")).toBeInTheDocument();
    expect(screen.getByText("Primary")).toBeInTheDocument();
    expect(screen.getByText("Junior Secondary")).toBeInTheDocument();
    expect(screen.getByText("2 subjects · 1 class")).toBeInTheDocument();

    const juniorSecondaryRow = screen.getByText("Junior Secondary").closest("li") as HTMLElement;
    expect(within(juniorSecondaryRow).getByText("Secondary")).toBeInTheDocument();

    const primaryRow = screen.getByText("Primary").closest("li") as HTMLElement;
    expect(within(primaryRow).queryByText("Secondary")).not.toBeInTheDocument();
  });

  it("renames a level", async () => {
    vi.mocked(levelsApi.renameLevel).mockResolvedValue({ ...PRIMARY, displayName: "Reception" });
    const user = userEvent.setup();

    renderAsSchoolAdmin();
    await screen.findByText("Primary");

    const row = screen.getByText("Primary").closest("li");
    expect(row).not.toBeNull();
    await user.click(within(row as HTMLElement).getByRole("button", { name: "Rename" }));

    const dialog = await screen.findByRole("dialog");
    const nameInput = within(dialog).getByLabelText("Name");
    await user.clear(nameInput);
    await user.type(nameInput, "Reception");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));

    expect(levelsApi.renameLevel).toHaveBeenCalledWith("level-2", { displayName: "Reception" });
  });

  it("moves a level down and persists the new order", async () => {
    vi.mocked(levelsApi.reorderLevels).mockResolvedValue([PRIMARY, PRE_SCHOOL, JUNIOR_SECONDARY]);
    const user = userEvent.setup();

    renderAsSchoolAdmin();
    await screen.findByText("Pre School");

    await user.click(screen.getByRole("button", { name: "Move Pre School down" }));

    expect(levelsApi.reorderLevels).toHaveBeenCalledWith({
      levelIds: ["level-2", "level-1", "level-3"],
    });
  });

  it("archives an active level", async () => {
    vi.mocked(levelsApi.deactivateLevel).mockResolvedValue({ ...PRIMARY, status: "INACTIVE" });
    const user = userEvent.setup();

    renderAsSchoolAdmin();
    await screen.findByText("Primary");

    const row = screen.getByText("Primary").closest("li");
    await user.click(within(row as HTMLElement).getByRole("button", { name: "Archive" }));

    expect(levelsApi.deactivateLevel).toHaveBeenCalledWith("level-2");
  });

  it("disables delete while the level still has subjects or classes", async () => {
    renderAsSchoolAdmin();
    await screen.findByText("Junior Secondary");

    const row = screen.getByText("Junior Secondary").closest("li");
    expect(within(row as HTMLElement).getByRole("button", { name: "Delete" })).toBeDisabled();
  });

  it("deletes a level once nothing references it, after confirmation", async () => {
    vi.mocked(levelsApi.deleteLevel).mockResolvedValue(undefined);
    const user = userEvent.setup();

    renderAsSchoolAdmin();
    await screen.findByText("Pre School");

    const row = screen.getByText("Pre School").closest("li");
    await user.click(within(row as HTMLElement).getByRole("button", { name: "Delete" }));

    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Delete" }));

    expect(levelsApi.deleteLevel).toHaveBeenCalledWith("level-1");
  });

  it("creates a new level for a chosen stage", async () => {
    vi.mocked(levelsApi.createLevel).mockResolvedValue({
      id: "level-4",
      baseLevel: "SECONDARY",
      displayName: "Senior Secondary",
      rank: 4,
      status: "ACTIVE",
      subjectCount: 0,
      classCount: 0,
      subjectGroupCount: 0,
    });
    const user = userEvent.setup();

    renderAsSchoolAdmin();
    await screen.findByText("Pre School");

    await user.click(screen.getByRole("button", { name: "Add level" }));
    const dialog = await screen.findByRole("dialog");

    await user.selectOptions(within(dialog).getByLabelText("Stage"), "Secondary");
    await user.type(within(dialog).getByLabelText("Name"), "Senior Secondary");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));

    expect(levelsApi.createLevel).toHaveBeenCalledWith({ baseLevel: "SECONDARY", displayName: "Senior Secondary" });
  });
});
