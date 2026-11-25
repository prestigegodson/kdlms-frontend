import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { formatCallDuration } from "../scheduleUtils";
import { LessonEndedView, type LessonEndedViewProps } from "./LessonEndedView";

function renderView(overrides: Partial<LessonEndedViewProps> = {}) {
  const props: LessonEndedViewProps = {
    className: "Maths 101",
    peerName: "Ada Obi",
    peerRole: "tutor",
    scheduledStart: "2026-11-25T14:00:00Z",
    scheduledEnd: "2026-11-25T15:00:00Z",
    mode: "direct",
    watched: false,
    tone: "complete",
    title: "Lesson ended",
    message: "The tutor ended the lesson.",
    durationMs: 42 * 60_000,
    home: "/learner",
    ...overrides,
  };
  const router = createMemoryRouter(
    [
      { path: "/ended", element: <LessonEndedView {...props} /> },
      { path: "/learner", element: <p>Learner home</p> },
    ],
    { initialEntries: ["/ended"] },
  );
  render(<RouterProvider router={router} />);
}

describe("LessonEndedView", () => {
  it("shows what happened and the class details", () => {
    renderView();
    expect(screen.getByRole("heading", { name: "Lesson ended" })).toBeInTheDocument();
    expect(screen.getByText("The tutor ended the lesson.")).toBeInTheDocument();
    expect(screen.getByText("Maths 101")).toBeInTheDocument();
    expect(screen.getByText("Ada Obi")).toBeInTheDocument();
    expect(screen.getByText("Tutor")).toBeInTheDocument();
    expect(screen.getByText("Time in call")).toBeInTheDocument();
    expect(screen.getByText("42 min")).toBeInTheDocument();
    expect(screen.getByText("One-on-one video")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Rejoin/ })).not.toBeInTheDocument();
  });

  it("hides the time in call when the call never connected", () => {
    renderView({ durationMs: null, peerName: null });
    expect(screen.queryByText("Time in call")).not.toBeInTheDocument();
    expect(screen.queryByText("Tutor")).not.toBeInTheDocument();
  });

  it("marks a guardian's lesson as watched and a group session's type", () => {
    renderView({ watched: true, mode: "group" });
    expect(screen.getByText("Watched")).toBeInTheDocument();
    expect(screen.getByText("Group live session")).toBeInTheDocument();
  });

  it("offers rejoin when it can, and goes home", async () => {
    const onRejoin = vi.fn();
    renderView({ onRejoin, tone: "left", title: "You left the lesson" });
    await userEvent.click(screen.getByRole("button", { name: /Rejoin/ }));
    expect(onRejoin).toHaveBeenCalledOnce();
    await userEvent.click(screen.getByRole("button", { name: /Back to home/ }));
    expect(await screen.findByText("Learner home")).toBeInTheDocument();
  });
});

describe("formatCallDuration", () => {
  it("formats minutes and hours", () => {
    expect(formatCallDuration(20_000)).toBe("Under a minute");
    expect(formatCallDuration(5 * 60_000)).toBe("5 min");
    expect(formatCallDuration(60 * 60_000)).toBe("1 h");
    expect(formatCallDuration(65 * 60_000)).toBe("1 h 5 min");
  });
});
