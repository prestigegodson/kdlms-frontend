import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as branchesApi from "@/api/branches";
import * as classesApi from "@/api/classes";
import type { SchoolClassView } from "@/api/classes";
import * as sessionsApi from "@/api/sessions";
import type { AcademicSessionView } from "@/api/sessions";
import * as studentsApi from "@/api/students";
import type { StudentView } from "@/api/students";
import { PromotionPage } from "@/features/students/PromotionPage";
import { resetAppBarStore, useAppBarStore } from "@/stores/appBarStore";
import { resetAuthStore, useAuthStore } from "@/stores/authStore";

vi.mock("@/api/students", async () => {
  const actual = await vi.importActual<typeof import("@/api/students")>("@/api/students");
  return { ...actual, listStudents: vi.fn(), promoteStudents: vi.fn(), placeStudents: vi.fn() };
});

vi.mock("@/api/branches", async () => {
  const actual = await vi.importActual<typeof import("@/api/branches")>("@/api/branches");
  return { ...actual, listBranches: vi.fn() };
});

vi.mock("@/api/classes", async () => {
  const actual = await vi.importActual<typeof import("@/api/classes")>("@/api/classes");
  return { ...actual, listClasses: vi.fn() };
});

vi.mock("@/api/sessions", async () => {
  const actual = await vi.importActual<typeof import("@/api/sessions")>("@/api/sessions");
  return { ...actual, listSessions: vi.fn() };
});

const SOURCE_CLASS: SchoolClassView = {
  id: "class-1",
  schoolId: "school-1",
  branchId: "branch-1",
  levelId: "level-1",
  name: "Primary 1",
  status: "ACTIVE",
};

const TARGET_CLASS: SchoolClassView = {
  id: "class-2",
  schoolId: "school-1",
  branchId: "branch-1",
  levelId: "level-1",
  name: "Primary 2",
  status: "ACTIVE",
};

const NEW_SESSION: AcademicSessionView = {
  id: "session-2",
  schoolId: "school-1",
  name: "2027/2028",
  startDate: "2027-09-01",
  endDate: null,
  current: false,
};

const STUDENT_VIEW: StudentView = {
  id: "student-1",
  schoolId: "school-1",
  branchId: "branch-1",
  admissionNumber: "BFA/2026/0001",
  firstName: "Ada",
  lastName: "Obi",
  fullName: "Ada Obi",
  gender: "FEMALE",
  status: "ACTIVE",
  currentClassId: "class-1",
  currentClassName: "Primary 1",
};

function renderPage() {
  resetAuthStore();
  useAuthStore.setState({
    user: { id: "user-1", email: "admin@school.example", firstName: "Ada", lastName: "Obi", role: "SCHOOL_ADMIN", schoolId: "school-1" },
    accessToken: "access",
    refreshToken: "refresh",
  });
  const router = createMemoryRouter([{ path: "/", element: <PromotionPage /> }], { initialEntries: ["/"] });
  render(<RouterProvider router={router} />);
}

describe("PromotionPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAppBarStore();
    vi.mocked(branchesApi.listBranches).mockResolvedValue({
      content: [],
      totalElements: 0,
      totalPages: 0,
      number: 0,
      size: 50,
    });
    vi.mocked(classesApi.listClasses).mockResolvedValue({
      content: [SOURCE_CLASS, TARGET_CLASS],
      totalElements: 2,
      totalPages: 1,
      number: 0,
      size: 200,
    });
    vi.mocked(sessionsApi.listSessions).mockResolvedValue({
      content: [NEW_SESSION],
      totalElements: 1,
      totalPages: 1,
      number: 0,
      size: 50,
    });
  });

  it("registers the app bar's back link to the student registry, the only route it's reachable from", async () => {
    vi.mocked(studentsApi.listStudents).mockResolvedValue({
      content: [],
      totalElements: 0,
      totalPages: 0,
      number: 0,
      size: 200,
    });

    renderPage();

    await waitFor(() => {
      expect(useAppBarStore.getState()).toMatchObject({
        title: "Promote or place students",
        backTo: "/school/students",
      });
    });
  });

  it("promotes the selected roster into a target class and session", async () => {
    vi.mocked(studentsApi.listStudents).mockResolvedValue({
      content: [STUDENT_VIEW],
      totalElements: 1,
      totalPages: 1,
      number: 0,
      size: 200,
    });
    vi.mocked(studentsApi.promoteStudents).mockResolvedValue({
      outcomes: [{ studentId: "student-1", success: true }],
    });
    const user = userEvent.setup();

    renderPage();

    await user.selectOptions(await screen.findByLabelText("Source class"), "class-1");
    await screen.findByText("Ada Obi");
    await user.selectOptions(screen.getByLabelText("Target session"), "session-2");
    await user.selectOptions(screen.getByLabelText("Target class"), "class-2");

    await user.click(screen.getByRole("button", { name: /Promote 1 student/ }));

    expect(studentsApi.promoteStudents).toHaveBeenCalledWith({
      sourceClassId: "class-1",
      targetClassId: "class-2",
      targetSessionId: "session-2",
      studentIds: ["student-1"],
    });
    expect(await screen.findByText("1 of 1 succeeded.")).toBeInTheDocument();
  });

  it("searches for and places individual students", async () => {
    vi.mocked(studentsApi.listStudents).mockResolvedValue({
      content: [STUDENT_VIEW],
      totalElements: 1,
      totalPages: 1,
      number: 0,
      size: 50,
    });
    vi.mocked(studentsApi.placeStudents).mockResolvedValue({
      outcomes: [{ studentId: "student-1", success: true }],
    });
    const user = userEvent.setup();

    renderPage();

    await user.click(screen.getByRole("button", { name: "Place students" }));
    await user.type(screen.getByPlaceholderText("Name or admission no."), "Ada");
    await screen.findByText("Ada Obi");
    await user.click(screen.getByLabelText("Select Ada Obi"));

    await user.selectOptions(screen.getByLabelText("Target session"), "session-2");
    await user.selectOptions(screen.getByLabelText("Target class"), "class-2");
    await user.click(screen.getByRole("button", { name: /Place 1 student/ }));

    expect(studentsApi.placeStudents).toHaveBeenCalledWith({
      targetClassId: "class-2",
      sessionId: "session-2",
      studentIds: ["student-1"],
    });
  });
});
