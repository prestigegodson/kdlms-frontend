import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as learningApi from "@/api/learning";
import type { ShareTargetClassView, ShareTargetSubjectsView } from "@/api/learning";
import { ShareResourceModal } from "@/features/learning/components/ShareResourceModal";
import { pickSubject } from "@/test/subjectPicker";

vi.mock("@/api/learning", async () => {
  const actual = await vi.importActual<typeof import("@/api/learning")>("@/api/learning");
  return {
    ...actual,
    getShareTargets: vi.fn(),
    getShareTargetSubjects: vi.fn(),
    shareLearningResource: vi.fn(),
  };
});

const RESOURCE = { id: "resource-1", title: "Times tables" };

const SUBJECTS: ShareTargetSubjectsView = {
  subjects: [{ subjectId: "subject-math", subjectName: "Mathematics", subjectGroupId: null, subjectGroupName: null }],
  subjectGroups: [],
};

const PRIMARY_TWO: ShareTargetClassView = {
  levelId: "level-p2",
  levelName: "Primary 2",
  classrooms: [
    { classId: "class-gold", className: "Primary 2 Gold", alreadyShared: false },
    { classId: "class-blue", className: "Primary 2 Blue", alreadyShared: true },
    { classId: "class-red", className: "Primary 2 Red", alreadyShared: false },
  ],
};

const PRIMARY_THREE: ShareTargetClassView = {
  levelId: "level-p3",
  levelName: "Primary 3",
  classrooms: [{ classId: "class-p3", className: "Primary 3 Gold", alreadyShared: false }],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(learningApi.getShareTargetSubjects).mockResolvedValue(SUBJECTS);
});

describe("ShareResourceModal", () => {
  it("skips the classroom checklist when the class has a single classroom", async () => {
    vi.mocked(learningApi.getShareTargets).mockResolvedValue([PRIMARY_THREE]);

    render(<ShareResourceModal resource={RESOURCE} onClose={vi.fn()} onShared={vi.fn()} />);

    expect(await screen.findByTestId("single-classroom")).toHaveTextContent("Will be shared with Primary 3 Gold.");
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("pre-ticks open classrooms, disables already-shared ones, and needs a subject before sharing", async () => {
    const user = userEvent.setup();
    const onShared = vi.fn();
    const onClose = vi.fn();
    vi.mocked(learningApi.getShareTargets).mockResolvedValue([PRIMARY_TWO, PRIMARY_THREE]);
    vi.mocked(learningApi.shareLearningResource).mockResolvedValue({
      resourceId: "copy-1",
      classes: [{ classId: "class-gold", className: "Primary 2 Gold" }],
    });

    render(<ShareResourceModal resource={RESOURCE} onClose={onClose} onShared={onShared} />);

    await user.selectOptions(await screen.findByLabelText("Class"), "level-p2");
    const gold = screen.getByRole("checkbox", { name: "Primary 2 Gold" });
    const blue = screen.getByRole("checkbox", { name: /Primary 2 Blue/ });
    const red = screen.getByRole("checkbox", { name: "Primary 2 Red" });
    expect(gold).toBeChecked();
    expect(red).toBeChecked();
    expect(blue).toBeDisabled();
    expect(screen.getByText(/Already shared/)).toBeInTheDocument();

    const share = screen.getByRole("button", { name: "Share" });
    expect(share).toBeDisabled();

    await user.click(red);
    await waitFor(() => expect(learningApi.getShareTargetSubjects).toHaveBeenCalledWith("resource-1", "level-p2"));
    await pickSubject(user, "Mathematics");
    expect(share).toBeEnabled();
    await user.click(share);

    await waitFor(() =>
      expect(learningApi.shareLearningResource).toHaveBeenCalledWith("resource-1", {
        levelId: "level-p2",
        classIds: ["class-gold"],
        subjectId: "subject-math",
        subjectGroupId: null,
      }),
    );
    expect(onShared).toHaveBeenCalledWith(expect.objectContaining({ resourceId: "copy-1" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("shows an empty state when no other class has classrooms", async () => {
    vi.mocked(learningApi.getShareTargets).mockResolvedValue([]);

    render(<ShareResourceModal resource={RESOURCE} onClose={vi.fn()} onShared={vi.fn()} />);

    expect(await screen.findByText(/no other classes with classrooms/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Share" })).toBeDisabled();
  });
});
