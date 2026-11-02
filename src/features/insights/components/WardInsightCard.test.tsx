import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/api/client";
import * as wardsApi from "@/api/wards";
import type { WardInsightsView, WardTermInsight } from "@/api/wards";
import { WardInsightCard } from "@/features/insights/components/WardInsightCard";

vi.mock("@/api/wards", async () => {
  const actual = await vi.importActual<typeof import("@/api/wards")>("@/api/wards");
  return { ...actual, getWardInsights: vi.fn() };
});

function term(overrides: Partial<WardTermInsight>): WardTermInsight {
  return {
    termId: "t-1",
    termName: "First Term",
    termNumber: 1,
    sessionName: "2026/2027",
    severity: "NONE",
    average: 70,
    attendanceRate: 95,
    reasons: [],
    computedAt: "2026-10-30T02:00:00Z",
    ...overrides,
  };
}

function view(terms: WardTermInsight[]): WardInsightsView {
  return { studentId: "s1", firstName: "Ada", computedAt: terms.length ? "2026-10-30T02:00:00Z" : null, terms };
}

describe("WardInsightCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("summarises the latest published term with its reasons and last term's numbers", async () => {
    vi.mocked(wardsApi.getWardInsights).mockResolvedValue(
      view([
        term({ termId: "t-1", average: 64, attendanceRate: 96 }),
        term({
          termId: "t-2",
          termName: "Second Term",
          termNumber: 2,
          severity: "AT_RISK",
          average: 51.5,
          attendanceRate: 72,
          reasons: [
            { signal: "AVERAGE_DROP", message: "Term average fell 12.5 points to 51.5.", detail: {} },
            { signal: "LOW_ATTENDANCE", message: "Attendance is 72% this term.", detail: {} },
          ],
        }),
      ]),
    );

    render(<WardInsightCard studentId="s1" firstName="Ada" />);

    expect(await screen.findByRole("heading", { name: "How Ada is doing" })).toBeInTheDocument();
    expect(screen.getByText("Needs some support")).toBeInTheDocument();
    expect(screen.getByText("Second Term, 2026/2027")).toBeInTheDocument();
    expect(screen.getByText("Term average fell 12.5 points to 51.5.")).toBeInTheDocument();
    expect(screen.getByText("Attendance is 72% this term.")).toBeInTheDocument();
    expect(screen.getByText("(last term 64)")).toBeInTheDocument();
    expect(screen.getByText("(last term 96%)")).toBeInTheDocument();
    expect(screen.getByText(/^Updated /)).toBeInTheDocument();
    expect(screen.queryByText(/position|of \d+/i)).not.toBeInTheDocument();
  });

  it("collapses to a title and severity badge that expands to the full summary", async () => {
    vi.mocked(wardsApi.getWardInsights).mockResolvedValue(
      view([
        term({
          severity: "WATCH",
          reasons: [{ signal: "LOW_ATTENDANCE", message: "Attendance is 80% this term.", detail: {} }],
        }),
      ]),
    );
    const user = userEvent.setup();

    render(<WardInsightCard studentId="s1" firstName="Ada" collapsible />);

    const toggle = await screen.findByRole("button", { name: /How Ada is doing/ });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText("Worth keeping an eye on")).toBeInTheDocument();
    expect(screen.queryByText("Attendance is 80% this term.")).not.toBeInTheDocument();

    await user.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Attendance is 80% this term.")).toBeInTheDocument();
    expect(screen.getAllByText("Worth keeping an eye on")).toHaveLength(1);
  });

  it("says when nothing needs attention", async () => {
    vi.mocked(wardsApi.getWardInsights).mockResolvedValue(view([term({})]));

    render(<WardInsightCard studentId="s1" firstName="Ada" />);

    expect(await screen.findByText("On track")).toBeInTheDocument();
    expect(screen.queryByText(/last term/)).not.toBeInTheDocument();
  });

  it("renders nothing when no term has been published yet", async () => {
    vi.mocked(wardsApi.getWardInsights).mockResolvedValue(view([]));

    const { container } = render(<WardInsightCard studentId="s1" firstName="Ada" />);

    await vi.waitFor(() => expect(wardsApi.getWardInsights).toHaveBeenCalledWith("s1"));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when the ward's school doesn't have insights", async () => {
    vi.mocked(wardsApi.getWardInsights).mockRejectedValue(
      new ApiError(403, "Student insights are not included in the current plan.", {
        type: "https://kdlms.com/problems/feature-not-included",
        detail: "Student insights are not included in the current plan.",
      }),
    );

    const { container } = render(<WardInsightCard studentId="s1" firstName="Ada" />);

    await vi.waitFor(() => expect(wardsApi.getWardInsights).toHaveBeenCalledWith("s1"));
    await Promise.resolve();
    expect(container).toBeEmptyDOMElement();
  });
});
