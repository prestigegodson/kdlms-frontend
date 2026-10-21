import type { BroadsheetView } from "@/api/assessments";
import type { ResultScope } from "@/api/types";
import { Button } from "@/components/ui/Button";
import { broadsheetToCsv } from "@/features/assessments/broadsheet";
import { downloadBlob } from "@/utils/download";
import { Download, Printer } from "lucide-react";

interface BroadsheetActionsProps {
  broadsheet: BroadsheetView;
  scope: ResultScope;
  /** Filename stem, e.g. "Primary 1A First Term" - slugified, with "-broadsheet[-midterm].csv" appended. */
  fileStem: string;
  /** From `useBroadsheetPrint`. */
  onPrint: () => void;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Download (CSV, built client-side from the already-loaded broadsheet - it
 * opens straight in Excel) and Print, shared by the admin and teacher
 * broadsheet panels. Print goes through the browser's own dialog, whose
 * "Save as PDF" covers a PDF copy.
 */
export function BroadsheetActions({ broadsheet, scope, fileStem, onPrint }: BroadsheetActionsProps) {
  function download() {
    const stem = slugify(fileStem) || "class";
    const blob = new Blob([broadsheetToCsv(broadsheet, scope)], { type: "text/csv;charset=utf-8" });
    downloadBlob(blob, scope === "MIDTERM" ? `${stem}-broadsheet-midterm.csv` : `${stem}-broadsheet.csv`);
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="secondary" size="sm" onClick={download}>
        <Download className="h-4 w-4" aria-hidden="true" /> Download CSV
      </Button>
      <Button variant="secondary" size="sm" onClick={onPrint}>
        <Printer className="h-4 w-4" aria-hidden="true" /> Print
      </Button>
    </div>
  );
}
