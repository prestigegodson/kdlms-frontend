import { Badge } from "@/components/ui/Badge";
import type { StockBand } from "@/api/inventory";

const VARIANT_BY_BAND: Record<StockBand, "neutral" | "success" | "warning" | "danger"> = {
  OUT_OF_STOCK: "danger",
  LOW: "warning",
  APPROACHING: "neutral",
  OK: "success",
  UNTRACKED: "neutral",
};

const LABEL_BY_BAND: Record<StockBand, string> = {
  OUT_OF_STOCK: "Out of stock",
  LOW: "Low stock",
  APPROACHING: "Approaching",
  OK: "OK",
  UNTRACKED: "Not tracked",
};

/** One Badge variant per stock band - the RequisitionStatusBadge shape, the shared source every stock row reads from. */
export function StockBandBadge({ band }: { band: StockBand }) {
  return <Badge variant={VARIANT_BY_BAND[band]}>{LABEL_BY_BAND[band]}</Badge>;
}
