import type { MessageCategory } from "@/api/communication";
import { Badge } from "@/components/ui/Badge";
import { categoryBadgeVariant, categoryLabel } from "@/features/communication/messageCategory";

export function CategoryBadge({ category }: { category: MessageCategory }) {
  return <Badge variant={categoryBadgeVariant(category)}>{categoryLabel(category)}</Badge>;
}
