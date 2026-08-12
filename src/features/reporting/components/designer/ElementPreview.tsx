import { ImageIcon } from "lucide-react";
import { downloadFile } from "@/api/files";
import { BLOCK_LABELS, type LayoutElement } from "@/features/reporting/components/designer/layout";
import { REPORT_BLOCKS } from "@/features/reporting/components/reportBlocks";
import { useObjectUrl } from "@/hooks/useObjectUrl";

const BLOCK_DESCRIPTIONS = Object.fromEntries(REPORT_BLOCKS.map((block) => [block.id, block.description]));

/**
 * The canvas's approximate, non-authoritative stand-in for one element -
 * BLOCK/TEXT/DIVIDER/SPACER/IMAGE only; a BOX renders its own children via
 * `ElementList` recursion rather than through here. This never reproduces
 * the server's actual table markup (see `TemplateDesignerPage`'s module
 * comment) - it exists purely so a system admin can see roughly what
 * they're building; `GET .../preview` against real sample data is the only
 * source of truth for what a report will actually look like.
 */
export function ElementPreview({ element }: { element: Exclude<LayoutElement, { type: "BOX" }> }) {
  switch (element.type) {
    case "BLOCK":
      if (element.block === "STUDENT_PHOTO") {
        return (
          <div style={{ textAlign: element.style?.align ?? "left" }}>
            <div
              className="inline-flex flex-col items-center justify-center gap-0.5 rounded-control border border-dashed border-slate-400 bg-slate-50 text-[10px] text-slate-500"
              style={{ width: `${element.maxWidthPx ?? 96}px`, height: `${element.maxHeightPx ?? 120}px` }}
            >
              <ImageIcon className="h-4 w-4 text-slate-300" aria-hidden="true" />
              Photo
            </div>
          </div>
        );
      }
      return (
        <div className="rounded-control border border-dashed border-slate-400 bg-slate-50 px-3 py-3 text-center text-xs text-slate-600">
          <div className="font-medium text-slate-700">{BLOCK_LABELS[element.block]}</div>
          <div className="mt-0.5 text-slate-500">{BLOCK_DESCRIPTIONS[element.block]}</div>
        </div>
      );
    case "TEXT":
      return (
        <div
          className="min-h-6 whitespace-pre-wrap break-words px-1 py-0.5 text-sm"
          style={{
            textAlign: element.style?.align ?? "left",
            fontWeight: element.style?.bold ? 700 : 400,
            fontStyle: element.style?.italic ? "italic" : "normal",
            fontSize: element.style?.fontSizePx ? `${element.style.fontSizePx}px` : undefined,
            color: element.style?.color,
          }}
        >
          {element.text || <span className="text-slate-400">Empty text - click to edit</span>}
        </div>
      );
    case "DIVIDER":
      return <hr className="my-1 border-t" style={{ borderColor: element.style?.color ?? "#cccccc" }} />;
    case "SPACER":
      return (
        <div
          className="flex items-center justify-center rounded-control border border-dashed border-slate-300 bg-slate-50 text-[10px] text-slate-400"
          style={{ height: `${Math.min(element.heightPx, 80)}px` }}
        >
          {element.heightPx}px gap
        </div>
      );
    case "IMAGE":
      return <ImagePreview fileId={element.fileId} />;
  }
}

function ImagePreview({ fileId }: { fileId: string }) {
  const url = useObjectUrl(fileId || undefined, downloadFile);

  if (!fileId) {
    return (
      <div className="flex h-16 items-center justify-center gap-2 rounded-control border border-dashed border-slate-300 bg-slate-50 text-xs text-slate-400">
        <ImageIcon className="h-4 w-4" aria-hidden="true" /> No image selected
      </div>
    );
  }
  return (
    <div className="flex h-16 items-center justify-center overflow-hidden rounded-control border border-slate-200 bg-white">
      {url ? <img src={url} alt="" className="max-h-full max-w-full object-contain" /> : <ImageIcon className="h-4 w-4 text-slate-300" aria-hidden="true" />}
    </div>
  );
}
