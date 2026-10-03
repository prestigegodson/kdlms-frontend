import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TermPaymentStatusBadge } from "@/features/billing/components/TermPaymentStatusBadge";

describe("TermPaymentStatusBadge", () => {
  it.each([
    ["UNPAID", "Unpaid"],
    ["PENDING_CONFIRMATION", "Pending confirmation"],
    ["PART_PAID", "Part-paid"],
    ["PAID_IN_FULL", "Paid in full"],
  ] as const)("labels %s as %s", (status, label) => {
    render(<TermPaymentStatusBadge status={status} hasPending={false} inCredit={false} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it("appends a pending marker to a settled state with a further submission waiting", () => {
    render(<TermPaymentStatusBadge status="PART_PAID" hasPending inCredit={false} />);
    expect(screen.getByText("Part-paid · pending")).toBeInTheDocument();
  });

  it("never doubles the marker on a pending-only state", () => {
    render(<TermPaymentStatusBadge status="PENDING_CONFIRMATION" hasPending inCredit={false} />);
    expect(screen.getByText("Pending confirmation")).toBeInTheDocument();
  });

  it("shows a credit in place of the state label", () => {
    render(<TermPaymentStatusBadge status="PAID_IN_FULL" hasPending={false} inCredit />);
    expect(screen.getByText("Credit")).toBeInTheDocument();
  });
});
