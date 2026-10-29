import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/api/client";
import * as featureGrantsApi from "@/api/featureGrants";
import * as packagesApi from "@/api/packages";
import type { PackageView } from "@/api/packages";
import * as subscriptionsApi from "@/api/subscriptions";
import { FeatureGrantsCard } from "@/features/schools/SchoolDetailPage";

vi.mock("@/api/featureGrants", () => ({
  listFeatureGrants: vi.fn(),
  saveFeatureGrant: vi.fn(),
  removeFeatureGrant: vi.fn(),
}));

vi.mock("@/api/packages", async () => {
  const actual = await vi.importActual<typeof import("@/api/packages")>("@/api/packages");
  return { ...actual, getPackage: vi.fn() };
});

vi.mock("@/api/subscriptions", async () => {
  const actual = await vi.importActual<typeof import("@/api/subscriptions")>("@/api/subscriptions");
  return { ...actual, getCurrentSubscription: vi.fn() };
});

const PACKAGE = { id: "pkg-1", timetable: true, staffAttendance: false } as PackageView;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(subscriptionsApi.getCurrentSubscription).mockResolvedValue({
    id: "sub-1",
    schoolId: "school-1",
    packageId: "pkg-1",
    packageName: "Basic",
    billingCycle: "ANNUAL",
    startDate: "2026-01-01",
    endDate: "2027-01-01",
    status: "ACTIVE",
    daysRemaining: 60,
  });
  vi.mocked(packagesApi.getPackage).mockResolvedValue(PACKAGE);
  vi.mocked(featureGrantsApi.listFeatureGrants).mockResolvedValue([]);
});

describe("FeatureGrantsCard", () => {
  it("marks package features as in package and lists school-only features", async () => {
    render(<FeatureGrantsCard schoolId="school-1" />);

    const timetable = await screen.findByLabelText("Timetables");
    expect(timetable).toBeChecked();
    expect(timetable).toBeDisabled();
    expect(screen.getByText("In package")).toBeInTheDocument();
    expect(screen.getByLabelText("Staff clock-in")).not.toBeChecked();
    expect(screen.queryByLabelText("Platform Video Conferencing")).not.toBeInTheDocument();
  });

  it("grants a feature the package lacks", async () => {
    vi.mocked(featureGrantsApi.saveFeatureGrant).mockResolvedValue({
      feature: "STAFF_ATTENDANCE",
      aiGenerationLimit: null,
      grantedAt: "2026-10-29T10:00:00Z",
    });
    render(<FeatureGrantsCard schoolId="school-1" />);

    await userEvent.click(await screen.findByLabelText("Staff clock-in"));

    expect(featureGrantsApi.saveFeatureGrant).toHaveBeenCalledWith("school-1", "STAFF_ATTENDANCE");
  });

  it("removes an existing grant", async () => {
    vi.mocked(featureGrantsApi.listFeatureGrants).mockResolvedValue([
      { feature: "STAFF_ATTENDANCE", aiGenerationLimit: null, grantedAt: "2026-10-29T10:00:00Z" },
    ]);
    vi.mocked(featureGrantsApi.removeFeatureGrant).mockResolvedValue();
    render(<FeatureGrantsCard schoolId="school-1" />);

    const staff = await screen.findByLabelText("Staff clock-in");
    expect(staff).toBeChecked();
    expect(screen.getByText("Extra")).toBeInTheDocument();
    await userEvent.click(staff);

    expect(featureGrantsApi.removeFeatureGrant).toHaveBeenCalledWith("school-1", "STAFF_ATTENDANCE");
  });

  it("needs a monthly limit before granting AI lesson notes", async () => {
    render(<FeatureGrantsCard schoolId="school-1" />);

    await userEvent.click(await screen.findByLabelText("AI lesson notes"));
    expect(featureGrantsApi.saveFeatureGrant).not.toHaveBeenCalled();
    expect(screen.getByText(/Enter the monthly AI generations/)).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("Monthly AI generations"), "40");
    await userEvent.click(screen.getByLabelText("AI lesson notes"));
    expect(featureGrantsApi.saveFeatureGrant).toHaveBeenCalledWith("school-1", "AI_LESSON_NOTES", 40);
  });

  it("still lists features when the school has no subscription", async () => {
    vi.mocked(subscriptionsApi.getCurrentSubscription).mockRejectedValue(new ApiError(404, "Not found"));
    render(<FeatureGrantsCard schoolId="school-1" />);

    await waitFor(() => expect(screen.getByLabelText("Timetables")).not.toBeChecked());
    expect(screen.queryByText("In package")).not.toBeInTheDocument();
  });
});
