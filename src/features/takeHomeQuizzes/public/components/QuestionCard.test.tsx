import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicQuestionView } from "@/api/publicTakeHomeQuiz";
import { QuestionCard } from "@/features/takeHomeQuizzes/public/components/QuestionCard";

const onChange = vi.fn();

/** Mirrors the public transport's own renderImage - see TakeHomeQuizPublicPage. */
function renderImage(fileId: string, alt: string) {
  return <img src={`/api/v1/public/take-home-quiz/tok123/images/${fileId}`} alt={alt} />;
}

function questionWithOptions(options: PublicQuestionView["options"]): PublicQuestionView {
  return {
    id: "q1",
    position: 1,
    questionType: "SINGLE_CHOICE",
    prompt: "<p>Which shape is a triangle?</p>",
    points: 1,
    options,
  };
}

describe("QuestionCard", () => {
  beforeEach(() => onChange.mockClear());

  it("renders an option's embedded image via the transport-supplied renderImage callback (Phase 35I)", () => {
    const question = questionWithOptions([
      { id: "opt-a", position: 1, label: '<img data-file-id="11111111-1111-1111-1111-111111111111" alt="triangle">' },
      { id: "opt-b", position: 2, label: '<img data-file-id="22222222-2222-2222-2222-222222222222" alt="square">' },
    ]);

    render(
      <QuestionCard
        question={question}
        answer={undefined}
        answered={false}
        onChange={onChange}
        renderImage={renderImage}
      />,
    );

    const image = screen.getByAltText("triangle") as HTMLImageElement;
    expect(image.src).toContain("/api/v1/public/take-home-quiz/tok123/images/11111111-1111-1111-1111-111111111111");
  });

  it("gives a picture-only option an accessible name so its radio is never nameless", () => {
    const question = questionWithOptions([
      { id: "opt-a", position: 1, label: '<img data-file-id="11111111-1111-1111-1111-111111111111">' },
      { id: "opt-b", position: 2, label: "Not this one" },
    ]);

    render(
      <QuestionCard
        question={question}
        answer={undefined}
        answered={false}
        onChange={onChange}
        renderImage={renderImage}
      />,
    );

    expect(screen.getByRole("radio", { name: "Option 1" })).toBeInTheDocument();
  });

  it("hides the radio and selects an option when its text is clicked", () => {
    const question = questionWithOptions([
      { id: "opt-a", position: 1, label: "<p>Triangle</p>" },
      { id: "opt-b", position: 2, label: "<p>Square</p>" },
    ]);

    render(
      <QuestionCard question={question} answer={undefined} answered={false} onChange={onChange} renderImage={renderImage} />,
    );

    expect(screen.getByRole("radio", { name: "Square" })).toHaveClass("sr-only");
    fireEvent.click(screen.getByText("Square"));
    expect(onChange).toHaveBeenCalledWith({ selectedOptionIds: ["opt-b"], textAnswer: null });
  });

  it("shows a pick-all hint for multi-choice and toggles options off again", () => {
    const question: PublicQuestionView = {
      ...questionWithOptions([
        { id: "opt-a", position: 1, label: "<p>Red</p>" },
        { id: "opt-b", position: 2, label: "<p>Blue</p>" },
      ]),
      questionType: "MULTI_CHOICE",
    };

    render(
      <QuestionCard
        question={question}
        answer={{ selectedOptionIds: ["opt-a", "opt-b"], textAnswer: null }}
        answered
        onChange={onChange}
        renderImage={renderImage}
      />,
    );

    expect(screen.getByText("Pick all that apply")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Red"));
    expect(onChange).toHaveBeenCalledWith({ selectedOptionIds: ["opt-b"], textAnswer: null });
  });

  it("lays short text options out as a grid but keeps image options in a list", () => {
    const shortQuestion = questionWithOptions([
      { id: "opt-a", position: 1, label: "<p>3</p>" },
      { id: "opt-b", position: 2, label: "<p>4</p>" },
    ]);
    const { unmount } = render(
      <QuestionCard question={shortQuestion} answer={undefined} answered={false} onChange={onChange} renderImage={renderImage} />,
    );
    expect(screen.getByTestId("question-options")).toHaveClass("grid");
    unmount();

    const imageQuestion = questionWithOptions([
      { id: "opt-a", position: 1, label: '<img data-file-id="11111111-1111-1111-1111-111111111111" alt="cat">' },
      { id: "opt-b", position: 2, label: "<p>Dog</p>" },
    ]);
    render(
      <QuestionCard question={imageQuestion} answer={undefined} answered={false} onChange={onChange} renderImage={renderImage} />,
    );
    expect(screen.getByTestId("question-options")).not.toHaveClass("grid");
  });
});
