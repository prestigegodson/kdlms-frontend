import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StickySubHeader, useFilterChip } from "@/components/ui/StickySubHeader";

describe("StickySubHeader", () => {
  it("renders its children, sticky under the app bar below `lg` and static from `lg` up", () => {
    render(
      <StickySubHeader>
        <span>Ward selector</span>
        <span>Term selector</span>
      </StickySubHeader>,
    );

    expect(screen.getByText("Ward selector")).toBeInTheDocument();
    expect(screen.getByText("Term selector")).toBeInTheDocument();

    // The children's grandparent, not parent - a panel wrapper div sits between them and the bar.
    const bar = screen.getByText("Ward selector").parentElement!.parentElement!;
    expect(bar.className).toContain("sticky");
    expect(bar.className).toContain("top-16");
    expect(bar.className).toContain("lg:static");
  });

  it("renders no toggle when not collapsible", () => {
    render(
      <StickySubHeader>
        <span>Class</span>
      </StickySubHeader>,
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  function Chip({ chipKey, value }: { chipKey: string; value: string | null }) {
    useFilterChip(chipKey, value);
    return <span>{chipKey}</span>;
  }

  it("renders a toggle summarizing published chips when collapsible", () => {
    render(
      <StickySubHeader collapsible>
        <Chip chipKey="branch" value="Main Campus" />
        <Chip chipKey="term" value={null} />
      </StickySubHeader>,
    );
    const toggle = screen.getByRole("button");
    expect(toggle).toHaveTextContent("Main Campus");
  });

  it("shows a muted placeholder before any chip has a value", () => {
    render(
      <StickySubHeader collapsible>
        <Chip chipKey="branch" value={null} />
      </StickySubHeader>,
    );
    expect(screen.getByRole("button")).toHaveTextContent("Select filters");
  });

  it("auto-collapses once every chip completes, and the toggle flips it back open", () => {
    function Harness({ term }: { term: string | null }) {
      return (
        <StickySubHeader collapsible>
          <Chip chipKey="branch" value="Main Campus" />
          <Chip chipKey="term" value={term} />
        </StickySubHeader>
      );
    }

    const { rerender } = render(<Harness term={null} />);
    let toggle = screen.getByRole("button");
    expect(toggle).toHaveAttribute("aria-expanded", "true");

    rerender(<Harness term="First Term" />);
    toggle = screen.getByRole("button");
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
  });

  it("keeps the panel open while any published chip is unset", () => {
    render(
      <StickySubHeader collapsible>
        <Chip chipKey="branch" value="Main Campus" />
        <Chip chipKey="term" value={null} />
      </StickySubHeader>,
    );
    expect(screen.getByRole("button")).toHaveAttribute("aria-expanded", "true");
  });
});
