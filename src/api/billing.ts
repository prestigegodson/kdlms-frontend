import { ApiError, apiFetch, apiFetchBlob } from "@/api/client";

/**
 * Mirrors backend billing.domain.FeeApplicability. FIRST_TERM_ONLY means the student's OWN
 * ADMISSION TERM - never "term 1 of the session" - the single most confusable name in this
 * module; see billing-module.md's naming-discipline table.
 */
export type FeeApplicability = "TERMLY" | "FIRST_TERM_ONLY";

/** Mirrors backend billing.application.port.in.FeeView.FeeLevelView. */
export interface FeeLevelView {
  levelId: string;
  levelName: string;
}

/** Mirrors backend billing.domain.FeeKind. TRANSPORT is the school-bus fee - always empty `levels`, always optional, priced and assigned entirely differently (see `TransportRouteView`/`TransportFareGridView`/`TransportRidersView` below) rather than through the ordinary price grid. */
export type FeeKind = "STANDARD" | "TRANSPORT";

/** Mirrors backend billing.application.port.in.FeeView - a fee DEFINITION, no amount at all (money lives in fee prices, Phase 21C, or transport fares, Phase 22). */
export interface FeeView {
  id: string;
  kind: FeeKind;
  name: string;
  description: string | null;
  applicability: FeeApplicability;
  termNumbers: number[] | null;
  levels: FeeLevelView[];
  compulsory: boolean;
  active: boolean;
  position: number;
  /** Phase 23: only ever true for a STANDARD fee applying to more than one term. */
  priceVariesByTerm: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * A create/update request. `kind` is immutable after creation - ignored on an update, and
 * omitted defaults to `"STANDARD"`. `termNumbers` is required (non-empty, 1-3) for TERMLY and
 * must be omitted/empty for FIRST_TERM_ONLY - a TRANSPORT fee must be TERMLY. `levelIds` must
 * name at least one level for a STANDARD fee, and must be empty for TRANSPORT - the backend 422s
 * either violation (enforced in the domain, not bean validation, so it's a business-rule error,
 * not a 400). `compulsory` must be false for TRANSPORT. `priceVariesByTerm` (Phase 23) may only be
 * true when `applicability` is `"TERMLY"` with more than one term selected - flipping it on an
 * existing fee rewrites every price row it already has (expanding losslessly, or refused with a
 * 422 if collapsing back would change a term's amount); see `FeeFormModal`'s own guard.
 */
export interface SaveFeeRequest {
  kind?: FeeKind;
  name: string;
  description: string | null;
  applicability: FeeApplicability;
  termNumbers: number[] | null;
  levelIds: string[];
  compulsory: boolean;
  active: boolean;
  position: number;
  priceVariesByTerm: boolean;
}

/** Mirrors backend billing.application.port.in.BillingSettingsView.BankAccountView. */
export interface BankAccountView {
  position: number;
  bankName: string;
  accountName: string;
  accountNumber: string;
}

/** Mirrors backend billing.application.port.in.BillingSettingsView. An absent saved row reads as this (NGN, no accounts, no instructions) - the school_settings/platform_support_contact absent-row-means-defaults contract. */
export interface BillingSettingsView {
  currency: string;
  instructions: string | null;
  accounts: BankAccountView[];
}

export interface BankAccountRequest {
  bankName: string;
  accountName: string;
  accountNumber: string;
}

/** A full replace, like every other settings resource in this codebase - an omitted field clears it, and the account list is always fully replaced. */
export interface SaveBillingSettingsRequest {
  currency: string;
  instructions: string | null;
  accounts: BankAccountRequest[];
}

/** Mirrors backend billing.application.port.in.FeePriceGridView.LevelColumn. */
export interface FeePriceLevelColumn {
  levelId: string;
  levelName: string;
}

/**
 * Mirrors backend billing.application.port.in.FeePriceGridView.FeeRow.PriceCell - one priced
 * (level, term) cell. `termNumber` is `null` iff the row's own `priceVariesByTerm` is false.
 */
export interface FeePriceCell {
  levelId: string;
  termNumber: number | null;
  amount: number;
}

/**
 * Mirrors backend billing.application.port.in.FeePriceGridView.FeeRow. `prices` is a flat list of
 * only real, priced cells - an absent cell means "not charged," never zero - one shape for both a
 * uniform fee (every cell's `termNumber` is `null`) and a per-term one (Phase 23), rather than a
 * nested `Record<levelId, Record<termNumber, amount>>` a reader would have to branch on.
 */
export interface FeePriceRow {
  feeId: string;
  feeName: string;
  applicability: FeeApplicability;
  /** This fee's own 1-3 subset - `null` for a FIRST_TERM_ONLY fee. */
  termNumbers: number[] | null;
  compulsory: boolean;
  priceVariesByTerm: boolean;
  applicableLevelIds: string[];
  prices: FeePriceCell[];
}

/** Mirrors backend billing.application.port.in.FeePriceGridView - one branch's one session's fee price grid. */
export interface FeePriceGridView {
  branchId: string;
  branchName: string;
  sessionId: string;
  sessionName: string;
  levels: FeePriceLevelColumn[];
  fees: FeePriceRow[];
}

/**
 * A null amount clears that (feeId, levelId, termNumber) row. `termNumber` must be `null` for a
 * fee not priced per term, and one of the fee's own terms for one that is - either mismatch fails
 * as a row outcome, never a thrown error.
 */
export interface SavePriceRow {
  feeId: string;
  levelId: string;
  termNumber: number | null;
  amount: number | null;
}

/** Mirrors backend ManageFeePricesUseCase.RowOutcome - keyed by (feeId, levelId, termNumber), not a row id. */
export interface FeePriceRowOutcome {
  feeId: string;
  levelId: string;
  termNumber: number | null;
  success: boolean;
  message: string | null;
}

export interface SavePricesResult {
  outcomes: FeePriceRowOutcome[];
}

/** Mirrors backend ManageFeePricesUseCase.BranchCopyOutcome - copied/skipped count price rows, not fees. */
export interface BranchCopyOutcome {
  branchId: string;
  branchName: string | null;
  success: boolean;
  copied: number;
  skipped: number;
  message: string | null;
}

export interface CopyPricesResult {
  outcomes: BranchCopyOutcome[];
}

/** Mirrors backend billing.application.port.in.BillLineView. `feeId` is `null` for a custom charge line (Phase 25) - a StudentBillExtra with no catalogue fee behind it. */
export interface BillLineView {
  feeId: string | null;
  feeName: string;
  amount: number;
}

/**
 * Mirrors backend billing.application.port.in.TransportFareLineView - one row of the published,
 * informational school-bus fare table, identical on every bill in the branch regardless of who
 * rides. Either amount is `null` when that direction isn't priced on the route for the session.
 */
export interface TransportFareLineView {
  routeName: string;
  oneWayAmount: number | null;
  toAndFroAmount: number | null;
}

/**
 * Mirrors backend billing.application.port.in.BillView - one student's rendered bill. Staff
 * preview shape, reused verbatim by the guardian ward view (Phase 21G) and the PDF (Phase 21E).
 * `chargedLines` (Phase 25 rename from `compulsoryLines`) is every line that counts toward
 * `total` - every compulsory fee, every selected optional fee, and every custom extra charge.
 * `optionalLines` lists only the school's optional fees this student is NOT selected for, for
 * display only, and never touches `total`. `transportFares` is the published school-bus fare
 * table (Phase 22 revision) - identical on every bill in the branch. `advance` (Phase 24) is true
 * when this student has no real enrollment yet in `sessionId` and is billed against an
 * advance-bill plan instead, at that plan's planned level.
 */
export interface BillView {
  studentId: string;
  studentName: string;
  admissionNumber: string;
  classId: string;
  className: string;
  levelId: string;
  levelName: string;
  sessionId: string;
  sessionName: string | null;
  termId: string;
  termName: string;
  termNumber: number;
  billReference: string;
  billable: boolean;
  chargedLines: BillLineView[];
  optionalLines: BillLineView[];
  transportFares: TransportFareLineView[];
  total: number;
  currency: string;
  bankAccounts: BankAccountView[];
  instructions: string | null;
  advance: boolean;
}

/** Mirrors backend billing.application.port.in.BillSummaryView - one class roster row. A non-billable student shows as "No bill" rather than being omitted. `advance` (Phase 24) mirrors BillView's own field. */
export interface BillSummaryView {
  studentId: string;
  studentName: string;
  admissionNumber: string;
  billable: boolean;
  total: number;
  currency: string;
  advance: boolean;
}

/** Mirrors backend billing.application.port.in.BranchBillingSummaryView.LevelSummary. */
export interface BranchBillingLevelSummary {
  levelId: string;
  levelName: string;
  billableStudentCount: number;
  expectedRevenue: number;
}

/** Mirrors backend billing.application.port.in.BranchBillingSummaryView - one branch's one term's expected compulsory revenue. */
export interface BranchBillingSummaryView {
  branchId: string;
  branchName: string;
  termId: string;
  termName: string;
  currency: string;
  totalExpectedRevenue: number;
  byLevel: BranchBillingLevelSummary[];
}

const FEES_BASE = "/api/v1/billing/fees";
const SETTINGS_BASE = "/api/v1/billing/settings";
const PRICES_BASE = "/api/v1/billing/prices";
const BILLING_BASE = "/api/v1/billing";

export function listFees(): Promise<FeeView[]> {
  return apiFetch<FeeView[]>(FEES_BASE);
}

export function createFee(request: SaveFeeRequest): Promise<FeeView> {
  return apiFetch<FeeView>(FEES_BASE, { method: "POST", body: JSON.stringify(request) });
}

export function updateFee(feeId: string, request: SaveFeeRequest): Promise<FeeView> {
  return apiFetch<FeeView>(`${FEES_BASE}/${feeId}`, { method: "PUT", body: JSON.stringify(request) });
}

export function deleteFee(feeId: string): Promise<void> {
  return apiFetch<void>(`${FEES_BASE}/${feeId}`, { method: "DELETE" });
}

export function getBillingSettings(): Promise<BillingSettingsView> {
  return apiFetch<BillingSettingsView>(SETTINGS_BASE);
}

export function saveBillingSettings(request: SaveBillingSettingsRequest): Promise<BillingSettingsView> {
  return apiFetch<BillingSettingsView>(SETTINGS_BASE, { method: "PUT", body: JSON.stringify(request) });
}

/** branchId is optional for a BRANCH_ADMIN - their own branch is derived server-side; a SCHOOL_ADMIN must supply one. */
export function getFeePriceGrid(sessionId: string, branchId?: string): Promise<FeePriceGridView> {
  const params = new URLSearchParams({ sessionId });
  if (branchId) params.set("branchId", branchId);
  return apiFetch<FeePriceGridView>(`${PRICES_BASE}?${params}`);
}

export function saveFeePrices(
  sessionId: string,
  prices: SavePriceRow[],
  branchId?: string,
): Promise<SavePricesResult> {
  const params = new URLSearchParams({ sessionId });
  if (branchId) params.set("branchId", branchId);
  return apiFetch<SavePricesResult>(`${PRICES_BASE}?${params}`, {
    method: "PUT",
    body: JSON.stringify({ prices }),
  });
}

export function copyFeePrices(
  sourceSessionId: string,
  targetSessionId: string,
  branchIds: string[],
): Promise<CopyPricesResult> {
  return apiFetch<CopyPricesResult>(`${PRICES_BASE}/copy`, {
    method: "POST",
    body: JSON.stringify({ sourceSessionId, targetSessionId, branchIds }),
  });
}

/** A staff preview of one student's bill for one term - 404s if the student isn't billable. */
export function getStudentBill(studentId: string, termId: string): Promise<BillView> {
  const params = new URLSearchParams({ termId });
  return apiFetch<BillView>(`${BILLING_BASE}/students/${studentId}/bill?${params}`);
}

/** One class's whole roster for one term - every student, a non-billable one shown as "No bill". */
export function getClassBills(classId: string, termId: string): Promise<BillSummaryView[]> {
  const params = new URLSearchParams({ termId });
  return apiFetch<BillSummaryView[]>(`${BILLING_BASE}/classes/${classId}/bills?${params}`);
}

/** branchId is optional for a BRANCH_ADMIN - their own branch is derived server-side; a SCHOOL_ADMIN must supply one. */
export function getBillingSummary(termId: string, branchId?: string): Promise<BranchBillingSummaryView> {
  const params = new URLSearchParams({ termId });
  if (branchId) params.set("branchId", branchId);
  return apiFetch<BranchBillingSummaryView>(`${BILLING_BASE}/summary?${params}`);
}

/** One student's bill as a PDF - 404s if the student isn't billable, the `getStudentBill` shape. */
export function getStudentBillPdf(studentId: string, termId: string): Promise<Blob> {
  const params = new URLSearchParams({ termId });
  return apiFetchBlob(`${BILLING_BASE}/students/${studentId}/bill/pdf?${params}`);
}

/**
 * Mirrors backend billing.application.port.in.ManageStudentBillAdjustmentsUseCase.FeeRow (Phase
 * 25) - one active, level-applicable STANDARD fee, whether or not it's applicable this term.
 * `standardAmount` is `null` when no fee price row exists for this (level, branch, session, term).
 * `selected`/`overrideAmount`/`thisTermOnly` mirror this student's own resolved adjustment, if
 * any - `thisTermOnly` distinguishes a standing row (`false`) from one scoped to this term alone.
 * `effectiveAmount` is `null` when the fee is not charged at all this term.
 */
export interface StudentBillFeeRow {
  feeId: string;
  feeName: string;
  compulsory: boolean;
  applicableThisTerm: boolean;
  standardAmount: number | null;
  selected: boolean;
  overrideAmount: number | null;
  thisTermOnly: boolean;
  effectiveAmount: number | null;
}

/** Mirrors backend billing.application.port.in.ManageStudentBillAdjustmentsUseCase.ExtraRow (Phase 25) - a custom charge applicable this term. */
export interface StudentBillExtraRow {
  id: string;
  label: string;
  amount: number;
  thisTermOnly: boolean;
  position: number;
}

/**
 * Mirrors backend billing.application.port.in.ManageStudentBillAdjustmentsUseCase.
 * TransportRouteOption (Phase 26) - one route offered to this student's branch, priced for the
 * billed term's session where available. A `null` direction amount means that leg isn't priced
 * and must not be offered as a choice.
 */
export interface StudentBillTransportRouteOption {
  routeId: string;
  routeName: string;
  oneWayAmount: number | null;
  toAndFroAmount: number | null;
}

/**
 * Mirrors backend billing.application.port.in.ManageStudentBillAdjustmentsUseCase.TransportView
 * (Phase 26, re-keyed in Phase 29) - this student's own school-bus assignment, if any, and the
 * routes available to assign. `assignable` is `false` only when this branch has no active route
 * priced at all for the billed term's session yet - an advance-billed student is assignable
 * exactly like a real one, once routes are priced for the session they're being billed in advance
 * for. `routeId`/`direction`/`amount` are all `null` when the student isn't currently a rider.
 */
export interface StudentBillTransportView {
  assignable: boolean;
  unassignableReason: string | null;
  routeId: string | null;
  direction: TransportDirection | null;
  amount: number | null;
  routes: StudentBillTransportRouteOption[];
}

/**
 * Mirrors backend billing.application.port.in.ManageStudentBillAdjustmentsUseCase.
 * StudentBillAdjustmentsView (Phase 25, Phase 26, Phase 28) - one student's editable per-fee opt-
 * ins/overrides, custom charges, and school-bus assignment for one term. `fees` covers every
 * active, level-applicable STANDARD fee - compulsory rows included (editable amount, no selection
 * toggle) alongside optional ones (selection toggle plus editable amount). The school bus is a
 * separate `transport` field, not a `FeeRow` - a TRANSPORT fee is priced per route, not per level.
 * `classId`/`className` are always the student's own current class, but `levelId`/`levelName` are
 * the level the bill is actually *priced* at - the student's own class level, unless `advance` is
 * `true`, in which case it's the matching advance-bill plan's billing level - `fees`/`billable`
 * are resolved against that same level, never the class's own.
 */
export interface StudentBillAdjustmentsView {
  studentId: string;
  studentName: string;
  admissionNumber: string;
  classId: string;
  className: string;
  levelId: string;
  levelName: string;
  termId: string;
  termName: string;
  termNumber: number;
  sessionId: string;
  sessionName: string | null;
  currency: string | null;
  billable: boolean;
  published: boolean;
  advance: boolean;
  fees: StudentBillFeeRow[];
  extras: StudentBillExtraRow[];
  transport: StudentBillTransportView;
}

/** One fee row of a save request - a row with neither `selected` nor a non-null `overrideAmount` is rejected (422) rather than written as a no-op. */
export interface FeeAdjustmentRequest {
  feeId: string;
  selected: boolean;
  overrideAmount: number | null;
  thisTermOnly: boolean;
}

/** One custom-charge row of a save request. */
export interface ExtraRequest {
  label: string;
  amount: number;
  thisTermOnly: boolean;
}

/** One student's optional-fee opt-ins, per-fee overrides, and custom charges for one term - see `StudentBillAdjustmentsView`'s own doc for the full-replace contract. */
export function getStudentBillAdjustments(studentId: string, termId: string): Promise<StudentBillAdjustmentsView> {
  const params = new URLSearchParams({ termId });
  return apiFetch<StudentBillAdjustmentsView>(`${BILLING_BASE}/students/${studentId}/adjustments?${params}`);
}

/**
 * Full replace - `fees` omits any fee with no desired adjustment; `extras` is the
 * applicable-this-term set in display order. `transportRouteId`/`transportDirection` both `null`
 * clears any existing school-bus assignment for the billed term's session (Phase 26), and never
 * touches an assignment the student carries for any other session; either field supplied alone is
 * rejected (422).
 */
export function saveStudentBillAdjustments(
  studentId: string,
  termId: string,
  fees: FeeAdjustmentRequest[],
  extras: ExtraRequest[],
  transportRouteId: string | null,
  transportDirection: TransportDirection | null,
): Promise<StudentBillAdjustmentsView> {
  const params = new URLSearchParams({ termId });
  return apiFetch<StudentBillAdjustmentsView>(`${BILLING_BASE}/students/${studentId}/adjustments?${params}`, {
    method: "PUT",
    body: JSON.stringify({ fees, extras, transportRouteId, transportDirection }),
  });
}

/**
 * A bulk bill export job - see `BillExportView` (backend) and `BillExportCard`. The
 * `api/reports.ts` `ClassReportExportView` shape, minus the `ResultScope` axis (a bill has no
 * mid-term/end-of-term split). Class-scoped since Phase 21E; Phase 30 added the level-scoped
 * target (the Advance bills tab's own export) sharing this same job shape - see `BillExportTarget`.
 */
export interface BillExportView {
  id: string;
  status: "QUEUED" | "RUNNING" | "READY" | "FAILED";
  totalStudents: number;
  renderedCount: number;
  failedCount: number;
  fileName: string | null;
  sizeBytes: number | null;
  expiresAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * What a bill export renders (Phase 30) - one class+term (`BillsTab`), or one branch's one
 * advance-bill source level+term (`AdvanceBillsTab`). `branchId` on the level target is optional
 * for a `BRANCH_ADMIN` (their own branch is derived server-side); a `SCHOOL_ADMIN` must supply it.
 */
export type BillExportTarget =
  | { kind: "class"; classId: string }
  | { kind: "level"; levelId: string; branchId?: string };

function billExportPath(target: BillExportTarget, termId: string): string {
  if (target.kind === "class") {
    return `${BILLING_BASE}/classes/${target.classId}/exports?termId=${termId}`;
  }
  const params = new URLSearchParams({ termId });
  if (target.branchId) params.set("branchId", target.branchId);
  return `${BILLING_BASE}/levels/${target.levelId}/exports?${params}`;
}

/** Creates a fresh export job, or regenerates/returns the existing one for this target+term. */
export function createBillExport(target: BillExportTarget, termId: string): Promise<BillExportView> {
  return apiFetch<BillExportView>(billExportPath(target, termId), { method: "POST" });
}

/** The export job's current status, for polling - `null` when none has ever been requested for this target+term. */
export async function getBillExport(target: BillExportTarget, termId: string): Promise<BillExportView | null> {
  try {
    return await apiFetch<BillExportView>(billExportPath(target, termId));
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

/** The finished ZIP archive - only call once the job is `READY`. */
export function downloadBillExport(target: BillExportTarget, termId: string): Promise<Blob> {
  return apiFetchBlob(billExportPath(target, termId).replace("/exports?", "/exports/download?"));
}

/** Mirrors backend billing.application.port.in.BillPublicationView.DeliveryCounters. */
export interface BillDeliveryCounters {
  pending: number;
  processing: number;
  sent: number;
  sentWithoutBill: number;
  cancelled: number;
  failed: number;
}

/** Mirrors backend billing.application.port.in.BillPublicationView - one branch's one term's publication state plus the delivery queue's per-status counters. */
export interface BillPublicationView {
  branchId: string;
  branchName: string;
  termId: string;
  termName: string;
  published: boolean;
  publishedAt: string | null;
  deliveries: BillDeliveryCounters;
}

/** Mirrors backend billing.application.port.in.BillPublicationPreflightView.UnpricedGap - named, not merely counted, so an admin can go fix the price grid directly. */
export interface UnpricedGap {
  feeId: string;
  feeName: string;
  levelId: string;
  levelName: string;
  affectedStudents: number;
}

/** Mirrors backend billing.application.port.in.BillPublicationPreflightView.UnpricedRoute - a SEPARATE, non-blocking list (a school-bus fee is always optional, so this can never be a compulsory gap). */
export interface UnpricedTransportRoute {
  routeId: string;
  routeName: string;
  direction: TransportDirection;
  affectedStudents: number;
}

/** Mirrors backend billing.application.port.in.BillPublicationPreflightView.UnplannedLevel (Phase 24, re-keyed to the level in Phase 27) - a level with active, not-yet-enrolled students but no advance-bill plan row for this session. Only ever populated when the session has at least one plan row elsewhere. */
export interface UnplannedLevel {
  levelId: string;
  levelName: string;
  activeStudents: number;
}

/**
 * Mirrors backend billing.application.port.in.BillPublicationPreflightView - a GET, not a hard
 * gate. `expectedTotal` (Phase 25 rename from `expectedCompulsoryTotal`) sums every billable
 * student's charged total - compulsory fees, selected optional fees, and custom extras alike.
 * `unpricedSelectedFees` (Phase 25) is a SEPARATE, non-blocking list, the `unpricedTransportRoutes`
 * precedent - an optional fee a student is selected for but with no price row and no per-student
 * override, never a normal compulsory gap.
 */
export interface BillPublicationPreflightView {
  billableStudents: number;
  studentsWithoutBill: number;
  unpricedCompulsoryFees: UnpricedGap[];
  expectedTotal: number;
  unpricedSelectedFees: UnpricedGap[];
  unpricedTransportRoutes: UnpricedTransportRoute[];
  advanceStudents: number;
  unplannedLevels: UnplannedLevel[];
}

/** Mirrors backend billing.application.port.in.PublishBillsUseCase.IssueMissingResult. */
export interface IssueMissingResult {
  queued: number;
}

const PUBLICATIONS_BASE = "/api/v1/billing/publications";

/** branchId is optional for a BRANCH_ADMIN - their own branch is derived server-side; a SCHOOL_ADMIN must supply one. */
export function getBillPublication(termId: string, branchId?: string): Promise<BillPublicationView> {
  const params = new URLSearchParams({ termId });
  if (branchId) params.set("branchId", branchId);
  return apiFetch<BillPublicationView>(`${PUBLICATIONS_BASE}?${params}`);
}

export function getBillPublicationPreflight(termId: string, branchId?: string): Promise<BillPublicationPreflightView> {
  const params = new URLSearchParams({ termId });
  if (branchId) params.set("branchId", branchId);
  return apiFetch<BillPublicationPreflightView>(`${PUBLICATIONS_BASE}/preflight?${params}`);
}

export function publishBills(termId: string, branchId?: string): Promise<void> {
  return apiFetch<void>(PUBLICATIONS_BASE, {
    method: "POST",
    body: JSON.stringify({ branchId: branchId ?? null, termId }),
  });
}

export function unpublishBills(termId: string, branchId?: string): Promise<void> {
  const params = new URLSearchParams({ termId });
  if (branchId) params.set("branchId", branchId);
  return apiFetch<void>(`${PUBLICATIONS_BASE}?${params}`, { method: "DELETE" });
}

/** "Send bills to new students" - queues a delivery for every billable student not already tracked. Idempotent. */
export function issueMissingBillDeliveries(termId: string, branchId?: string): Promise<IssueMissingResult> {
  return apiFetch<IssueMissingResult>(`${PUBLICATIONS_BASE}/deliveries/missing`, {
    method: "POST",
    body: JSON.stringify({ branchId: branchId ?? null, termId }),
  });
}

// ============================================================================
// Transport (school bus) - Phase 22. A dedicated pricing axis alongside the
// ordinary fee catalogue: routes are branch-scoped pickup areas, each priced
// per session with two independent amounts (one-way, to-and-fro), and a
// student is assigned to at most one route+direction per session (per
// enrollment - the same grain as selective-subject registration, so it never
// carries over a promotion). See billing-module.md's Phase 22 section.
// ============================================================================

/** Mirrors backend billing.domain.TransportDirection. `label()` on the backend becomes a lookup here - see `TRANSPORT_DIRECTION_LABELS`. */
export type TransportDirection = "ONE_WAY" | "TO_AND_FRO";

export const TRANSPORT_DIRECTION_LABELS: Record<TransportDirection, string> = {
  ONE_WAY: "One way",
  TO_AND_FRO: "Two ways",
};

/** Mirrors backend billing.application.port.in.TransportRouteView - one branch's named pickup area. */
export interface TransportRouteView {
  id: string;
  branchId: string;
  name: string;
  description: string | null;
  active: boolean;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface SaveTransportRouteRequest {
  name: string;
  description: string | null;
  active: boolean;
  position: number;
}

/** Mirrors backend billing.application.port.in.TransportFareGridView.RouteRow - either amount is null when that direction isn't priced yet. */
export interface TransportFareRouteRow {
  routeId: string;
  routeName: string;
  active: boolean;
  oneWayAmount: number | null;
  toAndFroAmount: number | null;
}

/** Mirrors backend billing.application.port.in.TransportFareGridView - one branch's one session's transport fare grid. */
export interface TransportFareGridView {
  branchId: string;
  branchName: string;
  sessionId: string;
  sessionName: string;
  routes: TransportFareRouteRow[];
}

/** Both amounts null clears the row - the fee-price grid's own null-clears idiom. */
export interface SaveTransportFareRow {
  routeId: string;
  oneWayAmount: number | null;
  toAndFroAmount: number | null;
}

/** Mirrors backend ManageTransportFaresUseCase.RowOutcome - keyed by routeId, not a row id. */
export interface TransportFareRowOutcome {
  routeId: string;
  success: boolean;
  message: string | null;
}

export interface SaveTransportFaresResult {
  outcomes: TransportFareRowOutcome[];
}

/** Mirrors backend ManageTransportFaresUseCase.BranchCopyOutcome - copied/skipped count fare rows, not routes. */
export interface TransportFareBranchCopyOutcome {
  branchId: string;
  branchName: string | null;
  success: boolean;
  copied: number;
  skipped: number;
  message: string | null;
}

export interface CopyTransportFaresResult {
  outcomes: TransportFareBranchCopyOutcome[];
}

/** Mirrors backend TransportRidersView.RouteOption - fare availability per direction, so an unpriced one can be greyed out before it's ever chosen. */
export interface TransportRouteOption {
  routeId: string;
  routeName: string;
  oneWayPriced: boolean;
  toAndFroPriced: boolean;
}

/** Mirrors backend TransportRidersView.StudentRow - routeId/direction are null when the student has no current assignment. */
export interface TransportRiderRow {
  enrollmentId: string;
  studentId: string;
  studentName: string;
  admissionNumber: string;
  routeId: string | null;
  direction: TransportDirection | null;
}

/** Mirrors backend billing.application.port.in.TransportRidersView. */
export interface TransportRidersView {
  classId: string;
  sessionId: string;
  routes: TransportRouteOption[];
  students: TransportRiderRow[];
}

/** A null routeId (or direction) removes that student's assignment. */
export interface SaveTransportRiderRow {
  enrollmentId: string;
  routeId: string | null;
  direction: TransportDirection | null;
}

/** Mirrors backend ManageTransportRidersUseCase.RowOutcome. */
export interface TransportRiderRowOutcome {
  enrollmentId: string;
  success: boolean;
  message: string | null;
}

export interface SaveTransportRidersResult {
  outcomes: TransportRiderRowOutcome[];
}

const TRANSPORT_BASE = "/api/v1/billing/transport";

/** branchId is optional for a BRANCH_ADMIN - their own branch is derived server-side; a SCHOOL_ADMIN must supply one. */
export function listTransportRoutes(branchId?: string): Promise<TransportRouteView[]> {
  const params = new URLSearchParams();
  if (branchId) params.set("branchId", branchId);
  const query = params.toString();
  return apiFetch<TransportRouteView[]>(`${TRANSPORT_BASE}/routes${query ? `?${query}` : ""}`);
}

export function createTransportRoute(
  request: SaveTransportRouteRequest,
  branchId?: string,
): Promise<TransportRouteView> {
  const params = new URLSearchParams();
  if (branchId) params.set("branchId", branchId);
  const query = params.toString();
  return apiFetch<TransportRouteView>(`${TRANSPORT_BASE}/routes${query ? `?${query}` : ""}`, {
    method: "POST",
    body: JSON.stringify(request),
  });
}

export function updateTransportRoute(
  routeId: string,
  request: SaveTransportRouteRequest,
  branchId?: string,
): Promise<TransportRouteView> {
  const params = new URLSearchParams();
  if (branchId) params.set("branchId", branchId);
  const query = params.toString();
  return apiFetch<TransportRouteView>(`${TRANSPORT_BASE}/routes/${routeId}${query ? `?${query}` : ""}`, {
    method: "PUT",
    body: JSON.stringify(request),
  });
}

export function deleteTransportRoute(routeId: string, branchId?: string): Promise<void> {
  const params = new URLSearchParams();
  if (branchId) params.set("branchId", branchId);
  const query = params.toString();
  return apiFetch<void>(`${TRANSPORT_BASE}/routes/${routeId}${query ? `?${query}` : ""}`, { method: "DELETE" });
}

export function getTransportFareGrid(sessionId: string, branchId?: string): Promise<TransportFareGridView> {
  const params = new URLSearchParams({ sessionId });
  if (branchId) params.set("branchId", branchId);
  return apiFetch<TransportFareGridView>(`${TRANSPORT_BASE}/fares?${params}`);
}

export function saveTransportFares(
  sessionId: string,
  fares: SaveTransportFareRow[],
  branchId?: string,
): Promise<SaveTransportFaresResult> {
  const params = new URLSearchParams({ sessionId });
  if (branchId) params.set("branchId", branchId);
  return apiFetch<SaveTransportFaresResult>(`${TRANSPORT_BASE}/fares?${params}`, {
    method: "PUT",
    body: JSON.stringify({ fares }),
  });
}

export function copyTransportFares(
  sourceSessionId: string,
  targetSessionId: string,
  branchIds: string[],
): Promise<CopyTransportFaresResult> {
  return apiFetch<CopyTransportFaresResult>(`${TRANSPORT_BASE}/fares/copy`, {
    method: "POST",
    body: JSON.stringify({ sourceSessionId, targetSessionId, branchIds }),
  });
}

export function getTransportRiders(classId: string, sessionId: string): Promise<TransportRidersView> {
  const params = new URLSearchParams({ classId, sessionId });
  return apiFetch<TransportRidersView>(`${TRANSPORT_BASE}/riders?${params}`);
}

export function saveTransportRiders(
  classId: string,
  sessionId: string,
  riders: SaveTransportRiderRow[],
): Promise<SaveTransportRidersResult> {
  const params = new URLSearchParams({ classId, sessionId });
  return apiFetch<SaveTransportRidersResult>(`${TRANSPORT_BASE}/riders?${params}`, {
    method: "PUT",
    body: JSON.stringify({ riders }),
  });
}

// ============================================================================
// Advance bills (Phase 24, re-keyed to the level and given its own tab in
// Phase 27) - a school bills next session's fees before promotion runs, by
// mapping a LEVEL to the level its students will be billed at. One small plan
// per branch per session: absence of a row means a level is excluded from
// advance billing entirely.
// ============================================================================

/** Mirrors backend billing.application.port.in.AdvanceBillPlanView.LevelOption - the billing-level picker's own candidate list. */
export interface AdvanceBillLevelOption {
  levelId: string;
  displayName: string;
}

/**
 * Mirrors backend billing.application.port.in.AdvanceBillPlanView.LevelRow. `billingLevelId`/
 * `billingLevelName` are null when this level has no plan row for `sessionId` - excluded from
 * advance billing. `classCount` is how many of this branch's classes sit at this level.
 * `activeStudents` sums those classes' current active rosters (any session); `alreadyEnrolled` is
 * how many of those already hold a real enrollment in `sessionId` (already promoted, billed at
 * their real level regardless of this row) - the difference is how many students this level's
 * plan would actually advance-bill.
 */
export interface AdvanceBillPlanLevelRow {
  sourceLevelId: string;
  sourceLevelName: string;
  billingLevelId: string | null;
  billingLevelName: string | null;
  classCount: number;
  activeStudents: number;
  alreadyEnrolled: number;
}

/** Mirrors backend billing.application.port.in.AdvanceBillPlanView - one branch's one (upcoming) session's advance-bill plan. */
export interface AdvanceBillPlanView {
  branchId: string;
  branchName: string;
  sessionId: string;
  sessionName: string;
  levels: AdvanceBillLevelOption[];
  rows: AdvanceBillPlanLevelRow[];
}

/** A null billingLevelId excludes sourceLevelId from sessionId's advance-bill plan - the fee-price grid's own null-clears idiom. */
export interface SaveAdvanceBillPlanRow {
  sourceLevelId: string;
  billingLevelId: string | null;
}

/** Mirrors backend ManageAdvanceBillPlansUseCase.RowOutcome - keyed by sourceLevelId, not a row id. */
export interface AdvanceBillPlanRowOutcome {
  sourceLevelId: string;
  success: boolean;
  message: string | null;
}

export interface SaveAdvanceBillPlanResult {
  outcomes: AdvanceBillPlanRowOutcome[];
}

/** Mirrors backend ManageAdvanceBillPlansUseCase.BranchCopyOutcome - copied/skipped count plan rows (levels), not classes. */
export interface AdvanceBillPlanBranchCopyOutcome {
  branchId: string;
  branchName: string | null;
  success: boolean;
  copied: number;
  skipped: number;
  message: string | null;
}

export interface CopyAdvanceBillPlansResult {
  outcomes: AdvanceBillPlanBranchCopyOutcome[];
}

/**
 * Mirrors backend billing.application.port.in.AdvanceBillPreviewView - the bills one source
 * level's plan would generate for one term of the planned session, the Advance bills tab's own
 * read. `billingLevelId`/`billingLevelName` are null when the source level has no plan row at all
 * - `students` is then always empty. `students` reuses `BillSummaryView` verbatim, every row here
 * carrying `advance: true`.
 */
export interface AdvanceBillPreviewView {
  branchId: string;
  termId: string;
  termName: string;
  sourceLevelId: string;
  sourceLevelName: string;
  billingLevelId: string | null;
  billingLevelName: string | null;
  currency: string;
  billableStudents: number;
  studentsWithoutBill: number;
  expectedTotal: number;
  students: BillSummaryView[];
}

const ADVANCE_BILL_PLANS_BASE = "/api/v1/billing/advance-plans";

/** branchId is optional for a BRANCH_ADMIN - their own branch is derived server-side; a SCHOOL_ADMIN must supply one. */
export function getAdvanceBillPlans(sessionId: string, branchId?: string): Promise<AdvanceBillPlanView> {
  const params = new URLSearchParams({ sessionId });
  if (branchId) params.set("branchId", branchId);
  return apiFetch<AdvanceBillPlanView>(`${ADVANCE_BILL_PLANS_BASE}?${params}`);
}

export function saveAdvanceBillPlans(
  sessionId: string,
  plans: SaveAdvanceBillPlanRow[],
  branchId?: string,
): Promise<SaveAdvanceBillPlanResult> {
  const params = new URLSearchParams({ sessionId });
  if (branchId) params.set("branchId", branchId);
  return apiFetch<SaveAdvanceBillPlanResult>(`${ADVANCE_BILL_PLANS_BASE}?${params}`, {
    method: "PUT",
    body: JSON.stringify({ plans }),
  });
}

export function copyAdvanceBillPlans(
  sourceSessionId: string,
  targetSessionId: string,
  branchIds: string[],
): Promise<CopyAdvanceBillPlansResult> {
  return apiFetch<CopyAdvanceBillPlansResult>(`${ADVANCE_BILL_PLANS_BASE}/copy`, {
    method: "POST",
    body: JSON.stringify({ sourceSessionId, targetSessionId, branchIds }),
  });
}

/** branchId is optional for a BRANCH_ADMIN - their own branch is derived server-side; a SCHOOL_ADMIN must supply one. */
export function getAdvanceBillPreview(
  sessionId: string,
  termId: string,
  sourceLevelId: string,
  branchId?: string,
): Promise<AdvanceBillPreviewView> {
  const params = new URLSearchParams({ sessionId, termId, sourceLevelId });
  if (branchId) params.set("branchId", branchId);
  return apiFetch<AdvanceBillPreviewView>(`${ADVANCE_BILL_PLANS_BASE}/preview?${params}`);
}
