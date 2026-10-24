import { useEffect, useId, useState } from "react";
import { getErrorMessage } from "@/api/client";
import {
  editFeePayment,
  getWardOtherPaymentItems,
  submitFeePayment,
  type OtherPaymentItemView,
  type PaymentAttachmentView,
  type PaymentRequest,
  type WardFeePaymentView,
} from "@/api/feePayments";
import type { MyWardView } from "@/api/wards";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/ErrorState";
import { Modal } from "@/components/ui/Modal";
import { Spinner } from "@/components/ui/Spinner";
import { ChildrenAmountsStep } from "@/features/billing/components/paymentForm/ChildrenAmountsStep";
import { OtherPurposeStep } from "@/features/billing/components/paymentForm/OtherPurposeStep";
import {
  chosenItem,
  EMPTY_PURPOSE,
  purposeFields,
  purposeFromPayment,
  purposeLabelOf,
  type PurposeDraft,
  purposeValid,
} from "@/features/billing/components/paymentForm/otherPurpose";
import { formatAmountInput } from "@/features/billing/components/paymentForm/paymentAmounts";
import {
  type ChildDrafts,
  childRequests,
  childrenStepValid,
  type PaymentChildOption,
  selectedOptions,
  totalMinor,
} from "@/features/billing/components/paymentForm/paymentChildren";
import { PaymentDetailsFields } from "@/features/billing/components/paymentForm/PaymentDetailsFields";
import {
  type PaymentDetails,
  paymentDetailsValid,
} from "@/features/billing/components/paymentForm/paymentDetails";
import { PaymentProofPicker } from "@/features/billing/components/paymentForm/PaymentProofPicker";
import { ReviewSummary } from "@/features/billing/components/paymentForm/ReviewSummary";
import { groupWardsBySchool } from "@/features/guardian/groupWardsBySchool";
import { useAuthStore } from "@/stores/authStore";
import { todayIso } from "@/utils/date";

/**
 * What the guardian asked for: log a new "other" payment (D24) - an excursion, the Christmas
 * party, anything no bill carries - or edit / resubmit one of their own. An edit or resubmit
 * starts from the ward whose row it was opened on.
 */
export type LogOtherPaymentIntent =
  | { kind: "new" }
  | { kind: "edit"; studentId: string; payment: WardFeePaymentView }
  | { kind: "resubmit"; studentId: string; payment: WardFeePaymentView };

interface LogOtherPaymentSheetProps {
  intent: LogOtherPaymentIntent | null;
  wards: MyWardView[];
  /** Each ward's own other payments, as the Payments page loaded them - an edit reads every ward's share from here. */
  paymentsByStudent: Map<string, WardFeePaymentView[]>;
  /** Each school's billing currency, as the Payments page learned it; NGN until known. */
  currencyBySchool: Map<string, string>;
  onClose: () => void;
  onSubmitted: (message: string) => void;
}

const TITLES: Record<LogOtherPaymentIntent["kind"], string> = {
  new: "Log other payment",
  edit: "Edit payment",
  resubmit: "Resubmit payment",
};

type StepKey = "school" | "purpose" | "children" | "details" | "proof";

const STEP_TITLES: Record<StepKey, string> = {
  school: "School",
  purpose: "What it's for",
  children: "Children & amounts",
  details: "Payment details",
  proof: "Proof & review",
};

/**
 * The guardian's log-other-payment flow (D24) - the `LogPaymentSheet` shell and shared form
 * steps, with the term and optional-fee steps swapped for a purpose step: there is no bill, so
 * no balance, paid-in-full block or term to choose (the payment is tagged with the school's
 * current term). Picking an item with a suggested amount prefills each child ticked after it.
 */
export function LogOtherPaymentSheet({
  intent,
  wards,
  paymentsByStudent,
  currencyBySchool,
  onClose,
  onSubmitted,
}: LogOtherPaymentSheetProps) {
  const [busy, setBusy] = useState(false);
  const close = () => {
    if (!busy) onClose();
  };
  return (
    <Modal
      open={intent !== null}
      onClose={close}
      title={intent ? TITLES[intent.kind] : TITLES.new}
      fullScreenOnMobile
    >
      {intent && (
        <LogOtherPaymentFlow
          key={
            intent.kind === "new"
              ? "new"
              : `${intent.kind}-${intent.studentId}-${intent.payment.paymentId}`
          }
          intent={intent}
          wards={wards}
          paymentsByStudent={paymentsByStudent}
          currencyBySchool={currencyBySchool}
          onCancel={close}
          onBusyChange={setBusy}
          onSubmitted={onSubmitted}
        />
      )}
    </Modal>
  );
}

interface LogOtherPaymentFlowProps extends Omit<LogOtherPaymentSheetProps, "intent" | "onClose"> {
  intent: LogOtherPaymentIntent;
  onCancel: () => void;
  onBusyChange: (busy: boolean) => void;
}

type ItemsLoad = { status: "error" } | { status: "loaded"; items: OtherPaymentItemView[] };

function LogOtherPaymentFlow({
  intent,
  wards,
  paymentsByStudent,
  currencyBySchool,
  onCancel,
  onBusyChange,
  onSubmitted,
}: LogOtherPaymentFlowProps) {
  const user = useAuthStore((state) => state.user);
  const fieldId = useId();
  const existing = intent.kind === "new" ? null : intent;
  const schoolGroups = groupWardsBySchool(wards);
  const multiSchool = schoolGroups.length > 1;

  const [chosenSchoolId, setChosenSchoolId] = useState<string | null>(
    multiSchool ? null : (wards[0]?.schoolId ?? null),
  );
  const schoolId = existing
    ? (wards.find((ward) => ward.studentId === existing.studentId)?.schoolId ?? null)
    : chosenSchoolId;
  const schoolWards = wards.filter((ward) => ward.schoolId === schoolId);
  const currency = (schoolId && currencyBySchool.get(schoolId)) || "NGN";

  // The school's active items, read through any of its wards - once per school per open.
  const [loads, setLoads] = useState<Record<string, ItemsLoad>>({});
  const load = schoolId ? loads[schoolId] : undefined;
  const firstWardId = schoolWards[0]?.studentId ?? null;
  useEffect(() => {
    if (!schoolId || !firstWardId || loads[schoolId]) return;
    let cancelled = false;
    getWardOtherPaymentItems(firstWardId).then(
      (items) => {
        if (!cancelled)
          setLoads((current) => ({ ...current, [schoolId]: { status: "loaded", items } }));
      },
      () => {
        if (!cancelled) setLoads((current) => ({ ...current, [schoolId]: { status: "error" } }));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [schoolId, firstWardId, loads]);

  // The purpose and the children both restart when the school changes (reset during render, the
  // LogPaymentSheet pattern); an edit or resubmit starts from the payment's own.
  const [formState, setFormState] = useState<{
    key: string | null;
    items: OtherPaymentItemView[];
    purpose: PurposeDraft;
    drafts: ChildDrafts;
  }>({ key: null, items: [], purpose: EMPTY_PURPOSE, drafts: {} });
  const formKey = load?.status === "loaded" ? schoolId : null;
  if (formKey !== formState.key) {
    const items = load?.status === "loaded" ? load.items : [];
    const seeded = existing
      ? purposeFromPayment(existing.payment, items, existing.kind === "edit")
      : { draft: EMPTY_PURPOSE, items };
    setFormState({
      key: formKey,
      items: seeded.items,
      purpose: seeded.draft,
      drafts: initialDrafts(intent, schoolWards, paymentsByStudent),
    });
  }
  const { items, purpose, drafts } = formState;
  const suggested = chosenItem(purpose, items)?.amount ?? null;

  const options: PaymentChildOption[] = schoolWards.map((ward) => ({
    studentId: ward.studentId,
    name: ward.fullName,
    groupLabel: ward.schoolName,
    disabledReason: null,
    balance: null,
    outstandingMinor: null,
    optionalFees: [],
  }));

  const [details, setDetails] = useState<PaymentDetails>(() =>
    existing
      ? {
          paymentDate: existing.payment.paymentDate,
          method: existing.payment.method,
          payerName: existing.payment.payerName,
          note: existing.payment.note ?? "",
        }
      : {
          paymentDate: todayIso(),
          method: null,
          payerName: user ? `${user.firstName} ${user.lastName}`.trim() : "",
          note: "",
        },
  );
  const [kept, setKept] = useState<PaymentAttachmentView[]>(
    intent.kind === "edit" ? intent.payment.attachments : [],
  );
  const [files, setFiles] = useState<File[]>([]);

  const steps: StepKey[] = [
    ...(existing || !multiSchool ? [] : (["school"] as StepKey[])),
    "purpose",
    "children",
    "details",
    "proof",
  ];
  const [stepKey, setStepKey] = useState<StepKey>(steps[0]);
  const stepIndex = Math.max(steps.indexOf(stepKey), 0);
  const currentStep = steps[stepIndex];
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  if (currentStep !== "school") {
    if (!load) {
      return (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner /> Loading…
        </div>
      );
    }
    if (load.status === "error") {
      return (
        <ErrorState
          message="Couldn't load what this school collects payments for."
          onRetry={() =>
            setLoads((current) => {
              const next = { ...current };
              if (schoolId) delete next[schoolId];
              return next;
            })
          }
        />
      );
    }
  }

  const attachmentCount = kept.length + files.length;
  const stepValid: Record<StepKey, boolean> = {
    school: schoolId !== null,
    purpose: purposeValid(purpose),
    children: childrenStepValid(options, drafts),
    details: paymentDetailsValid(details),
    proof: attachmentCount > 0,
  };
  const everyStepValid = steps.every((step) => stepValid[step]);
  const isLast = stepIndex === steps.length - 1;
  const purposeLabel = purposeLabelOf(purpose, items);

  function setPurpose(next: PurposeDraft) {
    setFormState((current) => ({ ...current, purpose: next }));
  }

  function setDrafts(update: (current: ChildDrafts) => ChildDrafts) {
    setFormState((current) => ({ ...current, drafts: update(current.drafts) }));
  }

  // Ticking a child prefills the item's suggested amount while its amount is still blank.
  function toggle(option: PaymentChildOption) {
    setDrafts((current) => {
      const draft = current[option.studentId] ?? {
        selected: false,
        amountText: "",
        optionalFeeIds: [],
      };
      const selected = !draft.selected;
      return {
        ...current,
        [option.studentId]: {
          ...draft,
          selected,
          amountText:
            selected && draft.amountText === "" && suggested != null
              ? formatAmountInput(suggested)
              : draft.amountText,
        },
      };
    });
  }

  function back() {
    if (stepIndex === 0) {
      onCancel();
    } else {
      setStepKey(steps[stepIndex - 1]);
    }
  }

  async function submit() {
    if (submitting || !everyStepValid) return;
    setSubmitting(true);
    onBusyChange(true);
    setSubmitError(null);
    setProgress(0);
    const onProgress = ({ loadedBytes, totalBytes }: { loadedBytes: number; totalBytes: number }) =>
      setProgress(totalBytes > 0 ? Math.round((loadedBytes / totalBytes) * 100) : null);
    const request: PaymentRequest = {
      termId: null,
      purpose: "OTHER",
      ...purposeFields(purpose),
      payerName: details.payerName.trim(),
      paymentDate: details.paymentDate,
      method: details.method ?? "OTHER",
      note: details.note.trim() === "" ? null : details.note.trim(),
      totalAmount: totalMinor(options, drafts) / 100,
      children: childRequests(options, drafts),
    };
    try {
      if (intent.kind === "edit") {
        await editFeePayment(
          intent.payment.paymentId,
          { ...request, keepAttachmentFileIds: kept.map((attachment) => attachment.fileId) },
          files,
          onProgress,
        );
        onBusyChange(false);
        onSubmitted("Payment updated.");
      } else {
        await submitFeePayment(request, files, onProgress);
        onBusyChange(false);
        onSubmitted("Payment logged — the school will confirm it.");
      }
    } catch (error) {
      setSubmitError(
        getErrorMessage(
          error,
          "Couldn't send your payment. Check your connection and try again - nothing you entered was lost.",
        ),
      );
      setSubmitting(false);
      setProgress(null);
      onBusyChange(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="mb-4 space-y-2">
        {purposeLabel && currentStep !== "school" && currentStep !== "purpose" && (
          <p className="break-words text-sm text-slate-500">{purposeLabel}</p>
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
            <legend className="block text-sm font-medium text-slate-700">
              Which school is this payment for?
            </legend>
            <div className="mt-1 space-y-2">
              {schoolGroups.map(([schoolName, groupWards]) => {
                const id = groupWards[0].schoolId;
                const checked = chosenSchoolId === id;
                return (
                  <label
                    key={id}
                    className={`flex min-h-11 cursor-pointer items-start gap-3 rounded-control border px-3 py-2.5 text-sm transition-colors ${
                      checked
                        ? "border-brand-500 bg-brand-50"
                        : "border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <input
                      type="radio"
                      name={`${fieldId}-school`}
                      value={id}
                      checked={checked}
                      onChange={() => setChosenSchoolId(id)}
                      className="mt-0.5 h-4 w-4 border-slate-300 text-brand-500"
                    />
                    <span>
                      <span
                        className={`block ${checked ? "font-medium text-brand-800" : "text-slate-800"}`}
                      >
                        {schoolName}
                      </span>
                      <span className="block text-xs text-slate-500">
                        {groupWards.map((ward) => ward.fullName).join(", ")}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        )}
        {currentStep === "purpose" && (
          <OtherPurposeStep
            items={items}
            value={purpose}
            currency={currency}
            onChange={setPurpose}
          />
        )}
        {currentStep === "children" && (
          <ChildrenAmountsStep
            options={options}
            drafts={drafts}
            currency={currency}
            onToggle={toggle}
            onAmountChange={(studentId, amountText) =>
              setDrafts((current) => ({
                ...current,
                [studentId]: { ...current[studentId], amountText },
              }))
            }
            noBillHint="Enter how much of this payment was for them"
          />
        )}
        {currentStep === "details" && (
          <PaymentDetailsFields
            value={details}
            onChange={(patch) => setDetails((current) => ({ ...current, ...patch }))}
          />
        )}
        {currentStep === "proof" && (
          <>
            <PaymentProofPicker
              existing={kept}
              onRemoveExisting={(fileId) =>
                setKept((current) => current.filter((file) => file.fileId !== fileId))
              }
              files={files}
              onFilesChange={setFiles}
              required
              disabled={submitting}
            />
            {intent.kind === "resubmit" && attachmentCount === 0 && (
              <p className="text-xs text-slate-500">
                Attach your proof again - the rejected payment keeps its own.
              </p>
            )}
            <ReviewSummary
              termLabel={purposeLabel}
              options={selectedOptions(options, drafts)}
              drafts={drafts}
              details={details}
              totalMinor={totalMinor(options, drafts)}
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
              <div
                className="h-full bg-brand-500 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-slate-500">
              {progress < 100 ? `Uploading ${progress}%` : "Saving…"}
            </p>
          </div>
        )}
        <div className="flex gap-2 sm:justify-end">
          <Button
            variant="secondary"
            className="min-h-11 flex-1 sm:flex-none"
            onClick={back}
            disabled={submitting}
          >
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

/**
 * The children step's starting state: an edit ticks every ward already on the payment with its
 * own claim; a resubmit ticks the row's ward with the rejected claim; a new payment ticks the
 * sole ward when the school has only one.
 */
function initialDrafts(
  intent: LogOtherPaymentIntent,
  schoolWards: MyWardView[],
  paymentsByStudent: Map<string, WardFeePaymentView[]>,
): ChildDrafts {
  const drafts: ChildDrafts = {};
  for (const ward of schoolWards) {
    const draft = { selected: false, amountText: "", optionalFeeIds: [] as string[] };
    if (intent.kind === "edit") {
      const claim = (paymentsByStudent.get(ward.studentId) ?? []).find(
        (payment) => payment.paymentId === intent.payment.paymentId,
      );
      if (claim) {
        draft.selected = true;
        draft.amountText = formatAmountInput(claim.claimedAmount);
      }
    } else if (intent.kind === "resubmit") {
      if (ward.studentId === intent.studentId) {
        draft.selected = true;
        draft.amountText = formatAmountInput(intent.payment.claimedAmount);
      }
    } else if (schoolWards.length === 1) {
      draft.selected = true;
    }
    drafts[ward.studentId] = draft;
  }
  return drafts;
}
