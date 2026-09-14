import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as billingApi from "@/api/billing";
import type { BillExportView } from "@/api/billing";
import { BillExportCard } from "@/features/billing/components/BillExportCard";
import { downloadBlob } from "@/utils/download";

vi.mock("@/api/billing", async () => {
  const actual = await vi.importActual<typeof import("@/api/billing")>("@/api/billing");
  return {
    ...actual,
    createBillExport: vi.fn(),
    getBillExport: vi.fn(),
    downloadBillExport: vi.fn(),
  };
});

vi.mock("@/utils/download", () => ({ downloadBlob: vi.fn() }));

function job(overrides: Partial<BillExportView>): BillExportView {
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

  it("shows the level-scoped heading, copy, and Generate button, and requests it with the branch and level ids", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    vi.mocked(billingApi.getBillExport).mockResolvedValue(null);
    vi.mocked(billingApi.createBillExport).mockResolvedValue(job({ status: "QUEUED" }));
    render(<BillExportCard levelId="level-1" branchId="branch-1" termId="term-1" />);

    expect(await screen.findByText("Level bills")).toBeInTheDocument();
    expect(screen.getByText(/advance bills for those not yet promoted/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Generate level bills" }));

    expect(billingApi.createBillExport).toHaveBeenCalledWith("level-1", "term-1", "branch-1");
  });

  it("creates a job and shows the running progress bar once RUNNING", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    vi.mocked(billingApi.getBillExport).mockResolvedValue(null);
    vi.mocked(billingApi.createBillExport).mockImplementation(async () => {
      const queued = job({ status: "QUEUED" });
      // Mirrors real backend behaviour: once the job exists, a poll for it returns the same row
      // rather than the earlier "nothing yet" 404.
      vi.mocked(billingApi.getBillExport).mockResolvedValue(queued);
      return queued;
    });
    render(<BillExportCard levelId="level-1" branchId="branch-1" termId="term-1" />);

    await user.click(await screen.findByRole("button", { name: "Generate level bills" }));
    expect(billingApi.createBillExport).toHaveBeenCalledWith("level-1", "term-1", "branch-1");
    expect(await screen.findByText("Queued…")).toBeInTheDocument();

    vi.mocked(billingApi.getBillExport).mockResolvedValue(
      job({ status: "RUNNING", totalStudents: 10, renderedCount: 4 }),
    );
    await vi.advanceTimersByTimeAsync(3000);

    expect(await screen.findByText("4 of 10 rendered")).toBeInTheDocument();
  });

  it("shows Download/Regenerate once READY, and stops polling", async () => {
    vi.mocked(billingApi.getBillExport).mockResolvedValue(
      job({ status: "READY", totalStudents: 3, renderedCount: 3, fileName: "level-bills.zip", sizeBytes: 2048 }),
    );
    render(<BillExportCard levelId="level-1" branchId="branch-1" termId="term-1" />);

    expect(await screen.findByRole("button", { name: /Download ZIP/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Regenerate" })).toBeInTheDocument();
    expect(screen.getByText(/3 bills/)).toBeInTheDocument();

    // Polling stops on a terminal status - no further calls after the initial fetch.
    const callsAfterReady = vi.mocked(billingApi.getBillExport).mock.calls.length;
    await vi.advanceTimersByTimeAsync(10_000);
    expect(billingApi.getBillExport).toHaveBeenCalledTimes(callsAfterReady);
  });

  it("downloads the archive with the server's file name", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const blob = new Blob(["zip-bytes"]);
    vi.mocked(billingApi.getBillExport).mockResolvedValue(
      job({ status: "READY", totalStudents: 1, renderedCount: 1, fileName: "primary-first-term-bills.zip" }),
    );
    vi.mocked(billingApi.downloadBillExport).mockResolvedValue(blob);
    render(<BillExportCard levelId="level-1" branchId="branch-1" termId="term-1" />);

    await user.click(await screen.findByRole("button", { name: /Download ZIP/ }));

    await waitFor(() => expect(downloadBlob).toHaveBeenCalledWith(blob, "primary-first-term-bills.zip"));
  });

  it("shows the error and a retry action once FAILED", async () => {
    vi.mocked(billingApi.getBillExport).mockResolvedValue(
      job({ status: "FAILED", lastError: "No billable students at this level for this term." }),
    );
    render(<BillExportCard levelId="level-1" branchId="branch-1" termId="term-1" />);

    expect(await screen.findByText("No billable students at this level for this term.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("polls with an omitted branchId for a BRANCH_ADMIN, whose branch the server derives", async () => {
    vi.mocked(billingApi.getBillExport).mockResolvedValue(null);
    render(<BillExportCard levelId="level-1" termId="term-1" />);

    await waitFor(() => expect(billingApi.getBillExport).toHaveBeenCalledWith("level-1", "term-1", undefined));
  });
});
