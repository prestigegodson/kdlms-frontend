import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as authApi from "@/api/auth";
import { ApiError } from "@/api/client";
import * as publicTutorsApi from "@/api/publicTutors";
import type { PublicTutorProfile } from "@/api/publicTutors";
import { PublicTutorPage } from "@/features/creators/public/PublicTutorPage";

vi.mock("@/api/auth", async () => {
  const actual = await vi.importActual<typeof import("@/api/auth")>("@/api/auth");
  return { ...actual, getAuthConfig: vi.fn() };
});
vi.mock("@/api/publicTutors", async () => {
  const actual = await vi.importActual<typeof import("@/api/publicTutors")>("@/api/publicTutors");
  return { ...actual, getPublicTutor: vi.fn(), submitJoinRequest: vi.fn() };
});

const PROFILE: PublicTutorProfile = {
  handle: "ada-maths",
  businessName: "Ada's Maths",
  tutorName: "Ada Lovelace",
  bio: "WAEC and JAMB prep.\nSmall groups.",
  logoVersion: "abc123",
  bannerVersion: null,
  links: [
    { platform: "WHATSAPP", value: "+234 803 000 0000" },
    { platform: "INSTAGRAM", value: "https://instagram.com/ada" },
  ],
  joinRequestsEnabled: true,
};

function renderPage(path = "/tutors/ada-maths") {
  const router = createMemoryRouter([{ path: "/tutors/:handle", element: <PublicTutorPage /> }], {
    initialEntries: [path],
  });
  render(<RouterProvider router={router} />);
}

describe("PublicTutorPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authApi.getAuthConfig).mockResolvedValue({ googleClientId: null, captchaSiteKey: null });
  });

  it("shows the tutor's public details and contact links", async () => {
    vi.mocked(publicTutorsApi.getPublicTutor).mockResolvedValue(PROFILE);
    renderPage();

    expect(await screen.findByRole("heading", { name: "Ada's Maths" })).toBeInTheDocument();
    expect(publicTutorsApi.getPublicTutor).toHaveBeenCalledWith("ada-maths");
    expect(screen.getByText("with Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText(/WAEC and JAMB prep/)).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Ada's Maths logo" })).toHaveAttribute(
      "src",
      expect.stringContaining("/api/v1/public/tutors/ada-maths/logo?v=abc123"),
    );
    const whatsapp = screen.getByRole("link", { name: /WhatsApp/ });
    expect(whatsapp).toHaveAttribute("href", "https://wa.me/2348030000000");
    expect(whatsapp).toHaveAttribute("rel", "nofollow noopener noreferrer");
    expect(screen.getByRole("link", { name: /Instagram/ })).toHaveAttribute("href", "https://instagram.com/ada");
  });

  it("says the page isn't available for an unknown or unpublished handle", async () => {
    vi.mocked(publicTutorsApi.getPublicTutor).mockResolvedValue(null);
    renderPage("/tutors/nobody");

    expect(await screen.findByRole("heading", { name: "This page isn't available" })).toBeInTheDocument();
  });

  it("hides the join form when the tutor doesn't take join requests", async () => {
    vi.mocked(publicTutorsApi.getPublicTutor).mockResolvedValue({ ...PROFILE, joinRequestsEnabled: false });
    renderPage();

    await screen.findByRole("heading", { name: "Ada's Maths" });
    expect(screen.queryByRole("heading", { name: "Request to join" })).not.toBeInTheDocument();
  });

  it("sends a join request and thanks the visitor", async () => {
    vi.mocked(publicTutorsApi.getPublicTutor).mockResolvedValue(PROFILE);
    vi.mocked(publicTutorsApi.submitJoinRequest).mockResolvedValue(undefined);
    renderPage();

    await userEvent.type(await screen.findByLabelText("Your name"), "Bola Ade");
    await userEvent.type(screen.getByLabelText("Email"), "bola@example.com");
    await userEvent.type(screen.getByLabelText("Message"), "For my son, SS2.");
    await userEvent.click(screen.getByRole("button", { name: "Send request" }));

    expect(publicTutorsApi.submitJoinRequest).toHaveBeenCalledWith("ada-maths", {
      name: "Bola Ade",
      email: "bola@example.com",
      phone: null,
      message: "For my son, SS2.",
      website: "",
      captchaToken: null,
    });
    expect(await screen.findByText(/Ada's Maths has your request/)).toBeInTheDocument();
  });

  it("shows the server's error when a request is refused", async () => {
    vi.mocked(publicTutorsApi.getPublicTutor).mockResolvedValue(PROFILE);
    vi.mocked(publicTutorsApi.submitJoinRequest).mockRejectedValue(
      new ApiError(400, "The CAPTCHA check failed. Please try again."),
    );
    renderPage();

    await userEvent.type(await screen.findByLabelText("Your name"), "Bola");
    await userEvent.type(screen.getByLabelText("Email"), "bola@example.com");
    await userEvent.click(screen.getByRole("button", { name: "Send request" }));

    expect(await screen.findByText("The CAPTCHA check failed. Please try again.")).toBeInTheDocument();
  });
});
