import { describe, expect, it } from "vitest";
import {
  blankQuestion,
  carryCollapsedKeys,
  duplicateQuestion,
  type EditableQuestion,
} from "@/features/takeHomeQuizzes/editableQuestion";

function saved(id: string, patch: Partial<EditableQuestion> = {}): EditableQuestion {
  return { ...blankQuestion(), key: id, id, ...patch };
}

describe("duplicateQuestion", () => {
  it("copies the content under new keys with no server ids", () => {
    const interaction = { pairs: [] } as unknown as EditableQuestion["interaction"];
    const original = saved("q1", {
      prompt: "<p>Capital of France?</p>",
      points: "3",
      options: [{ key: "o1", id: "o1", label: "<p>Paris</p>", correct: true }],
      answerKeys: [{ key: "a1", id: "a1", expectedAnswer: "Paris" }],
      tags: ["geography"],
      interaction,
      scoring: "ALL_OR_NOTHING",
      stimulusKey: "s1",
    });

    const copy = duplicateQuestion(original);

    expect(copy.id).toBeNull();
    expect(copy.key).not.toBe("q1");
    expect(copy.options).toEqual([{ key: copy.options[0].key, id: null, label: "<p>Paris</p>", correct: true }]);
    expect(copy.options[0].key).not.toBe("o1");
    expect(copy.answerKeys).toEqual([{ key: copy.answerKeys[0].key, id: null, expectedAnswer: "Paris" }]);
    expect(copy.answerKeys[0].key).not.toBe("a1");
    expect(copy).toMatchObject({
      prompt: "<p>Capital of France?</p>",
      points: "3",
      tags: ["geography"],
      interaction,
      scoring: "ALL_OR_NOTHING",
      stimulusKey: "s1",
    });
  });
});

describe("carryCollapsedKeys", () => {
  it("moves a collapsed new row onto the server id it was saved under", () => {
    const local = { ...blankQuestion(), key: "local" };
    const collapsed = carryCollapsedKeys([saved("q1"), local], [saved("q1"), saved("q2")], new Set(["q1", "local"]));
    expect([...collapsed].sort()).toEqual(["q1", "q2"]);
  });

  it("leaves an open new row open after saving", () => {
    const local = { ...blankQuestion(), key: "local" };
    expect([...carryCollapsedKeys([local], [saved("q1")], new Set())]).toEqual([]);
  });

  it("changes nothing when the list's length changed", () => {
    const local = { ...blankQuestion(), key: "local" };
    const keys = new Set(["local"]);
    expect(carryCollapsedKeys([local], [saved("q1"), saved("q2")], keys)).toBe(keys);
  });
});
