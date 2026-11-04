import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as feePaymentsApi from "@/api/feePayments";
import type { MyWardView } from "@/api/wards";
import { WardCreditSummary } from "@/features/guardian/components/WardCreditSummary";

vi.mock("@/api/feePayments", async () => {
  const actual = await vi.importActual<typeof import("@/api/feePayments")>("@/api/feePayments");
  return { ...actual, getWardCredit: vi.fn() };
});

const ADA = { studentId: "s1", fullName: "Ada Obi", schoolId: "school-1", schoolName: "Main" } as MyWardView;
const BEN = { studentId: "s2", fullName: "Ben Obi", schoolId: "school-1", schoolName: "Main" } as MyWardView;

describe("WardCreditSummary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows only the wards holding credit, with where it came from and where it went", async () => {
    vi.mocked(feePaymentsApi.getWardCredit).mockImplementation((studentId) =>
      Promise.resolve(
        studentId === "s1"
          ? {
              studentId,
              currency: "NGN",
              available: 2000,
              sources: [{ termId: "t1", termName: "First Term", sessionName: "2026/2027", available: 2000 }],
              targets: [],
              applications: [
                {
                  id: "a1",
                  version: 0,
                  sourceTermId: "t0",
                  targetTermId: "t2",
                  targetTermName: "Second Term",
                  amount: 500,
                  settlement: "PARTIAL",
                  status: "APPLIED",
                  appliedAt: "2026-11-04T10:00:00Z",
                },
              ],
            }
          : { studentId, currency: "NGN", available: 0, sources: [], targets: [], applications: [] },
      ),
    );

    render(
      <MemoryRouter>
        <WardCreditSummary wards={[ADA, BEN]} refreshKey={0} />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Ada Obi")).toBeInTheDocument();
    expect(screen.queryByText("Ben Obi")).not.toBeInTheDocument();
    expect(screen.getByText("Overpaid in First Term (2026/2027)")).toBeInTheDocument();
    expect(screen.getByText(/Applied to Second Term/)).toBeInTheDocument();
  });

  it("renders nothing when no ward has credit, or a wallet fails to load", async () => {
    vi.mocked(feePaymentsApi.getWardCredit).mockRejectedValue(new Error("nope"));
    const { container } = render(<WardCreditSummary wards={[ADA]} refreshKey={0} />);

    await waitFor(() => expect(feePaymentsApi.getWardCredit).toHaveBeenCalledWith("s1"));
    expect(container).toBeEmptyDOMElement();
  });
});
