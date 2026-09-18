import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
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
});
