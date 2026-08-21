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
  price: 500,
  currency: "NGN",
  multiBranch: false,
  branchLimit: 1,
  activeStudentLimit: 50,
  takeHomeQuiz: false,
  onDemandLearning: false,
  communication: false,
  timetable: false,
  lessonNotes: false,
  aiLessonNotes: false,
  aiGenerationLimit: 0,
  status: "ACTIVE",
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

  it("lists packages with their status", async () => {
    mockList([STARTER_PACKAGE]);

    render(<PackagesPage />);

    expect(await screen.findByText("Starter")).toBeInTheDocument();
    expect(screen.getByText("ACTIVE")).toBeInTheDocument();
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

  it("forces a branch limit of 1 when multi-branch is left unchecked", async () => {
    mockList([]);
    vi.mocked(packagesApi.createPackage).mockResolvedValue(STARTER_PACKAGE);
    const user = userEvent.setup();

    render(<PackagesPage />);
    await screen.findByText(/No packages yet/);

    await user.click(screen.getByRole("button", { name: "Add package" }));
    const dialog = await screen.findByRole("dialog");

    await user.type(within(dialog).getByLabelText("Name"), "Starter");
    await user.type(within(dialog).getByLabelText("Price"), "500");
    await user.type(within(dialog).getByLabelText("Active student limit"), "50");

    await user.click(within(dialog).getByRole("button", { name: "Save" }));

    expect(packagesApi.createPackage).toHaveBeenCalledWith(
      expect.objectContaining({ multiBranch: false, branchLimit: 1 }),
    );
  });
});
