import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { QuizAnalytics, QuizQuestionStats } from "@/api/takeHomeQuizzes";
import { QuizAnalyticsPanel } from "@/features/takeHomeQuizzes/components/analytics/QuizAnalyticsPanel";
import { formatDuration } from "@/features/takeHomeQuizzes/components/analytics/formatDuration";

function question(overrides: Partial<QuizQuestionStats>): QuizQuestionStats {
  return {
    questionId: "q",
    position: 1,
    questionType: "SINGLE_CHOICE",
    prompt: "<p>Prompt</p>",
    points: 1,
    answeredCount: 2,
    correctCount: 1,
    correctPercent: 50,
    averagePoints: 0.5,
    options: [],
    commonWrongAnswers: [],
    distractorFlag: false,
    parts: [],
    ...overrides,
  };
}

const analytics: QuizAnalytics = {
  totalPoints: 2,
  participation: { rosterSize: 3, started: 2, submitted: 2, inProgress: 0, notStarted: 1 },
  scores: {
    mean: 1.5,
    median: 1.5,
    highest: 2,
    lowest: 1,
    standardDeviation: 0.5,
    meanPercent: 75,
    bands: Array.from({ length: 10 }, (_, i) => ({
      fromPercent: i * 10,
      toPercent: i * 10 + 10,
      count: 0,
    })),
  },
  timing: {
    durationMinutes: 30,
    measuredCount: 2,
    averageSeconds: 725,
    medianSeconds: 725,
    fastestSeconds: 600,
    slowestSeconds: 850,
    timedOutCount: 0,
    timedOutPercent: 0,
    averageTimeUsedPercent: 40.3,
  },
  questions: [
    question({
      questionId: "gap",
      position: 2,
      questionType: "FILL_IN_THE_GAP",
      prompt: "<p>Capital of Nigeria?</p>",
      correctPercent: 0,
      commonWrongAnswers: [{ answer: "Lagos", count: 2 }],
    }),
    question({
      questionId: "choice",
      position: 1,
      prompt: "<p>2 + 2?</p>",
      correctPercent: 50,
      distractorFlag: true,
      options: [
        {
          optionId: "a",
          position: 1,
          label: "<p>4</p>",
          correct: true,
          pickedCount: 1,
          pickedPercent: 50,
        },
        {
          optionId: "b",
          position: 2,
          label: "<p>5</p>",
          correct: false,
          pickedCount: 1,
          pickedPercent: 50,
        },
      ],
    }),
  ],
  tags: [],
};

describe("QuizAnalyticsPanel", () => {
  it("shows participation, timing and the questions in the server's hardest-first order", async () => {
    render(
      <QuizAnalyticsPanel load={() => Promise.resolve(analytics)} participantNoun="students" />,
    );

    expect(await screen.findByText("2 / 3")).toBeInTheDocument();
    expect(screen.getAllByText("12m 05s").length).toBeGreaterThan(0);
    const questions = screen.getAllByRole("button", { expanded: false });
    expect(questions[0]).toHaveTextContent("Question 2");
    expect(questions[0]).toHaveTextContent("0% correct");
    expect(questions[1]).toHaveTextContent("Check answer key");
  });

  it("expands a gap question into its common wrong answers", async () => {
    render(
      <QuizAnalyticsPanel load={() => Promise.resolve(analytics)} participantNoun="students" />,
    );

    await userEvent.click(await screen.findByRole("button", { name: /Question 2/ }));
    expect(screen.getByText("“Lagos”")).toBeInTheDocument();
  });

  it("expands an interactive question into its parts and their common confusions", async () => {
    const interactive: QuizAnalytics = {
      ...analytics,
      questions: [
        question({
          questionId: "match",
          position: 3,
          questionType: "MATCHING",
          prompt: "<p>Match each city</p>",
          averagePercent: 50,
          parts: [
            {
              partId: "kano",
              position: 2,
              label: "<p>Kano</p>",
              expectedLabel: "<p>North-west</p>",
              correctCount: 1,
              correctPercent: 25,
              unansweredCount: 1,
              topWrong: [{ ref: "ne", label: "<p>North-east</p>", count: 2 }],
            },
            {
              partId: "zone",
              position: 1,
              label: null,
              expectedLabel: null,
              correctCount: 4,
              correctPercent: 100,
              unansweredCount: 0,
              topWrong: [],
            },
          ],
        }),
      ],
    };
    render(<QuizAnalyticsPanel load={() => Promise.resolve(interactive)} participantNoun="students" />);

    await userEvent.click(await screen.findByRole("button", { name: /Question 3/ }));
    expect(screen.getByText("Kano")).toBeInTheDocument();
    expect(screen.getByText("North-west")).toBeInTheDocument();
    expect(screen.getByText("25% correct")).toBeInTheDocument();
    expect(screen.getByText("North-east")).toBeInTheDocument();
    expect(screen.getByText("1 left unanswered")).toBeInTheDocument();
    expect(screen.getByText("Pair 1")).toBeInTheDocument();
  });

  it("shows topic mastery only when a question is tagged", async () => {
    const { unmount } = render(
      <QuizAnalyticsPanel load={() => Promise.resolve(analytics)} participantNoun="students" />,
    );
    await screen.findByText("2 / 3");
    expect(screen.queryByText("Topic mastery")).not.toBeInTheDocument();
    unmount();

    const tagged: QuizAnalytics = {
      ...analytics,
      tags: [
        { tag: "photosynthesis", questionCount: 2, points: 4, averagePercent: 35.5 },
        { tag: "cells", questionCount: 1, points: 2, averagePercent: 80 },
      ],
    };
    render(<QuizAnalyticsPanel load={() => Promise.resolve(tagged)} participantNoun="students" />);
    expect(await screen.findByText("Topic mastery")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "photosynthesis: 35.5%" })).toBeInTheDocument();
    expect(screen.getByText("2 questions · 35.5%")).toBeInTheDocument();
  });

  it("shows an empty state until someone submits", async () => {
    const none: QuizAnalytics = {
      ...analytics,
      participation: { rosterSize: 3, started: 0, submitted: 0, inProgress: 0, notStarted: 3 },
    };
    render(
      <QuizAnalyticsPanel load={vi.fn(() => Promise.resolve(none))} participantNoun="learners" />,
    );

    expect(await screen.findByText("No learners have submitted yet")).toBeInTheDocument();
  });
});

describe("formatDuration", () => {
  it("formats seconds, minutes and hours", () => {
    expect(formatDuration(null)).toBe("—");
    expect(formatDuration(42)).toBe("42s");
    expect(formatDuration(725)).toBe("12m 05s");
    expect(formatDuration(3720)).toBe("1h 02m");
  });
});
