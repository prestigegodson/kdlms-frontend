import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TermProgressCard } from "@/features/dashboard/components/TermProgressCard";

describe("TermProgressCard", () => {
  it("shows the term's name, date range, and days remaining", () => {
    render(
      <TermProgressCard
        currentTerm={{ name: "Term 1", startDate: "2026-09-01", endDate: "2026-12-12", daysRemaining: 20 }}
      />,
    );

    expect(screen.getByText("Term 1")).toBeInTheDocument();
    expect(screen.getByText("Ends in 20 days")).toBeInTheDocument();
  });

  it("says 'ends today' rather than '0 days' on the last day of the term", () => {
    render(
      <TermProgressCard
        currentTerm={{ name: "Term 1", startDate: "2026-09-01", endDate: "2026-12-12", daysRemaining: 0 }}
      />,
    );

    expect(screen.getByText("Ends today")).toBeInTheDocument();
  });

  it("says the term ended N days ago, rather than showing a permanent 'ends today', once its end date has passed", () => {
    render(
      <TermProgressCard
        currentTerm={{ name: "Term 1", startDate: "2026-09-01", endDate: "2026-12-12", daysRemaining: -5 }}
      />,
    );

    expect(screen.getByText(/Ended 5 days ago/)).toBeInTheDocument();
    expect(screen.queryByText("Ends today")).not.toBeInTheDocument();
  });

  it("omits the next-term line when no term has been created yet after the current one", () => {
    render(
      <TermProgressCard
        currentTerm={{ name: "Term 1", startDate: "2026-09-01", endDate: "2026-12-12", daysRemaining: 20 }}
      />,
    );

    expect(screen.queryByText(/Next:/)).not.toBeInTheDocument();
  });

  it("names the next term and its start date when one exists", () => {
    render(
      <TermProgressCard
        currentTerm={{ name: "Term 1", startDate: "2026-09-01", endDate: "2026-12-12", daysRemaining: 20 }}
        nextTerm={{ name: "Term 2", startDate: "2027-01-10" }}
      />,
    );

    expect(screen.getByText("Term 2")).toBeInTheDocument();
    expect(screen.getByText(/10 January, 2027/)).toBeInTheDocument();
  });
});
