import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as virtualClassesApi from "@/api/virtualClasses";
import type { VirtualClass, VirtualClassList } from "@/api/virtualClasses";
import { VirtualClassesPage } from "./VirtualClassesPage";

vi.mock("@/api/virtualClasses", async () => {
  const actual =
    await vi.importActual<typeof import("@/api/virtualClasses")>("@/api/virtualClasses");
  return { ...actual, listVirtualClasses: vi.fn(), createVirtualClass: vi.fn() };
});

function klass(overrides: Partial<VirtualClass>): VirtualClass {
  return {
    id: "c1",
    name: "Algebra",
    description: null,
    subjectLabel: "Maths",
    status: "ACTIVE",
    startDate: "2026-10-01",
    endDate: null,
    overLimit: false,
    slots: [{ id: "s1", dayOfWeek: 1, startTime: "09:00:00", durationMinutes: 60 }],
    createdAt: "2026-10-01T08:00:00Z",
    ...overrides,
  };
}

function renderPage() {
  const router = createMemoryRouter(
    [{ path: "/creator/classes", element: <VirtualClassesPage /> }],
    {
      initialEntries: ["/creator/classes"],
    },
  );
  render(<RouterProvider router={router} />);
}

describe("VirtualClassesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("flags a class beyond the plan limit and blocks adding another", async () => {
    const list: VirtualClassList = {
      classes: [klass({}), klass({ id: "c2", name: "Geometry", overLimit: true, slots: [] })],
      maxClasses: 1,
      activeCount: 2,
      timezone: "Africa/Lagos",
    };
    vi.mocked(virtualClassesApi.listVirtualClasses).mockResolvedValue(list);

    renderPage();

    expect(await screen.findByText("Geometry")).toBeInTheDocument();
    expect(screen.getByText("Over plan limit")).toBeInTheDocument();
    expect(screen.getByText("Mon 09:00–10:00")).toBeInTheDocument();
    expect(screen.getByText("Not scheduled yet")).toBeInTheDocument();
    expect(screen.getByText(/2 of 1 active class on your plan/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /new class/i })).toBeDisabled();
  });

  it("invites the creator to create their first class", async () => {
    vi.mocked(virtualClassesApi.listVirtualClasses).mockResolvedValue({
      classes: [],
      maxClasses: null,
      activeCount: 0,
      timezone: "Africa/Lagos",
    });

    renderPage();

    expect(await screen.findByText("No classes yet")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /new class/i })).toHaveLength(2);
  });
});
