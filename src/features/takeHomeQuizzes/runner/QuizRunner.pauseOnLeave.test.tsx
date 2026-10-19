import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AttemptClockView, QuizAttemptView } from "@/api/publicTakeHomeQuiz";
import { QuizRunner } from "@/features/takeHomeQuizzes/runner/QuizRunner";
import type { QuizTransport } from "@/features/takeHomeQuizzes/runner/quizTransport";

const NOW = new Date("2026-01-01T10:00:00Z").getTime();

function attemptView(deadlineInMs: number, pauseTimerOnLeave: boolean): QuizAttemptView {
  return {
    questions: [
      {
        id: "q1",
        position: 1,
        questionType: "SINGLE_CHOICE",
        prompt: "<p>1 + 1?</p>",
        points: 1,
        options: [{ id: "a", position: 1, label: "2" }],
        stimulusId: null,
      },
    ],
    answers: {},
    deadlineAt: new Date(NOW + deadlineInMs).toISOString(),
    serverTime: new Date(NOW).toISOString(),
    pauseTimerOnLeave,
  };
}

function clockIn(ms: number): AttemptClockView {
  return { deadlineAt: new Date(Date.now() + ms).toISOString(), serverTime: new Date(Date.now()).toISOString() };
}

function transport(heartbeat: () => Promise<AttemptClockView>) {
  return {
    bufferKey: `test-${crypto.randomUUID()}`,
    saveAnswers: vi.fn(),
    submit: vi.fn(async () => ({ alreadySubmitted: false, revealResults: false, serverTime: "" })),
    heartbeat: vi.fn(heartbeat),
    pause: vi.fn(async () => clockIn(0)),
    renderQuestionImage: () => null,
  } satisfies QuizTransport;
}

function renderRunner(attempt: QuizAttemptView, quizTransport: QuizTransport) {
  render(<QuizRunner initialAttempt={attempt} transport={quizTransport} onSubmitted={vi.fn()} onError={vi.fn()} />);
}

describe("QuizRunner pause-on-leave (V152)", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("heartbeats every 30 seconds while the quiz is open", async () => {
    const quizTransport = transport(async () => clockIn(10 * 60_000));
    renderRunner(attemptView(10 * 60_000, true), quizTransport);

    await act(() => vi.advanceTimersByTimeAsync(29_000));
    expect(quizTransport.heartbeat).not.toHaveBeenCalled();
    await act(() => vi.advanceTimersByTimeAsync(1_000));
    expect(quizTransport.heartbeat).toHaveBeenCalledTimes(1);
    await act(() => vi.advanceTimersByTimeAsync(30_000));
    expect(quizTransport.heartbeat).toHaveBeenCalledTimes(2);
  });

  it("never heartbeats or pauses a fixed timer", async () => {
    const quizTransport = transport(async () => clockIn(10 * 60_000));
    renderRunner(attemptView(10 * 60_000, false), quizTransport);

    await act(() => vi.advanceTimersByTimeAsync(90_000));
    window.dispatchEvent(new Event("pagehide"));
    expect(quizTransport.heartbeat).not.toHaveBeenCalled();
    expect(quizTransport.pause).not.toHaveBeenCalled();
  });

  it("pauses the clock as the page goes away", () => {
    const quizTransport = transport(async () => clockIn(10 * 60_000));
    renderRunner(attemptView(10 * 60_000, true), quizTransport);

    window.dispatchEvent(new Event("pagehide"));
    expect(quizTransport.pause).toHaveBeenCalledTimes(1);
  });

  it("checks with the server before auto-submitting, and keeps going when time was credited back", async () => {
    // The on-screen deadline is stale (a phone back from the background) - the server says 5 minutes remain.
    const quizTransport = transport(async () => clockIn(5 * 60_000));
    renderRunner(attemptView(2_000, true), quizTransport);

    await act(() => vi.advanceTimersByTimeAsync(3_000));
    expect(quizTransport.heartbeat).toHaveBeenCalledTimes(1);
    expect(quizTransport.submit).not.toHaveBeenCalled();
  });

  it("auto-submits when the server confirms time is up", async () => {
    const deadline = new Date(NOW + 1_000).toISOString();
    const quizTransport = transport(async () => ({ deadlineAt: deadline, serverTime: new Date(Date.now()).toISOString() }));
    renderRunner(attemptView(2_000, true), quizTransport);

    await act(() => vi.advanceTimersByTimeAsync(3_000));
    expect(quizTransport.heartbeat).toHaveBeenCalledTimes(1);
    expect(quizTransport.submit).toHaveBeenCalledTimes(1);
  });

  it("auto-submits a fixed timer at zero without asking", async () => {
    const quizTransport = transport(async () => clockIn(5 * 60_000));
    renderRunner(attemptView(2_000, false), quizTransport);

    await act(() => vi.advanceTimersByTimeAsync(3_000));
    expect(quizTransport.heartbeat).not.toHaveBeenCalled();
    expect(quizTransport.submit).toHaveBeenCalledTimes(1);
  });
});
