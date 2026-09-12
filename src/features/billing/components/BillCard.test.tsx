import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { BillView } from "@/api/billing";
import { BillCard } from "@/features/billing/components/BillCard";

const BASE: BillView = {
  studentId: "student-1",
  studentName: "Ada Obi",
  admissionNumber: "SCH/2026/0001",
  classId: "class-1",
  className: "Primary 1A",
  levelId: "level-1",
  levelName: "Primary",
  sessionId: "session-1",
  sessionName: "2026/2027",
  termId: "term-1",
  termName: "First Term",
  termNumber: 1,
  billReference: "SCH/2026/0001-T1",
  billable: true,
  chargedLines: [{ feeId: "fee-1", feeName: "Tuition", amount: 5000 }],
  optionalLines: [],
  transportFares: [],
  total: 5000,
  currency: "NGN",
  bankAccounts: [],
  instructions: null,
  advance: false,
};

describe("BillCard", () => {
  it("renders the Optional group's lines when present", () => {
    const bill: BillView = {
      ...BASE,
      optionalLines: [{ feeId: "fee-2", feeName: "Excursion", amount: 2500 }],
    };

    render(<BillCard bill={bill} />);

    expect(screen.getByText("Optional — not included in the total")).toBeInTheDocument();
    expect(screen.getByText("Excursion")).toBeInTheDocument();
  });

  it("omits the Optional heading when there are no optional lines", () => {
    render(<BillCard bill={BASE} />);

    expect(screen.queryByText("Optional — not included in the total")).not.toBeInTheDocument();
  });

  it("renders the School bus fare table with route rows, dashing an unpriced direction", () => {
    const bill: BillView = {
      ...BASE,
      transportFares: [
        { routeName: "Ikeja", oneWayAmount: 25000, toAndFroAmount: 45000 },
        { routeName: "Lekki", oneWayAmount: 30000, toAndFroAmount: null },
      ],
    };

    render(<BillCard bill={bill} />);

    expect(screen.getByText("School bus fares")).toBeInTheDocument();
    expect(screen.getByText(/already included in the charges above/)).toBeInTheDocument();
    expect(screen.getByText("Ikeja")).toBeInTheDocument();
    expect(screen.getByText("Lekki")).toBeInTheDocument();
    const dashes = screen.getAllByText("—");
    expect(dashes.length).toBeGreaterThan(0);
  });

  it("omits the School bus heading when there are no fare rows", () => {
    render(<BillCard bill={BASE} />);

    expect(screen.queryByText("School bus fares")).not.toBeInTheDocument();
  });
});
