import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ChatComposer } from "@/features/classMessages/components/ChatComposer";

describe("ChatComposer", () => {
  it("sends on Enter and clears the field once accepted", async () => {
    const onSend = vi.fn().mockResolvedValue(undefined);
    render(<ChatComposer onSend={onSend} />);
    const field = screen.getByPlaceholderText("Write a message…");

    await userEvent.type(field, "  Hello there  {Enter}");

    expect(onSend).toHaveBeenCalledWith("Hello there");
    expect(field).toHaveValue("");
  });

  it("starts a new line on Shift+Enter without sending", async () => {
    const onSend = vi.fn().mockResolvedValue(undefined);
    render(<ChatComposer onSend={onSend} />);
    const field = screen.getByPlaceholderText("Write a message…");

    await userEvent.type(field, "Line one{Shift>}{Enter}{/Shift}Line two");

    expect(onSend).not.toHaveBeenCalled();
    expect(field).toHaveValue("Line one\nLine two");
  });

  it("keeps the draft and shows an error when sending fails", async () => {
    const onSend = vi.fn().mockRejectedValue(new Error("boom"));
    render(<ChatComposer onSend={onSend} />);
    const field = screen.getByPlaceholderText("Write a message…");

    await userEvent.type(field, "Keep me");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(await screen.findByText("Could not send your message")).toBeInTheDocument();
    expect(field).toHaveValue("Keep me");
  });
});
