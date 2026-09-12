import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as billingApi from "@/api/billing";
import type { ClassBillExportView } from "@/api/billing";
import { BillExportCard } from "@/features/billing/components/BillExportCard";
import { downloadBlob } from "@/utils/download";

vi.mock("@/api/billing", async () => {
  const actual = await vi.importActual<typeof import("@/api/billing")>("@/api/billing");
  return {
    ...actual,
    createClassBillExport: vi.fn(),
    getClassBillExport: vi.fn(),
    downloadClassBillExport: vi.fn(),
  };
});

vi.mock("@/utils/download", () => ({ downloadBlob: vi.fn() }));

function job(overrides: Partial<ClassBillExportView>): ClassBillExportView {
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

describe("BillExportCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows a Generate button when no export has ever been requested", async () => {
    vi.mocked(billingApi.getClassBillExport).mockResolvedValue(null);
    render(<BillExportCard classId="class-1" termId="term-1" />);

    expect(await screen.findByRole("button", { name: "Generate class bills" })).toBeInTheDocument();
  });

  it("creates a job and shows the running progress bar once RUNNING", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    vi.mocked(billingApi.getClassBillExport).mockResolvedValue(null);
    vi.mocked(billingApi.createClassBillExport).mockImplementation(async () => {
      const queued = job({ status: "QUEUED" });
      // Mirrors real backend behaviour: once the job exists, a poll for it returns the same row
      // rather than the earlier "nothing yet" 404.
      vi.mocked(billingApi.getClassBillExport).mockResolvedValue(queued);
      return queued;
    });
    render(<BillExportCard classId="class-1" termId="term-1" />);

    await user.click(await screen.findByRole("button", { name: "Generate class bills" }));
    expect(billingApi.createClassBillExport).toHaveBeenCalledWith("class-1", "term-1");
    expect(await screen.findByText("Queued…")).toBeInTheDocument();

    vi.mocked(billingApi.getClassBillExport).mockResolvedValue(
      job({ status: "RUNNING", totalStudents: 10, renderedCount: 4 }),
    );
    await vi.advanceTimersByTimeAsync(3000);

    expect(await screen.findByText("4 of 10 rendered")).toBeInTheDocument();
  });

  it("shows Download/Regenerate once READY, and stops polling", async () => {
    vi.mocked(billingApi.getClassBillExport).mockResolvedValue(
      job({ status: "READY", totalStudents: 3, renderedCount: 3, fileName: "class-bills.zip", sizeBytes: 2048 }),
    );
    render(<BillExportCard classId="class-1" termId="term-1" />);

    expect(await screen.findByRole("button", { name: /Download ZIP/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Regenerate" })).toBeInTheDocument();
    expect(screen.getByText(/3 bills/)).toBeInTheDocument();

    // Polling stops on a terminal status - no further calls after the initial fetch.
    const callsAfterReady = vi.mocked(billingApi.getClassBillExport).mock.calls.length;
    await vi.advanceTimersByTimeAsync(10_000);
    expect(billingApi.getClassBillExport).toHaveBeenCalledTimes(callsAfterReady);
  });

  it("downloads the archive with the server's file name", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const blob = new Blob(["zip-bytes"]);
    vi.mocked(billingApi.getClassBillExport).mockResolvedValue(
      job({ status: "READY", totalStudents: 1, renderedCount: 1, fileName: "primary-1-first-term-bills.zip" }),
    );
    vi.mocked(billingApi.downloadClassBillExport).mockResolvedValue(blob);
    render(<BillExportCard classId="class-1" termId="term-1" />);

    await user.click(await screen.findByRole("button", { name: /Download ZIP/ }));

    await waitFor(() => expect(downloadBlob).toHaveBeenCalledWith(blob, "primary-1-first-term-bills.zip"));
  });

  it("shows the error and a retry action once FAILED", async () => {
    vi.mocked(billingApi.getClassBillExport).mockResolvedValue(
      job({ status: "FAILED", lastError: "No billable students in this class for this term." }),
    );
    render(<BillExportCard classId="class-1" termId="term-1" />);

    expect(await screen.findByText("No billable students in this class for this term.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});
