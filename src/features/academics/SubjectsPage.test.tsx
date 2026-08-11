import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/api/client";
import * as levelsApi from "@/api/levels";
import type { LevelView } from "@/api/levels";
import * as meApi from "@/api/me";
import type { TeacherSubjectAssignmentView } from "@/api/me";
import * as subjectGroupsApi from "@/api/subjectGroups";
import type { SubjectGroupView } from "@/api/subjectGroups";
import * as subjectsApi from "@/api/subjects";
import type { SubjectView } from "@/api/subjects";
import { SubjectsPage } from "@/features/academics/SubjectsPage";
import { resetAuthStore, useAuthStore } from "@/stores/authStore";
import { resetLevelStore } from "@/stores/levelStore";
import { resetTeacherScopeStore, useTeacherScopeStore } from "@/stores/teacherScopeStore";

vi.mock("@/api/subjects", async () => {
  const actual = await vi.importActual<typeof import("@/api/subjects")>("@/api/subjects");
  return {
    ...actual,
    listSubjects: vi.fn(),
    createSubject: vi.fn(),
    updateSubject: vi.fn(),
    activateSubject: vi.fn(),
    deactivateSubject: vi.fn(),
    deleteSubject: vi.fn(),
    copySubjects: vi.fn(),
  };
});

vi.mock("@/api/me", async () => {
  const actual = await vi.importActual<typeof import("@/api/me")>("@/api/me");
  return { ...actual, listMySubjects: vi.fn() };
});

vi.mock("@/api/subjectGroups", async () => {
  const actual = await vi.importActual<typeof import("@/api/subjectGroups")>("@/api/subjectGroups");
  return {
    ...actual,
    listSubjectGroups: vi.fn(),
    createSubjectGroup: vi.fn(),
    renameSubjectGroup: vi.fn(),
    deleteSubjectGroup: vi.fn(),
  };
});

vi.mock("@/api/levels", async () => {
  const actual = await vi.importActual<typeof import("@/api/levels")>("@/api/levels");
  return { ...actual, listLevels: vi.fn() };
});

const PRIMARY_LEVEL: LevelView = {
  id: "level-1",
  baseLevel: "PRIMARY",
  displayName: "Primary",
  rank: 4,
  status: "ACTIVE",
  subjectCount: 0,
  classCount: 0,
  subjectGroupCount: 0,
};

const SECONDARY_LEVEL: LevelView = {
  id: "level-2",
  baseLevel: "SECONDARY",
  displayName: "Secondary",
  rank: 5,
  status: "ACTIVE",
  subjectCount: 0,
  classCount: 0,
  subjectGroupCount: 0,
};

const SCIENCES_GROUP: SubjectGroupView = { id: "group-1", schoolId: "school-1", levelId: "level-1", name: "Sciences" };

const GROUPED_SUBJECT: SubjectView = {
  id: "subject-1",
  schoolId: "school-1",
  levelId: "level-1",
  name: "Basic Science",
  code: "BSC",
  subjectGroupId: "group-1",
  subjectGroupName: "Sciences",
  termNumbers: [1, 2, 3],
  selective: false,
  status: "ACTIVE",
};

const UNGROUPED_SUBJECT: SubjectView = {
  id: "subject-2",
  schoolId: "school-1",
  levelId: "level-1",
  name: "Mathematics",
  code: "MTH",
  termNumbers: [1, 2, 3],
  selective: false,
  status: "ACTIVE",
};

const TERM_THREE_ONLY_SUBJECT: SubjectView = {
  id: "subject-3",
  schoolId: "school-1",
  levelId: "level-1",
  name: "Project Work",
  termNumbers: [3],
  selective: false,
  status: "ACTIVE",
};

const SOURCE_PHYSICS: SubjectView = {
  id: "subject-10",
  schoolId: "school-1",
  levelId: "level-2",
  name: "Physics",
  code: "PHY",
  termNumbers: [1, 2, 3],
  selective: false,
  status: "ACTIVE",
};

const SOURCE_CHEMISTRY: SubjectView = {
  id: "subject-11",
  schoolId: "school-1",
  levelId: "level-2",
  name: "Chemistry",
  code: "CHM",
  termNumbers: [1, 2, 3],
  selective: false,
  status: "ACTIVE",
};

function mockSubjects(subjects: SubjectView[]) {
  vi.mocked(subjectsApi.listSubjects).mockResolvedValue({
    content: subjects,
    totalElements: subjects.length,
    totalPages: 1,
    number: 0,
    size: 50,
  });
}

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
  const router = createMemoryRouter([{ path: "/", element: <SubjectsPage /> }], { initialEntries: ["/"] });
  render(<RouterProvider router={router} />);
}

function renderAsBranchAdmin() {
  resetAuthStore();
  useAuthStore.setState({
    user: {
      id: "user-2",
      email: "branch@school.example",
      firstName: "Bola",
      lastName: "Ade",
      role: "BRANCH_ADMIN",
      schoolId: "school-1",
      branchId: "branch-1",
    },
    accessToken: "access",
    refreshToken: "refresh",
  });
  const router = createMemoryRouter([{ path: "/", element: <SubjectsPage /> }], { initialEntries: ["/"] });
  render(<RouterProvider router={router} />);
}

function renderAsTeacher() {
  resetAuthStore();
  useAuthStore.setState({
    user: {
      id: "teacher-1",
      email: "sonia@school.example",
      firstName: "Sonia",
      lastName: "B",
      role: "TEACHER",
      schoolId: "school-1",
      branchId: "branch-1",
    },
    accessToken: "access",
    refreshToken: "refresh",
  });
  const router = createMemoryRouter([{ path: "/", element: <SubjectsPage /> }], { initialEntries: ["/"] });
  render(<RouterProvider router={router} />);
}

const TERM_ONE_ASSIGNMENT: TeacherSubjectAssignmentView = {
  classId: "class-1",
  className: "Little Star 1",
  levelId: "level-1",
  levelName: "Primary",
  subjectId: "subject-2",
  subjectName: "Mathematics",
};

describe("SubjectsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetTeacherScopeStore();
    resetLevelStore();
    vi.mocked(levelsApi.listLevels).mockResolvedValue([PRIMARY_LEVEL, SECONDARY_LEVEL]);
    vi.mocked(subjectGroupsApi.listSubjectGroups).mockResolvedValue([SCIENCES_GROUP]);
  });

  it("sections subjects by group, with ungrouped subjects trailing", async () => {
    mockSubjects([GROUPED_SUBJECT, UNGROUPED_SUBJECT]);

    renderAsSchoolAdmin();

    expect(await screen.findByText("Basic Science")).toBeInTheDocument();
    expect(screen.getByText("Sciences")).toBeInTheDocument();
    expect(screen.getByText("Ungrouped")).toBeInTheDocument();
    expect(screen.getByText("Mathematics")).toBeInTheDocument();
  });

  it("creates a subject in the selected group", async () => {
    mockSubjects([]);
    vi.mocked(subjectsApi.createSubject).mockResolvedValue(GROUPED_SUBJECT);
    const user = userEvent.setup();

    renderAsSchoolAdmin();
    await screen.findByText(/No subjects yet/);

    await user.click(screen.getByRole("button", { name: "Add subject" }));
    const dialog = await screen.findByRole("dialog");

    await user.type(within(dialog).getByLabelText("Name"), "Basic Science");
    await user.selectOptions(within(dialog).getByLabelText("Group"), "Sciences");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));

    expect(subjectsApi.createSubject).toHaveBeenCalledWith({
      levelId: "level-1",
      name: "Basic Science",
      code: undefined,
      subjectGroupId: "group-1",
      termNumbers: [1, 2, 3],
      selective: false,
    });
  });

  it("shows each subject's configured terms, defaulting new subjects to every term", async () => {
    mockSubjects([TERM_THREE_ONLY_SUBJECT, UNGROUPED_SUBJECT]);

    renderAsSchoolAdmin();

    expect(await screen.findByText("Project Work")).toBeInTheDocument();
    expect(screen.getByText("T3")).toBeInTheDocument();
    expect(screen.getByText("All terms")).toBeInTheDocument();
  });

  it("creates a subject restricted to a single term", async () => {
    mockSubjects([]);
    vi.mocked(subjectsApi.createSubject).mockResolvedValue(TERM_THREE_ONLY_SUBJECT);
    const user = userEvent.setup();

    renderAsSchoolAdmin();
    await screen.findByText(/No subjects yet/);

    await user.click(screen.getByRole("button", { name: "Add subject" }));
    const dialog = await screen.findByRole("dialog");

    await user.type(within(dialog).getByLabelText("Name"), "Project Work");
    await user.click(within(dialog).getByLabelText("Term 1"));
    await user.click(within(dialog).getByLabelText("Term 2"));
    await user.click(within(dialog).getByRole("button", { name: "Save" }));

    expect(subjectsApi.createSubject).toHaveBeenCalledWith({
      levelId: "level-1",
      name: "Project Work",
      code: undefined,
      subjectGroupId: undefined,
      termNumbers: [3],
      selective: false,
    });
  });

  it("creates a subject marked selective", async () => {
    mockSubjects([]);
    const selectiveSubject: SubjectView = { ...UNGROUPED_SUBJECT, id: "subject-4", selective: true };
    vi.mocked(subjectsApi.createSubject).mockResolvedValue(selectiveSubject);
    const user = userEvent.setup();

    renderAsSchoolAdmin();
    await screen.findByText(/No subjects yet/);

    await user.click(screen.getByRole("button", { name: "Add subject" }));
    const dialog = await screen.findByRole("dialog");

    await user.type(within(dialog).getByLabelText("Name"), "Mathematics");
    await user.click(within(dialog).getByLabelText(/Selective/));
    await user.click(within(dialog).getByRole("button", { name: "Save" }));

    expect(subjectsApi.createSubject).toHaveBeenCalledWith({
      levelId: "level-1",
      name: "Mathematics",
      code: undefined,
      subjectGroupId: undefined,
      termNumbers: [1, 2, 3],
      selective: true,
    });
  });

  it("badges a selective subject in the list", async () => {
    mockSubjects([{ ...UNGROUPED_SUBJECT, selective: true }]);

    renderAsSchoolAdmin();

    expect(await screen.findByText("Mathematics")).toBeInTheDocument();
    expect(screen.getByText("Selective", { selector: "span" })).toBeInTheDocument();
  });

  it("refuses to save a subject with no terms selected", async () => {
    mockSubjects([]);
    const user = userEvent.setup();

    renderAsSchoolAdmin();
    await screen.findByText(/No subjects yet/);

    await user.click(screen.getByRole("button", { name: "Add subject" }));
    const dialog = await screen.findByRole("dialog");

    await user.type(within(dialog).getByLabelText("Name"), "Project Work");
    await user.click(within(dialog).getByLabelText("Term 1"));
    await user.click(within(dialog).getByLabelText("Term 2"));
    await user.click(within(dialog).getByLabelText("Term 3"));
    await user.click(within(dialog).getByRole("button", { name: "Save" }));

    expect(await within(dialog).findByText("Select at least one term.")).toBeInTheDocument();
    expect(subjectsApi.createSubject).not.toHaveBeenCalled();
  });

  it("deactivates an active subject", async () => {
    mockSubjects([UNGROUPED_SUBJECT]);
    vi.mocked(subjectsApi.deactivateSubject).mockResolvedValue(undefined);
    const user = userEvent.setup();

    renderAsSchoolAdmin();
    await screen.findByText("Mathematics");

    await user.click(screen.getByRole("button", { name: "Deactivate" }));

    expect(subjectsApi.deactivateSubject).toHaveBeenCalledWith("subject-2");
  });

  it("deletes a subject after confirming in the dialog, then reloads the list", async () => {
    mockSubjects([UNGROUPED_SUBJECT]);
    vi.mocked(subjectsApi.deleteSubject).mockResolvedValue(undefined);
    const user = userEvent.setup();

    renderAsSchoolAdmin();
    await screen.findByText("Mathematics");

    await user.click(screen.getByRole("button", { name: "Delete" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Delete" }));

    expect(subjectsApi.deleteSubject).toHaveBeenCalledWith("subject-2");
    expect(subjectsApi.listSubjects).toHaveBeenCalledTimes(2);
  });

  it("renders the server's 422 message inside the dialog when the delete is rejected", async () => {
    mockSubjects([UNGROUPED_SUBJECT]);
    vi.mocked(subjectsApi.deleteSubject).mockRejectedValue(
      new ApiError(422, "'Mathematics' has recorded assessments and can no longer be deleted - deactivate it instead."),
    );
    const user = userEvent.setup();

    renderAsSchoolAdmin();
    await screen.findByText("Mathematics");

    await user.click(screen.getByRole("button", { name: "Delete" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Delete" }));

    expect(
      await within(dialog).findByText(
        "'Mathematics' has recorded assessments and can no longer be deleted - deactivate it instead.",
      ),
    ).toBeInTheDocument();
  });

  it("shows no Delete button for a BRANCH_ADMIN, unlike Edit and Deactivate", async () => {
    mockSubjects([UNGROUPED_SUBJECT]);

    renderAsBranchAdmin();
    await screen.findByText("Mathematics");

    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Deactivate" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
  });

  it("creates a subject group from the manage-groups dialog", async () => {
    mockSubjects([]);
    vi.mocked(subjectGroupsApi.createSubjectGroup).mockResolvedValue(SCIENCES_GROUP);
    const user = userEvent.setup();

    renderAsSchoolAdmin();
    await screen.findByText(/No subjects yet/);

    await user.click(screen.getByRole("button", { name: "Manage groups" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Sciences")).toBeInTheDocument();

    await user.type(within(dialog).getByLabelText("New group name"), "Languages");
    await user.click(within(dialog).getByRole("button", { name: "Add" }));

    expect(subjectGroupsApi.createSubjectGroup).toHaveBeenCalledWith({ levelId: "level-1", name: "Languages" });
  });

  it("deletes a subject group after inline confirmation", async () => {
    mockSubjects([]);
    vi.mocked(subjectGroupsApi.deleteSubjectGroup).mockResolvedValue(undefined);
    const user = userEvent.setup();

    renderAsSchoolAdmin();
    await screen.findByText(/No subjects yet/);

    await user.click(screen.getByRole("button", { name: "Manage groups" }));
    const dialog = await screen.findByRole("dialog");

    await user.click(within(dialog).getByRole("button", { name: "Delete" }));
    await user.click(within(dialog).getByRole("button", { name: "Confirm" }));

    expect(subjectGroupsApi.deleteSubjectGroup).toHaveBeenCalledWith("group-1");
  });

  it("shows the current term for a TEACHER's already server-filtered subject list", async () => {
    vi.mocked(meApi.listMySubjects).mockResolvedValue([TERM_ONE_ASSIGNMENT]);
    useTeacherScopeStore.setState({
      status: "loaded",
      capabilities: {
        isClassTeacher: false,
        classTeacherClassIds: [],
        subjectTeacherClassIds: ["class-1"],
        currentTermNumber: 1,
        currentTermName: "First Term",
      },
    });

    renderAsTeacher();

    expect(await screen.findByText("Mathematics")).toBeInTheDocument();
    expect(screen.getByText("Showing subjects for First Term.")).toBeInTheDocument();
  });

  it("warns a TEACHER when the school has not set a current term", async () => {
    vi.mocked(meApi.listMySubjects).mockResolvedValue([TERM_ONE_ASSIGNMENT]);
    useTeacherScopeStore.setState({
      status: "loaded",
      capabilities: { isClassTeacher: false, classTeacherClassIds: [], subjectTeacherClassIds: ["class-1"] },
    });

    renderAsTeacher();

    expect(await screen.findByText("Mathematics")).toBeInTheDocument();
    expect(
      screen.getByText("Your school has not set a current term - showing all your subjects."),
    ).toBeInTheDocument();
  });

  describe("copying subjects from another level", () => {
    function mockSubjectsByLevel() {
      vi.mocked(subjectsApi.listSubjects).mockImplementation((levelId?: string) => {
        const content = levelId === "level-2" ? [SOURCE_PHYSICS, SOURCE_CHEMISTRY] : [];
        return Promise.resolve({ content, totalElements: content.length, totalPages: 1, number: 0, size: 200 });
      });
    }

    it("pre-selects every active subject from the chosen source level, deselecting one omits it from the request", async () => {
      mockSubjectsByLevel();
      vi.mocked(subjectsApi.copySubjects).mockResolvedValue({
        outcomes: [{ sourceSubjectId: "subject-10", createdSubjectId: "subject-20", success: true }],
      });
      const user = userEvent.setup();

      renderAsSchoolAdmin();
      await screen.findByText(/No subjects yet/);

      await user.click(screen.getByRole("button", { name: "Copy from level…" }));
      const dialog = await screen.findByRole("dialog", { name: "Copy subjects to Primary" });

      await user.selectOptions(within(dialog).getByLabelText("Copy from level"), "Secondary");
      await within(dialog).findByText("Physics");
      expect(within(dialog).getByLabelText("Select all 2")).toBeChecked();

      await user.click(within(dialog).getByLabelText(/Chemistry/));
      await user.click(within(dialog).getByRole("button", { name: "Copy" }));

      expect(subjectsApi.copySubjects).toHaveBeenCalledWith({
        sourceLevelId: "level-2",
        targetLevelId: "level-1",
        subjectIds: ["subject-10"],
      });
      expect(await within(dialog).findByText("Copied")).toBeInTheDocument();
    });

    it("renders a mixed success/failure outcome list after copying", async () => {
      mockSubjectsByLevel();
      vi.mocked(subjectsApi.copySubjects).mockResolvedValue({
        outcomes: [
          { sourceSubjectId: "subject-10", createdSubjectId: "subject-20", success: true },
          {
            sourceSubjectId: "subject-11",
            success: false,
            message: "A subject named 'Chemistry' already exists for this level.",
          },
        ],
      });
      const user = userEvent.setup();

      renderAsSchoolAdmin();
      await screen.findByText(/No subjects yet/);

      await user.click(screen.getByRole("button", { name: "Copy from level…" }));
      const dialog = await screen.findByRole("dialog", { name: "Copy subjects to Primary" });

      await user.selectOptions(within(dialog).getByLabelText("Copy from level"), "Secondary");
      await within(dialog).findByText("Physics");
      await user.click(within(dialog).getByRole("button", { name: "Copy" }));

      expect(await within(dialog).findByText("Copied")).toBeInTheDocument();
      expect(
        within(dialog).getByText("A subject named 'Chemistry' already exists for this level."),
      ).toBeInTheDocument();

      await user.click(within(dialog).getByRole("button", { name: "Done" }));
      // A successful row triggers a reload of the target level's own list.
      expect(subjectsApi.listSubjects).toHaveBeenCalledWith("level-1");
    });

    it("hides the copy action when only one level exists", async () => {
      vi.mocked(levelsApi.listLevels).mockResolvedValue([PRIMARY_LEVEL]);
      mockSubjects([]);

      renderAsSchoolAdmin();
      await screen.findByText(/No subjects yet/);

      expect(screen.getByRole("button", { name: "Copy from level…" })).toBeDisabled();
    });
  });
});
