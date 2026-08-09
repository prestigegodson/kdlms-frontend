import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/Table";

function renderRow(row: ReactElement, destination = "/destination") {
  const router = createMemoryRouter(
    [
      {
        path: "/",
        element: (
          <Table>
            <TableBody>{row}</TableBody>
          </Table>
        ),
      },
      { path: destination, element: <p>Arrived</p> },
    ],
    { initialEntries: ["/"] },
  );
  render(<RouterProvider router={router} />);
  return router;
}

describe("TableRow", () => {
  it("stays inert without to/onClick - no tabIndex, no chevron, no pointer cursor", () => {
    renderRow(
      <TableRow>
        <TableCell>Plain row</TableCell>
      </TableRow>,
    );

    const row = screen.getByText("Plain row").closest("tr")!;
    expect(row).not.toHaveAttribute("tabindex");
    expect(row.className).not.toContain("cursor-pointer");
    expect(row.querySelector("td[aria-hidden='true']")).not.toBeInTheDocument();
  });

  it("navigates via `to` on click, and renders a trailing chevron + pointer cursor + tabIndex", async () => {
    const user = userEvent.setup();
    renderRow(
      <TableRow to="/destination">
        <TableCell>Tappable row</TableCell>
      </TableRow>,
    );

    const row = screen.getByText("Tappable row").closest("tr")!;
    expect(row).toHaveAttribute("tabindex", "0");
    expect(row.className).toContain("cursor-pointer");
    expect(row.querySelector("td[aria-hidden='true']")).toBeInTheDocument();

    await user.click(row);

    expect(await screen.findByText("Arrived")).toBeInTheDocument();
  });

  it("navigates on Enter and on Space when the row is focused", async () => {
    const user = userEvent.setup();
    renderRow(
      <TableRow to="/destination">
        <TableCell>Keyboard row</TableCell>
      </TableRow>,
    );

    const row = screen.getByText("Keyboard row").closest("tr")!;
    row.focus();
    await user.keyboard("{Enter}");

    expect(await screen.findByText("Arrived")).toBeInTheDocument();
  });

  it("treats a plain onClick as interactive (chevron, cursor, keyboard) without navigating", async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    renderRow(
      <TableRow onClick={onClick}>
        <TableCell>Clickable, no route</TableCell>
      </TableRow>,
    );

    const row = screen.getByText("Clickable, no route").closest("tr")!;
    expect(row).toHaveAttribute("tabindex", "0");
    expect(row.className).toContain("cursor-pointer");

    await user.click(row);

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Arrived")).not.toBeInTheDocument();
  });

  it("calls onClick before navigating when both onClick and to are given", async () => {
    const calls: string[] = [];
    const onClick = vi.fn(() => calls.push("onClick"));
    const user = userEvent.setup();
    renderRow(
      <TableRow to="/destination" onClick={onClick}>
        <TableCell>Both</TableCell>
      </TableRow>,
    );

    await user.click(screen.getByText("Both").closest("tr")!);

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("Arrived")).toBeInTheDocument();
  });
});
