import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as authApi from "@/api/auth";
import { ApiError } from "@/api/client";
import { VerifyEmailPage } from "@/features/auth/VerifyEmailPage";
import { resetAuthStore, useAuthStore } from "@/stores/authStore";

vi.mock("@/api/auth");

function renderAt(path: string) {
  const router = createMemoryRouter([{ path: "/verify-email", element: <VerifyEmailPage /> }], {
    initialEntries: [path],
  });
  render(<RouterProvider router={router} />);
}

describe("VerifyEmailPage", () => {
  beforeEach(() => {
    resetAuthStore();
    vi.clearAllMocks();
  });

  it("confirms the token and refreshes a signed-in creator's session", async () => {
    useAuthStore.setState({
      user: {
        id: "user-1",
        email: "ada@creator.example",
        firstName: "Ada",
        lastName: "Lovelace",
        role: "CREATOR",
        emailVerified: false,
      },
      accessToken: "a",
      refreshToken: "r",
    });
    vi.mocked(authApi.confirmEmailVerification).mockResolvedValue();
    vi.mocked(authApi.refresh).mockResolvedValue({
      accessToken: "a2",
      refreshToken: "r2",
      user: {
        id: "user-1",
        email: "ada@creator.example",
        firstName: "Ada",
        lastName: "Lovelace",
        role: "CREATOR",
        emailVerified: true,
      },
    });

    renderAt("/verify-email?token=abc");

    expect(await screen.findByText("Your email address is verified. You're all set.")).toBeInTheDocument();
    expect(authApi.confirmEmailVerification).toHaveBeenCalledWith("abc");
    expect(useAuthStore.getState().user?.emailVerified).toBe(true);
  });

  it("explains an invalid or used link", async () => {
    vi.mocked(authApi.confirmEmailVerification).mockRejectedValue(
      new ApiError(422, "This verification link is invalid or has expired."),
    );

    renderAt("/verify-email?token=used");

    expect(await screen.findByText(/This verification link is invalid or has expired\./)).toBeInTheDocument();
  });

  it("rejects a link with no token without calling the API", async () => {
    renderAt("/verify-email");

    expect(await screen.findByText(/This verification link is incomplete\./)).toBeInTheDocument();
    expect(authApi.confirmEmailVerification).not.toHaveBeenCalled();
  });
});
