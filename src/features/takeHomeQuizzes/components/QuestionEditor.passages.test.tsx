import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect, useState } from "react";
import { describe, expect, it } from "vitest";
import { QuestionEditor } from "@/features/takeHomeQuizzes/components/QuestionEditor";
import { blankQuestion, type EditableQuestion } from "@/features/takeHomeQuizzes/editableQuestion";
import type { EditableStimulus } from "@/features/takeHomeQuizzes/editableStimulus";

let latest: { questions: EditableQuestion[]; stimuli: EditableStimulus[] } = { questions: [], stimuli: [] };

function Harness({ initial }: { initial: EditableQuestion[] }) {
  const [questions, setQuestions] = useState(initial);
  const [stimuli, setStimuli] = useState<EditableStimulus[]>([]);
  useEffect(() => {
    latest = { questions, stimuli };
  });
  return (
    <QuestionEditor questions={questions} onChange={setQuestions} stimuli={stimuli} onStimuliChange={setStimuli} />
  );
}

describe("QuestionEditor passages (Phase 20L)", () => {
  it("adds a passage with its own first question and links an existing question to it", async () => {
    const user = userEvent.setup();
    render(<Harness initial={[{ ...blankQuestion(), key: "q1", prompt: "<p>Standalone</p>" }]} />);

    await user.click(screen.getByRole("button", { name: /Add passage \/ instruction/ }));
    const section = screen.getByRole("region", { name: "Passage 1" });
    expect(within(section).getByText("Question 2")).toBeInTheDocument();
    expect(latest.questions[1].stimulusKey).toBe(latest.stimuli[0].key);
    expect(within(section).getByRole("radio", { name: "Passage" })).toHaveAttribute("aria-checked", "true");

    await user.selectOptions(screen.getByLabelText("Passage", { selector: `#question-stimulus-q1` }), "Passage 1");
    expect(latest.questions.map((question) => question.stimulusKey)).toEqual([
      latest.stimuli[0].key,
      latest.stimuli[0].key,
    ]);
    expect(within(screen.getByRole("region", { name: "Passage 1" })).getByText("Questions 1–2 · Hide text"))
      .toBeInTheDocument();
  });

  it("switches a passage to an instruction, which has no paragraph labels", async () => {
    const user = userEvent.setup();
    render(<Harness initial={[]} />);
    await user.click(screen.getByRole("button", { name: /Add passage \/ instruction/ }));
    expect(screen.getByRole("switch", { name: "Label paragraphs A, B, C" })).toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: "Instruction" }));
    expect(screen.getByRole("region", { name: "Instruction 1" })).toBeInTheDocument();
    expect(screen.queryByRole("switch", { name: "Label paragraphs A, B, C" })).not.toBeInTheDocument();
    expect(latest.stimuli[0].kind).toBe("INSTRUCTION");
  });

  it("asks whether to keep a passage's questions when removing it", async () => {
    const user = userEvent.setup();
    render(<Harness initial={[]} />);
    await user.click(screen.getByRole("button", { name: /Add passage \/ instruction/ }));
    await user.click(screen.getByRole("button", { name: "Remove passage 1" }));
    await user.click(screen.getByRole("button", { name: "Keep the questions" }));

    expect(screen.queryByRole("region", { name: "Passage 1" })).not.toBeInTheDocument();
    expect(latest.stimuli).toEqual([]);
    expect(latest.questions).toHaveLength(1);
    expect(latest.questions[0].stimulusKey).toBeNull();
  });

  it("offers no passages without onStimuliChange", () => {
    render(<QuestionEditor questions={[]} onChange={() => {}} />);
    expect(screen.queryByRole("button", { name: /Add passage/ })).not.toBeInTheDocument();
  });
});
