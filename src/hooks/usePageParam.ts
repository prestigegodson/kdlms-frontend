import { useSearchParams } from "react-router";

/**
 * A list's current page, kept in the URL as a 1-indexed `?page=` (absent on page 1) so browser
 * Back from a drilled-into item lands on the page it came from. Returns a 0-indexed page for
 * `paginate`/`Pagination`, which clamp an out-of-range value themselves.
 */
export function usePageParam(): [number, (pageIndex: number) => void] {
  const [searchParams, setSearchParams] = useSearchParams();
  const pageIndex = Number(searchParams.get("page") ?? "1") - 1;

  const setPageIndex = (next: number) => {
    setSearchParams((params) => {
      const updated = new URLSearchParams(params);
      if (next <= 0) updated.delete("page");
      else updated.set("page", String(next + 1));
      return updated;
    });
  };

  return [Number.isFinite(pageIndex) ? pageIndex : 0, setPageIndex];
}
