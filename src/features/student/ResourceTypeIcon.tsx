import { FileAudio, FileText, FileVideo } from "lucide-react";
import type { ReactNode } from "react";
import { RESOURCE_TYPE_LABEL } from "@/features/student/resourceCards";

/** The YouTube mark - lucide-react 1.x dropped its brand icons, so it's drawn inline. */
function YouTubeGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <rect x="1.5" y="5" width="21" height="14" rx="4" fill="#FF0000" />
      <path d="M10 9.2v5.6l4.8-2.8z" fill="#FFFFFF" />
    </svg>
  );
}

/** A page with a "PDF" label - lucide has no PDF-specific file icon. */
function PdfGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path
        d="M6 2h8l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path d="M14 2v5h5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
      <rect x="2" y="11.5" width="15" height="7" rx="1.5" fill="#DC2626" />
      <text x="9.5" y="16.85" textAnchor="middle" fontSize="5.4" fontWeight="700" fill="#FFFFFF" fontFamily="sans-serif">
        PDF
      </text>
    </svg>
  );
}

const lucide = (Icon: typeof FileText) => <Icon className="h-5 w-5" aria-hidden="true" />;

const TYPE_ICON: Record<string, { glyph: ReactNode; tile: string }> = {
  YOUTUBE: { glyph: <YouTubeGlyph />, tile: "bg-red-50" },
  PDF: { glyph: <PdfGlyph />, tile: "bg-red-50 text-red-600" },
  AUDIO: { glyph: lucide(FileAudio), tile: "bg-indigo-50 text-indigo-600" },
  VIDEO: { glyph: lucide(FileVideo), tile: "bg-indigo-50 text-indigo-600" },
  RICH_TEXT: { glyph: lucide(FileText), tile: "bg-indigo-50 text-indigo-600" },
};

/** A resource's type as an icon tile, labelled for screen readers with the same name the type badge used. */
export function ResourceTypeIcon({ type, className = "" }: { type: string; className?: string }) {
  const { glyph, tile } = TYPE_ICON[type] ?? TYPE_ICON.RICH_TEXT;
  return (
    <span
      role="img"
      aria-label={RESOURCE_TYPE_LABEL[type] ?? type}
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${tile} ${className}`}
    >
      {glyph}
    </span>
  );
}
