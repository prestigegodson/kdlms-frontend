import { render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { ChoiceOptionsField } from "@/features/takeHomeQuizzes/components/ChoiceOptionsField";
import type { EditableOption } from "@/features/takeHomeQuizzes/editableQuestion";

// See RichTextField.test.tsx's own note - ChoiceOptionsField mounts a real
// TipTap editor per option row, which needs the same jsdom geometry
// polyfills for ProseMirror's caret placement / scroll-into-view calls.
beforeAll(() => {
  document.elementFromPoint = () => null;
  Range.prototype.getBoundingClientRect = () =>
    ({ top: 0, left: 0, bottom: 0, right: 0, width: 0, height: 0, x: 0, y: 0, toJSON() {} }) as DOMRect;
  Range.prototype.getClientRects = () => ({ length: 0, item: () => null, [Symbol.iterator]: function* () {} }) as unknown as DOMRectList;
});

const options: EditableOption[] = [
  { key: "a", id: "opt-a", label: "<p>3</p>", correct: false },
  { key: "b", id: "opt-b", label: "<p>4</p>", correct: true },
];

describe("ChoiceOptionsField", () => {
  it("gives every option row an image button, since a choice option can carry an image (Phase 20J)", () => {
    render(
      <ChoiceOptionsField questionType="SINGLE_CHOICE" options={options} onChange={vi.fn()} groupName="q1" />,
    );

    expect(screen.getAllByRole("button", { name: "Insert image" })).toHaveLength(options.length);
  });

  it("hides the image button (and every other control) once disabled", () => {
    render(
      <ChoiceOptionsField
        questionType="SINGLE_CHOICE"
        options={options}
        onChange={vi.fn()}
        groupName="q1"
        disabled
      />,
    );

    expect(screen.queryByRole("button", { name: "Insert image" })).toBeNull();
  });
});
