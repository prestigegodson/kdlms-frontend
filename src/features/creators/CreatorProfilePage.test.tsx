import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as creatorsApi from "@/api/creators";
import type { CreatorProfile } from "@/api/creators";
import * as filesApi from "@/api/files";
import * as schoolBrandingApi from "@/api/schoolBranding";
import { CreatorProfilePage } from "@/features/creators/CreatorProfilePage";
import { resetSchoolBrandingStore } from "@/stores/schoolBrandingStore";

vi.mock("@/api/tutorCurrencies");
vi.mock("@/api/schoolBranding");
vi.mock("@/api/creators", async () => {
  const actual = await vi.importActual<typeof import("@/api/creators")>("@/api/creators");
  return {
    ...actual,
    getMyCreatorProfile: vi.fn(),
    updateMyCreatorBranding: vi.fn(),
    updateMyCreatorBio: vi.fn(),
    updateMyPublicProfile: vi.fn(),
    checkPublicHandle: vi.fn((handle: string) => Promise.resolve({ handle, available: true, reason: null })),
  };
});
vi.mock("@/api/files", async () => {
  const actual = await vi.importActual<typeof import("@/api/files")>("@/api/files");
  return { ...actual, uploadFile: vi.fn(), downloadFile: vi.fn() };
});

const PROFILE: CreatorProfile = {
  schoolId: "tenant-1",
  firstName: "Ada",
  lastName: "Lovelace",
  businessName: "Ada's Studio",
  contactAddress: "1 Marina",
  mobile: "+2348000000000",
  timezone: "Africa/Lagos",
  currency: "NGN",
  logoFileId: "logo-1",
  bannerFileId: "banner-1",
  bio: null,
  publicHandle: null,
  publicProfileEnabled: false,
  joinRequestsEnabled: false,
  publicLinks: [],
  suggestedHandle: "adas-studio",
};

describe("CreatorProfilePage branding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSchoolBrandingStore();
    vi.mocked(creatorsApi.getMyCreatorProfile).mockResolvedValue(PROFILE);
    vi.mocked(filesApi.downloadFile).mockResolvedValue(new Blob(["img"], { type: "image/png" }));
    vi.mocked(schoolBrandingApi.getMySchoolBranding).mockResolvedValue({ schoolName: "Ada's Studio" });
  });

  it("uploads a new banner and saves it with the current logo", async () => {
    vi.mocked(filesApi.uploadFile).mockResolvedValue({
      fileId: "banner-2",
      fileName: "banner.png",
      contentType: "image/png",
      sizeBytes: 3,
    });
    vi.mocked(creatorsApi.updateMyCreatorBranding).mockResolvedValue({ ...PROFILE, bannerFileId: "banner-2" });
    const { container } = render(<CreatorProfilePage />);

    await screen.findByText("Branding");
    const inputs = container.querySelectorAll<HTMLInputElement>('input[type="file"]');
    await userEvent.upload(inputs[1], new File(["img"], "banner.png", { type: "image/png" }));

    expect(creatorsApi.updateMyCreatorBranding).toHaveBeenCalledWith({
      logoFileId: "logo-1",
      bannerFileId: "banner-2",
    });
    expect(await screen.findByText("Branding updated.")).toBeInTheDocument();
    // Only a logo change refreshes the sidebar's brand mark.
    expect(schoolBrandingApi.getMySchoolBranding).not.toHaveBeenCalled();
  });

  it("removes the logo and refreshes the sidebar", async () => {
    vi.mocked(creatorsApi.updateMyCreatorBranding).mockResolvedValue({ ...PROFILE, logoFileId: null });
    render(<CreatorProfilePage />);

    await screen.findByText("Branding");
    await userEvent.click(screen.getAllByRole("button", { name: /Remove/ })[0]);

    expect(creatorsApi.updateMyCreatorBranding).toHaveBeenCalledWith({
      logoFileId: null,
      bannerFileId: "banner-1",
    });
    expect(await screen.findByText("Branding updated.")).toBeInTheDocument();
    expect(schoolBrandingApi.getMySchoolBranding).toHaveBeenCalled();
  });

  it("shows an error when saving the branding fails", async () => {
    vi.mocked(creatorsApi.updateMyCreatorBranding).mockRejectedValue(new Error("boom"));
    render(<CreatorProfilePage />);

    await screen.findByText("Branding");
    await userEvent.click(screen.getAllByRole("button", { name: /Remove/ })[0]);

    expect(await screen.findByText("Failed to save branding")).toBeInTheDocument();
  });
});

describe("CreatorProfilePage bio", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSchoolBrandingStore();
    vi.mocked(creatorsApi.getMyCreatorProfile).mockResolvedValue({ ...PROFILE, bio: "Old bio" });
    vi.mocked(filesApi.downloadFile).mockResolvedValue(new Blob(["img"], { type: "image/png" }));
  });

  it("saves an edited bio", async () => {
    vi.mocked(creatorsApi.updateMyCreatorBio).mockResolvedValue({ ...PROFILE, bio: "Maths tutor" });
    render(<CreatorProfilePage />);

    const field = await screen.findByLabelText("Bio");
    expect(field).toHaveValue("Old bio");
    await userEvent.clear(field);
    await userEvent.type(field, "Maths tutor");
    await userEvent.click(screen.getByRole("button", { name: "Save bio" }));

    expect(creatorsApi.updateMyCreatorBio).toHaveBeenCalledWith("Maths tutor");
    expect(await screen.findByText("Bio updated.")).toBeInTheDocument();
  });

  it("clears the bio when saved blank", async () => {
    vi.mocked(creatorsApi.updateMyCreatorBio).mockResolvedValue({ ...PROFILE, bio: null });
    render(<CreatorProfilePage />);

    await userEvent.clear(await screen.findByLabelText("Bio"));
    await userEvent.click(screen.getByRole("button", { name: "Save bio" }));

    expect(creatorsApi.updateMyCreatorBio).toHaveBeenCalledWith(null);
  });
});

describe("CreatorProfilePage public page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSchoolBrandingStore();
    vi.mocked(creatorsApi.getMyCreatorProfile).mockResolvedValue(PROFILE);
    vi.mocked(filesApi.downloadFile).mockResolvedValue(new Blob(["img"], { type: "image/png" }));
    vi.mocked(schoolBrandingApi.getMySchoolBranding).mockResolvedValue({ schoolName: "Ada's Studio" });
    vi.mocked(creatorsApi.checkPublicHandle).mockImplementation((handle) =>
      Promise.resolve({ handle, available: true, reason: null }),
    );
  });

  it("offers the suggested link name and publishes the page with a contact link", async () => {
    const published = {
      ...PROFILE,
      publicHandle: "adas-studio",
      publicProfileEnabled: true,
      publicLinks: [{ platform: "WHATSAPP" as const, value: "+234 803 000 0000" }],
    };
    vi.mocked(creatorsApi.updateMyPublicProfile).mockResolvedValue(published);
    render(<CreatorProfilePage />);

    expect(await screen.findByLabelText("Link name")).toHaveValue("adas-studio");
    await userEvent.click(screen.getByRole("switch", { name: "Publish my public page" }));
    await userEvent.click(screen.getByRole("button", { name: "Add contact link" }));
    await userEvent.type(screen.getByLabelText("WhatsApp number"), "+234 803 000 0000");
    await userEvent.click(screen.getByRole("button", { name: "Save public page" }));

    expect(creatorsApi.updateMyPublicProfile).toHaveBeenCalledWith({
      handle: "adas-studio",
      enabled: true,
      joinRequestsEnabled: false,
      links: [{ platform: "WHATSAPP", value: "+234 803 000 0000" }],
    });
    expect(await screen.findByText("Your page is live")).toBeInTheDocument();
    expect(screen.getByLabelText("Your public page link")).toHaveValue(
      `${window.location.protocol}//${window.location.hostname}${window.location.port ? `:${window.location.port}` : ""}/tutors/adas-studio`,
    );
  });

  it("blocks saving a link name another tutor holds", async () => {
    vi.mocked(creatorsApi.checkPublicHandle).mockResolvedValue({
      handle: "taken-name",
      available: false,
      reason: "That link name is already taken.",
    });
    render(<CreatorProfilePage />);

    const input = await screen.findByLabelText("Link name");
    await userEvent.clear(input);
    await userEvent.type(input, "taken-name");

    expect(await screen.findByText("That link name is already taken.", {}, { timeout: 2000 })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save public page" })).toBeDisabled();
  });
});
