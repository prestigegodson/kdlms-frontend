import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as authApi from "@/api/auth";
import { ApiError } from "@/api/client";
import * as invitesApi from "@/api/invites";
import type { InviteDetails } from "@/api/invites";
import { InviteAcceptPage } from "@/features/invites/InviteAcceptPage";
import { resetAuthStore, useAuthStore } from "@/stores/authStore";

vi.mock("@/api/invites");
vi.mock("@/api/auth");

function invite(overrides: Partial<InviteDetails> = {}): InviteDetails {
  return {
    email: "lin@learner.example",
    role: "LEARNER",
    learnerName: "Lin Adult",
    creatorName: "Ada's Studio",
    firstName: "Lin",
    lastName: "Adult",
    accountExists: false,
    passwordRequired: true,
    nameRequired: false,
    ...overrides,
  };
}

function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      { path: "/invite/:token", element: <InviteAcceptPage /> },
      { path: "/learner", element: <h1>Learner home</h1> },
      { path: "/guardian", element: <h1>Guardian home</h1> },
      { path: "/login", element: <h1>Sign in</h1> },
    ],
    { initialEntries: [path] },
  );
  render(<RouterProvider router={router} />);
}

const session = {
  accessToken: "a",
  refreshToken: "r",
  user: { id: "u1", email: "lin@learner.example", firstName: "Lin", lastName: "Adult", role: "LEARNER" as const },
};

describe("InviteAcceptPage", () => {
  beforeEach(() => {
    resetAuthStore();
    vi.clearAllMocks();
    vi.mocked(authApi.getAuthConfig).mockResolvedValue({ googleClientId: null });
  });

  afterEach(() => {
    delete (window as { google?: unknown }).google;
  });

  it("sets a password and signs a new learner straight in", async () => {
    vi.mocked(invitesApi.previewInvite).mockResolvedValue(invite());
    vi.mocked(invitesApi.acceptInvite).mockResolvedValue({ signInRequired: false, session });

    renderAt("/invite/tok-1");

    expect(await screen.findByText(/Ada's Studio has invited you/)).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Choose a password"), "LearnerPass1!");
    await userEvent.type(screen.getByLabelText("Confirm password"), "LearnerPass1!");
    await userEvent.click(screen.getByRole("button", { name: "Accept and sign in" }));

    expect(await screen.findByRole("heading", { name: "Learner home" })).toBeInTheDocument();
    expect(invitesApi.acceptInvite).toHaveBeenCalledWith({
      token: "tok-1",
      password: "LearnerPass1!",
      firstName: null,
      lastName: null,
    });
    expect(useAuthStore.getState().user?.role).toBe("LEARNER");
  });

  it("asks a new guardian for their name and refuses mismatched passwords", async () => {
    vi.mocked(invitesApi.previewInvite).mockResolvedValue(
      invite({ role: "GUARDIAN", learnerName: "Kemi Obi", firstName: null, lastName: null, nameRequired: true }),
    );

    renderAt("/invite/tok-2");

    expect(await screen.findByText(/added Kemi Obi to their online classes/)).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("First name"), "Pat");
    await userEvent.type(screen.getByLabelText("Last name"), "Parent");
    await userEvent.type(screen.getByLabelText("Choose a password"), "Password-one");
    await userEvent.type(screen.getByLabelText("Confirm password"), "Password-two");
    await userEvent.click(screen.getByRole("button", { name: "Accept and sign in" }));

    expect(await screen.findByText("The two passwords don't match.")).toBeInTheDocument();
    expect(invitesApi.acceptInvite).not.toHaveBeenCalled();
  });

  it("tells an invitee who already has a password to sign in", async () => {
    vi.mocked(invitesApi.previewInvite).mockResolvedValue(invite({ accountExists: true, passwordRequired: false }));
    vi.mocked(invitesApi.acceptInvite).mockResolvedValue({ signInRequired: true, session: null });

    renderAt("/invite/tok-3");

    await userEvent.click(await screen.findByRole("button", { name: "Accept invitation" }));

    expect(await screen.findByText(/Sign in with your existing KDLMS password/)).toBeInTheDocument();
    expect(invitesApi.acceptInvite).toHaveBeenCalledWith({
      token: "tok-3",
      password: null,
      firstName: null,
      lastName: null,
    });
  });

  it("explains an invalid or expired link", async () => {
    vi.mocked(invitesApi.previewInvite).mockRejectedValue(
      new ApiError(422, "This invitation link is invalid or has expired."),
    );

    renderAt("/invite/expired");

    expect(await screen.findByText("This invitation link is invalid or has expired.")).toBeInTheDocument();
  });

  it("accepts with Google", async () => {
    let googleCallback: ((response: { credential: string }) => void) | undefined;
    (window as { google?: unknown }).google = {
      accounts: {
        id: {
          initialize: (config: { callback: (response: { credential: string }) => void }) => {
            googleCallback = config.callback;
          },
          renderButton: vi.fn(),
        },
      },
    };
    vi.mocked(authApi.getAuthConfig).mockResolvedValue({ googleClientId: "client.apps.googleusercontent.com" });
    vi.mocked(invitesApi.previewInvite).mockResolvedValue(invite());
    vi.mocked(authApi.googleSignIn).mockResolvedValue(session);

    renderAt("/invite/tok-4");

    await screen.findByTestId("google-signin");
    googleCallback?.({ credential: "google-id-token" });

    expect(await screen.findByRole("heading", { name: "Learner home" })).toBeInTheDocument();
    expect(authApi.googleSignIn).toHaveBeenCalledWith("google-id-token", "ACCEPT_INVITE", {
      subdomain: null,
      inviteToken: "tok-4",
    });
  });
});
