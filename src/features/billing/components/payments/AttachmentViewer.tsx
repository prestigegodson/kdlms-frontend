import { FileText, ZoomIn, ZoomOut } from "lucide-react";
import { useEffect, useState } from "react";
import { getErrorMessage } from "@/api/client";
import { downloadStaffPaymentAttachment, type StaffAttachmentView } from "@/api/staffFeePayments";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";

interface AttachmentViewerProps {
  paymentId: string;
  attachments: StaffAttachmentView[];
}

const isImage = (attachment: StaffAttachmentView) => attachment.contentType.startsWith("image/");

/**
 * A payment's proof (D14) for the reviewer: photos load as thumbnails (fetched with the staff
 * bearer, never a bare `src`, since the attachment endpoint is authenticated) and open in an
 * in-place zoom; a PDF opens in a new tab. Every object URL is revoked on unmount.
 */
export function AttachmentViewer({ paymentId, attachments }: AttachmentViewerProps) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState<string | null>(null);
  const [zoomed, setZoomed] = useState<string | null>(null);
  const [magnified, setMagnified] = useState(false);
  const [openingPdf, setOpeningPdf] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const created: string[] = [];
    for (const attachment of attachments.filter(isImage)) {
      downloadStaffPaymentAttachment(paymentId, attachment.fileId)
        .then((blob) => {
          const url = URL.createObjectURL(blob);
          created.push(url);
          if (cancelled) {
            URL.revokeObjectURL(url);
          } else {
            setUrls((current) => ({ ...current, [attachment.fileId]: url }));
          }
        })
        .catch((error: unknown) => {
          if (!cancelled) setFailed(getErrorMessage(error, "Couldn't load a proof image"));
        });
    }
    return () => {
      cancelled = true;
      created.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [paymentId, attachments]);

  async function openPdf(attachment: StaffAttachmentView) {
    // Opened synchronously so a popup blocker treats it as the click's own window, then pointed at the blob.
    const tab = window.open("", "_blank");
    setOpeningPdf(attachment.fileId);
    try {
      const blob = await downloadStaffPaymentAttachment(paymentId, attachment.fileId);
      const url = URL.createObjectURL(blob);
      if (tab) {
        tab.location.href = url;
      } else {
        window.open(url, "_blank");
      }
      // Long enough for the new tab to load it.
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) {
      tab?.close();
      setFailed(getErrorMessage(error, "Couldn't open the PDF"));
    } finally {
      setOpeningPdf(null);
    }
  }

  if (attachments.length === 0) {
    return <p className="text-sm text-slate-500">No proof attached.</p>;
  }

  const zoomedAttachment = attachments.find((attachment) => attachment.fileId === zoomed);

  return (
    <div className="space-y-3">
      {failed && <Alert variant="error">{failed}</Alert>}
      {zoomedAttachment && urls[zoomedAttachment.fileId] ? (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={() => setMagnified((value) => !value)}>
              {magnified ? (
                <>
                  <ZoomOut className="h-4 w-4" aria-hidden="true" /> Fit
                </>
              ) : (
                <>
                  <ZoomIn className="h-4 w-4" aria-hidden="true" /> Zoom
                </>
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setZoomed(null);
                setMagnified(false);
              }}
            >
              Back to all proof
            </Button>
          </div>
          <div className="max-h-[70dvh] overflow-auto overscroll-contain rounded-control border border-slate-200 bg-slate-50">
            <img
              src={urls[zoomedAttachment.fileId]}
              alt={zoomedAttachment.fileName}
              className={magnified ? "w-[200%] max-w-none" : "mx-auto w-full object-contain"}
            />
          </div>
        </div>
      ) : (
        <ul className="flex flex-wrap gap-3">
          {attachments.map((attachment) => (
            <li key={attachment.fileId}>
              {isImage(attachment) ? (
                urls[attachment.fileId] ? (
                  <button
                    type="button"
                    onClick={() => setZoomed(attachment.fileId)}
                    className="block h-28 w-28 cursor-zoom-in overflow-hidden rounded-control border border-slate-200"
                    aria-label={`View ${attachment.fileName}`}
                  >
                    <img
                      src={urls[attachment.fileId]}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  </button>
                ) : (
                  <Skeleton className="h-28 w-28" />
                )
              ) : (
                <button
                  type="button"
                  onClick={() => openPdf(attachment)}
                  disabled={openingPdf === attachment.fileId}
                  className="flex h-28 w-28 cursor-pointer flex-col items-center justify-center gap-1 rounded-control border border-slate-200 px-2 text-center text-xs text-slate-600 hover:bg-slate-50"
                  aria-label={`Open ${attachment.fileName}`}
                >
                  <FileText className="h-6 w-6 text-slate-400" aria-hidden="true" />
                  <span className="line-clamp-2 break-all">{attachment.fileName}</span>
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
