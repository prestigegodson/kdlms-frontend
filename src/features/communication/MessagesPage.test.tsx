import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as classesApi from "@/api/classes";
import * as meApi from "@/api/me";
import { MessagesPage } from "@/features/communication/MessagesPage";
import { resetAuthStore, useAuthStore } from "@/stores/authStore";

vi.mock("@/api/me", async () => {
  const actual = await vi.importActual<typeof import("@/api/me")>("@/api/me");
  return { ...actual, listMyClasses: vi.fn() };
});

vi.mock("@/api/classes", async () => {
  const actual = await vi.importActual<typeof import("@/api/classes")>("@/api/classes");
  return { ...actual, listClasses: vi.fn() };
});

function renderAs(role: "TEACHER" | "SCHOOL_ADMIN") {
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
    initialEntries: ["/"],
  });
  render(<RouterProvider router={router} />);
}

describe("MessagesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(meApi.listMyClasses).mockResolvedValue([]);
    vi.mocked(classesApi.listClasses).mockResolvedValue({
      content: [],
      totalElements: 0,
      totalPages: 0,
      number: 0,
      size: 200,
    });
  });

  it("shows the teacher's logging flow, with no compose control, for a TEACHER with no class-taught classes", async () => {
    renderAs("TEACHER");

    expect(await screen.findByText("No classes to log for")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Log a note" })).not.toBeInTheDocument();
  });

  it("shows the read-only admin overview for a SCHOOL_ADMIN", async () => {
    renderAs("SCHOOL_ADMIN");

    expect(
      await screen.findByText("Review the class communication log for any day."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Log a note" })).not.toBeInTheDocument();
  });
});
