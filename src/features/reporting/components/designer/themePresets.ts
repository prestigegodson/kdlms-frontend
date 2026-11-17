import type {
  HeadingStyle,
  LayoutElement,
  ReportLayout,
  TableStyle,
} from "@/features/reporting/components/designer/layout";

/**
 * One-click colour schemes for the designer. A theme is not stored anywhere:
 * applying one just writes ordinary layout fields (header colours, the table
 * style, the page border colour and the school-name colour), so the backend
 * never learns about themes and every value stays editable afterwards.
 */
export interface ThemePreset {
  id: string;
  label: string;
  accent: string;
}

export const THEME_PRESETS: readonly ThemePreset[] = [
  { id: "royal", label: "Royal blue", accent: "#1f3a8a" },
  { id: "emerald", label: "Emerald", accent: "#0f6b4b" },
  { id: "maroon", label: "Maroon", accent: "#7a1f2b" },
  { id: "purple", label: "Purple", accent: "#5b2a86" },
  { id: "mono", label: "Monochrome", accent: "#333333" },
];

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

/** Mixes `hex` toward white by `amount` (0 = unchanged, 1 = white), returning a 6-digit hex - the only colour form the backend accepts. */
export function tint(hex: string, amount: number): string {
  if (!HEX_COLOR.test(hex)) throw new Error(`Not a 6-digit hex color: ${hex}`);
  const channel = (offset: number) => {
    const value = parseInt(hex.slice(offset, offset + 2), 16);
    return Math.round(value + (255 - value) * amount)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${channel(1)}${channel(3)}${channel(5)}`;
}

/** Recolours every SCHOOL_HEADER block's school name and every bordered BOX's border, wherever they sit (a column, a BOX, a TABLE cell). */
function recolourElements(elements: LayoutElement[], accent: string): LayoutElement[] {
  return elements.map((element) => {
    if (element.type === "BLOCK" && element.block === "SCHOOL_HEADER") {
      const heading: HeadingStyle = { ...element.style?.heading, color: accent };
      return { ...element, style: { ...element.style, heading } };
    }
    if (element.type === "BOX") {
      const style = element.style?.border ? { ...element.style, borderColor: tint(accent, 0.6) } : element.style;
      return { ...element, style, elements: recolourElements(element.elements, accent) };
    }
    if (element.type === "TABLE") {
      return {
        ...element,
        table: {
          ...element.table,
          rows: element.table.rows.map((row) => ({
            ...row,
            cells: row.cells.map((cell) => (cell.elements ? { ...cell, elements: recolourElements(cell.elements, accent) } : cell)),
          })),
        },
      };
    }
    return element;
  });
}

/**
 * Derives a full colour scheme from one accent: solid accent table headers
 * with white text, a light tint for group/title bands, a softer tint for
 * table and bordered-box borders, and an almost-white tint for alternate
 * rows. The page border (if there is one) and the school name take the
 * accent itself.
 * Table spacing/size and every non-colour setting are left alone.
 */
export function applyTheme(layout: ReportLayout, accent: string): ReportLayout {
  const tableStyle: TableStyle = {
    ...layout.page.tableStyle,
    borderColor: tint(accent, 0.6),
    stripeColor: tint(accent, 0.93),
  };
  return {
    ...layout,
    page: {
      ...layout.page,
      headerColors: {
        headerBackground: accent,
        headerText: "#ffffff",
        bandBackground: tint(accent, 0.82),
        bandText: accent,
      },
      tableStyle,
      frame: layout.page.frame ? { ...layout.page.frame, color: accent } : undefined,
    },
    rows: layout.rows.map((row) => ({
      ...row,
      columns: row.columns.map((column) => ({ ...column, elements: recolourElements(column.elements, accent) })),
    })),
  };
}
