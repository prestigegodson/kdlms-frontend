import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as learningApi from "@/api/learning";
import * as quizApi from "@/api/myTakeHomeQuizzes";
import * as studentApi from "@/api/student";
import { StudentDashboardPage } from "@/features/student/StudentDashboardPage";
import { resetAuthStore, useAuthStore } from "@/stores/authStore";
import { resetFeatureStore, useFeatureStore } from "@/stores/featureStore";
import { resetStudentStore } from "@/stores/studentStore";

vi.mock("@/api/student", async () => {
  const actual = await vi.importActual<typeof import("@/api/student")>("@/api/student");
  return {
    ...actual,
    getMyStudent: vi.fn(),
    listMyTerms: vi.fn(),
    downloadMyPhoto: vi.fn(),
  };
});

vi.mock("@/api/myTakeHomeQuizzes", async () => {
  const actual = await vi.importActual<typeof import("@/api/myTakeHomeQuizzes")>("@/api/myTakeHomeQuizzes");
  return { ...actual, listMyTakeHomeQuizzes: vi.fn() };
});

vi.mock("@/api/learning", async () => {
  const actual = await vi.importActual<typeof import("@/api/learning")>("@/api/learning");
  return { ...actual, listMyLearningResources: vi.fn() };
});

const DAY = 24 * 60 * 60 * 1000;

const QUIZZES: quizApi.MyTakeHomeQuizSummaryView[] = [
  {
    id: "q-due",
    title: "Fractions check",
    subjectName: "Mathematics",
    quizType: "PRACTICE" as quizApi.MyTakeHomeQuizSummaryView["quizType"],
    availability: "OPEN",
    attemptState: "NOT_STARTED",
    resultsPublished: false,
    score: null,
    totalPoints: 10,
    closesAt: new Date(Date.now() + 2 * DAY).toISOString(),
  },
  {
    id: "q-done",
    title: "Verbs quiz",
    subjectName: "English",
    quizType: "PRACTICE" as quizApi.MyTakeHomeQuizSummaryView["quizType"],
    availability: "CLOSED",
    attemptState: "SUBMITTED",
    resultsPublished: true,
    score: 8,
    totalPoints: 10,
    closesAt: new Date(Date.now() - 2 * DAY).toISOString(),
  },
];

const RESOURCES = [
  { id: "r1", title: "Intro", description: null, subjectName: "Mathematics", resourceType: "VIDEO", durationSeconds: 600, position: 0, completed: true, availableUntil: null },
  { id: "r2", title: "Practice", description: null, subjectName: "Mathematics", resourceType: "VIDEO", durationSeconds: 300, position: 1, completed: false, availableUntil: null },
] as learningApi.MyLearningResourceSummaryView[];

const ME = {
  studentId: "s1",
  fullName: "Grace Ward",
  admissionNumber: "KDL/24/001",
  gender: "FEMALE" as const,
  hasPhoto: false,
  classId: "class-1",
  className: "Primary 1",
  levelName: "Primary",
  sessionId: "session-1",
  sessionName: "2026/2027",
  currentTermId: "term-1",
  currentTermName: "First Term",
  branchId: "branch-1",
  schoolId: "school-1",
  schoolName: "Portal School",
};

function renderPage() {
  resetAuthStore();
  useAuthStore.setState({
    user: {
      id: "student-1",
      email: "grace-kdl24001",
      firstName: "Grace",
      lastName: "Ward",
      role: "STUDENT",
      schoolId: "school-1",
      branchId: "branch-1",
    },
    accessToken: "access",
    refreshToken: "refresh",
  });
  const router = createMemoryRouter([{ path: "/", element: <StudentDashboardPage /> }], { initialEntries: ["/"] });
  render(<RouterProvider router={router} />);
}

describe("StudentDashboardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStudentStore();
    vi.mocked(studentApi.listMyTerms).mockResolvedValue([]);
    resetFeatureStore();
    useFeatureStore.setState({ takeHomeQuiz: true, onDemandLearning: true, status: "loaded" });
    vi.mocked(quizApi.listMyTakeHomeQuizzes).mockResolvedValue({
      content: QUIZZES,
      totalElements: QUIZZES.length,
      totalPages: 1,
      number: 0,
      size: 100,
    } as Awaited<ReturnType<typeof quizApi.listMyTakeHomeQuizzes>>);
    vi.mocked(learningApi.listMyLearningResources).mockResolvedValue(RESOURCES);
  });

  it("shows the caller's own name, admission number, and class once loaded", async () => {
    vi.mocked(studentApi.getMyStudent).mockResolvedValue(ME);

    renderPage();

    expect(await screen.findByText("Grace Ward")).toBeInTheDocument();
    expect(screen.getByText("KDL/24/001")).toBeInTheDocument();
    expect(screen.getByText("Primary 1 · Primary")).toBeInTheDocument();
  });

  it("never fetches a photo for a student with none set", async () => {
    vi.mocked(studentApi.getMyStudent).mockResolvedValue(ME);

    renderPage();

    await screen.findByText("Grace Ward");
    expect(studentApi.downloadMyPhoto).not.toHaveBeenCalled();
  });

  it("shows a retryable error state when the profile fails to load", async () => {
    vi.mocked(studentApi.getMyStudent)
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValue(ME);
    const user = userEvent.setup();

    renderPage();

    expect(await screen.findByRole("button", { name: "Try again" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByText("Grace Ward")).toBeInTheDocument();
  });

  it("renders the due-soon banner, snapshot, progress and quiz table from the student's own data", async () => {
    vi.mocked(studentApi.getMyStudent).mockResolvedValue(ME);

    renderPage();

    expect(await screen.findByText("1 incomplete quiz")).toBeInTheDocument();
    expect(screen.getByText("Learner snapshot")).toBeInTheDocument();
    expect(screen.getByText("0:10:00")).toBeInTheDocument();
    expect(screen.getByText("Lesson progress by subject")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Quizzes mastered" })).toHaveAttribute("aria-valuenow", "100");
    expect(screen.getByText("Fractions check")).toBeInTheDocument();
    expect(screen.getAllByText("80%")).toHaveLength(2);
    expect(screen.getByText("Verbs quiz").closest("tr")).toHaveTextContent("Completed");
    expect(screen.getByText("Fractions check").closest("tr")).toHaveTextContent("Available");
  });

  it("shows a dash for a score that hasn't been released", async () => {
    vi.mocked(studentApi.getMyStudent).mockResolvedValue(ME);

    renderPage();

    const row = (await screen.findByText("Fractions check")).closest("tr") as HTMLElement;
    expect(row).toHaveTextContent("—");
  });

  it("leaves out every quiz widget when take-home quizzes are off", async () => {
    useFeatureStore.setState({ takeHomeQuiz: false });
    vi.mocked(studentApi.getMyStudent).mockResolvedValue(ME);

    renderPage();

    expect(await screen.findByText("Lesson progress by subject")).toBeInTheDocument();
    expect(quizApi.listMyTakeHomeQuizzes).not.toHaveBeenCalled();
    expect(screen.queryByText(/incomplete quiz/)).not.toBeInTheDocument();
    expect(screen.queryByText("My quizzes")).not.toBeInTheDocument();
    expect(screen.queryByRole("progressbar", { name: "Quizzes completed" })).not.toBeInTheDocument();
  });

  it("leaves out lesson widgets when on-demand learning is off", async () => {
    useFeatureStore.setState({ onDemandLearning: false });
    vi.mocked(studentApi.getMyStudent).mockResolvedValue(ME);

    renderPage();

    expect(await screen.findByText("My quizzes")).toBeInTheDocument();
    expect(learningApi.listMyLearningResources).not.toHaveBeenCalled();
    expect(screen.queryByText("Learning time")).not.toBeInTheDocument();
    expect(screen.queryByText("Lesson progress by subject")).not.toBeInTheDocument();
  });

  it("still shows the profile when the quiz list fails to load", async () => {
    vi.mocked(quizApi.listMyTakeHomeQuizzes).mockRejectedValue(new Error("boom"));
    vi.mocked(studentApi.getMyStudent).mockResolvedValue(ME);

    renderPage();

    expect(await screen.findByText("Lesson progress by subject")).toBeInTheDocument();
    expect(screen.getByText("Grace Ward")).toBeInTheDocument();
    expect(screen.queryByText("My quizzes")).not.toBeInTheDocument();
  });
});
