import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { createMemoryRouter, RouterProvider } from "react-router";
import type { Role } from "@/api/types";
import { RequireRole } from "@/routes/RequireRole";
import { resetAuthStore, useAuthStore } from "@/stores/authStore";
import { resetTeacherScopeStore, useTeacherScopeStore } from "@/stores/teacherScopeStore";

function renderGuarded(roles: Role[], allowLevelHead = false) {
  const router = createMemoryRouter(
    [
      { path: "/login", element: <div>Login page</div> },
      { path: "/admin", element: <div>Admin home</div> },
      { path: "/school", element: <div>School home</div> },
      { path: "/student", element: <div>Student home</div> },
      { path: "/set-password", element: <div>Set password page</div> },
      {
        path: "/protected",
        element: (
          <RequireRole roles={roles} allowLevelHead={allowLevelHead}>
            <div>Protected content</div>
          </RequireRole>
        ),
      },
    ],
    { initialEntries: ["/protected"] },
  );
  render(<RouterProvider router={router} />);
}

function signInAsTeacher() {
  useAuthStore.setState({
    user: { id: "1", email: "t@b.com", firstName: "T", lastName: "B", role: "TEACHER" },
    accessToken: "t",
    refreshToken: "r",
  });
}

describe("RequireRole", () => {
  beforeEach(() => {
    resetAuthStore();
    resetTeacherScopeStore();
  });

  describe("allowLevelHead", () => {
    it("admits a TEACHER who heads a level", async () => {
      signInAsTeacher();
      useTeacherScopeStore.setState({
        status: "loaded",
        capabilities: {
          isClassTeacher: false,
          classTeacherClassIds: [],
          subjectTeacherClassIds: [],
          headOfLevelIds: ["level-1"],
        },
      });

      renderGuarded(["SCHOOL_ADMIN", "BRANCH_ADMIN"], true);

      expect(await screen.findByText("Protected content")).toBeInTheDocument();
    });

    it("sends an ordinary TEACHER home", async () => {
      signInAsTeacher();
      useTeacherScopeStore.setState({
        status: "loaded",
        capabilities: {
          isClassTeacher: true,
          classTeacherClassIds: ["c"],
          subjectTeacherClassIds: [],
          headOfLevelIds: [],
        },
      });

      renderGuarded(["SCHOOL_ADMIN", "BRANCH_ADMIN"], true);

      expect(await screen.findByText("School home")).toBeInTheDocument();
    });

    it("renders nothing while the teacher's capabilities are still loading, rather than redirecting early", () => {
      signInAsTeacher();
      useTeacherScopeStore.setState({ status: "loading", capabilities: null });

      renderGuarded(["SCHOOL_ADMIN", "BRANCH_ADMIN"], true);

      expect(screen.queryByText("Protected content")).not.toBeInTheDocument();
      expect(screen.queryByText("School home")).not.toBeInTheDocument();
    });

    it("never admits a headship without the flag", async () => {
      signInAsTeacher();
      useTeacherScopeStore.setState({
        status: "loaded",
        capabilities: {
          isClassTeacher: false,
          classTeacherClassIds: [],
          subjectTeacherClassIds: [],
          headOfLevelIds: ["level-1"],
        },
      });

      renderGuarded(["SCHOOL_ADMIN", "BRANCH_ADMIN"]);

      expect(await screen.findByText("School home")).toBeInTheDocument();
    });
  });

  it("redirects to /login when there is no session", async () => {
    renderGuarded(["SYSTEM_ADMIN"]);

    expect(await screen.findByText("Login page")).toBeInTheDocument();
  });

  it("redirects to the user's own home when their role isn't allowed here, not /login", async () => {
    useAuthStore.setState({
      user: { id: "1", email: "a@b.com", firstName: "A", lastName: "B", role: "SCHOOL_ADMIN" },
      accessToken: "t",
      refreshToken: "r",
    });

    renderGuarded(["SYSTEM_ADMIN"]);

    expect(await screen.findByText("School home")).toBeInTheDocument();
    expect(screen.queryByText("Login page")).not.toBeInTheDocument();
  });

  it("renders the protected content when the role matches", async () => {
    useAuthStore.setState({
      user: { id: "1", email: "a@b.com", firstName: "A", lastName: "B", role: "SYSTEM_ADMIN" },
      accessToken: "t",
      refreshToken: "r",
    });

    renderGuarded(["SYSTEM_ADMIN"]);

    expect(await screen.findByText("Protected content")).toBeInTheDocument();
  });

  it("redirects a STUDENT to their own home when their role isn't allowed here", async () => {
    useAuthStore.setState({
      user: { id: "1", email: "grace-kdl24001", firstName: "Grace", lastName: "Ward", role: "STUDENT" },
      accessToken: "t",
      refreshToken: "r",
    });

    renderGuarded(["SYSTEM_ADMIN"]);

    expect(await screen.findByText("Student home")).toBeInTheDocument();
    expect(screen.queryByText("Login page")).not.toBeInTheDocument();
  });

  it("renders the protected content for a STUDENT when the route allows it", async () => {
    useAuthStore.setState({
      user: { id: "1", email: "grace-kdl24001", firstName: "Grace", lastName: "Ward", role: "STUDENT" },
      accessToken: "t",
      refreshToken: "r",
    });

    renderGuarded(["STUDENT"]);

    expect(await screen.findByText("Protected content")).toBeInTheDocument();
  });

  it("redirects to /set-password when the user still must change a temporary password, even though their role matches", async () => {
    useAuthStore.setState({
      user: {
        id: "1",
        email: "a@b.com",
        firstName: "A",
        lastName: "B",
        role: "SYSTEM_ADMIN",
        mustChangePassword: true,
      },
      accessToken: "t",
      refreshToken: "r",
    });

    renderGuarded(["SYSTEM_ADMIN"]);

    expect(await screen.findByText("Set password page")).toBeInTheDocument();
    expect(screen.queryByText("Protected content")).not.toBeInTheDocument();
  });

  it("renders nothing until the persisted session has hydrated", () => {
    useAuthStore.setState({ hydrated: false });

    renderGuarded(["SYSTEM_ADMIN"]);

    expect(screen.queryByText("Protected content")).not.toBeInTheDocument();
    expect(screen.queryByText("Login page")).not.toBeInTheDocument();
  });
});
