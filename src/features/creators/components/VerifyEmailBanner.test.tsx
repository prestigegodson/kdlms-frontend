import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as authApi from "@/api/auth";
import { ApiError } from "@/api/client";
import { VerifyEmailBanner } from "@/features/creators/components/VerifyEmailBanner";
import { type AuthenticatedUser, resetAuthStore, useAuthStore } from "@/stores/authStore";

vi.mock("@/api/auth", async () => {
  const actual = await vi.importActual<typeof import("@/api/auth")>("@/api/auth");
  return { ...actual, resendEmailVerification: vi.fn() };
});

const CREATOR: AuthenticatedUser = {
  id: "user-1",
  email: "ada@creator.example",
  firstName: "Ada",
  lastName: "Lovelace",
  role: "CREATOR",
  schoolId: "tenant-1",
  emailVerified: false,
};

describe("VerifyEmailBanner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAuthStore();
  });

  it("renders nothing once the creator's email is verified", () => {
    useAuthStore.setState({ user: { ...CREATOR, emailVerified: true } });

    const { container } = render(<VerifyEmailBanner />);

    expect(container).toBeEmptyDOMElement();
  });

  it("asks an unverified creator to verify and resends on request", async () => {
    useAuthStore.setState({ user: CREATOR });
    vi.mocked(authApi.resendEmailVerification).mockResolvedValue({});
    const user = userEvent.setup();

    render(<VerifyEmailBanner />);

    expect(screen.getByText("Verify your email address")).toBeInTheDocument();
    expect(screen.getByText("ada@creator.example")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Resend email" }));

    expect(await screen.findByText("Sent - check your inbox.")).toBeInTheDocument();
    expect(authApi.resendEmailVerification).toHaveBeenCalledTimes(1);
  });

  it("shows the server's message when a resend is refused", async () => {
    useAuthStore.setState({ user: CREATOR });
    vi.mocked(authApi.resendEmailVerification).mockRejectedValue(
      new ApiError(429, "We just sent you a verification email."),
    );
    const user = userEvent.setup();

    render(<VerifyEmailBanner />);
    await user.click(screen.getByRole("button", { name: "Resend email" }));

    expect(await screen.findByText("We just sent you a verification email.")).toBeInTheDocument();
  });
});
