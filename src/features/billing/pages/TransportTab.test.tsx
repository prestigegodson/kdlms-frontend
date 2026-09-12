import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as billingApi from "@/api/billing";
import type { TransportFareGridView, TransportRidersView, TransportRouteView } from "@/api/billing";
import * as branchesApi from "@/api/branches";
import * as classesApi from "@/api/classes";
import type { SchoolClassView } from "@/api/classes";
import * as sessionsApi from "@/api/sessions";
import type { AcademicSessionView } from "@/api/sessions";
import { TransportTab } from "@/features/billing/pages/TransportTab";
import { resetAuthStore, useAuthStore } from "@/stores/authStore";
import { resetBranchStore } from "@/stores/branchStore";
import { resetFeatureStore, useFeatureStore } from "@/stores/featureStore";

vi.mock("@/api/billing", async () => {
  const actual = await vi.importActual<typeof import("@/api/billing")>("@/api/billing");
  return {
    ...actual,
    listTransportRoutes: vi.fn(),
    createTransportRoute: vi.fn(),
    updateTransportRoute: vi.fn(),
    deleteTransportRoute: vi.fn(),
    getTransportFareGrid: vi.fn(),
    saveTransportFares: vi.fn(),
    copyTransportFares: vi.fn(),
    getTransportRiders: vi.fn(),
    saveTransportRiders: vi.fn(),
  };
});

vi.mock("@/api/sessions", async () => {
  const actual = await vi.importActual<typeof import("@/api/sessions")>("@/api/sessions");
  return { ...actual, listSessions: vi.fn() };
});

vi.mock("@/api/branches", async () => {
  const actual = await vi.importActual<typeof import("@/api/branches")>("@/api/branches");
  return { ...actual, listBranches: vi.fn() };
});

vi.mock("@/api/classes", async () => {
  const actual = await vi.importActual<typeof import("@/api/classes")>("@/api/classes");
  return { ...actual, listClasses: vi.fn() };
});

const SESSION: AcademicSessionView = {
  id: "session-1",
  schoolId: "school-1",
  name: "2026/2027",
  startDate: "2026-09-01",
  endDate: null,
  current: true,
};

const ROUTE: TransportRouteView = {
  id: "route-1",
  branchId: "branch-1",
  name: "Ikeja",
  description: null,
  active: true,
  position: 0,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

const FARE_GRID: TransportFareGridView = {
  branchId: "branch-1",
  branchName: "Main Campus",
  sessionId: "session-1",
  sessionName: "2026/2027",
  routes: [{ routeId: "route-1", routeName: "Ikeja", active: true, oneWayAmount: 30000, toAndFroAmount: 50000 }],
};

const CLASS: SchoolClassView = {
  id: "class-1",
  schoolId: "school-1",
  branchId: "branch-1",
  levelId: "level-1",
  name: "Primary 1A",
  status: "ACTIVE",
};

const RIDERS_VIEW: TransportRidersView = {
  classId: "class-1",
  sessionId: "session-1",
  routes: [{ routeId: "route-1", routeName: "Ikeja", oneWayPriced: true, toAndFroPriced: true }],
  students: [
    {
      enrollmentId: "enrollment-1",
      studentId: "student-1",
      studentName: "Ada Obi",
      admissionNumber: "SCH/2026/0001",
      routeId: null,
      direction: null,
    },
  ],
};

function signInAs(role: "SCHOOL_ADMIN" | "BRANCH_ADMIN") {
  useAuthStore.setState({
    user: {
      id: "user-1",
      email: "admin@school.example",
      firstName: "Ada",
      lastName: "Obi",
      role,
      schoolId: "school-1",
      branchId: role === "BRANCH_ADMIN" ? "branch-1" : undefined,
    },
    accessToken: "access",
    refreshToken: "refresh",
  });
  useFeatureStore.setState({ billing: true, status: "loaded" });
}

describe("TransportTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAuthStore();
    resetFeatureStore();
    resetBranchStore();
    signInAs("SCHOOL_ADMIN");
    vi.mocked(sessionsApi.listSessions).mockResolvedValue({
      content: [SESSION],
      totalElements: 1,
      totalPages: 1,
      number: 0,
      size: 50,
    });
    vi.mocked(branchesApi.listBranches).mockResolvedValue({
      content: [{ id: "branch-1", schoolId: "school-1", name: "Main Campus", main: true, status: "ACTIVE" }],
      totalElements: 1,
      totalPages: 1,
      number: 0,
      size: 50,
    });
    vi.mocked(classesApi.listClasses).mockResolvedValue({
      content: [CLASS],
      totalElements: 1,
      totalPages: 1,
      number: 0,
      size: 200,
    });
    vi.mocked(billingApi.listTransportRoutes).mockResolvedValue([ROUTE]);
    vi.mocked(billingApi.getTransportFareGrid).mockResolvedValue(FARE_GRID);
    vi.mocked(billingApi.getTransportRiders).mockResolvedValue(RIDERS_VIEW);
  });

  it("lists routes and their fares", async () => {
    render(<TransportTab />);

    // "Ikeja" appears twice - once in the Routes list, once as the Fares grid's own row label.
    expect(await screen.findAllByText("Ikeja")).toHaveLength(2);
    expect(await screen.findByDisplayValue("30000")).toBeInTheDocument();
    expect(await screen.findByDisplayValue("50000")).toBeInTheDocument();
  });

  it("adding a route calls createTransportRoute with the branch scope", async () => {
    const user = userEvent.setup();
    vi.mocked(billingApi.createTransportRoute).mockResolvedValue({ ...ROUTE, id: "route-2", name: "Yaba" });
    render(<TransportTab />);

    await screen.findAllByText("Ikeja");
    await user.click(screen.getByRole("button", { name: "Add route" }));
    const dialog = await screen.findByRole("dialog", { name: "Add route" });
    await user.type(within(dialog).getByLabelText("Name"), "Yaba");
    await user.click(within(dialog).getByRole("button", { name: "Add route" }));

    await waitFor(() =>
      expect(billingApi.createTransportRoute).toHaveBeenCalledWith(
        { name: "Yaba", description: null, active: true, position: 1 },
        "branch-1",
      ),
    );
  });

  it("editing a fare shows the unsaved-changes bar and saves on confirm", async () => {
    const user = userEvent.setup();
    vi.mocked(billingApi.saveTransportFares).mockResolvedValue({
      outcomes: [{ routeId: "route-1", success: true, message: null }],
    });
    render(<TransportTab />);

    const oneWayInput = await screen.findByLabelText("Ikeja one-way fare");
    await user.clear(oneWayInput);
    await user.type(oneWayInput, "32000");

    expect(await screen.findByText("1 unsaved change")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(billingApi.saveTransportFares).toHaveBeenCalledWith(
        "session-1",
        [{ routeId: "route-1", oneWayAmount: 32000, toAndFroAmount: 50000 }],
        "branch-1",
      ),
    );
  });

  it("assigning a rider a route and direction saves via saveTransportRiders", async () => {
    const user = userEvent.setup();
    vi.mocked(billingApi.saveTransportRiders).mockResolvedValue({
      outcomes: [{ enrollmentId: "enrollment-1", success: true, message: null }],
    });
    render(<TransportTab />);

    await user.selectOptions(await screen.findByLabelText("Class"), "class-1");
    await user.selectOptions(await screen.findByLabelText("Ada Obi route"), "route-1");
    await user.selectOptions(await screen.findByLabelText("Ada Obi direction"), "TO_AND_FRO");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(billingApi.saveTransportRiders).toHaveBeenCalledWith("class-1", "session-1", [
        { enrollmentId: "enrollment-1", routeId: "route-1", direction: "TO_AND_FRO" },
      ]),
    );
  });

  it("a BRANCH_ADMIN sees no branch picker", async () => {
    signInAs("BRANCH_ADMIN");
    render(<TransportTab />);

    await screen.findByText("Ikeja");
    expect(screen.queryByLabelText("Branch")).not.toBeInTheDocument();
  });
});
