import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as branchesApi from "@/api/branches";
import * as classesApi from "@/api/classes";
import * as communicationApi from "@/api/communication";
import * as meApi from "@/api/me";
import { MessagesPage } from "@/features/communication/MessagesPage";
import { resetAuthStore, useAuthStore } from "@/stores/authStore";
import { resetBranchStore } from "@/stores/branchStore";
import { resetUnreadMessagesStore, useUnreadMessagesStore } from "@/stores/unreadMessagesStore";

vi.mock("@/api/me", async () => {
  const actual = await vi.importActual<typeof import("@/api/me")>("@/api/me");
  return { ...actual, listMyClasses: vi.fn() };
});

vi.mock("@/api/classes", async () => {
  const actual = await vi.importActual<typeof import("@/api/classes")>("@/api/classes");
  return { ...actual, listClasses: vi.fn() };
});

vi.mock("@/api/branches", async () => {
  const actual = await vi.importActual<typeof import("@/api/branches")>("@/api/branches");
  return { ...actual, listBranches: vi.fn() };
});

vi.mock("@/api/communication", async () => {
  const actual = await vi.importActual<typeof import("@/api/communication")>("@/api/communication");
  return { ...actual, getUnreadThreads: vi.fn() };
});

function renderAs(role: "TEACHER" | "SCHOOL_ADMIN", initialPath = "/") {
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
  const router = createMemoryRouter([{ path: "/", element: <MessagesPage /> }], {
    initialEntries: [initialPath],
  });
  render(<RouterProvider router={router} />);
}

describe("MessagesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetBranchStore();
    resetUnreadMessagesStore();
    vi.mocked(meApi.listMyClasses).mockResolvedValue([]);
    vi.mocked(classesApi.listClasses).mockResolvedValue({
      content: [],
      totalElements: 0,
      totalPages: 0,
      number: 0,
      size: 200,
    });
    vi.mocked(branchesApi.listBranches).mockResolvedValue({
      content: [{ id: "branch-1", schoolId: "school-1", name: "Main Branch", main: true, status: "ACTIVE" }],
      totalElements: 1,
      totalPages: 1,
      number: 0,
      size: 50,
    });
    vi.mocked(communicationApi.getUnreadThreads).mockResolvedValue({ threads: [], total: 0 });
  });

  it("shows the teacher's logging flow, with no compose control, for a TEACHER with no class-taught classes", async () => {
    renderAs("TEACHER");

    expect(await screen.findByText("No classes to log for")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Log a note" })).not.toBeInTheDocument();
  });

  it("shows the read-only admin overview for a SCHOOL_ADMIN, narrowed to the auto-selected branch", async () => {
    renderAs("SCHOOL_ADMIN");

    expect(
      await screen.findByText("Review the class communication log for any day."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Log a note" })).not.toBeInTheDocument();
    expect(await screen.findByLabelText("Branch")).toBeInTheDocument();
    expect(classesApi.listClasses).toHaveBeenCalledWith("branch-1", undefined, 0, 200);
  });

  it("defaults a TEACHER with no unread messages to the by-class-and-date board", async () => {
    renderAs("TEACHER");

    expect(await screen.findByRole("tab", { name: "By class & date" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Unread (0)" })).toHaveAttribute("aria-selected", "false");
    expect(communicationApi.getUnreadThreads).not.toHaveBeenCalled();
  });

  it("defaults a TEACHER with unread messages to the Unread tab and fetches the list", async () => {
    useUnreadMessagesStore.setState({ count: 3, status: "loaded" });
    vi.mocked(communicationApi.getUnreadThreads).mockResolvedValue({
      threads: [
        {
          threadId: "thread-1",
          studentId: "student-1",
          studentName: "Ada Obi",
          admissionNumber: "SCH/2026/0001",
          classId: "class-1",
          className: "Primary 1",
          category: "GENERAL",
          logDate: "2026-08-15",
          startedByName: "Mrs. Obi",
          lastMessageAt: "2026-08-15T09:00:00Z",
          replyCount: 1,
          guardianHasReplied: true,
          unread: true,
        },
      ],
      total: 1,
    });

    renderAs("TEACHER");

    expect(await screen.findByRole("tab", { name: "Unread (3)" })).toHaveAttribute("aria-selected", "true");
    expect(await screen.findByText("Ada Obi · Primary 1")).toBeInTheDocument();
    expect(communicationApi.getUnreadThreads).toHaveBeenCalled();
  });

  it("honours an explicit ?view=unread even with no unread messages", async () => {
    renderAs("TEACHER", "/?view=unread");

    expect(await screen.findByRole("tab", { name: "Unread (0)" })).toHaveAttribute("aria-selected", "true");
    expect(communicationApi.getUnreadThreads).toHaveBeenCalled();
  });
});
