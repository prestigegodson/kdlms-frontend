import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as packagesApi from "@/api/packages";
import type { PackageView } from "@/api/packages";
import { PackagesPage } from "@/features/packages/PackagesPage";

vi.mock("@/api/packages", async () => {
  const actual = await vi.importActual<typeof import("@/api/packages")>("@/api/packages");
  return {
    ...actual,
    listPackages: vi.fn(),
    createPackage: vi.fn(),
    updatePackage: vi.fn(),
    retirePackage: vi.fn(),
    reactivatePackage: vi.fn(),
  };
});

const STARTER_PACKAGE: PackageView = {
  id: "pkg-1",
  name: "Starter",
  description: undefined,
  billingCycle: "MONTHLY",
  audience: "SCHOOL",
  free: false,
  prices: [{ currency: "NGN", amountMinor: 50_000 }],
  multiBranch: false,
  branchLimit: 1,
  activeStudentLimit: 50,
  maxClasses: null,
  maxStudentsPerClass: null,
  maxSessionMinutes: null,
  maxParticipantsPerSession: null,
  maxMonthlySessionHours: null,
  takeHomeQuiz: false,
  onDemandLearning: false,
  communication: false,
  timetable: false,
  lessonNotes: false,
  aiLessonNotes: false,
  aiGenerationLimit: 0,
  billing: false,
  learningMedia: false,
  studentLogins: false,
  guardianAccess: false,
  status: "ACTIVE",
};

const FREE_PLAN: PackageView = {
  ...STARTER_PACKAGE,
  id: "pkg-free",
  name: "Free",
  audience: "CREATOR",
  free: true,
  prices: [],
  activeStudentLimit: null,
  maxClasses: 1,
  maxStudentsPerClass: 10,
};

function mockList(packages: PackageView[]) {
  vi.mocked(packagesApi.listPackages).mockResolvedValue({
    content: packages,
    totalElements: packages.length,
    totalPages: 1,
    number: 0,
    size: 20,
  });
}

describe("PackagesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists school packages with their price and status", async () => {
    mockList([STARTER_PACKAGE]);

    render(<PackagesPage />);

    expect(await screen.findByText("Starter")).toBeInTheDocument();
    expect(screen.getByText("ACTIVE")).toBeInTheDocument();
    expect(screen.getByText("₦500.00")).toBeInTheDocument();
    expect(packagesApi.listPackages).toHaveBeenCalledWith(0, 100, "SCHOOL");
  });

  it("retires an active package", async () => {
    mockList([STARTER_PACKAGE]);
    vi.mocked(packagesApi.retirePackage).mockResolvedValue(undefined);
    const user = userEvent.setup();

    render(<PackagesPage />);
    await screen.findByText("Starter");

    await user.click(screen.getByRole("button", { name: "Retire" }));

    expect(packagesApi.retirePackage).toHaveBeenCalledWith("pkg-1");
  });

  it("forces a branch limit of 1 when multi-branch is left unchecked and sends prices in minor units", async () => {
    mockList([]);
    vi.mocked(packagesApi.createPackage).mockResolvedValue(STARTER_PACKAGE);
    const user = userEvent.setup();

    render(<PackagesPage />);
    await screen.findByText(/No packages yet/);

    await user.click(screen.getByRole("button", { name: "Add package" }));
    const dialog = await screen.findByRole("dialog");

    await user.type(within(dialog).getByLabelText("Name"), "Starter");
    await user.type(within(dialog).getByLabelText("NGN"), "500.25");
    await user.type(within(dialog).getByLabelText("USD"), "4");
    await user.type(within(dialog).getByLabelText("Active student limit"), "50");

    await user.click(within(dialog).getByRole("button", { name: "Save" }));

    expect(packagesApi.createPackage).toHaveBeenCalledWith(
      expect.objectContaining({
        audience: "SCHOOL",
        multiBranch: false,
        branchLimit: 1,
        prices: [
          { currency: "NGN", amountMinor: 50_025 },
          { currency: "USD", amountMinor: 400 },
        ],
        maxClasses: null,
        guardianAccess: false,
      }),
    );
  });

  it("refuses to save a paid package with no price", async () => {
    mockList([]);
    const user = userEvent.setup();

    render(<PackagesPage />);
    await screen.findByText(/No packages yet/);

    await user.click(screen.getByRole("button", { name: "Add package" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("Name"), "Starter");
    await user.type(within(dialog).getByLabelText("Active student limit"), "50");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));

    expect(await within(dialog).findByText("Enter a price in at least one currency.")).toBeInTheDocument();
    expect(packagesApi.createPackage).not.toHaveBeenCalled();
  });

  it("shows creator plans on their own tab, with the free plan badged", async () => {
    mockList([STARTER_PACKAGE]);
    const user = userEvent.setup();

    render(<PackagesPage />);
    await screen.findByText("Starter");

    mockList([FREE_PLAN]);
    await user.click(screen.getByRole("tab", { name: "Creator" }));

    // Both the plan's name and its price cell's badge read "Free".
    expect(await screen.findAllByText("Free")).toHaveLength(2);
    expect(packagesApi.listPackages).toHaveBeenLastCalledWith(0, 100, "CREATOR");
    expect(screen.getByRole("columnheader", { name: "Learners per class" })).toBeInTheDocument();
  });

  it("creates a free creator plan with no prices and blank limits as unlimited", async () => {
    mockList([]);
    vi.mocked(packagesApi.createPackage).mockResolvedValue(FREE_PLAN);
    const user = userEvent.setup();

    render(<PackagesPage />);
    await screen.findByText(/No packages yet/);
    await user.click(screen.getByRole("tab", { name: "Creator" }));
    await screen.findByText(/No creator plans yet/);

    await user.click(screen.getByRole("button", { name: "Add creator plan" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).queryByLabelText("Active student limit")).not.toBeInTheDocument();
    expect(within(dialog).queryByLabelText("Timetables")).not.toBeInTheDocument();

    await user.type(within(dialog).getByLabelText("Name"), "Free");
    await user.click(within(dialog).getByLabelText("Free plan"));
    expect(within(dialog).queryByLabelText("NGN")).not.toBeInTheDocument();
    await user.type(within(dialog).getByLabelText("Max classes"), "1");
    await user.click(within(dialog).getByLabelText("Guardian access"));
    await user.click(within(dialog).getByRole("button", { name: "Save" }));

    expect(packagesApi.createPackage).toHaveBeenCalledWith(
      expect.objectContaining({
        audience: "CREATOR",
        free: true,
        prices: [],
        activeStudentLimit: null,
        maxClasses: 1,
        maxStudentsPerClass: null,
        timetable: false,
        guardianAccess: true,
      }),
    );
  });
});
