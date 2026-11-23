import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as joinRequestsApi from "@/api/joinRequests";
import type { JoinRequest } from "@/api/joinRequests";
import * as learnersApi from "@/api/learners";
import type { Page } from "@/api/types";
import * as virtualClassesApi from "@/api/virtualClasses";
import { JoinRequestsPage } from "@/features/creators/JoinRequestsPage";
import { resetJoinRequestsPendingStore } from "@/stores/joinRequestsPendingStore";

vi.mock("@/api/joinRequests");
vi.mock("@/api/learners");
vi.mock("@/api/virtualClasses");

const REQUEST: JoinRequest = {
  id: "req-1",
  name: "Bola Ade",
  email: "bola@example.com",
  phone: "0803 000 0000",
  message: "For my son, SS2.",
  status: "PENDING",
  createdAt: "2026-11-01T10:00:00Z",
  updatedAt: "2026-11-01T10:00:00Z",
  handledAt: null,
};

function page(content: JoinRequest[]): Page<JoinRequest> {
  return { content, totalElements: content.length, totalPages: 1, number: 0, size: 20 } as Page<JoinRequest>;
}

function renderPage() {
  render(
    <MemoryRouter>
      <JoinRequestsPage />
    </MemoryRouter>,
  );
}

describe("JoinRequestsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetJoinRequestsPendingStore();
    vi.mocked(joinRequestsApi.getPendingJoinRequestCount).mockResolvedValue({ count: 0 });
  });

  it("lists pending requests by default", async () => {
    vi.mocked(joinRequestsApi.listJoinRequests).mockResolvedValue(page([REQUEST]));
    renderPage();

    expect(await screen.findByText("Bola Ade")).toBeInTheDocument();
    expect(joinRequestsApi.listJoinRequests).toHaveBeenCalledWith("PENDING", 0);
    expect(screen.getByText("For my son, SS2.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "bola@example.com" })).toHaveAttribute("href", "mailto:bola@example.com");
  });

  it("shows an empty state that points to the public page settings", async () => {
    vi.mocked(joinRequestsApi.listJoinRequests).mockResolvedValue(page([]));
    renderPage();

    expect(await screen.findByText("No pending requests")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Public page settings" })).toHaveAttribute("href", "/tutor/profile");
  });

  it("dismisses a request", async () => {
    vi.mocked(joinRequestsApi.listJoinRequests)
      .mockResolvedValueOnce(page([REQUEST]))
      .mockResolvedValue(page([]));
    vi.mocked(joinRequestsApi.dismissJoinRequest).mockResolvedValue({ ...REQUEST, status: "DISMISSED" });
    renderPage();

    await userEvent.click(await screen.findByRole("button", { name: "Dismiss" }));

    expect(joinRequestsApi.dismissJoinRequest).toHaveBeenCalledWith("req-1");
    expect(await screen.findByText("Bola Ade's request was dismissed.")).toBeInTheDocument();
  });

  it("adds the person as a learner from a prefilled form and marks the request added", async () => {
    vi.mocked(joinRequestsApi.listJoinRequests)
      .mockResolvedValueOnce(page([REQUEST]))
      .mockResolvedValue(page([]));
    vi.mocked(learnersApi.listLearners).mockResolvedValue({
      learners: [],
      guardianAccess: false,
      maxStudentsPerClass: null,
    } as unknown as learnersApi.LearnerRoster);
    vi.mocked(virtualClassesApi.listVirtualClasses).mockResolvedValue({
      classes: [],
    } as unknown as Awaited<ReturnType<typeof virtualClassesApi.listVirtualClasses>>);
    vi.mocked(learnersApi.addLearner).mockResolvedValue({
      learner: { firstName: "Bola", lastName: "Ade" },
      credentials: null,
    } as unknown as learnersApi.AddLearnerResult);
    vi.mocked(joinRequestsApi.markJoinRequestAdded).mockResolvedValue({ ...REQUEST, status: "ADDED" });
    renderPage();

    await userEvent.click(await screen.findByRole("button", { name: "Add as learner" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByLabelText("First name")).toHaveValue("Bola");
    expect(within(dialog).getByLabelText("Last name")).toHaveValue("Ade");
    expect(within(dialog).getByLabelText("Email")).toHaveValue("bola@example.com");

    await userEvent.click(within(dialog).getByRole("button", { name: "Add learner" }));

    expect(learnersApi.addLearner).toHaveBeenCalledWith(
      expect.objectContaining({ firstName: "Bola", lastName: "Ade", email: "bola@example.com", minor: false }),
    );
    expect(joinRequestsApi.markJoinRequestAdded).toHaveBeenCalledWith("req-1");
    expect(await screen.findByText("Bola Ade was added as a learner.")).toBeInTheDocument();
  });
});
