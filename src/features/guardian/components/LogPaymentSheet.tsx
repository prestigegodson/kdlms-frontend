import { useEffect, useId, useState } from "react";
import { getErrorMessage } from "@/api/client";
import {
  editFeePayment,
  getWardFees,
  submitFeePayment,
  type PaymentAttachmentView,
  type WardFeePaymentView,
  type WardFeeTermView,
} from "@/api/feePayments";
import type { MyWardView } from "@/api/wards";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/ErrorState";
import { FormField } from "@/components/ui/FormField";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { Spinner } from "@/components/ui/Spinner";
import { PaymentDetailsFields } from "@/features/billing/components/paymentForm/PaymentDetailsFields";
import { type PaymentDetails, paymentDetailsValid } from "@/features/billing/components/paymentForm/paymentDetails";
import { PaymentProofPicker } from "@/features/billing/components/paymentForm/PaymentProofPicker";
import { ChildrenAmountsStep } from "@/features/billing/components/paymentForm/ChildrenAmountsStep";
import { OptionalFeesStep } from "@/features/billing/components/paymentForm/OptionalFeesStep";
import {
  type ChildDrafts,
  childrenStepValid,
  selectedOptions,
  toggleChild,
  toggleOptionalFee,
  totalMinor,
} from "@/features/billing/components/paymentForm/paymentChildren";
import { ReviewSummary } from "@/features/billing/components/paymentForm/ReviewSummary";
import {
  buildRequest,
  childOptions,
  defaultTermId,
  editingPaymentId,
  initialDrafts,
  payableTerms,
  STEP_TITLES,
  type StepKey,
  stepsFor,
} from "@/features/guardian/components/logPayment/logPaymentDraft";
import { groupWardsBySchool } from "@/features/guardian/groupWardsBySchool";
import { useAuthStore } from "@/stores/authStore";
import { todayIso } from "@/utils/date";

/**
 * What the guardian asked the sheet to do: log a new payment for a term, edit a still-pending one,
 * or resubmit a rejected one prefilled from it - each from one ward's term card - or log one from
 * the Fees page itself (`open`), picking the school (only when the wards span more than one) and
 * the term inside the sheet instead.
 */
export type LogPaymentIntent =
  | { kind: "open" }
  | { kind: "new"; studentId: string; term: WardFeeTermView }
  | { kind: "edit"; studentId: string; term: WardFeeTermView; payment: WardFeePaymentView }
  | { kind: "resubmit"; studentId: string; term: WardFeeTermView; payment: WardFeePaymentView };

interface LogPaymentSheetProps {
  intent: LogPaymentIntent | null;
  wards: MyWardView[];
  onClose: () => void;
  /** Called once a submit/edit succeeds, with a confirmation to show, so the page refetches its term cards. */
  onSubmitted: (message: string) => void;
}

const TITLES: Record<LogPaymentIntent["kind"], string> = {
  open: "Log payment",
  new: "Log payment",
  edit: "Edit payment",
  resubmit: "Resubmit payment",
};

/**
 * The guardian's log-payment flow (Phase 45H) - a full-screen sheet on a phone, a centred dialog
 * from `md` up, stepping through children & amounts, optional fees (only when a ticked child has
 * any), payment details, and proof & review, with a sticky Back/Next dock. The inner flow is keyed
 * on the intent, so every open starts from a fresh prefill.
 */
export function LogPaymentSheet({ intent, wards, onClose, onSubmitted }: LogPaymentSheetProps) {
  const [busy, setBusy] = useState(false);
  const title = intent ? TITLES[intent.kind] : "Log payment";
  // An in-flight upload can't be abandoned by a stray backdrop tap or Escape.
  const close = () => {
    if (!busy) onClose();
  };
  return (
    <Modal open={intent !== null} onClose={close} title={title} fullScreenOnMobile>
      {intent && (
        <LogPaymentFlow
          key={
            intent.kind === "open"
              ? "open"
              : `${intent.kind}-${intent.studentId}-${intent.term.termId}-${"payment" in intent ? intent.payment.paymentId : ""}`
          }
          intent={intent}
          wards={wards}
          onCancel={close}
          onBusyChange={setBusy}
          onSubmitted={onSubmitted}
        />
      )}
    </Modal>
  );
}

interface LogPaymentFlowProps {
  intent: LogPaymentIntent;
  wards: MyWardView[];
  onCancel: () => void;
  onBusyChange: (busy: boolean) => void;
  onSubmitted: (message: string) => void;
}

/**
 * One school's wards' term cards, fetched once per school per open (no entry yet = loading). A
 * ward whose fetch failed is absent from `cards`; `error` means the flow can't go on at all.
 */
type SchoolLoad =
  | { status: "error" }
  | { status: "loaded"; cards: Map<string, WardFeeTermView[]> };

function LogPaymentFlow({ intent, wards, onCancel, onBusyChange, onSubmitted }: LogPaymentFlowProps) {
  const user = useAuthStore((state) => state.user);
  const fieldId = useId();
  const cardIntent = intent.kind === "open" ? null : intent;
  const schoolGroups = groupWardsBySchool(wards);
  const multiSchool = new Set(wards.map((ward) => ward.schoolId)).size > 1;

  // A card fixes the school (its ward's) and the term; the page-level flow picks both here.
  const [chosenSchoolId, setChosenSchoolId] = useState<string | null>(
    multiSchool ? null : (wards[0]?.schoolId ?? null),
  );
  const schoolId = cardIntent
    ? (wards.find((ward) => ward.studentId === cardIntent.studentId)?.schoolId ?? null)
    : chosenSchoolId;
  const [chosenTermId, setChosenTermId] = useState<string | null>(null);

  const [loads, setLoads] = useState<Record<string, SchoolLoad>>({});
  const load: SchoolLoad | undefined = schoolId ? loads[schoolId] : undefined;
  const needsLoad = schoolId !== null && load === undefined;

  // Each of the school's wards' term cards - its balance, paid-in-full flag, optional fees and (on
  // edit) its share of the payment. A card's own ward already has its card, so isn't refetched.
  // A guardian has only a handful of wards.
  useEffect(() => {
    if (!needsLoad || !schoolId) return;
    let cancelled = false;
    const fetched = wards.filter(
      (ward) => ward.schoolId === schoolId && ward.studentId !== cardIntent?.studentId,
    );
    Promise.allSettled(fetched.map((ward) => getWardFees(ward.studentId))).then((results) => {
      if (cancelled) return;
      const cards = new Map<string, WardFeeTermView[]>();
      results.forEach((result, index) => {
        if (result.status === "fulfilled") cards.set(fetched[index].studentId, result.value);
      });
      const failed = cards.size < fetched.length;
      // On edit, a sibling already on the payment whose fees failed to load would silently drop
      // off it on save - refuse to start rather than risk that. A page-level payment can't go on
      // with nobody's fees loaded.
      const fatal = cardIntent
        ? failed && cardIntent.kind === "edit" && cardIntent.payment.childCount > 1
        : fetched.length > 0 && cards.size === 0;
      setLoads((current) => ({
        ...current,
        [schoolId]: fatal ? { status: "error" } : { status: "loaded", cards },
      }));
    });
    return () => {
      cancelled = true;
    };
  }, [needsLoad, schoolId, wards, cardIntent]);

  function retryLoad() {
    if (!schoolId) return;
    setLoads((current) => {
      const next = { ...current };
      delete next[schoolId];
      return next;
    });
  }

  const loaded = load?.status === "loaded" ? load.cards : null;
  const payable = !cardIntent && loaded ? payableTerms([...loaded.values()]) : [];
  const termId = cardIntent
    ? cardIntent.term.termId
    : (payable.find((card) => card.termId === chosenTermId)?.termId ?? defaultTermId(payable));
  const termCard = cardIntent ? cardIntent.term : (payable.find((card) => card.termId === termId) ?? null);
  const currency = termCard?.currency ?? "NGN";
  const termLabel = termCard ? `${termCard.termName}, ${termCard.sessionName}` : null;

  const termsByStudent = new Map<string, WardFeeTermView | null>();
  if (loaded && termId) {
    loaded.forEach((cards, studentId) =>
      termsByStudent.set(studentId, cards.find((card) => card.termId === termId) ?? null),
    );
    if (cardIntent) termsByStudent.set(cardIntent.studentId, cardIntent.term);
  }
  const options =
    loaded && schoolId && termId
      ? childOptions(
          { schoolId, editingPaymentId: editingPaymentId(intent), hideOtherSchools: !cardIntent },
          wards,
          termsByStudent,
        )
      : [];

  // The children step restarts from a fresh prefill whenever the school or term changes (reset
  // during render, the WardFeesPage pattern), so a ticked child never outlives its term.
  const draftsKey = loaded && termId ? `${schoolId}|${termId}` : null;
  const [draftState, setDraftState] = useState<{ key: string | null; drafts: ChildDrafts }>({
    key: null,
    drafts: {},
  });
  if (draftsKey !== draftState.key) {
    setDraftState({ key: draftsKey, drafts: draftsKey ? initialDrafts(intent, options) : {} });
  }
  const drafts = draftState.drafts;
  function setDrafts(update: (current: ChildDrafts) => ChildDrafts) {
    setDraftState((current) => ({ ...current, drafts: update(current.drafts) }));
  }

  const [details, setDetails] = useState<PaymentDetails>(() =>
    "payment" in intent
      ? {
          paymentDate: intent.payment.paymentDate,
          method: intent.payment.method,
          payerName: intent.payment.payerName,
          note: intent.payment.note ?? "",
        }
      : {
          paymentDate: todayIso(),
          method: null,
          payerName: user ? `${user.firstName} ${user.lastName}`.trim() : "",
          note: "",
        },
  );
  // Only an edit keeps attachments - a resubmit is a new payment, and the rejected one's proof
  // stays with it.
  const [kept, setKept] = useState<PaymentAttachmentView[]>(
    intent.kind === "edit" ? intent.payment.attachments : [],
  );
  const [files, setFiles] = useState<File[]>([]);

  const leading: StepKey[] = cardIntent ? [] : multiSchool ? ["school", "term"] : ["term"];
  const [stepKey, setStepKey] = useState<StepKey>(leading[0] ?? "children");
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const steps = stepsFor(options, drafts, leading);
  const stepIndex = Math.max(steps.indexOf(stepKey), 0);
  const currentStep = steps[stepIndex];

  // Past the school step, nothing renders until that school's fees are in.
  if (currentStep !== "school") {
    if (!load) {
      return (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner /> Loading…
        </div>
      );
    }
    if (load.status === "error") {
      return <ErrorState message="Couldn't load your children's fees." onRetry={retryLoad} />;
    }
  }

  const selected = selectedOptions(options, drafts);
  const isLast = stepIndex === steps.length - 1;
  const total = totalMinor(options, drafts);
  const attachmentCount = kept.length + files.length;

  const stepValid: Record<StepKey, boolean> = {
    school: schoolId !== null,
    term: termId !== null,
    children: childrenStepValid(options, drafts),
    optional: true,
    details: paymentDetailsValid(details),
    proof: attachmentCount > 0,
  };
  const everyStepValid = steps.every((step) => stepValid[step]);

  function updateDraft(studentId: string, patch: Partial<ChildDrafts[string]>) {
    setDrafts((current) => ({ ...current, [studentId]: { ...current[studentId], ...patch } }));
  }

  function toggleFee(studentId: string, feeId: string) {
    setDrafts((current) => toggleOptionalFee(current, studentId, feeId));
  }

  function back() {
    if (stepIndex === 0) {
      onCancel();
    } else {
      setStepKey(steps[stepIndex - 1]);
    }
  }

  async function submit() {
    if (submitting || !everyStepValid || !termId) return;
    setSubmitting(true);
    onBusyChange(true);
    setSubmitError(null);
    setProgress(0);
    const onProgress = ({ loadedBytes, totalBytes }: { loadedBytes: number; totalBytes: number }) =>
      setProgress(totalBytes > 0 ? Math.round((loadedBytes / totalBytes) * 100) : null);
    try {
      if (intent.kind === "edit") {
        const request = buildRequest(
          termId,
          options,
          drafts,
          details,
          kept.map((attachment) => attachment.fileId),
        );
        await editFeePayment(intent.payment.paymentId, request, files, onProgress);
        onBusyChange(false);
        onSubmitted("Payment updated.");
      } else {
        await submitFeePayment(buildRequest(termId, options, drafts, details), files, onProgress);
        onBusyChange(false);
        onSubmitted("Payment logged — the school will confirm it.");
      }
    } catch (error) {
      // Everything entered stays put - Submit becomes the retry.
      setSubmitError(
        getErrorMessage(error, "Couldn't send your payment. Check your connection and try again - nothing you entered was lost."),
      );
      setSubmitting(false);
      setProgress(null);
      onBusyChange(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="mb-4 space-y-2">
        {termLabel && currentStep !== "school" && currentStep !== "term" && (
          <p className="text-sm text-slate-500">{termLabel}</p>
        )}
        <p className="text-xs font-medium uppercase tracking-wide text-brand-700">
          Step {stepIndex + 1} of {steps.length} · {STEP_TITLES[currentStep]}
        </p>
        <div
          className="h-1 overflow-hidden rounded-full bg-slate-100"
          role="progressbar"
          aria-label="Form progress"
          aria-valuemin={1}
          aria-valuemax={steps.length}
          aria-valuenow={stepIndex + 1}
        >
          <div
            className="h-full rounded-full bg-brand-500 transition-all"
            style={{ width: `${((stepIndex + 1) / steps.length) * 100}%` }}
          />
        </div>
      </div>

      <div className="space-y-4 pb-4">
        {currentStep === "school" && (
          <fieldset>
            <legend className="block text-sm font-medium text-slate-700">Which school is this payment for?</legend>
            <div className="mt-1 space-y-2">
              {schoolGroups.map(([schoolName, schoolWards]) => {
                const id = schoolWards[0].schoolId;
                const checked = chosenSchoolId === id;
                return (
                  <label
                    key={id}
                    className={`flex min-h-11 cursor-pointer items-start gap-3 rounded-control border px-3 py-2.5 text-sm transition-colors ${
                      checked ? "border-brand-500 bg-brand-50" : "border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <input
                      type="radio"
                      name={`${fieldId}-school`}
                      value={id}
                      checked={checked}
                      onChange={() => {
                        setChosenSchoolId(id);
                        setChosenTermId(null);
                      }}
                      className="mt-0.5 h-4 w-4 border-slate-300 text-brand-500"
                    />
                    <span>
                      <span className={`block ${checked ? "font-medium text-brand-800" : "text-slate-800"}`}>
                        {schoolName}
                      </span>
                      <span className="block text-xs text-slate-500">
                        {schoolWards.map((ward) => ward.fullName).join(", ")}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        )}
        {currentStep === "term" &&
          (payable.length === 0 ? (
            <Alert variant="info">
              Nothing to pay at {schoolGroups.find(([, group]) => group[0].schoolId === schoolId)?.[0] ?? "this school"}{" "}
              right now — every open term is paid in full.
            </Alert>
          ) : (
            <FormField label="Which term is this payment for?" htmlFor={`${fieldId}-term`}>
              <Select
                id={`${fieldId}-term`}
                value={termId ?? ""}
                onChange={(event) => setChosenTermId(event.target.value)}
              >
                {payable.map((card) => (
                  <option key={card.termId} value={card.termId}>
                    {card.termName}, {card.sessionName}
                    {card.current ? " (current)" : ""}
                  </option>
                ))}
              </Select>
            </FormField>
          ))}
        {currentStep === "children" && (
          <ChildrenAmountsStep
            options={options}
            drafts={drafts}
            currency={currency}
            onToggle={(option) => setDrafts((current) => toggleChild(current, option))}
            onAmountChange={(studentId, amountText) => updateDraft(studentId, { amountText })}
          />
        )}
        {currentStep === "optional" && (
          <OptionalFeesStep options={selected} drafts={drafts} currency={currency} onToggleFee={toggleFee} />
        )}
        {currentStep === "details" && (
          <PaymentDetailsFields value={details} onChange={(patch) => setDetails((current) => ({ ...current, ...patch }))} />
        )}
        {currentStep === "proof" && (
          <>
            <PaymentProofPicker
              existing={kept}
              onRemoveExisting={(fileId) => setKept((current) => current.filter((file) => file.fileId !== fileId))}
              files={files}
              onFilesChange={setFiles}
              required
              disabled={submitting}
            />
            {intent.kind === "resubmit" && attachmentCount === 0 && (
              <p className="text-xs text-slate-500">Attach your proof again - the rejected payment keeps its own.</p>
            )}
            <ReviewSummary
              termLabel={termLabel ?? ""}
              options={selected}
              drafts={drafts}
              details={details}
              totalMinor={total}
              currency={currency}
            />
          </>
        )}
        {submitError && <Alert variant="error">{submitError}</Alert>}
      </div>

      <div
        data-sheet-dock
        className="mt-auto space-y-2 border-t border-slate-100 pt-4 mobile:sticky mobile:bottom-0 mobile:-mx-6 mobile:bg-white/95 mobile:px-6 mobile:pb-4 mobile:backdrop-blur"
      >
        {submitting && progress !== null && (
          <div className="space-y-1" aria-live="polite">
            <div
              className="h-1.5 overflow-hidden rounded-full bg-slate-100"
              role="progressbar"
              aria-label="Upload progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress}
            >
              <div className="h-full bg-brand-500 transition-all" style={{ width: `${progress}%` }} />
            </div>
            <p className="text-xs text-slate-500">{progress < 100 ? `Uploading ${progress}%` : "Saving…"}</p>
          </div>
        )}
        <div className="flex gap-2 sm:justify-end">
          <Button variant="secondary" className="min-h-11 flex-1 sm:flex-none" onClick={back} disabled={submitting}>
            {stepIndex === 0 ? "Cancel" : "Back"}
          </Button>
          {isLast ? (
            <Button
              className="min-h-11 flex-1 sm:flex-none"
              onClick={submit}
              loading={submitting}
              disabled={!everyStepValid}
            >
              {intent.kind === "edit" ? "Save changes" : "Submit payment"}
            </Button>
          ) : (
            <Button
              className="min-h-11 flex-1 sm:flex-none"
              onClick={() => setStepKey(steps[stepIndex + 1])}
              disabled={!stepValid[currentStep]}
            >
              Next
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
