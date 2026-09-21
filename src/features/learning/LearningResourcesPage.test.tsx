import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as classesApi from "@/api/classes";
import * as learningApi from "@/api/learning";
import * as meApi from "@/api/me";
import * as sessionsApi from "@/api/sessions";
import { LearningResourcesPage } from "@/features/learning/LearningResourcesPage";
import { resetAuthStore, useAuthStore } from "@/stores/authStore";
import { resetBranchStore, useBranchStore } from "@/stores/branchStore";
import { resetFeatureStore, useFeatureStore } from "@/stores/featureStore";

// The TakeHomeQuizzesPage.test.tsx shape (same class+term-picker-then-list pattern this page's
// own comment says it mirrors).
vi.mock("@/api/learning", async () => {
  const actual = await vi.importActual<typeof import("@/api/learning")>("@/api/learning");
  return {
    ...actual,
    listLearningResources: vi.fn(),
    getAuthorableSubjects: vi.fn(),
    getLearningResource: vi.fn(),
    publishLearningResource: vi.fn(),
    unpublishLearningResource: vi.fn(),
    archiveLearningResource: vi.fn(),
    deleteLearningResource: vi.fn(),
    listLearningComments: vi.fn(),
    getLearningResourceCompletions: vi.fn(),
  };
});

vi.mock("@/api/me", async () => {
  const actual = await vi.importActual<typeof import("@/api/me")>("@/api/me");
  return { ...actual, listMyClasses: vi.fn() };
});

vi.mock("@/api/classes", async () => {
  const actual = await vi.importActual<typeof import("@/api/classes")>("@/api/classes");
  return { ...actual, listClasses: vi.fn() };
});

vi.mock("@/api/sessions", async () => {
  const actual = await vi.importActual<typeof import("@/api/sessions")>("@/api/sessions");
  return { ...actual, listSessions: vi.fn(), listTerms: vi.fn() };
});

const RESOURCE_ROW: learningApi.LearningResourceSummaryView = {
  id: "resource-1",
  title: "Fractions worksheet",
  subjectName: "Mathematics",
  resourceType: "PDF",
  status: "DRAFT",
  position: 0,
  updatedAt: "2026-03-01T00:00:00Z",
};

const RESOURCE_DETAIL: learningApi.LearningResourceView = {
  id: "resource-1",
  classId: "class-1",
  className: "JSS 1A",
  subjectId: "subject-1",
  subjectName: "Mathematics",
  termId: "term-1",
  title: "Fractions worksheet",
  description: null,
  resourceType: "PDF",
  bodyHtml: null,
  fileId: "file-1",
  youtubeVideoId: null,
  durationSeconds: null,
  commentsEnabled: true,
  status: "DRAFT",
  position: 0,
  updatedAt: "2026-03-01T00:00:00Z",
  actions: { canEdit: true, canPublish: true, canUnpublish: false, canArchive: true, canDelete: true },
};

function renderAs(role: "TEACHER" | "SCHOOL_ADMIN", initialEntry = "/") {
  resetAuthStore();
  useAuthStore.setState({
    user: {
      id: "user-1",
      email: "user@school.example",
      firstName: "A",
      lastName: "B",
      role,
      schoolId: "school-1",
    },
    accessToken: "access",
    refreshToken: "refresh",
  });
  const router = createMemoryRouter([{ path: "/", element: <LearningResourcesPage /> }], {
    initialEntries: [initialEntry],
  });
  render(<RouterProvider router={router} />);
}

async function selectClassAndSubject() {
  const user = userEvent.setup();
  await user.selectOptions(await screen.findByLabelText("Class"), "JSS 1A");
  await user.selectOptions(await screen.findByLabelText("Subject"), "Mathematics");
  return user;
}

async function openRowMenu(user: ReturnType<typeof userEvent.setup>, title = "Fractions worksheet") {
  await user.click(await screen.findByRole("button", { name: `Actions for ${title}` }));
}

describe("LearningResourcesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetBranchStore();
    resetFeatureStore();
    useFeatureStore.setState({ onDemandLearning: true, learningMedia: false });

    vi.mocked(meApi.listMyClasses).mockResolvedValue([
      {
        classId: "class-1",
        className: "JSS 1A",
        branchId: "branch-1",
        levelId: "level-1",
        isClassTeacher: true,
        subjectIds: ["subject-1"],
      },
    ]);
    vi.mocked(classesApi.listClasses).mockResolvedValue({
      content: [
        { id: "class-1", schoolId: "school-1", name: "JSS 1A", branchId: "branch-1", levelId: "level-1", status: "ACTIVE" },
      ],
      totalElements: 1,
      totalPages: 1,
      number: 0,
      size: 200,
    });
    vi.mocked(sessionsApi.listSessions).mockResolvedValue({
      content: [
        { id: "session-1", schoolId: "school-1", name: "2026/2027", startDate: "2026-09-01", endDate: null, current: true },
      ],
      totalElements: 1,
      totalPages: 1,
      number: 0,
      size: 50,
    });
    vi.mocked(sessionsApi.listTerms).mockResolvedValue([
      { id: "term-1", schoolId: "school-1", sessionId: "session-1", termNumber: 1, name: "First Term", startDate: "2026-09-01", endDate: "2026-12-01", current: true },
    ]);
    vi.mocked(learningApi.getAuthorableSubjects).mockResolvedValue([
      { subjectId: "subject-1", subjectName: "Mathematics" },
    ]);
    vi.mocked(learningApi.listLearningResources).mockResolvedValue({
      content: [RESOURCE_ROW],
      totalElements: 1,
      totalPages: 1,
      number: 0,
      size: 20,
    });
    vi.mocked(learningApi.getLearningResource).mockResolvedValue(RESOURCE_DETAIL);
    vi.mocked(learningApi.listLearningComments).mockResolvedValue([]);
    vi.mocked(learningApi.getLearningResourceCompletions).mockResolvedValue({
      resourceId: "resource-1",
      title: "Fractions worksheet",
      totalStudents: 0,
      completedCount: 0,
      students: [],
    });
  });

  it("shows the no-classes-assigned empty state for a TEACHER with no assignments", async () => {
    vi.mocked(meApi.listMyClasses).mockResolvedValue([]);

    renderAs("TEACHER");

    expect(await screen.findByText("No classes assigned yet")).toBeInTheDocument();
  });

  it("lists resources once a class, term, and subject are selected, driven by the picker", async () => {
    renderAs("TEACHER");

    await selectClassAndSubject();

    expect(await screen.findByText("Fractions worksheet")).toBeInTheDocument();
    expect(learningApi.listLearningResources).toHaveBeenCalledWith(
      "class-1",
      "term-1",
      "subject-1",
      undefined,
      0,
      20,
    );
  });

  it("seeds the class and subject from ?classId=&subjectId= (SubjectsPage's row action)", async () => {
    renderAs("TEACHER", "/?classId=class-1&subjectId=subject-1");

    // No manual class/subject selection - both seed from the query string.
    expect(await screen.findByText("Fractions worksheet")).toBeInTheDocument();
    expect(learningApi.listLearningResources).toHaveBeenCalledWith(
      "class-1",
      "term-1",
      "subject-1",
      undefined,
      0,
      20,
    );
    expect(screen.getByLabelText("Class")).toHaveValue("class-1");
    expect(screen.getByLabelText("Subject")).toHaveValue("subject-1");
  });

  it("shows a status badge matching each resource's status", async () => {
    renderAs("TEACHER");
    await selectClassAndSubject();

    const row = (await screen.findByText("Fractions worksheet")).closest("tr");
    expect(row).not.toBeNull();
    expect(within(row as HTMLElement).getByText("DRAFT")).toBeInTheDocument();
  });

  it("collapses the row actions into a single Actions menu", async () => {
    renderAs("TEACHER");
    const user = await selectClassAndSubject();
    await screen.findByText("Fractions worksheet");

    expect(screen.queryByRole("menuitem", { name: "Publish" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();

    await openRowMenu(user);

    expect(screen.getAllByRole("menuitem").map((item) => item.textContent)).toEqual([
      "Preview",
      "Edit",
      "Comments",
      "Completions",
      "Publish",
      "Archive",
      "Delete",
    ]);
  });

  it("publishes a DRAFT resource and refreshes the list", async () => {
    vi.mocked(learningApi.publishLearningResource).mockResolvedValue({ ...RESOURCE_DETAIL, status: "PUBLISHED" });
    renderAs("TEACHER");
    const user = await selectClassAndSubject();

    await screen.findByText("Fractions worksheet");
    const callsBeforePublish = vi.mocked(learningApi.listLearningResources).mock.calls.length;
    await openRowMenu(user);
    await user.click(screen.getByRole("menuitem", { name: "Publish" }));

    expect(learningApi.publishLearningResource).toHaveBeenCalledWith("resource-1");
    await vi.waitFor(() =>
      expect(vi.mocked(learningApi.listLearningResources).mock.calls.length).toBeGreaterThan(callsBeforePublish),
    );
  });

  it("archives a resource after confirming, and never calls the action without confirmation", async () => {
    renderAs("TEACHER");
    const user = await selectClassAndSubject();
    await screen.findByText("Fractions worksheet");

    await openRowMenu(user);
    await user.click(screen.getByRole("menuitem", { name: "Archive" }));
    const cancelDialog = await screen.findByRole("dialog");
    await user.click(within(cancelDialog).getByRole("button", { name: "Cancel" }));
    expect(learningApi.archiveLearningResource).not.toHaveBeenCalled();

    vi.mocked(learningApi.archiveLearningResource).mockResolvedValue({ ...RESOURCE_DETAIL, status: "ARCHIVED" });
    await openRowMenu(user);
    await user.click(screen.getByRole("menuitem", { name: "Archive" }));
    const confirmDialog = await screen.findByRole("dialog");
    await user.click(within(confirmDialog).getByRole("button", { name: "Archive" }));
    expect(learningApi.archiveLearningResource).toHaveBeenCalledWith("resource-1");
  });

  it("opens the comments moderation modal for a resource", async () => {
    renderAs("TEACHER");
    const user = await selectClassAndSubject();
    await screen.findByText("Fractions worksheet");

    await openRowMenu(user);
    await user.click(screen.getByRole("menuitem", { name: "Comments" }));

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(learningApi.listLearningComments).toHaveBeenCalledWith("resource-1");
  });

  it("opens the completions roster for a resource", async () => {
    renderAs("TEACHER");
    const user = await selectClassAndSubject();
    await screen.findByText("Fractions worksheet");

    await openRowMenu(user);
    await user.click(screen.getByRole("menuitem", { name: "Completions" }));

    expect(learningApi.getLearningResourceCompletions).toHaveBeenCalledWith("resource-1");
  });

  it("opens the editor and hides Audio/Video authoring options when learningMedia isn't entitled", async () => {
    useFeatureStore.setState({ onDemandLearning: true, learningMedia: false });
    renderAs("TEACHER");
    const user = await selectClassAndSubject();
    await screen.findByText("Fractions worksheet");

    await user.click(screen.getByRole("button", { name: "Add resource" }));

    const dialog = await screen.findByRole("dialog", { name: "Add resource" });
    const typeSelect = within(dialog).getByLabelText("Type");
    expect(within(typeSelect).queryByText("Audio (mp3)")).not.toBeInTheDocument();
    expect(within(typeSelect).queryByText("Video (mp4)")).not.toBeInTheDocument();
  });

  it("shows Audio/Video authoring options once learningMedia is entitled", async () => {
    useFeatureStore.setState({ onDemandLearning: true, learningMedia: true });
    renderAs("TEACHER");
    const user = await selectClassAndSubject();
    await screen.findByText("Fractions worksheet");

    await user.click(screen.getByRole("button", { name: "Add resource" }));

    const dialog = await screen.findByRole("dialog", { name: "Add resource" });
    const typeSelect = within(dialog).getByLabelText("Type");
    expect(within(typeSelect).getByText("Audio (mp3)")).toBeInTheDocument();
    expect(within(typeSelect).getByText("Video (mp4)")).toBeInTheDocument();
  });

  it("sources classes from listClasses (school-wide, branch-filtered), not listMyClasses, for a SCHOOL_ADMIN", async () => {
    useBranchStore.setState({ status: "loaded", branches: [], selectedBranchId: null });
    renderAs("SCHOOL_ADMIN");

    await vi.waitFor(() => expect(classesApi.listClasses).toHaveBeenCalled());
    expect(meApi.listMyClasses).not.toHaveBeenCalled();
  });
});
