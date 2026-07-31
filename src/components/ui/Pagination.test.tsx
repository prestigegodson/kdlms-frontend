import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Page } from "@/api/types";
import { Pagination } from "@/components/ui/Pagination";

function pageOf(content: unknown[], number: number, size: number, totalElements: number): Page<unknown> {
  return { content, number, size, totalElements, totalPages: Math.ceil(totalElements / size) };
}

describe("Pagination", () => {
  it("renders nothing when there are no results", () => {
    const { container } = render(
      <Pagination page={pageOf([], 0, 20, 0)} onPageChange={vi.fn()} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("shows the current range and disables Previous on the first page", () => {
    render(<Pagination page={pageOf(Array(20).fill(0), 0, 20, 45)} onPageChange={vi.fn()} />);

    expect(screen.getByText(/Showing/)).toHaveTextContent("Showing 1–20 of 45");
    expect(screen.getByRole("button", { name: "Previous page" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next page" })).toBeEnabled();
  });

  it("disables Next on the last page", () => {
    render(<Pagination page={pageOf(Array(5).fill(0), 2, 20, 45)} onPageChange={vi.fn()} />);

    expect(screen.getByText(/Showing/)).toHaveTextContent("Showing 41–45 of 45");
    expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled();
  });

  it("calls onPageChange with the target page index", async () => {
    const onPageChange = vi.fn();
    const user = userEvent.setup();
    render(<Pagination page={pageOf(Array(20).fill(0), 1, 20, 45)} onPageChange={onPageChange} />);

    await user.click(screen.getByRole("button", { name: "Next page" }));
    expect(onPageChange).toHaveBeenCalledWith(2);

    await user.click(screen.getByRole("button", { name: "Previous page" }));
    expect(onPageChange).toHaveBeenCalledWith(0);
  });
});
