import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as authApi from "@/api/auth";
import { GoogleSignInButton } from "@/features/auth/GoogleSignInButton";

vi.mock("@/api/auth");

describe("GoogleSignInButton", () => {
  let capturedCallback: ((response: { credential?: string }) => void) | undefined;
  const renderButton = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    capturedCallback = undefined;
    window.google = {
      accounts: {
        id: {
          initialize: (config) => {
            capturedCallback = config.callback;
          },
          renderButton,
        },
      },
    };
  });

  afterEach(() => {
    delete window.google;
  });

  it("renders nothing while Google sign-in is off", async () => {
    vi.mocked(authApi.getAuthConfig).mockResolvedValue({ googleClientId: null });

    render(<GoogleSignInButton mode="signin" onCredential={vi.fn()} after={<span>or</span>} />);

    await waitFor(() => expect(authApi.getAuthConfig).toHaveBeenCalled());
    expect(screen.queryByTestId("google-signin")).not.toBeInTheDocument();
    expect(screen.queryByText("or")).not.toBeInTheDocument();
    expect(renderButton).not.toHaveBeenCalled();
  });

  it("renders Google's button and hands its ID token to the page", async () => {
    vi.mocked(authApi.getAuthConfig).mockResolvedValue({ googleClientId: "client.apps.googleusercontent.com" });
    const onCredential = vi.fn();

    render(<GoogleSignInButton mode="signup" onCredential={onCredential} after={<span>or</span>} />);

    expect(await screen.findByTestId("google-signin")).toBeInTheDocument();
    expect(screen.getByText("or")).toBeInTheDocument();
    await waitFor(() => expect(renderButton).toHaveBeenCalled());
    expect(renderButton.mock.calls[0][1]).toMatchObject({ text: "signup_with" });

    capturedCallback?.({ credential: "google-id-token" });
    expect(onCredential).toHaveBeenCalledWith("google-id-token");
  });
});
