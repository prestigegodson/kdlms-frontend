import { ChevronDown, ChevronUp, Plus, Receipt, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import {
  TRANSPORT_DIRECTION_LABELS,
  type BillView,
  type ProspectiveBillOptionsView,
  type ProspectiveBillRequest,
  type ProspectiveExtraCharge,
  type ProspectiveFeeSelection,
  type TransportDirection,
  emailProspectiveBill,
  getProspectiveBillOptions,
  getProspectiveBillPdf,
  previewProspectiveBill,
} from "@/api/billing";
import { ApiError } from "@/api/client";
import { can } from "@/auth/permissions";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Checkbox } from "@/components/ui/Checkbox";
import { EmptyState } from "@/components/ui/EmptyState";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { StickySubHeader } from "@/components/ui/StickySubHeader";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/Table";
import { BillCard } from "@/features/billing/components/BillCard";
import { LevelTermPicker } from "@/features/billing/components/LevelTermPicker";
import { BranchFilter } from "@/features/branches/components/BranchFilter";
import { useBranchScope } from "@/features/branches/useBranchScope";
import { useAuthStore } from "@/stores/authStore";
import { useFeatureStore } from "@/stores/featureStore";
import { downloadBlob } from "@/utils/download";
import { formatMoney } from "@/utils/currency";

/** One editable fee row's local state - `amount` is the raw text field, mirroring `standardAmount` until the admin overrides it. */
interface FeeDraft {
  feeId: string;
  feeName: string;
  compulsory: boolean;
  priced: boolean;
  standardAmount: number | null;
  selected: boolean;
  amount: string;
}

interface ExtraDraft {
  label: string;
  amount: string;
}

function toFeeDrafts(options: ProspectiveBillOptionsView): FeeDraft[] {
  return options.fees.map((fee) => ({
    feeId: fee.feeId,
    feeName: fee.feeName,
    compulsory: fee.compulsory,
    priced: fee.priced,
    standardAmount: fee.standardAmount,
    selected: fee.compulsory,
    amount: "",
  }));
}

/**
 * A stateless one-off fee quote for a child who isn't a `students` row yet (Phase 42) - "bill this
 * as a brand-new admission." Nothing here is persisted: there is no roster, no history, and no
 * re-send - Preview/Download/Email all rebuild the request from the form's current state and call
 * the backend fresh. Mirrors `StudentBillAdjustmentsModal`'s fee-row/extras/transport UI shape,
 * minus the `thisTermOnly` scope toggle, which has no meaning for a one-off quote, and minus
 * `applicableThisTerm`, since `getProspectiveBillOptions` only ever returns fees that actually
 * apply this term (the admission-term rule - see the backend's own Javadoc).
 */
export function ProspectiveBillTab() {
  const { ready: branchReady, branchId } = useBranchScope();
  const role = useAuthStore((state) => state.user?.role);
  const entitled = useFeatureStore((state) => state.billing);
  const canGenerate = can.generateProspectiveBills(role, entitled);

  const [levelId, setLevelId] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [termId, setTermId] = useState("");

  const [fullName, setFullName] = useState("");
  const [guardianEmail, setGuardianEmail] = useState("");

  const [options, setOptions] = useState<ProspectiveBillOptionsView | null>(null);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [fees, setFees] = useState<FeeDraft[]>([]);
  const [extras, setExtras] = useState<ExtraDraft[]>([]);
  const [transportRouteId, setTransportRouteId] = useState<string | null>(null);
  const [transportDirection, setTransportDirection] = useState<TransportDirection | null>(null);

  const [preview, setPreview] = useState<BillView | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [emailSuccess, setEmailSuccess] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [emailing, setEmailing] = useState(false);

  // A branch/level/term change clears the loaded options/preview during render (the
  // AdminResultsPanel idiom) - a previous selection's fees would otherwise flash before the fetch
  // lands, and a stale preview would silently describe a different term.
  const selectionKey = `${branchId ?? ""}|${levelId}|${termId}`;
  const [lastSelectionKey, setLastSelectionKey] = useState(selectionKey);
  if (selectionKey !== lastSelectionKey) {
    setLastSelectionKey(selectionKey);
    setOptions(null);
    setOptionsError(null);
    setFees([]);
    setExtras([]);
    setTransportRouteId(null);
    setTransportDirection(null);
    setPreview(null);
    setActionError(null);
    setEmailSuccess(null);
  }

  useEffect(() => {
    if (!levelId || !termId) return;
    getProspectiveBillOptions(levelId, termId, branchId)
      .then((view) => {
        setOptions(view);
        setFees(toFeeDrafts(view));
      })
      .catch((error: unknown) => setOptionsError(error instanceof ApiError ? error.message : "Failed to load fees"));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- branchId is read for the fetch, not a re-trigger of its own
  }, [levelId, termId]);

  const selectedRoute = options?.routes.find((route) => route.routeId === transportRouteId) ?? null;
  const transportFare =
    selectedRoute == null || transportDirection == null
      ? null
      : transportDirection === "ONE_WAY"
        ? selectedRoute.oneWayAmount
        : selectedRoute.toAndFroAmount;

  function updateTransportRoute(routeId: string) {
    const route = options?.routes.find((r) => r.routeId === routeId) ?? null;
    const directionStillOffered =
      route != null &&
      transportDirection != null &&
      ((transportDirection === "ONE_WAY" && route.oneWayAmount != null) ||
        (transportDirection === "TO_AND_FRO" && route.toAndFroAmount != null));
    setTransportRouteId(routeId || null);
    setTransportDirection(routeId ? (directionStillOffered ? transportDirection : null) : null);
  }

  function updateFee(feeId: string, patch: Partial<FeeDraft>) {
    setFees((current) => current.map((fee) => (fee.feeId === feeId ? { ...fee, ...patch } : fee)));
  }

  function updateExtra(index: number, patch: Partial<ExtraDraft>) {
    setExtras((current) => current.map((extra, i) => (i === index ? { ...extra, ...patch } : extra)));
  }

  function removeExtra(index: number) {
    setExtras((current) => current.filter((_, i) => i !== index));
  }

  function moveExtra(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= extras.length) return;
    setExtras((current) => {
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function addExtra() {
    setExtras((current) => [...current, { label: "", amount: "" }]);
  }

  /** Builds the request from the form's current state, or sets `actionError` and returns `null` if it's invalid client-side. Deeper validation (an unpriced compulsory fee, and so on) is the server's own 422. */
  function buildRequest(): ProspectiveBillRequest | null {
    setActionError(null);
    if (fullName.trim() === "") {
      setActionError("Enter the child's full name.");
      return null;
    }
    if (!levelId || !termId) {
      setActionError("Select a level and a term.");
      return null;
    }

    const feeSelections: ProspectiveFeeSelection[] = [];
    for (const fee of fees) {
      const trimmed = fee.amount.trim();
      let overrideAmount: number | null = null;
      if (trimmed !== "") {
        const parsed = Number(trimmed);
        if (!Number.isFinite(parsed) || parsed < 0) {
          setActionError(`${fee.feeName}: enter a number 0 or greater, or leave the amount blank.`);
          return null;
        }
        overrideAmount = parsed;
      }
      if (!fee.selected && overrideAmount == null) {
        continue;
      }
      feeSelections.push({ feeId: fee.feeId, selected: fee.selected, overrideAmount });
    }

    const extraCharges: ProspectiveExtraCharge[] = [];
    for (const extra of extras) {
      if (extra.label.trim() === "") {
        setActionError("Every custom charge needs a label.");
        return null;
      }
      const amount = Number(extra.amount);
      if (!Number.isFinite(amount) || amount < 0) {
        setActionError(`${extra.label}: enter a number 0 or greater.`);
        return null;
      }
      extraCharges.push({ label: extra.label.trim(), amount });
    }

    if (transportRouteId && !transportDirection) {
      setActionError("Choose a direction for the school bus, or clear the route.");
      return null;
    }

    return {
      fullName: fullName.trim(),
      guardianEmail: guardianEmail.trim() === "" ? null : guardianEmail.trim(),
      branchId: branchId ?? null,
      levelId,
      termId,
      fees: feeSelections,
      extras: extraCharges,
      transportRouteId,
      transportDirection,
    };
  }

  function handlePreview() {
    const request = buildRequest();
    if (!request) return;
    setPreviewing(true);
    setPreview(null);
    setEmailSuccess(null);
    previewProspectiveBill(request)
      .then(setPreview)
      .catch((error: unknown) => setActionError(error instanceof ApiError ? error.message : "Failed to preview the bill"))
      .finally(() => setPreviewing(false));
  }

  function handleDownload() {
    const request = buildRequest();
    if (!request) return;
    setDownloadingPdf(true);
    setEmailSuccess(null);
    getProspectiveBillPdf(request)
      .then((blob) => downloadBlob(blob, `${request.fullName.replace(/\s+/g, "_")}-bill.pdf`))
      .catch((error: unknown) => setActionError(error instanceof ApiError ? error.message : "Failed to download the bill"))
      .finally(() => setDownloadingPdf(false));
  }

  function handleEmail() {
    const request = buildRequest();
    if (!request) return;
    if (!request.guardianEmail) {
      setActionError("Enter the guardian's email to send it.");
      return;
    }
    setEmailing(true);
    setEmailSuccess(null);
    emailProspectiveBill(request)
      .then(() => setEmailSuccess(`Sent to ${request.guardianEmail}.`))
      .catch((error: unknown) => setActionError(error instanceof ApiError ? error.message : "Failed to send the email"))
      .finally(() => setEmailing(false));
  }

  if (!canGenerate) {
    return (
      <EmptyState
        icon={Receipt}
        title="Not available"
        description="Generating a prospective bill isn't available for your role or this school's package."
      />
    );
  }

  return (
    <div className="space-y-6">
      <StickySubHeader collapsible>
        <BranchFilter id="prospective-bill-branch" />
        <LevelTermPicker
          levelId={levelId}
          onLevelChange={setLevelId}
          sessionId={sessionId}
          onSessionChange={setSessionId}
          termId={termId}
          onTermChange={setTermId}
          idPrefix="prospective-bill"
        />
      </StickySubHeader>

      {!levelId || !termId ? (
        branchReady && (
          <EmptyState
            icon={Receipt}
            title="Select a level and a term"
            description="Pick the branch, level, session and term to quote fees for, as though this child were a brand-new admission."
          />
        )
      ) : (
        <>
          {optionsError && <Alert variant="error">{optionsError}</Alert>}
          {!options && !optionsError && <Skeleton className="h-40 w-full" />}

          {options && (
            <>
              <Card>
                <div className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField label="Child's full name" htmlFor="prospective-bill-name">
                      <Input
                        id="prospective-bill-name"
                        value={fullName}
                        onChange={(event) => setFullName(event.target.value)}
                        placeholder="e.g. Ada Obi"
                      />
                    </FormField>
                    <FormField label="Guardian email (optional)" htmlFor="prospective-bill-email">
                      <Input
                        id="prospective-bill-email"
                        type="email"
                        value={guardianEmail}
                        onChange={(event) => setGuardianEmail(event.target.value)}
                        placeholder="parent@example.com"
                      />
                    </FormField>
                  </div>

                  {actionError && <Alert variant="error">{actionError}</Alert>}
                  {emailSuccess && <Alert variant="success">{emailSuccess}</Alert>}

                  <div>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableHeaderCell>Fee</TableHeaderCell>
                          <TableHeaderCell>Charge</TableHeaderCell>
                          <TableHeaderCell numeric>Standard</TableHeaderCell>
                          <TableHeaderCell numeric>Amount</TableHeaderCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {fees.map((fee) => (
                          <TableRow key={fee.feeId}>
                            <TableCell label="Fee">
                              <div className="flex items-center gap-2">
                                <span>{fee.feeName}</span>
                                <Badge variant={fee.compulsory ? "brand" : "neutral"}>
                                  {fee.compulsory ? "Compulsory" : "Optional"}
                                </Badge>
                              </div>
                            </TableCell>
                            <TableCell label="Charge">
                              {fee.compulsory ? (
                                <span className="text-xs text-slate-400">Always</span>
                              ) : (
                                <Checkbox
                                  aria-label={`Charge ${fee.feeName}`}
                                  checked={fee.selected}
                                  onChange={(event) => updateFee(fee.feeId, { selected: event.target.checked })}
                                />
                              )}
                            </TableCell>
                            <TableCell label="Standard" numeric>
                              <span className="text-slate-500">
                                {fee.standardAmount != null ? formatMoney(fee.standardAmount, options.currency) : "—"}
                              </span>
                            </TableCell>
                            <TableCell label="Amount" numeric>
                              <Input
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                aria-label={`Override amount for ${fee.feeName}`}
                                placeholder={fee.standardAmount != null ? String(fee.standardAmount) : "No price"}
                                className="w-28 text-right tabular-nums"
                                value={fee.amount}
                                onChange={(event) => updateFee(fee.feeId, { amount: event.target.value })}
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {options.routes.length > 0 && (
                    <div>
                      <h3 className="mb-2 text-sm font-medium text-slate-700">School bus</h3>
                      <div className="flex flex-wrap items-end gap-2">
                        <FormField label="Route" htmlFor="prospective-bill-route" className="min-w-[10rem]">
                          <Select
                            id="prospective-bill-route"
                            value={transportRouteId ?? ""}
                            onChange={(event) => updateTransportRoute(event.target.value)}
                          >
                            <option value="">Not riding</option>
                            {options.routes.map((route) => (
                              <option key={route.routeId} value={route.routeId}>
                                {route.routeName}
                              </option>
                            ))}
                          </Select>
                        </FormField>
                        <FormField label="Direction" htmlFor="prospective-bill-direction">
                          <Select
                            id="prospective-bill-direction"
                            disabled={!transportRouteId}
                            value={transportDirection ?? ""}
                            onChange={(event) =>
                              setTransportDirection((event.target.value || null) as TransportDirection | null)
                            }
                          >
                            <option value="">Select…</option>
                            <option
                              value="ONE_WAY"
                              disabled={selectedRoute != null && selectedRoute.oneWayAmount == null}
                            >
                              {TRANSPORT_DIRECTION_LABELS.ONE_WAY}
                              {selectedRoute != null && selectedRoute.oneWayAmount == null ? " (not priced)" : ""}
                            </option>
                            <option
                              value="TO_AND_FRO"
                              disabled={selectedRoute != null && selectedRoute.toAndFroAmount == null}
                            >
                              {TRANSPORT_DIRECTION_LABELS.TO_AND_FRO}
                              {selectedRoute != null && selectedRoute.toAndFroAmount == null ? " (not priced)" : ""}
                            </option>
                          </Select>
                        </FormField>
                        <div className="pb-2 text-sm text-slate-500">
                          Fare: {transportFare != null ? formatMoney(transportFare, options.currency) : "—"}
                        </div>
                      </div>
                    </div>
                  )}

                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <h3 className="text-sm font-medium text-slate-700">Other charges</h3>
                      <Button type="button" variant="secondary" size="sm" onClick={addExtra}>
                        <Plus className="h-4 w-4" aria-hidden="true" /> Add charge
                      </Button>
                    </div>
                    {extras.length === 0 && <p className="text-sm text-slate-500">No custom charges added.</p>}
                    <div className="space-y-2">
                      {extras.map((extra, index) => (
                        <div
                          key={index}
                          className="flex flex-wrap items-end gap-2 rounded-panel border border-slate-200 p-3"
                        >
                          <FormField label="Label" htmlFor={`extra-label-${index}`} className="min-w-[10rem] flex-1">
                            <Input
                              id={`extra-label-${index}`}
                              value={extra.label}
                              onChange={(event) => updateExtra(index, { label: event.target.value })}
                            />
                          </FormField>
                          <FormField label="Amount" htmlFor={`extra-amount-${index}`}>
                            <Input
                              id={`extra-amount-${index}`}
                              type="number"
                              inputMode="decimal"
                              step="any"
                              min="0"
                              className="w-28 text-right tabular-nums"
                              value={extra.amount}
                              onChange={(event) => updateExtra(index, { amount: event.target.value })}
                            />
                          </FormField>
                          <div className="flex gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              disabled={index === 0}
                              onClick={() => moveExtra(index, -1)}
                              aria-label="Move up"
                            >
                              <ChevronUp className="h-4 w-4" aria-hidden="true" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              disabled={index === extras.length - 1}
                              onClick={() => moveExtra(index, 1)}
                              aria-label="Move down"
                            >
                              <ChevronDown className="h-4 w-4" aria-hidden="true" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeExtra(index)}
                              aria-label="Remove charge"
                            >
                              <Trash2 className="h-4 w-4" aria-hidden="true" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-3">
                    <Button type="button" variant="secondary" onClick={handlePreview} loading={previewing}>
                      Preview
                    </Button>
                    <Button type="button" variant="secondary" onClick={handleDownload} loading={downloadingPdf}>
                      Download PDF
                    </Button>
                    <Button
                      type="button"
                      onClick={handleEmail}
                      loading={emailing}
                      disabled={guardianEmail.trim() === ""}
                    >
                      Email guardian
                    </Button>
                  </div>
                </div>
              </Card>

              {preview && (
                <Card>
                  <BillCard bill={preview} />
                </Card>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
