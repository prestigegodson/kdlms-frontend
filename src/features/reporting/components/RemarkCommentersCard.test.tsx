import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import * as branchesApi from "@/api/branches";
import type { BranchView } from "@/api/branches";
import * as reportSettingsApi from "@/api/reportSettings";
import type { RemarkCommenterView } from "@/api/reportSettings";
import { RemarkCommentersCard } from "@/features/reporting/components/RemarkCommentersCard";

vi.mock("@/api/branches", async () => {
  const actual = await vi.importActual<typeof import("@/api/branches")>("@/api/branches");
  return { ...actual, listBranches: vi.fn() };
});

vi.mock("@/api/reportSettings", async () => {
  const actual = await vi.importActual<typeof import("@/api/reportSettings")>("@/api/reportSettings");
  return { ...actual, listRemarkCommenters: vi.fn(), saveRemarkCommenters: vi.fn() };
});

const LEVELS = [
  { levelId: "level-1", levelName: "Primary" },
  { levelId: "level-2", levelName: "Nursery" },
];

const MAIN_BRANCH: BranchView = {
  id: "branch-1",
  schoolId: "school-1",
  name: "Main Campus",
  main: true,
  status: "ACTIVE",
};

function mockBranches(...branches: BranchView[]) {
  vi.mocked(branchesApi.listBranches).mockResolvedValue({
    content: branches,
    totalElements: branches.length,
    totalPages: 1,
    number: 0,
    size: 100,
  });
}

describe("RemarkCommentersCard", () => {
  it("shows a Principal placeholder for a level with nothing configured", async () => {
    mockBranches(MAIN_BRANCH);
    vi.mocked(reportSettingsApi.listRemarkCommenters).mockResolvedValue([]);

    render(<RemarkCommentersCard levels={LEVELS} editable />);

    expect(await screen.findByText("Primary")).toBeInTheDocument();
    const titleInputs = screen.getAllByPlaceholderText("Principal");
    expect(titleInputs).toHaveLength(2);
    expect(titleInputs[0]).toHaveValue("");
  });

  it("loads an existing level default and a branch override into their own rows", async () => {
    mockBranches(MAIN_BRANCH);
    const commenters: RemarkCommenterView[] = [
      { levelId: "level-1", levelName: "Primary", title: "Head of Primary", name: "Mrs Ade" },
      {
        levelId: "level-1",
        levelName: "Primary",
        branchId: "branch-1",
        branchName: "Main Campus",
        title: "Head of Primary (Main)",
        name: "Mr Bello",
      },
    ];
    vi.mocked(reportSettingsApi.listRemarkCommenters).mockResolvedValue(commenters);

    render(<RemarkCommentersCard levels={LEVELS} editable />);

    expect(await screen.findByDisplayValue("Head of Primary")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Mrs Ade")).toBeInTheDocument();
    expect(screen.getByText("Branch overrides")).toBeInTheDocument();
    // "Main Campus" also appears as an <option> in Nursery's own "add a branch
    // override" picker, since it isn't overridden there - getAllByText, not
    // getByText, and assert the override row's own <div> label specifically.
    expect(screen.getByText("Main Campus", { selector: "div" })).toBeInTheDocument();
    expect(screen.getByDisplayValue("Head of Primary (Main)")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Mr Bello")).toBeInTheDocument();
  });

  it("saves only fully-filled rows, dropping a blank one so the level falls back to Principal", async () => {
    mockBranches(MAIN_BRANCH);
    vi.mocked(reportSettingsApi.listRemarkCommenters).mockResolvedValue([]);
    vi.mocked(reportSettingsApi.saveRemarkCommenters).mockResolvedValue([
      { levelId: "level-1", levelName: "Primary", title: "Head of Primary", name: "Mrs Ade" },
    ]);
    const user = userEvent.setup();

    render(<RemarkCommentersCard levels={LEVELS} editable />);
    await screen.findByText("Primary");

    // No branch overrides exist yet, so the only textboxes on the page are each
    // level's own Title (placeholder "Principal") and Name pair, in DOM order:
    // [Primary title, Primary name, Nursery title, Nursery name]. Nursery's pair
    // is deliberately left blank.
    const titleInputs = screen.getAllByPlaceholderText("Principal");
    await user.type(titleInputs[0], "Head of Primary");
    const textboxes = screen.getAllByRole("textbox");
    await user.type(textboxes[1], "Mrs Ade");

    await user.click(screen.getByRole("button", { name: "Save commenters" }));

    expect(reportSettingsApi.saveRemarkCommenters).toHaveBeenCalledWith([
      { levelId: "level-1", branchId: null, title: "Head of Primary", name: "Mrs Ade", signatureFileId: null },
    ]);
    expect(await screen.findByText("Saved.")).toBeInTheDocument();
  });

  it("is read-only for a non-editable caller: no Save button, no Remove button, disabled inputs", async () => {
    mockBranches(MAIN_BRANCH);
    vi.mocked(reportSettingsApi.listRemarkCommenters).mockResolvedValue([
      {
        levelId: "level-1",
        levelName: "Primary",
        branchId: "branch-1",
        branchName: "Main Campus",
        title: "Head of Primary",
        name: "Mrs Ade",
      },
    ]);

    render(<RemarkCommentersCard levels={LEVELS} editable={false} />);

    await screen.findByDisplayValue("Head of Primary");
    expect(screen.queryByRole("button", { name: "Save commenters" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove" })).not.toBeInTheDocument();
    expect(screen.getByDisplayValue("Head of Primary")).toBeDisabled();
  });
});
