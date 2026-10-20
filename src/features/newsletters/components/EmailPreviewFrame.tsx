import { Monitor, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";
import { previewHtml } from "../newsletterContent";

type Width = "desktop" | "mobile";

const WIDTH_PX: Record<Width, number> = { desktop: 600, mobile: 375 };

interface EmailPreviewFrameProps {
  html: string;
  subject: string;
  preheader: string;
}

/**
 * The live preview of a pasted newsletter: an inbox line (subject + preview text) above the email
 * rendered in a sandboxed `srcDoc` iframe - the `reporting` ReportPreviewFrame idiom, so the
 * email's own `<style>` can't leak into the page and none of its scripts (already stripped
 * server-side) could run. Re-renders a beat after typing pauses, so a large paste doesn't reload
 * the frame on every keystroke. Desktop/mobile widths show how the layout reflows.
 */
export function EmailPreviewFrame({ html, subject, preheader }: EmailPreviewFrameProps) {
  const [width, setWidth] = useState<Width>("desktop");
  const [rendered, setRendered] = useState(() => previewHtml(html));

  useEffect(() => {
    const timeout = setTimeout(() => setRendered(previewHtml(html)), 300);
    return () => clearTimeout(timeout);
  }, [html]);

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-panel border border-slate-200 bg-slate-100">
      <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 py-2">
        <div className="min-w-0 text-sm">
          <p className="truncate font-medium text-slate-900">
            {subject.trim() || "No subject yet"}
          </p>
          <p className="truncate text-xs text-slate-500">{preheader.trim() || "No preview text"}</p>
        </div>
        <div
          className="flex shrink-0 rounded-control border border-slate-200 p-0.5"
          role="group"
          aria-label="Preview width"
        >
          {(["desktop", "mobile"] as const).map((option) => {
            const Icon = option === "desktop" ? Monitor : Smartphone;
            return (
              <button
                key={option}
                type="button"
                aria-pressed={width === option}
                aria-label={option === "desktop" ? "Desktop width" : "Mobile width"}
                onClick={() => setWidth(option)}
                className={`inline-flex items-center rounded px-2 py-1 mobile:min-h-11 mobile:px-3 ${
                  width === option
                    ? "bg-brand-50 text-brand-700"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex min-h-[480px] flex-1 justify-center overflow-auto overscroll-contain p-3 sm:p-4">
        {html.trim() ? (
          <iframe
            title="Newsletter preview"
            srcDoc={rendered}
            sandbox=""
            className="h-full min-h-[480px] w-full shrink-0 border-0 bg-white shadow-sm"
            style={{ maxWidth: WIDTH_PX[width] }}
          />
        ) : (
          <p className="self-center text-center text-sm text-slate-500">
            Paste your newsletter's HTML to see it here.
          </p>
        )}
      </div>
    </div>
  );
}
