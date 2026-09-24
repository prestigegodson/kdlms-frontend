import { describe, expect, it } from "vitest";
import { paginate } from "@/utils/paginate";

const ITEMS = [1, 2, 3, 4, 5, 6, 7];

describe("paginate", () => {
  it("returns an empty first page for an empty list", () => {
    expect(paginate([], 0, 5)).toEqual({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 5 });
  });

  it("slices the requested page", () => {
    expect(paginate(ITEMS, 0, 3)).toMatchObject({ content: [1, 2, 3], totalElements: 7, totalPages: 3, number: 0 });
    expect(paginate(ITEMS, 1, 3).content).toEqual([4, 5, 6]);
  });

  it("returns a partial last page", () => {
    expect(paginate(ITEMS, 2, 3).content).toEqual([7]);
  });

  it("fills exactly when the list is a multiple of the page size", () => {
    expect(paginate([1, 2, 3, 4], 1, 2)).toMatchObject({ content: [3, 4], totalPages: 2, number: 1 });
  });

  it("clamps an out-of-range or invalid index", () => {
    expect(paginate(ITEMS, -2, 3).number).toBe(0);
    expect(paginate(ITEMS, 9, 3)).toMatchObject({ content: [7], number: 2 });
    expect(paginate(ITEMS, Number.NaN, 3).number).toBe(0);
  });
});
