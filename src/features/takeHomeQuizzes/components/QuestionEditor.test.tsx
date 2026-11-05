import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect, useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { QuestionEditor } from "@/features/takeHomeQuizzes/components/QuestionEditor";
import { blankQuestion, type EditableQuestion } from "@/features/takeHomeQuizzes/editableQuestion";
import { blankStimulus, type EditableStimulus } from "@/features/takeHomeQuizzes/editableStimulus";
import { useFeatureStore } from "@/stores/featureStore";

let latest: EditableQuestion[] = [];

function Harness({
  initial,
  initialStimuli = [],
  answerKeyOnly = false,
  saveAs,
}: {
  initial: EditableQuestion[];
  initialStimuli?: EditableStimulus[];
  answerKeyOnly?: boolean;
  /** Stands in for a page's save: every unsaved row comes back with a server id as its key. */
  saveAs?: string;
}) {
  const [questions, setQuestions] = useState(initial);
  const [stimuli, setStimuli] = useState(initialStimuli);
  useEffect(() => {
    latest = questions;
  });
  return (
    <>
      <QuestionEditor
        questions={questions}
        onChange={setQuestions}
        stimuli={stimuli}
        onStimuliChange={setStimuli}
        answerKeyOnly={answerKeyOnly}
      />
      {saveAs && (
        <button
          type="button"
          onClick={() =>
            setQuestions((current) =>
              current.map((question, index) =>
                question.id === null ? { ...question, key: `${saveAs}${index}`, id: `${saveAs}${index}` } : question,
              ),
            )
          }
        >
          Save
        </button>
      )}
    </>
  );
}

function question(key: string, prompt: string, patch: Partial<EditableQuestion> = {}): EditableQuestion {
  return { ...blankQuestion(), key, id: key, prompt, ...patch };
}

afterEach(() => {
  useFeatureStore.getState().reset();
});

describe("QuestionEditor collapsing", () => {
  it("starts with every question open", () => {
    render(<Harness initial={[question("q1", "<p>One</p>"), question("q2", "<p>Two</p>")]} />);
    expect(screen.getByRole("button", { name: "Collapse question 1" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: "Collapse question 2" })).toHaveAttribute("aria-expanded", "true");
  });

  it("collapses the earlier questions when one is added and leaves the new one open", async () => {
    const user = userEvent.setup();
    render(<Harness initial={[question("q1", "<p>One</p>"), question("q2", "<p>Two</p>")]} />);

    await user.click(screen.getByRole("button", { name: "Add question" }));

    expect(screen.getByRole("button", { name: "Expand question 1" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("button", { name: "Expand question 2" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Collapse question 3" })).toBeInTheDocument();
    expect(screen.getByLabelText("Question 3 prompt")).toBeInTheDocument();
    expect(screen.queryByLabelText("Question 1 prompt")).not.toBeInTheDocument();
    expect(screen.getByText(/Single choice · One/)).toBeInTheDocument();
  });

  it("collapses the earlier questions when one is added to a passage", async () => {
    const user = userEvent.setup();
    const stimulus = blankStimulus("PASSAGE");
    render(
      <Harness initial={[question("q1", "<p>One</p>", { stimulusKey: stimulus.key })]} initialStimuli={[stimulus]} />,
    );

    await user.click(screen.getByRole("button", { name: /Add question to passage 1/ }));

    expect(screen.getByRole("button", { name: "Expand question 1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Collapse question 2" })).toBeInTheDocument();
  });

  it("reopens a collapsed question with its content intact", async () => {
    const user = userEvent.setup();
    render(<Harness initial={[question("q1", "<p>One</p>")]} />);

    await user.click(screen.getByRole("button", { name: "Collapse question 1" }));
    expect(screen.queryByLabelText("Question 1 prompt")).not.toBeInTheDocument();
    expect(latest[0].prompt).toBe("<p>One</p>");

    await user.click(screen.getByRole("button", { name: "Expand question 1" }));
    expect(screen.getByLabelText("Question 1 prompt")).toHaveTextContent("One");
  });

  it("names a question with no text yet", async () => {
    const user = userEvent.setup();
    render(<Harness initial={[question("q1", "")]} />);
    await user.click(screen.getByRole("button", { name: "Collapse question 1" }));
    expect(screen.getByText(/No text yet/)).toBeInTheDocument();
  });

  it("keeps a new question collapsed when saving gives it a server id", async () => {
    const user = userEvent.setup();
    render(<Harness initial={[question("q1", "<p>One</p>")]} saveAs="saved" />);

    await user.click(screen.getByRole("button", { name: "Add question" }));
    await user.click(screen.getByRole("button", { name: "Add question" }));
    expect(screen.getByRole("button", { name: "Expand question 2" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(latest[1].id).toBe("saved1");
    expect(screen.getByRole("button", { name: "Expand question 1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Expand question 2" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Collapse question 3" })).toBeInTheDocument();
  });

  it("offers the toggle in correction mode", () => {
    render(<Harness initial={[question("q1", "<p>One</p>")]} answerKeyOnly />);
    expect(screen.getByRole("button", { name: "Collapse question 1" })).toBeInTheDocument();
  });
});

describe("QuestionEditor duplicating", () => {
  it("inserts an unsaved copy after the original, collapses the rest and leaves the copy open", async () => {
    const user = userEvent.setup();
    render(<Harness initial={[question("q1", "<p>One</p>", { points: "4" }), question("q2", "<p>Two</p>")]} />);

    await user.click(screen.getByRole("button", { name: "Duplicate question 1" }));

    expect(latest.map((item) => item.prompt)).toEqual(["<p>One</p>", "<p>One</p>", "<p>Two</p>"]);
    expect(latest[1].id).toBeNull();
    expect(latest[1].points).toBe("4");
    expect(screen.getByRole("button", { name: "Expand question 1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Collapse question 2" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Expand question 3" })).toBeInTheDocument();
  });

  it("keeps a copy inside its passage", async () => {
    const user = userEvent.setup();
    const stimulus = blankStimulus("PASSAGE");
    render(
      <Harness
        initial={[question("q1", "<p>One</p>", { stimulusKey: stimulus.key }), question("q2", "<p>Two</p>")]}
        initialStimuli={[stimulus]}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Duplicate question 1" }));

    expect(latest.map((item) => item.stimulusKey)).toEqual([stimulus.key, stimulus.key, null]);
    expect(within(screen.getByRole("region", { name: "Passage 1" })).getByText("Question 2")).toBeInTheDocument();
  });

  it("is not offered in correction mode", () => {
    render(<Harness initial={[question("q1", "<p>One</p>")]} answerKeyOnly />);
    expect(screen.queryByRole("button", { name: "Duplicate question 1" })).not.toBeInTheDocument();
  });

  it("is not offered for an interactive question once the tenant has lost the feature", () => {
    useFeatureStore.setState({ interactiveQuestions: false });
    render(
      <Harness
        initial={[
          question("q1", "<p>One</p>", { questionType: "SEQUENCE", interaction: {} as EditableQuestion["interaction"] }),
          question("q2", "<p>Two</p>"),
        ]}
      />,
    );
    expect(screen.queryByRole("button", { name: "Duplicate question 1" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Duplicate question 2" })).toBeInTheDocument();
  });
});
