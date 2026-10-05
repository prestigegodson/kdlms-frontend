import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as authApi from "@/api/auth";
import { ApiError } from "@/api/client";
import * as creatorsApi from "@/api/creators";
import { CreatorSignupPage } from "@/features/creators/CreatorSignupPage";
import { resetAuthStore } from "@/stores/authStore";

vi.mock("@/api/auth");
vi.mock("@/api/creators", async () => {
  const actual = await vi.importActual<typeof import("@/api/creators")>("@/api/creators");
  return { ...actual, registerCreator: vi.fn() };
});

function renderPage() {
  const router = createMemoryRouter(
    [
      { path: "/creators/signup", element: <CreatorSignupPage /> },
      { path: "/creator", element: <div>Creator portal</div> },
    ],
    { initialEntries: ["/creators/signup"] },
  );
  render(<RouterProvider router={router} />);
}

async function fillForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Email"), "ada@creator.example");
  await user.type(screen.getByLabelText("Password"), "CreatorPass123!");
  await user.type(screen.getByLabelText("First name"), "Ada");
  await user.type(screen.getByLabelText("Last name"), "Lovelace");
  await user.type(screen.getByLabelText("Business name"), "Analytical Tutors");
  await user.type(screen.getByLabelText("Contact address"), "1 Marina, Lagos");
  await user.type(screen.getByLabelText("Mobile number"), "+2348000000000");
}

describe("CreatorSignupPage", () => {
  beforeEach(() => {
    resetAuthStore();
    vi.clearAllMocks();
  });

  it("registers, signs in at the root domain, and lands in the creator portal", async () => {
    vi.mocked(creatorsApi.registerCreator).mockResolvedValue({ schoolId: "tenant-1", userId: "user-1" });
    vi.mocked(authApi.login).mockResolvedValue({
      accessToken: "a",
      refreshToken: "r",
      user: {
        id: "user-1",
        email: "ada@creator.example",
        firstName: "Ada",
        lastName: "Lovelace",
        role: "CREATOR",
        schoolId: "tenant-1",
        emailVerified: false,
      },
    });
    const user = userEvent.setup();

    renderPage();
    await fillForm(user);
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByText("Creator portal")).toBeInTheDocument();
    expect(creatorsApi.registerCreator).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "ada@creator.example",
        password: "CreatorPass123!",
        profile: expect.objectContaining({ businessName: "Analytical Tutors", currency: "NGN" }),
      }),
    );
    expect(authApi.login).toHaveBeenCalledWith("ada@creator.example", "CreatorPass123!", null);
  });

  it("shows the server's message when registration is refused", async () => {
    vi.mocked(creatorsApi.registerCreator).mockRejectedValue(
      new ApiError(422, "An account with this email already exists."),
    );
    const user = userEvent.setup();

    renderPage();
    await fillForm(user);
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByText("An account with this email already exists.")).toBeInTheDocument();
    expect(authApi.login).not.toHaveBeenCalled();
  });
});
