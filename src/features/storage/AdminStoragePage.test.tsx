import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/api/client";
import * as storageApi from "@/api/storage";
import type { SchoolStorage, StorageOverview, StorageTieringRun } from "@/api/storage";
import { AdminStoragePage } from "@/features/storage/AdminStoragePage";
import { formatStorageSize } from "@/features/storage/format";

vi.mock("@/api/storage", async () => {
  const actual = await vi.importActual<typeof import("@/api/storage")>("@/api/storage");
  return {
    ...actual,
    getStorageOverview: vi.fn(),
    getStorageBySchool: vi.fn(),
    getTieringRuns: vi.fn(),
    startTieringRun: vi.fn(),
  };
});

const GB = 1024 ** 3;

function run(overrides: Partial<StorageTieringRun> = {}): StorageTieringRun {
  return {
    id: "run-1",
    trigger: "SCHEDULED",
    triggeredBy: null,
    status: "SUCCEEDED",
    queuedAt: "2026-10-24T01:00:00Z",
    startedAt: "2026-10-24T01:00:05Z",
    finishedAt: "2026-10-24T01:03:00Z",
    tally: { scanned: 120, toStandard: 2, toStandardIa: 30, toGlacierIr: 8, skipped: 0, failed: 1 },
    error: null,
    ...overrides,
  };
}

function overview(overrides: Partial<StorageOverview> = {}): StorageOverview {
  return {
    totalFiles: 1000,
    totalBytes: 10 * GB,
    byClass: [
      { storageClass: "STANDARD", files: 600, bytes: 4 * GB, filePercent: 60, bytePercent: 40, estimatedMonthlyCost: 0.09 },
      { storageClass: "STANDARD_IA", files: 300, bytes: 4 * GB, filePercent: 30, bytePercent: 40, estimatedMonthlyCost: 0.05 },
      { storageClass: "GLACIER_IR", files: 100, bytes: 2 * GB, filePercent: 10, bytePercent: 20, estimatedMonthlyCost: 0.01 },
    ],
    estimatedMonthlyCost: 0.15,
    estimatedMonthlyCostIfAllStandard: 0.23,
    tieringEnabled: true,
    activeRun: null,
    lastRun: run(),
    ...overrides,
  };
}

const SCHOOLS: SchoolStorage[] = [
  {
    schoolId: "s-1",
    schoolName: "Greenwood Academy",
    files: 900,
    bytes: 8 * GB,
    byClass: { STANDARD: { files: 500, bytes: 2 * GB }, STANDARD_IA: { files: 400, bytes: 6 * GB } },
  },
  { schoolId: null, schoolName: null, files: 100, bytes: 2 * GB, byClass: { STANDARD: { files: 100, bytes: 2 * GB } } },
];

function renderPage() {
  const router = createMemoryRouter([{ path: "/", element: <AdminStoragePage /> }], { initialEntries: ["/"] });
  render(<RouterProvider router={router} />);
}

describe("AdminStoragePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(storageApi.getStorageOverview).mockResolvedValue(overview());
    vi.mocked(storageApi.getStorageBySchool).mockResolvedValue(SCHOOLS);
    vi.mocked(storageApi.getTieringRuns).mockResolvedValue([run()]);
  });

  it("shows totals, the split per class and the savings", async () => {
    renderPage();

    expect(await screen.findByText("1,000")).toBeInTheDocument();
    expect(screen.getByText("10 GB")).toBeInTheDocument();
    expect(screen.getAllByText("Glacier Instant Retrieval").length).toBeGreaterThan(0);
    expect(screen.getByRole("img", { name: /Standard 40.0%, Infrequent Access 40.0%, Glacier Instant Retrieval 20.0%/ }))
      .toBeInTheDocument();
    // 0.23 - 0.15 saved
    expect(screen.getByText("US$0.08")).toBeInTheDocument();
  });

  it("switches the split between size and file count", async () => {
    renderPage();
    await screen.findByText("1,000");

    fireEvent.click(screen.getByRole("tab", { name: "By files" }));

    expect(screen.getByRole("img", { name: /Standard 60.0%, Infrequent Access 30.0%, Glacier Instant Retrieval 10.0%/ }))
      .toBeInTheDocument();
  });

  it("shows a segment's numbers on hover", async () => {
    renderPage();
    await screen.findByText("1,000");

    fireEvent.mouseEnter(screen.getByTestId("segment-GLACIER_IR"));

    expect(within(screen.getByRole("tooltip")).getByText(/100 files/)).toBeInTheDocument();
  });

  it("lists schools, naming system assets, and sorts by share tiered", async () => {
    renderPage();
    await screen.findByText("Greenwood Academy");
    expect(screen.getByText("Platform (system assets)")).toBeInTheDocument();
    expect(screen.getByText("75.0%")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "% tiered" }));

    const names = screen.getAllByText(/Greenwood Academy|Platform \(system assets\)/).map((node) => node.textContent);
    expect(names).toEqual(["Greenwood Academy", "Platform (system assets)"]);
  });

  it("starts a run and refreshes", async () => {
    vi.mocked(storageApi.startTieringRun).mockResolvedValue(run({ status: "QUEUED", trigger: "MANUAL" }));
    renderPage();
    await screen.findByText("1,000");

    fireEvent.click(screen.getByRole("button", { name: /Run now/ }));

    await waitFor(() => expect(storageApi.startTieringRun).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(storageApi.getStorageOverview).toHaveBeenCalledTimes(2));
  });

  it("shows why a run couldn't start", async () => {
    vi.mocked(storageApi.startTieringRun).mockRejectedValue(
      new ApiError(409, "A storage tiering run is already queued or running."),
    );
    renderPage();
    await screen.findByText("1,000");

    fireEvent.click(screen.getByRole("button", { name: /Run now/ }));

    expect(await screen.findByText("A storage tiering run is already queued or running.")).toBeInTheDocument();
  });

  it("disables Run now while tiering is off or a run is active", async () => {
    vi.mocked(storageApi.getStorageOverview).mockResolvedValue(overview({ tieringEnabled: false }));
    renderPage();

    expect(await screen.findByText("Tiering is turned off")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Run now/ })).toBeDisabled();
  });

  it("shows an error state when loading fails", async () => {
    vi.mocked(storageApi.getStorageOverview).mockRejectedValue(new ApiError(500, "Boom"));
    renderPage();

    expect(await screen.findByText("Boom")).toBeInTheDocument();
  });
});

describe("formatStorageSize", () => {
  it("scales past megabytes", () => {
    expect(formatStorageSize(512)).toBe("512 B");
    expect(formatStorageSize(1536)).toBe("1.5 KB");
    expect(formatStorageSize(3 * 1024 ** 4)).toBe("3.0 TB");
    expect(formatStorageSize(250 * 1024 ** 3)).toBe("250 GB");
  });
});
