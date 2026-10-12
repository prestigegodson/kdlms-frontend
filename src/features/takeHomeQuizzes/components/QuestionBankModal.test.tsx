import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { QuestionBankItemView, QuestionCommand } from "@/api/takeHomeQuizzes";
import type { Page } from "@/api/types";
import {
  QuestionBankModal,
  type QuestionBankSource,
} from "@/features/takeHomeQuizzes/components/QuestionBankModal";
import { QuestionEditor } from "@/features/takeHomeQuizzes/components/QuestionEditor";
import { blankQuestion, type EditableQuestion } from "@/features/takeHomeQuizzes/editableQuestion";

function item(overrides: Partial<QuestionBankItemView>): QuestionBankItemView {
  return {
    id: "item",
    questionType: "SINGLE_CHOICE",
    prompt: "<p>Question</p>",
    points: 1,
    options: [
      { label: "<p>3</p>", correct: false },
      { label: "<p>4</p>", correct: true },
    ],
    answerKeys: [],
    tags: [],
    levelId: "level",
    levelName: "Primary",
    subjectId: "maths",
    subjectName: "Mathematics",
    subjectLabel: null,
    createdBy: "teacher",
    createdByName: "Tara Teacher",
    createdAt: "2026-10-01T10:00:00Z",
    deletable: false,
    ...overrides,
  };
}

const ADDITION = item({
  id: "addition",
  prompt: "<p>2 + 2 = ?</p>",
  tags: ["arithmetic"],
  deletable: true,
});
const CAPITAL = item({
  id: "capital",
  questionType: "FILL_IN_THE_GAP",
  prompt: "<p>Capital of Nigeria?</p>",
  options: [],
  answerKeys: ["Abuja"],
});

function pageOf(content: QuestionBankItemView[]): Page<QuestionBankItemView> {
  return { content, totalElements: content.length, totalPages: 1, number: 0, size: 20 };
}

const COPY: QuestionCommand = {
  id: null,
  questionType: "FILL_IN_THE_GAP",
  prompt: "<p>Capital of Nigeria?</p>",
  points: 1,
  options: [],
  answerKeys: [{ id: null, expectedAnswer: "Abuja" }],
  tags: [],
};

function bankSource(overrides: Partial<QuestionBankSource> = {}): QuestionBankSource {
  return {
    search: vi.fn().mockResolvedValue(pageOf([ADDITION, CAPITAL])),
    add: vi.fn().mockResolvedValue([COPY]),
    save: vi.fn().mockResolvedValue(ADDITION),
    remove: vi.fn().mockResolvedValue(undefined),
    context: { label: "Mathematics", query: { subjectId: "maths" } },
    offerMine: true,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("QuestionBankModal", () => {
  it("lists an interactive item it can't add without the add-on, but won't let it be selected", async () => {
    const sequence = item({
      id: "sequence",
      questionType: "SEQUENCE",
      prompt: "<p>Order the events</p>",
      options: [],
    });
    render(
      <QuestionBankModal
        open
        onClose={vi.fn()}
        bank={bankSource({ search: vi.fn().mockResolvedValue(pageOf([ADDITION, sequence])) })}
        onAdd={vi.fn()}
        interactiveAllowed={false}
      />,
    );

    expect(await screen.findByText("Order the events")).toBeInTheDocument();
    expect(screen.getByText("Not in your plan")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /Order the events/ })).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: /2 \+ 2/ })).toBeEnabled();
  });

  it("starts narrowed to the quiz's subject and widens to the whole bank", async () => {
    const bank = bankSource();
    render(<QuestionBankModal open onClose={vi.fn()} bank={bank} onAdd={vi.fn()} />);

    expect(await screen.findByText("2 + 2 = ?")).toBeInTheDocument();
    expect(bank.search).toHaveBeenLastCalledWith(
      expect.objectContaining({ subjectId: "maths" }),
      0,
    );

    await userEvent.selectOptions(screen.getByLabelText("Show"), "all");
    await waitFor(() =>
      expect(bank.search).toHaveBeenLastCalledWith(
        expect.not.objectContaining({ subjectId: "maths" }),
        0,
      ),
    );
  });

  it("adds the chosen questions in the order they were picked", async () => {
    const bank = bankSource();
    const onAdd = vi.fn();
    const onClose = vi.fn();
    render(<QuestionBankModal open onClose={onClose} bank={bank} onAdd={onAdd} />);

    const addButton = await screen.findByRole("button", { name: "Add 0 questions" });
    expect(addButton).toBeDisabled();

    await userEvent.click(screen.getByRole("checkbox", { name: /Capital of Nigeria/ }));
    await userEvent.click(screen.getByRole("checkbox", { name: /2 \+ 2/ }));
    await userEvent.click(screen.getByRole("button", { name: "Add 2 questions" }));

    await waitFor(() => expect(onAdd).toHaveBeenCalledWith([COPY]));
    expect(bank.add).toHaveBeenCalledWith(["capital", "addition"]);
    expect(onClose).toHaveBeenCalled();
  });

  it("offers delete only on the items the caller may delete", async () => {
    const bank = bankSource();
    render(<QuestionBankModal open onClose={vi.fn()} bank={bank} onAdd={vi.fn()} />);

    await screen.findByText("2 + 2 = ?");
    expect(screen.getAllByRole("button", { name: "Delete from the bank" })).toHaveLength(1);

    await userEvent.click(screen.getByRole("button", { name: "Delete from the bank" }));
    const dialog = await screen.findByRole("dialog", { name: "Delete from the bank?" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(bank.remove).toHaveBeenCalledWith("addition"));
  });

  it("hides the 'only mine' filter for a single-author bank", async () => {
    render(
      <QuestionBankModal
        open
        onClose={vi.fn()}
        bank={bankSource({ offerMine: false, context: undefined })}
        onAdd={vi.fn()}
      />,
    );
    await screen.findByText("2 + 2 = ?");
    expect(screen.queryByText("Only questions I saved")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Show")).not.toBeInTheDocument();
  });
});

describe("QuestionEditor's bank actions", () => {
  function filledQuestion(): EditableQuestion {
    const question = blankQuestion();
    return {
      ...question,
      prompt: "<p>2 + 2 = ?</p>",
      options: [
        { ...question.options[0], label: "<p>3</p>" },
        { ...question.options[1], label: "<p>4</p>", correct: true },
      ],
      tags: ["arithmetic"],
    };
  }

  it("saves the card's current question to the bank, even while the questions are read-only", async () => {
    const bank = bankSource();
    const question = filledQuestion();
    render(<QuestionEditor questions={[question]} onChange={vi.fn()} disabled bank={bank} />);

    await userEvent.click(screen.getByRole("button", { name: "Save question 1 to the bank" }));

    expect(await screen.findByText("Saved to the question bank.")).toBeInTheDocument();
    expect(bank.save).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: "<p>2 + 2 = ?</p>",
        options: [
          expect.objectContaining({ label: "<p>3</p>", correct: false }),
          expect.objectContaining({ label: "<p>4</p>", correct: true }),
        ],
        tags: ["arithmetic"],
      }),
    );
    expect(screen.queryByRole("button", { name: "Add from bank" })).not.toBeInTheDocument();
  });

  it("appends questions added from the bank after the written ones", async () => {
    const onChange = vi.fn();
    const question = filledQuestion();
    render(
      <QuestionEditor
        questions={[question, blankQuestion()]}
        onChange={onChange}
        bank={bankSource()}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Add from bank" }));
    await userEvent.click(await screen.findByRole("checkbox", { name: /Capital of Nigeria/ }));
    await userEvent.click(screen.getByRole("button", { name: "Add 1 question" }));

    await waitFor(() => expect(onChange).toHaveBeenCalled());
    const next = onChange.mock.calls.at(-1)?.[0] as EditableQuestion[];
    // The untouched blank row is dropped; the copy arrives as a new, unsaved question.
    expect(next).toHaveLength(2);
    expect(next[0].key).toBe(question.key);
    expect(next[1]).toMatchObject({
      id: null,
      prompt: "<p>Capital of Nigeria?</p>",
      questionType: "FILL_IN_THE_GAP",
    });
  });
});
