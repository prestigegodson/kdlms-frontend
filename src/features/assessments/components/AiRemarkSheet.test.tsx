import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { GenerateRemarkHandlers } from "@/api/assessments";
import { ApiError } from "@/api/client";
import { AiRemarkSheet } from "@/features/assessments/components/AiRemarkSheet";
import { REMARK_AI_COPY } from "@/features/lessonNotes/components/aiGenerateCopy";

type Generate = (
  extra: string | null,
  handlers: GenerateRemarkHandlers,
  signal: AbortSignal,
) => Promise<void>;

function renderSheet(generate: Generate) {
  const onApply = vi.fn();
  const onClose = vi.fn();
  render(
    <AiRemarkSheet
      studentName="Zara Bello"
      generate={generate}
      copy={REMARK_AI_COPY}
      onClose={onClose}
      onApply={onApply}
    />,
  );
  return { onApply, onClose };
}

describe("AiRemarkSheet", () => {
  it("streams a preview, then applies the cleaned-up draft on Use this", async () => {
    const user = userEvent.setup();
    const generate = vi.fn<Generate>(async (_extra, handlers) => {
      handlers.onDelta("Zara has ");
      handlers.onDelta("worked hard.");
      handlers.onResult("Zara has worked hard.");
    });
    const { onApply, onClose } = renderSheet(generate);

    await user.type(screen.getByLabelText("Extra instructions (optional)"), "Mention her reading");
    await user.click(screen.getByRole("button", { name: "Draft remark" }));

    expect(generate).toHaveBeenCalledWith(
      "Mention her reading",
      expect.any(Object),
      expect.any(AbortSignal),
    );
    expect(await screen.findByText("Zara has worked hard.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Use this" }));

    expect(onApply).toHaveBeenCalledWith("Zara has worked hard.");
    expect(onClose).toHaveBeenCalled();
  });

  it("shows a refusal such as a spent quota and offers Try again", async () => {
    const user = userEvent.setup();
    renderSheet(async () => {
      throw new ApiError(422, "This plan's 10 AI generations for October have all been used.");
    });

    await user.click(screen.getByRole("button", { name: "Draft remark" }));

    expect(await screen.findByText(/have all been used/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Try again/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Use this" })).not.toBeInTheDocument();
  });

  it("returns to the form without an error when the teacher stops the draft", async () => {
    const user = userEvent.setup();
    renderSheet(
      (_extra, handlers, signal) =>
        new Promise<void>((_resolve, reject) => {
          handlers.onDelta("Zara ");
          signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
        }),
    );

    await user.click(screen.getByRole("button", { name: "Draft remark" }));
    await user.click(await screen.findByRole("button", { name: "Stop" }));

    expect(await screen.findByRole("button", { name: "Draft remark" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
