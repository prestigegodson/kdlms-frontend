import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as creatorsApi from "@/api/creators";
import type { CreatorAdminView } from "@/api/creators";
import { CreatorDetailPage } from "@/features/creators/admin/CreatorDetailPage";

vi.mock("@/api/creators", async () => {
  const actual = await vi.importActual<typeof import("@/api/creators")>("@/api/creators");
  return { ...actual, getCreator: vi.fn(), deleteCreator: vi.fn() };
});

vi.mock("@/features/schools/SchoolDetailPage", () => ({
  SubscriptionCard: () => <div>Subscription</div>,
  FeatureGrantsCard: () => <div>Extra features</div>,
}));

const CREATOR: CreatorAdminView = {
  schoolId: "tenant-1",
  businessName: "Analytical Tutors",
  firstName: "Ada",
  lastName: "Lovelace",
  contactAddress: "1 Marina",
  mobile: "+2348000000000",
  timezone: "Africa/Lagos",
  currency: "NGN",
  status: "ACTIVE",
  userId: "user-1",
  email: "ada@creator.example",
  emailVerified: true,
  createdAt: "2026-10-03T10:00:00Z",
};

function renderPage() {
  const router = createMemoryRouter(
    [
      { path: "/admin/tutors/:schoolId", element: <CreatorDetailPage /> },
      { path: "/admin/tutors", element: <div>Tutors list</div> },
    ],
    { initialEntries: ["/admin/tutors/tenant-1"] },
  );
  render(<RouterProvider router={router} />);
}

describe("CreatorDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(creatorsApi.deleteCreator).mockResolvedValue(undefined);
  });

  it("deletes a tutor only after the admin types their email, then returns to the list", async () => {
    vi.mocked(creatorsApi.getCreator).mockResolvedValue(CREATOR);
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Delete tutor" }));
    const confirm = screen.getAllByRole("button", { name: "Delete tutor" }).at(-1)!;
    expect(confirm).toBeDisabled();

    await user.type(screen.getByLabelText(/to confirm/), "ada@creator.example");
    await user.click(confirm);

    expect(creatorsApi.deleteCreator).toHaveBeenCalledWith("tenant-1");
    expect(await screen.findByText("Tutors list")).toBeInTheDocument();
  });

  it("shows a deleted tutor as DELETED with no delete action", async () => {
    vi.mocked(creatorsApi.getCreator).mockResolvedValue({ ...CREATOR, status: "ARCHIVED" });
    renderPage();

    expect(await screen.findByText("DELETED")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete tutor" })).not.toBeInTheDocument();
  });
});
