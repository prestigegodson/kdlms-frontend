import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as learnersApi from "@/api/learners";
import type { Learner, LearnerRoster } from "@/api/learners";
import * as virtualClassesApi from "@/api/virtualClasses";
import { LearnersPage } from "./LearnersPage";

vi.mock("@/api/learners");
vi.mock("@/api/virtualClasses", async () => {
  const actual = await vi.importActual<typeof import("@/api/virtualClasses")>("@/api/virtualClasses");
  return { ...actual, listVirtualClasses: vi.fn() };
});

function learner(overrides: Partial<Learner>): Learner {
  return {
    id: "l1",
    firstName: "Ada",
    lastName: "Adult",
    dateOfBirth: null,
    minor: false,
    kind: "ADULT",
    status: "ACTIVE",
    email: "ada@learner.example",
    loginId: null,
    guardians: [],
    classes: [{ id: "c1", name: "Algebra" }],
    inviteExpiresAt: null,
    editable: true,
    addedAt: "2026-10-01T08:00:00Z",
    ...overrides,
  };
}

function roster(learners: Learner[], guardianAccess = false): LearnerRoster {
  return { learners, guardianAccess, maxStudentsPerClass: 10 };
}

function renderPage() {
  const router = createMemoryRouter([{ path: "/creator/learners", element: <LearnersPage /> }], {
    initialEntries: ["/creator/learners"],
  });
  render(<RouterProvider router={router} />);
}

describe("LearnersPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(virtualClassesApi.listVirtualClasses).mockResolvedValue({
      classes: [
        {
          id: "c1",
          name: "Algebra",
          description: null,
          subjectLabel: null,
          status: "ACTIVE",
          startDate: "2026-10-01",
          endDate: null,
          overLimit: false,
          slots: [],
          createdAt: "2026-10-01T08:00:00Z",
        },
      ],
      maxClasses: 1,
      activeCount: 1,
      timezone: "Africa/Lagos",
    });
  });

  it("lists each kind of learner with its status and contact", async () => {
    vi.mocked(learnersApi.listLearners).mockResolvedValue(
      roster([
        learner({}),
        learner({
          id: "l2",
          firstName: "Kemi",
          lastName: "Minor",
          minor: true,
          kind: "MINOR_WITH_GUARDIAN",
          status: "INVITED",
          email: "parent@example.com",
          classes: [],
        }),
        learner({
          id: "l3",
          firstName: "Tobi",
          lastName: "Minor",
          minor: true,
          kind: "MINOR_WITH_LOGIN",
          email: null,
          loginId: "tobi-ab12cd",
        }),
      ]),
    );

    renderPage();

    expect(await screen.findByText("ada@learner.example")).toBeInTheDocument();
    expect(screen.getByText("Guardian: parent@example.com")).toBeInTheDocument();
    expect(screen.getByText("Login id: tobi-ab12cd")).toBeInTheDocument();
    expect(screen.getByText("Invited")).toBeInTheDocument();
  });

  it("shows a minor's generated credentials once after adding them without guardian access", async () => {
    vi.mocked(learnersApi.listLearners).mockResolvedValue(roster([]));
    vi.mocked(learnersApi.addLearner).mockResolvedValue({
      learner: learner({ firstName: "Tobi", lastName: "Minor", minor: true, kind: "MINOR_WITH_LOGIN" }),
      credentials: { loginId: "tobi-ab12cd", temporaryPassword: "Temp-Pass-123" },
    });

    renderPage();

    await userEvent.click((await screen.findAllByRole("button", { name: /Add learner/ }))[0]);
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByLabelText("A child (under 18)"));
    expect(within(dialog).queryByLabelText("Guardian's email")).not.toBeInTheDocument();
    await userEvent.type(within(dialog).getByLabelText("First name"), "Tobi");
    await userEvent.type(within(dialog).getByLabelText("Last name"), "Minor");
    await userEvent.click(within(dialog).getByLabelText("Algebra"));
    await userEvent.click(within(dialog).getByRole("button", { name: "Add learner" }));

    expect(await screen.findByText("tobi-ab12cd")).toBeInTheDocument();
    expect(screen.getByText("Temp-Pass-123")).toBeInTheDocument();
    expect(learnersApi.addLearner).toHaveBeenCalledWith({
      firstName: "Tobi",
      lastName: "Minor",
      dateOfBirth: null,
      minor: true,
      email: null,
      classIds: ["c1"],
    });
  });

  it("asks for the guardian's email for a minor when the plan has guardian access", async () => {
    vi.mocked(learnersApi.listLearners).mockResolvedValue(roster([], true));

    renderPage();

    await userEvent.click((await screen.findAllByRole("button", { name: /Add learner/ }))[0]);
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByLabelText("A child (under 18)"));

    expect(within(dialog).getByLabelText("Guardian's email")).toBeInTheDocument();
  });
});
