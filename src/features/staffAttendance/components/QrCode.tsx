import QRCode from "qrcode";
import { useEffect, useState } from "react";

interface QrCodeProps {
  value: string;
  /** Rendered width/height in CSS pixels. */
  size?: number;
  label: string;
}

/**
 * A QR code for `value`, drawn client-side into a data-URL `<img>` - nothing is
 * sent anywhere. High error correction so a slightly scuffed or glare-washed
 * gate screen still scans.
 */
export function QrCode({ value, size = 240, label }: QrCodeProps) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(value, { errorCorrectionLevel: "H", margin: 1, width: size * 2 })
      .then((url) => {
        if (!cancelled) {
          setSrc(url);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSrc(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [value, size]);

  if (!src) {
    return <div style={{ width: size, height: size }} className="rounded-lg bg-slate-100" aria-hidden="true" />;
  }
  return <img src={src} width={size} height={size} alt={label} className="rounded-lg bg-white" />;
}
