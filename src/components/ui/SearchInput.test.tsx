import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SearchInput } from "@/components/ui/SearchInput";

describe("SearchInput", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not call onChange until typing pauses", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<SearchInput value="" onChange={onChange} placeholder="Search students" />);

    await user.type(screen.getByPlaceholderText("Search students"), "Ada");
    expect(onChange).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(300);
    expect(onChange).toHaveBeenCalledWith("Ada");
  });

  it("adopts an external reset of value", () => {
    const { rerender } = render(<SearchInput value="Ada" onChange={vi.fn()} placeholder="Search students" />);
    expect(screen.getByPlaceholderText("Search students")).toHaveValue("Ada");

    rerender(<SearchInput value="" onChange={vi.fn()} placeholder="Search students" />);
    expect(screen.getByPlaceholderText("Search students")).toHaveValue("");
  });
});
