/**
 * The report preview's one signature element: an actual sheet of paper - a
 * centred, true-A4-aspect white page with a soft shadow on a slate field.
 * It's the only place in the app with this treatment, and it's honest - it
 * shows exactly what prints, since the same {@code html} is what the PDF
 * endpoint renders from. A sandboxed `srcDoc` iframe rather than raw
 * `dangerouslySetInnerHTML`, since the HTML embeds a template's own
 * `<style>` block that must not leak into the host page.
 */
export function ReportPreviewFrame({ html }: { html: string }) {
  return (
    <div className="flex justify-center overflow-x-auto rounded-panel bg-slate-100 p-4 sm:p-8">
      <div
        className="w-full max-w-[794px] shrink-0 bg-white shadow-lg"
        style={{ aspectRatio: "210 / 297" }}
      >
        <iframe title="Result report preview" srcDoc={html} className="h-full w-full border-0" sandbox="" />
      </div>
    </div>
  );
}
