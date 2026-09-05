import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as reportsApi from "@/api/reports";
import type { ClassReportExportView } from "@/api/reports";
import { ClassReportExportCard } from "@/features/reporting/components/ClassReportExportCard";
import { downloadBlob } from "@/utils/download";

vi.mock("@/api/reports", async () => {
  const actual = await vi.importActual<typeof import("@/api/reports")>("@/api/reports");
  return {
    ...actual,
    createClassReportExport: vi.fn(),
    getClassReportExport: vi.fn(),
    downloadClassReportExport: vi.fn(),
  };
});

vi.mock("@/utils/download", () => ({ downloadBlob: vi.fn() }));

function job(overrides: Partial<ClassReportExportView>): ClassReportExportView {
  return {
    id: "export-1",
    status: "QUEUED",
    totalStudents: 0,
    renderedCount: 0,
    failedCount: 0,
    fileName: null,
    sizeBytes: null,
    expiresAt: null,
    lastError: null,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("ClassReportExportCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows a Generate button when no export has ever been requested", async () => {
    vi.mocked(reportsApi.getClassReportExport).mockResolvedValue(null);
    render(<ClassReportExportCard classId="class-1" termId="term-1" scope="TERM" />);

    expect(await screen.findByRole("button", { name: "Generate class reports" })).toBeInTheDocument();
  });

  it("creates a job and shows the running progress bar once RUNNING", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    vi.mocked(reportsApi.getClassReportExport).mockResolvedValue(null);
    vi.mocked(reportsApi.createClassReportExport).mockImplementation(async () => {
      const queued = job({ status: "QUEUED" });
      // Mirrors real backend behaviour: once the job exists, a poll for it
      // returns the same row rather than the earlier "nothing yet" 404.
      vi.mocked(reportsApi.getClassReportExport).mockResolvedValue(queued);
      return queued;
    });
    render(<ClassReportExportCard classId="class-1" termId="term-1" scope="TERM" />);

    await user.click(await screen.findByRole("button", { name: "Generate class reports" }));
    expect(reportsApi.createClassReportExport).toHaveBeenCalledWith("class-1", "term-1", "TERM");
    expect(await screen.findByText("Queued…")).toBeInTheDocument();

    vi.mocked(reportsApi.getClassReportExport).mockResolvedValue(
      job({ status: "RUNNING", totalStudents: 10, renderedCount: 4 }),
    );
    await vi.advanceTimersByTimeAsync(3000);

    expect(await screen.findByText("4 of 10 rendered")).toBeInTheDocument();
  });

  it("shows Download/Regenerate once READY, and stops polling", async () => {
    vi.mocked(reportsApi.getClassReportExport).mockResolvedValue(
      job({ status: "READY", totalStudents: 3, renderedCount: 3, fileName: "class-reports.zip", sizeBytes: 2048 }),
    );
    render(<ClassReportExportCard classId="class-1" termId="term-1" scope="TERM" />);

    expect(await screen.findByRole("button", { name: /Download ZIP/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Regenerate" })).toBeInTheDocument();
    expect(screen.getByText(/3 reports/)).toBeInTheDocument();

    // Polling stops on a terminal status - no further calls after the initial fetch.
    const callsAfterReady = vi.mocked(reportsApi.getClassReportExport).mock.calls.length;
    await vi.advanceTimersByTimeAsync(10_000);
    expect(reportsApi.getClassReportExport).toHaveBeenCalledTimes(callsAfterReady);
  });

  it("downloads the archive with the server's file name", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const blob = new Blob(["zip-bytes"]);
    vi.mocked(reportsApi.getClassReportExport).mockResolvedValue(
      job({ status: "READY", totalStudents: 1, renderedCount: 1, fileName: "primary-1-first-term-reports.zip" }),
    );
    vi.mocked(reportsApi.downloadClassReportExport).mockResolvedValue(blob);
    render(<ClassReportExportCard classId="class-1" termId="term-1" scope="TERM" />);

    await user.click(await screen.findByRole("button", { name: /Download ZIP/ }));

    await waitFor(() => expect(downloadBlob).toHaveBeenCalledWith(blob, "primary-1-first-term-reports.zip"));
  });

  it("shows the error and a retry action once FAILED", async () => {
    vi.mocked(reportsApi.getClassReportExport).mockResolvedValue(
      job({ status: "FAILED", lastError: "No result template is available for this level yet." }),
    );
    render(<ClassReportExportCard classId="class-1" termId="term-1" scope="TERM" />);

    expect(await screen.findByText("No result template is available for this level yet.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});
