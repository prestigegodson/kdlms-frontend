import { describe, expect, it } from "vitest";
import { blankQuestion, type EditableQuestion } from "@/features/takeHomeQuizzes/editableQuestion";
import {
  addQuestionToStimulus,
  blankStimulus,
  canMoveQuestion,
  editorSections,
  moveQuestion,
  moveStimulusRun,
  relinkQuestion,
  removeStimulus,
  toContentCommands,
} from "@/features/takeHomeQuizzes/editableStimulus";

function q(key: string, stimulusKey: string | null = null): EditableQuestion {
  return { ...blankQuestion(), key, prompt: `<p>${key}</p>`, stimulusKey };
}

const keys = (questions: EditableQuestion[]) => questions.map((question) => question.key);

describe("editableStimulus", () => {
  it("groups each passage's run into one section and lists an unused passage last", () => {
    const passage = { ...blankStimulus(), key: "p1" };
    const unused = { ...blankStimulus("INSTRUCTION"), key: "p2" };
    const sections = editorSections([passage, unused], [q("a"), q("b", "p1"), q("c", "p1"), q("d")]);
    expect(sections.map((section) => (section.kind === "question" ? section.question.key : section.stimulus.key)))
      .toEqual(["a", "p1", "d", "p2"]);
    const first = sections[1];
    expect(first.kind === "stimulus" && first.questions.map((entry) => entry.index)).toEqual([1, 2]);
  });

  it("keeps a linked question inside its passage and steps a standalone question over a whole passage", () => {
    const questions = [q("a"), q("b", "p1"), q("c", "p1"), q("d")];
    expect(canMoveQuestion(questions, 1, -1)).toBe(false);
    expect(keys(moveQuestion(questions, 1, -1))).toEqual(["a", "b", "c", "d"]);
    expect(keys(moveQuestion(questions, 1, 1))).toEqual(["a", "c", "b", "d"]);
    expect(keys(moveQuestion(questions, 0, 1))).toEqual(["b", "c", "a", "d"]);
    expect(keys(moveQuestion(questions, 3, -1))).toEqual(["a", "d", "b", "c"]);
  });

  it("moves a passage's whole run past its neighbour", () => {
    const questions = [q("a"), q("b", "p1"), q("c", "p1"), q("d", "p2"), q("e", "p2")];
    expect(keys(moveStimulusRun(questions, "p1", -1))).toEqual(["b", "c", "a", "d", "e"]);
    expect(keys(moveStimulusRun(questions, "p1", 1))).toEqual(["a", "d", "e", "b", "c"]);
  });

  it("re-links a question to the end of the target run, or just after the run it leaves", () => {
    const questions = [q("a"), q("b", "p1"), q("c", "p1"), q("d")];
    const linked = relinkQuestion(questions, 0, "p1");
    expect(keys(linked)).toEqual(["b", "c", "a", "d"]);
    expect(linked[2].stimulusKey).toBe("p1");
    const unlinked = relinkQuestion(questions, 1, null);
    expect(keys(unlinked)).toEqual(["a", "c", "b", "d"]);
    expect(unlinked[2].stimulusKey).toBeNull();
    expect(keys(relinkQuestion([q("x", "p9")], 0, null))).toEqual(["x"]);
  });

  it("adds to the end of a run and removes a passage keeping or dropping its questions", () => {
    const questions = [q("a", "p1"), q("b")];
    const added = addQuestionToStimulus(questions, "p1");
    expect(added[1].stimulusKey).toBe("p1");
    expect(added[2].key).toBe("b");

    const passage = { ...blankStimulus(), key: "p1" };
    const kept = removeStimulus([passage], questions, "p1", true);
    expect(kept.stimuli).toEqual([]);
    expect(kept.questions.map((question) => question.stimulusKey)).toEqual([null, null]);
    expect(keys(removeStimulus([passage], questions, "p1", false).questions)).toEqual(["b"]);
  });

  it("sends each link as an index into the save's stimuli", () => {
    const passage = { ...blankStimulus(), key: "p1", body: "<p>Text</p>", title: "  The Bee ", paragraphLabels: true };
    const instruction = { ...blankStimulus("INSTRUCTION"), key: "p2", body: "<p>Choose</p>", paragraphLabels: true };
    const content = toContentCommands([passage, instruction], [q("a", "p2"), q("b", "p1"), q("c")]);
    expect(content.questions.map((question) => question.stimulusIndex)).toEqual([1, 0, null]);
    expect(content.stimuli[0]).toMatchObject({ id: null, kind: "PASSAGE", title: "The Bee", paragraphLabels: true });
    expect(content.stimuli[1]).toMatchObject({ kind: "INSTRUCTION", title: null, paragraphLabels: false });
  });
});
