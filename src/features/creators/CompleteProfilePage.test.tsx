import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as authApi from "@/api/auth";
import { ApiError } from "@/api/client";
import * as creatorsApi from "@/api/creators";
import { CompleteProfilePage } from "@/features/creators/CompleteProfilePage";
import { resetAuthStore, useAuthStore } from "@/stores/authStore";

vi.mock("@/api/auth");
vi.mock("@/api/creators", async () => {
  const actual = await vi.importActual<typeof import("@/api/creators")>("@/api/creators");
  return { ...actual, updateMyCreatorProfile: vi.fn() };
});

const INCOMPLETE_CREATOR = {
  id: "user-1",
  email: "ada@example.com",
  firstName: "Ada",
  lastName: "Lovelace",
  role: "CREATOR" as const,
  schoolId: "tenant-1",
  emailVerified: true,
  profileIncomplete: true,
};

function renderPage() {
  const router = createMemoryRouter(
    [
      { path: "/creator/complete-profile", element: <CompleteProfilePage /> },
      { path: "/creator", element: <div>Creator portal</div> },
      { path: "/login", element: <div>Login page</div> },
    ],
    { initialEntries: ["/creator/complete-profile"] },
  );
  render(<RouterProvider router={router} />);
}

describe("CompleteProfilePage", () => {
  beforeEach(() => {
    resetAuthStore();
    vi.clearAllMocks();
    useAuthStore.setState({ user: INCOMPLETE_CREATOR, accessToken: "a", refreshToken: "r" });
  });

  it("prefills the Google names, saves the profile, refreshes the session, and enters the portal", async () => {
    vi.mocked(creatorsApi.updateMyCreatorProfile).mockResolvedValue({} as creatorsApi.CreatorProfile);
    vi.mocked(authApi.refresh).mockResolvedValue({
      accessToken: "a2",
      refreshToken: "r2",
      user: { ...INCOMPLETE_CREATOR, profileIncomplete: false },
    });
    const user = userEvent.setup();
    renderPage();

    expect(screen.getByLabelText("First name")).toHaveValue("Ada");
    expect(screen.getByLabelText("Last name")).toHaveValue("Lovelace");
    await user.type(screen.getByLabelText("Business name"), "Analytical Tutors");
    await user.type(screen.getByLabelText("Contact address"), "1 Marina, Lagos");
    await user.type(screen.getByLabelText("Mobile number"), "+2348000000000");
    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(await screen.findByText("Creator portal")).toBeInTheDocument();
    expect(creatorsApi.updateMyCreatorProfile).toHaveBeenCalledWith(
      expect.objectContaining({ firstName: "Ada", businessName: "Analytical Tutors" }),
    );
    expect(authApi.refresh).toHaveBeenCalledWith("r");
    expect(useAuthStore.getState().user?.profileIncomplete).toBe(false);
  });

  it("shows the server's message when saving fails", async () => {
    vi.mocked(creatorsApi.updateMyCreatorProfile).mockRejectedValue(
      new ApiError(422, "'Mars/Olympus' is not a recognised timezone."),
    );
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText("Business name"), "Analytical Tutors");
    await user.type(screen.getByLabelText("Contact address"), "1 Marina, Lagos");
    await user.type(screen.getByLabelText("Mobile number"), "+2348000000000");
    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(await screen.findByText("'Mars/Olympus' is not a recognised timezone.")).toBeInTheDocument();
    expect(authApi.refresh).not.toHaveBeenCalled();
  });

  it("sends a creator whose profile is already complete straight to the portal", async () => {
    useAuthStore.setState({ user: { ...INCOMPLETE_CREATOR, profileIncomplete: false } });

    renderPage();

    expect(await screen.findByText("Creator portal")).toBeInTheDocument();
  });
});
