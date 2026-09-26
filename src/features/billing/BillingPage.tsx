import { useState } from "react";
import { can } from "@/auth/permissions";
import { PageHeader } from "@/components/ui/PageHeader";
import { Tabs } from "@/components/ui/Tabs";
import { AdvanceBillsTab } from "@/features/billing/pages/AdvanceBillsTab";
import { BillsTab } from "@/features/billing/pages/BillsTab";
import { FeesTab } from "@/features/billing/pages/FeesTab";
import { PricesTab } from "@/features/billing/pages/PricesTab";
import { ProspectiveBillTab } from "@/features/billing/pages/ProspectiveBillTab";
import { SettingsTab } from "@/features/billing/pages/SettingsTab";
import { TransportTab } from "@/features/billing/pages/TransportTab";
import { useAuthStore } from "@/stores/authStore";
import { useFeatureStore } from "@/stores/featureStore";

// Bills | Advance bills | Prospective bill | Fees | Prices | Transport | Settings - the
// documented order (billing-module.md); 21B/21C shipped only the tabs they actually built rather
// than a disabled placeholder, and 21D fills Bills in first per that same convention. Advance
// bills (Phase 27) sits right after Bills since it's the same task - generating bills - just for
// a session ahead of promotion, and it now owns its own end-to-end flow (plan -> preview ->
// publish) rather than a summary card buried inside Bills. Prospective bill (Phase 42) sits right
// after Advance bills for the same reason - generating a bill, just for a child who isn't a
// `students` row at all yet, priced as a brand-new admission - a stateless one-off quote with no
// roster of its own. Transport (Phase 22) sits after Prices since it is itself a pricing screen,
// just for the school-bus fee's own axis.
type Tab = "bills" | "advance" | "prospective" | "fees" | "prices" | "transport" | "settings";

/**
 * The school's fee catalogue and billing configuration - one page, tabbed,
 * since billing is an occasional administrative task rather than one of
 * the school portal's everyday destinations (mirrors AssessmentsPage's
 * Tabs shape). Every tab is gated by its own `can.*` predicate rather
 * than a single page-level guard, since a BRANCH_ADMIN sees Fees read-only,
 * Prices read-write (own branch), and Settings not at all. Bills itself is
 * available to anyone who can see this page at all - `can.viewBilling` is
 * already the page's own entry gate, so there is no narrower predicate for
 * this tab.
 */
export function BillingPage() {
  const role = useAuthStore((state) => state.user?.role);
  const entitled = useFeatureStore((state) => state.billing);
  const [tab, setTab] = useState<Tab>("bills");

  const canManageAdvanceBills = can.manageAdvanceBills(role, entitled);
  const canGenerateProspectiveBills = can.generateProspectiveBills(role, entitled);
  const canManagePrices = can.manageFeePrices(role, entitled);
  const canManageTransport = can.manageTransport(role, entitled);
  const canManageSettings = can.manageBillingSettings(role, entitled);

  return (
    <div className="space-y-6">
      <PageHeader title="Fees & Bills" description="Define fees and configure how bills are paid." />

      <Tabs
        ariaLabel="Billing views"
        value={tab}
        onChange={setTab}
        items={[
          { value: "bills", label: "Bills" },
          ...(canManageAdvanceBills ? [{ value: "advance" as const, label: "Advance bills" }] : []),
          ...(canGenerateProspectiveBills ? [{ value: "prospective" as const, label: "Prospective bill" }] : []),
          { value: "fees", label: "Fees" },
          ...(canManagePrices ? [{ value: "prices" as const, label: "Prices" }] : []),
          ...(canManageTransport ? [{ value: "transport" as const, label: "Transport" }] : []),
          ...(canManageSettings ? [{ value: "settings" as const, label: "Settings" }] : []),
        ]}
      />

      {tab === "bills" && <BillsTab />}
      {tab === "advance" && canManageAdvanceBills && <AdvanceBillsTab />}
      {tab === "prospective" && canGenerateProspectiveBills && <ProspectiveBillTab />}
      {tab === "fees" && <FeesTab />}
      {tab === "prices" && canManagePrices && <PricesTab />}
      {tab === "transport" && canManageTransport && <TransportTab />}
      {tab === "settings" && canManageSettings && <SettingsTab />}
    </div>
  );
}
