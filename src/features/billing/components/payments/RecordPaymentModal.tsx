import { X } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { getStudentBill } from "@/api/billing";
import { getErrorMessage } from "@/api/client";
import type { Settlement } from "@/api/feePayments";
import { getStudentPaymentLedger, recordFeePayment } from "@/api/staffFeePayments";
import { can } from "@/auth/permissions";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { Spinner } from "@/components/ui/Spinner";
import { ChildrenAmountsStep } from "@/features/billing/components/paymentForm/ChildrenAmountsStep";
import { OptionalFeesStep } from "@/features/billing/components/paymentForm/OptionalFeesStep";
import {
  type ChildDrafts,
  childrenStepValid,
  hasOptionalFees,
  MAX_PAYMENT_CHILDREN,
  prefillAmount,
  selectedOptions,
  toggleChild,
  toggleOptionalFee,
  totalMinor,
} from "@/features/billing/components/paymentForm/paymentChildren";
import { PaymentDetailsFields } from "@/features/billing/components/paymentForm/PaymentDetailsFields";
import {
  type PaymentDetails,
  paymentDetailsValid,
} from "@/features/billing/components/paymentForm/paymentDetails";
import { PaymentProofPicker } from "@/features/billing/components/paymentForm/PaymentProofPicker";
import { ReviewSummary } from "@/features/billing/components/paymentForm/ReviewSummary";
import {
  buildStaffRequest,
  type RecordChildOption,
  recordChildOption,
  recordSuggestion,
} from "@/features/billing/components/payments/recordPaymentDraft";
import { SettlementToggle } from "@/features/billing/components/payments/SettlementToggle";
import {
  StudentSearchField,
  type StudentSearchSelection,
} from "@/features/students/components/StudentSearchField";
import { useAuthStore } from "@/stores/authStore";
import { useBranchStore } from "@/stores/branchStore";
import { usePendingFeePaymentsStore } from "@/stores/pendingFeePaymentsStore";
import { todayIso } from "@/utils/date";

export interface RecordPaymentTarget {
  termId: string;
  /** e.g. "First Term" - shown as the form's heading. */
  termLabel: string;
  currency: string;
  /** The branch the student search starts in (a SCHOOL_ADMIN can switch it to add a sibling elsewhere). */
  branchId?: string;
  /** Pre-adds this student, e.g. when opened from their bill preview. */
  student?: StudentSearchSelection;
}

interface RecordPaymentModalProps {
  target: RecordPaymentTarget | null;
  onClose: () => void;
  /** Called once a record succeeds, with a confirmation to show. */
  onRecorded: (message: string) => void;
}

type StepKey = "children" | "optional" | "details" | "proof";

const STEP_TITLES: Record<StepKey, string> = {
  children: "Students & amounts",
  optional: "Optional fees",
  details: "Payment details",
  proof: "Proof & confirm",
};

/**
 * Recording a payment on a guardian's behalf (Phase 45I, D12/D14) - the guardian sheet's steps
 * and form pieces, with students picked by search instead of from a ward list (siblings across
 * branches allowed, D3), proof optional, a paid-in-full term flagged rather than refused (D6), and
 * a choice between "Save as pending" and "Record & confirm" (each child then needs a settlement).
 */
export function RecordPaymentModal({ target, onClose, onRecorded }: RecordPaymentModalProps) {
  const [busy, setBusy] = useState(false);
  return (
    <Modal
      open={target !== null}
      onClose={() => !busy && onClose()}
      title="Record payment"
      fullScreenOnMobile
    >
      {target && (
        <RecordFlow
          key={`${target.termId}-${target.student?.id ?? ""}`}
          target={target}
          onCancel={() => !busy && onClose()}
          onBusyChange={setBusy}
          onRecorded={onRecorded}
        />
      )}
    </Modal>
  );
}

/** A student's term status (from their ledger) and bill, as a children-step row. */
async function fetchChildOption(
  student: StudentSearchSelection,
  termId: string,
): Promise<RecordChildOption> {
  const [ledger, bill] = await Promise.all([
    getStudentPaymentLedger(student.id, termId),
    // A student with no bill this term 404s - the payment is then amount-only (D2).
    getStudentBill(student.id, termId).catch(() => null),
  ]);
  const status = ledger.terms.find((term) => term.termId === termId)?.status;
  if (!status) {
    throw new Error(`Couldn't load ${student.name}'s fees for this term`);
  }
  return recordChildOption(student, status, bill);
}

interface RecordFlowProps {
  target: RecordPaymentTarget;
  onCancel: () => void;
  onBusyChange: (busy: boolean) => void;
  onRecorded: (message: string) => void;
}

function RecordFlow({ target, onCancel, onBusyChange, onRecorded }: RecordFlowProps) {
  const id = useId();
  const user = useAuthStore((state) => state.user);
  const branches = useBranchStore((state) => state.branches);
  const selectsBranch = can.selectBranch(user?.role);
  const refreshPending = usePendingFeePaymentsStore((state) => state.refresh);
  const { termId, termLabel, currency } = target;

  const [searchBranchId, setSearchBranchId] = useState<string | undefined>(
    selectsBranch ? target.branchId : user?.branchId,
  );
  const [options, setOptions] = useState<RecordChildOption[]>([]);
  const [drafts, setDrafts] = useState<ChildDrafts>({});
  const [adding, setAdding] = useState(target.student ? 1 : 0);
  const [addError, setAddError] = useState<string | null>(null);

  const [details, setDetails] = useState<PaymentDetails>({
    paymentDate: todayIso(),
    method: null,
    payerName: "",
    note: "",
  });
  const [files, setFiles] = useState<File[]>([]);
  const [settlements, setSettlements] = useState<Record<string, Settlement>>({});

  const [stepKey, setStepKey] = useState<StepKey>("children");
  const [submitting, setSubmitting] = useState<"pending" | "confirm" | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function applyOption(option: RecordChildOption) {
    setOptions((current) =>
      current.some((existing) => existing.studentId === option.studentId)
        ? current
        : [...current, option],
    );
    setDrafts((current) => ({
      ...current,
      [option.studentId]: { selected: true, amountText: prefillAmount(option), optionalFeeIds: [] },
    }));
  }

  function load(student: StudentSearchSelection) {
    fetchChildOption(student, termId)
      .then(applyOption)
      .catch((error: unknown) =>
        setAddError(getErrorMessage(error, `Couldn't load ${student.name}'s fees for this term`)),
      )
      .finally(() => setAdding((n) => n - 1));
  }

  function addStudent(student: StudentSearchSelection) {
    if (options.some((option) => option.studentId === student.id)) return;
    setAdding((n) => n + 1);
    setAddError(null);
    load(student);
  }

  // The opener's student is added straight away (`adding` starts at 1 for it).
  useEffect(() => {
    if (target.student) load(target.student);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on open
  }, []);

  const selected = selectedOptions(options, drafts);
  const steps: StepKey[] = hasOptionalFees(options, drafts)
    ? ["children", "optional", "details", "proof"]
    : ["children", "details", "proof"];
  const stepIndex = Math.max(steps.indexOf(stepKey), 0);
  const currentStep = steps[stepIndex];
  const isLast = stepIndex === steps.length - 1;
  const total = totalMinor(options, drafts);
  const stepValid: Record<StepKey, boolean> = {
    children: adding === 0 && childrenStepValid(options, drafts),
    optional: true,
    details: paymentDetailsValid(details),
    proof: true,
  };
  const everyStepValid = steps.every((step) => stepValid[step]);
  const atLimit = options.length >= MAX_PAYMENT_CHILDREN;

  function back() {
    if (stepIndex === 0) {
      onCancel();
    } else {
      setStepKey(steps[stepIndex - 1]);
    }
  }

  async function submit(confirmNow: boolean) {
    if (submitting || !everyStepValid) return;
    setSubmitting(confirmNow ? "confirm" : "pending");
    onBusyChange(true);
    setSubmitError(null);
    setProgress(files.length > 0 ? 0 : null);
    try {
      await recordFeePayment(
        buildStaffRequest(termId, options, drafts, details, confirmNow, settlements),
        files,
        files.length > 0
          ? ({ loadedBytes, totalBytes }) =>
              setProgress(totalBytes > 0 ? Math.round((loadedBytes / totalBytes) * 100) : null)
          : undefined,
      );
      onBusyChange(false);
      refreshPending();
      onRecorded(
        confirmNow
          ? "Payment recorded and confirmed - receipts issued."
          : "Payment saved as pending.",
      );
    } catch (error) {
      setSubmitError(
        getErrorMessage(
          error,
          "Couldn't record the payment. Nothing you entered was lost - try again.",
        ),
      );
      setSubmitting(null);
      setProgress(null);
      onBusyChange(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="mb-4 space-y-2">
        <p className="text-sm text-slate-500">{termLabel}</p>
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
        {currentStep === "children" && (
          <>
            <div className="grid gap-2 sm:grid-cols-2">
              {selectsBranch && (
                <FormField label="Branch" htmlFor={`${id}-branch`}>
                  <Select
                    id={`${id}-branch`}
                    value={searchBranchId ?? ""}
                    onChange={(event) => setSearchBranchId(event.target.value || undefined)}
                  >
                    <option value="">Select a branch…</option>
                    {branches.map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name}
                      </option>
                    ))}
                  </Select>
                </FormField>
              )}
              <FormField
                label="Add a student"
                htmlFor={`${id}-student`}
                className={selectsBranch ? "" : "sm:col-span-2"}
              >
                <StudentSearchField
                  id={`${id}-student`}
                  value={null}
                  onChange={(student) => student && addStudent(student)}
                  branchId={searchBranchId}
                  disabled={atLimit || submitting !== null}
                  disabledHint={
                    atLimit ? `At most ${MAX_PAYMENT_CHILDREN} students` : "Select a branch first."
                  }
                />
              </FormField>
            </div>
            {adding > 0 && (
              <p className="flex items-center gap-2 text-sm text-slate-500">
                <Spinner /> Loading fees…
              </p>
            )}
            {addError && <Alert variant="error">{addError}</Alert>}
            {options.length === 0 ? (
              <p className="text-sm text-slate-500">Search for each student this payment covers.</p>
            ) : (
              <>
                <ChildrenAmountsStep
                  options={options}
                  drafts={drafts}
                  currency={currency}
                  intro="Untick a student to leave them off, and enter how much of the payment was for each."
                  noBillHint="No bill this term - enter the amount received"
                  onToggle={(option) => setDrafts((current) => toggleChild(current, option))}
                  onAmountChange={(studentId, amountText) =>
                    setDrafts((current) => ({
                      ...current,
                      [studentId]: { ...current[studentId], amountText },
                    }))
                  }
                />
                <ul className="flex flex-wrap gap-2">
                  {options.map((option) => (
                    <li key={option.studentId}>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Remove ${option.name}`}
                        onClick={() => {
                          setOptions((current) =>
                            current.filter((existing) => existing.studentId !== option.studentId),
                          );
                          setDrafts((current) => {
                            const next = { ...current };
                            delete next[option.studentId];
                            return next;
                          });
                        }}
                      >
                        <X className="h-4 w-4" aria-hidden="true" /> {option.name}
                      </Button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        )}
        {currentStep === "optional" && (
          <OptionalFeesStep
            options={selected}
            drafts={drafts}
            currency={currency}
            onToggleFee={(studentId, feeId) =>
              setDrafts((current) => toggleOptionalFee(current, studentId, feeId))
            }
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
              existing={[]}
              onRemoveExisting={() => undefined}
              files={files}
              onFilesChange={setFiles}
              required={false}
              disabled={submitting !== null}
            />
            <ReviewSummary
              termLabel={termLabel}
              options={selected}
              drafts={drafts}
              details={details}
              totalMinor={total}
              currency={currency}
            />
            <section aria-label="Settlement if confirming now" className="space-y-3">
              <div>
                <h3 className="text-sm font-medium text-slate-900">If you record & confirm now</h3>
                <p className="text-xs text-slate-500">
                  Each student's receipt is issued straight away as a part payment or paid in full.
                </p>
              </div>
              {selected.map((option) => {
                const suggested = recordSuggestion(option, drafts);
                return (
                  <div key={option.studentId} className="space-y-1">
                    <p className="text-sm text-slate-800">{option.name}</p>
                    <SettlementToggle
                      value={settlements[option.studentId] ?? suggested}
                      onChange={(settlement) =>
                        setSettlements((current) => ({
                          ...current,
                          [option.studentId]: settlement,
                        }))
                      }
                      suggested={suggested}
                      hasBill={option.billedMinor !== null}
                      disabled={submitting !== null}
                    />
                  </div>
                );
              })}
            </section>
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
        <div className="flex flex-wrap gap-2 sm:justify-end">
          <Button
            variant="secondary"
            className="min-h-11 flex-1 sm:flex-none"
            onClick={back}
            disabled={submitting !== null}
          >
            {stepIndex === 0 ? "Cancel" : "Back"}
          </Button>
          {isLast ? (
            <>
              <Button
                variant="secondary"
                className="min-h-11 flex-1 sm:flex-none"
                onClick={() => submit(false)}
                loading={submitting === "pending"}
                disabled={!everyStepValid || submitting !== null}
              >
                Save as pending
              </Button>
              <Button
                className="min-h-11 flex-1 sm:flex-none"
                onClick={() => submit(true)}
                loading={submitting === "confirm"}
                disabled={!everyStepValid || submitting !== null}
              >
                Record & confirm
              </Button>
            </>
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
