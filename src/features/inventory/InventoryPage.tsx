import { useSearchParams } from "react-router";
import { PageHeader } from "@/components/ui/PageHeader";
import { Tabs } from "@/components/ui/Tabs";
import { ItemsTab } from "@/features/inventory/pages/ItemsTab";
import { RequisitionsTab } from "@/features/inventory/pages/RequisitionsTab";
import { StockTab } from "@/features/inventory/pages/StockTab";
import { TypesTab } from "@/features/inventory/pages/TypesTab";

// Requisitions | Stock | Items | Types - transactional/everyday tabs first, the setup/catalogue
// tabs last, the billing.BillingPage ordering precedent (Bills first, Settings last). Every tab
// is visible to both SCHOOL_ADMIN and BRANCH_ADMIN (can.viewInventory is already this page's own
// entry gate) - each tab gates its own write controls internally, since a BRANCH_ADMIN reads the
// catalogue read-only but writes stock/requisitions for their own branch.
type Tab = "requisitions" | "stock" | "items" | "types";

const TABS: Tab[] = ["requisitions", "stock", "items", "types"];

function isTab(value: string | null): value is Tab {
  return value !== null && (TABS as string[]).includes(value);
}

/**
 * The inventory module's tabbed shell - deliberately ungated, unlike BillingPage: no entitlement
 * check anywhere here. The active tab lives in the URL (`?tab=`), not local state, so the
 * dashboard's stock/requisition previews can deep-link here (`?tab=requisitions&status=SUBMITTED`
 * additionally seeds the Requisitions tab's own status filter).
 */
export function InventoryPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const tab: Tab = isTab(tabParam) ? tabParam : "requisitions";
  const initialStatus = searchParams.get("status") ?? undefined;

  function setTab(next: Tab) {
    setSearchParams(next === "requisitions" ? {} : { tab: next });
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Inventory" description="Track stock and manage requisitions across your branches." />

      <Tabs
        ariaLabel="Inventory views"
        value={tab}
        onChange={setTab}
        items={[
          { value: "requisitions", label: "Requisitions" },
          { value: "stock", label: "Stock" },
          { value: "items", label: "Items" },
          { value: "types", label: "Item Types" },
        ]}
      />

      {tab === "requisitions" && <RequisitionsTab initialStatus={initialStatus} />}
      {tab === "stock" && <StockTab />}
      {tab === "items" && <ItemsTab />}
      {tab === "types" && <TypesTab />}
    </div>
  );
}
