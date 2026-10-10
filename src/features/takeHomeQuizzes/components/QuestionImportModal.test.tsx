import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/api/client";
import type { QuestionCommand } from "@/api/takeHomeQuizzes";
import { QuestionImportModal, type QuestionImporter } from "@/features/takeHomeQuizzes/components/QuestionImportModal";
import { downloadBlob } from "@/utils/download";

vi.mock("@/utils/download", () => ({ downloadBlob: vi.fn() }));

const PARSED: QuestionCommand[] = [
  {
    id: null,
    questionType: "SINGLE_CHOICE",
    prompt: "<p>What is the capital of France?</p>",
    points: 1,
    options: [
      { id: null, label: "<p>Lagos</p>", correct: false },
      { id: null, label: "<p>Paris</p>", correct: true },
    ],
    answerKeys: [],
  },
];

function importer(overrides: Partial<QuestionImporter> = {}): QuestionImporter {
  return {
    importFile: vi.fn().mockResolvedValue(PARSED),
    fetchTemplate: vi.fn().mockResolvedValue(new Blob(["x"])),
    ...overrides,
  };
}

const FILE = new File(["question,type"], "questions.csv", { type: "text/csv" });

beforeEach(() => {
  vi.clearAllMocks();
});

describe("QuestionImportModal", () => {
  it("downloads the template in the chosen format", async () => {
    const quizImporter = importer();
    render(<QuestionImportModal open onClose={vi.fn()} importer={quizImporter} onImport={vi.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: /template \(\.csv\)/i }));

    await waitFor(() => expect(downloadBlob).toHaveBeenCalledWith(expect.any(Blob), "quiz-questions-template.csv"));
    expect(quizImporter.fetchTemplate).toHaveBeenCalledWith("csv");
  });

  it("hands the parsed questions to the editor only once the author adds them", async () => {
    const onImport = vi.fn();
    const onClose = vi.fn();
    const quizImporter = importer();
    render(<QuestionImportModal open onClose={onClose} importer={quizImporter} onImport={onImport} />);

    const addButton = screen.getByRole("button", { name: "Add to quiz" });
    expect(addButton).toBeDisabled();

    await userEvent.upload(screen.getByLabelText("Question file"), FILE);

    expect(await screen.findByText("1 question ready")).toBeInTheDocument();
    expect(quizImporter.importFile).toHaveBeenCalledWith(FILE);
    expect(onImport).not.toHaveBeenCalled();

    await userEvent.click(addButton);
    expect(onImport).toHaveBeenCalledWith(PARSED);
    expect(onClose).toHaveBeenCalled();
  });

  it("lists each problem of a rejected file by row", async () => {
    const rejected = new ApiError(422, "The file has 2 problems. Fix them and upload it again.", {
      type: "https://kdlms.com/problems/question-import-invalid",
      detail: "The file has 2 problems. Fix them and upload it again.",
      errors: [
        { row: 2, column: "correct_answer", message: "The correct answer E points at a blank option." },
        { row: 3, column: "type", message: 'Unknown type "essay".' },
      ] as unknown as string[],
    });
    const quizImporter = importer({ importFile: vi.fn().mockRejectedValue(rejected) });
    const onImport = vi.fn();
    render(<QuestionImportModal open onClose={vi.fn()} importer={quizImporter} onImport={onImport} />);

    await userEvent.upload(screen.getByLabelText("Question file"), FILE);

    expect(await screen.findByText("questions.csv couldn't be imported")).toBeInTheDocument();
    expect(screen.getByText("The correct answer E points at a blank option.")).toBeInTheDocument();
    expect(screen.getByText('Unknown type "essay".')).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add to quiz" })).toBeDisabled();
  });
});
