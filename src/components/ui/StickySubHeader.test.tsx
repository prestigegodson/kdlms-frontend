import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StickySubHeader } from "@/components/ui/StickySubHeader";

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

    const bar = screen.getByText("Ward selector").parentElement!;
    expect(bar.className).toContain("sticky");
    expect(bar.className).toContain("top-16");
    expect(bar.className).toContain("lg:static");
  });
});
