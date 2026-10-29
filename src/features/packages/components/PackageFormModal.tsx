import { type FormEvent, type ReactNode, useState } from "react";
import type {
  BillingCycle,
  PackageAudience,
  PackagePrice,
  PackageView,
  SavePackageRequest,
} from "@/api/packages";
import { ApiError } from "@/api/client";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { fromMinor, SUPPORTED_CURRENCIES, type SupportedCurrency, toMinor } from "@/utils/currency";

interface PackageFormModalProps {
  title: string;
  /** Who the package is sold to. Fixed for an existing package, so editing always passes `initial.audience`. */
  audience: PackageAudience;
  initial?: PackageView;
  onClose: () => void;
  onSubmit: (values: SavePackageRequest) => Promise<void>;
  onSaved: () => void;
}

type PriceInputs = Record<SupportedCurrency, string>;
type CyclePrices = Record<BillingCycle, PriceInputs>;
type LimitKey =
  | "maxClasses"
  | "maxStudentsPerClass"
  | "maxSessionMinutes"
  | "maxParticipantsPerSession"
  | "maxMonthlySessionHours";

const CREATOR_LIMITS: { key: LimitKey; label: string }[] = [
  { key: "maxClasses", label: "Max classes" },
  { key: "maxStudentsPerClass", label: "Max learners per class" },
];

/** The LiveKit room's own costs - they only apply to sessions held in Platform Video Conferencing. */
const PLATFORM_VIDEO_LIMITS: { key: LimitKey; label: string }[] = [
  { key: "maxSessionMinutes", label: "Max session length (minutes)" },
  { key: "maxParticipantsPerSession", label: "Max participants per session" },
  { key: "maxMonthlySessionHours", label: "Max live hours per month" },
];

const CYCLES: { cycle: BillingCycle; label: string }[] = [
  { cycle: "MONTHLY", label: "Monthly" },
  { cycle: "ANNUAL", label: "Annual" },
];

function blankPrices(): PriceInputs {
  return Object.fromEntries(SUPPORTED_CURRENCIES.map((currency) => [currency, ""])) as PriceInputs;
}

function initialPrices(initial?: PackageView): CyclePrices {
  const inputs: CyclePrices = { MONTHLY: blankPrices(), ANNUAL: blankPrices() };
  for (const price of initial?.prices ?? []) {
    inputs[price.billingCycle ?? initial?.billingCycle ?? "MONTHLY"][price.currency] = String(
      fromMinor(price.amountMinor),
    );
  }
  return inputs;
}

/** Every filled-in price for `cycle`; a blank currency simply isn't offered. */
function pricesIn(inputs: PriceInputs, cycle: BillingCycle): PackagePrice[] {
  return SUPPORTED_CURRENCIES.filter((currency) => inputs[currency].trim() !== "").map((currency) => ({
    currency,
    billingCycle: cycle,
    amountMinor: toMinor(Number(inputs[currency])),
  }));
}

function initialLimits(initial?: PackageView): Record<LimitKey, string> {
  const value = (limit: number | null | undefined) => (limit == null ? "" : String(limit));
  return {
    maxClasses: value(initial?.maxClasses),
    maxStudentsPerClass: value(initial?.maxStudentsPerClass),
    maxSessionMinutes: value(initial?.maxSessionMinutes),
    maxParticipantsPerSession: value(initial?.maxParticipantsPerSession),
    maxMonthlySessionHours: value(initial?.maxMonthlySessionHours),
  };
}

/** A blank limit means unlimited. */
function limitValue(text: string): number | null {
  return text.trim() === "" ? null : Number(text);
}

/**
 * Create/edit form for a package. A SCHOOL package has branch and active-student limits and the
 * school feature flags; a CREATOR plan has the five creator limits (blank = unlimited), guardian
 * access, and may be the platform's one free plan - which carries no prices. Either kind is priced
 * per currency: a blank currency simply isn't offered. A CREATOR plan may be priced monthly,
 * annually or both - its billing cycle is then the default one, preselected at checkout, and needs
 * a price; a SCHOOL package is priced in its one billing cycle only.
 */
export function PackageFormModal({ title, audience, initial, onClose, onSubmit, onSaved }: PackageFormModalProps) {
  const isCreator = audience === "CREATOR";
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [billingCycle, setBillingCycle] = useState<BillingCycle>(initial?.billingCycle ?? "MONTHLY");
  const [free, setFree] = useState(initial?.free ?? false);
  const [prices, setPrices] = useState<CyclePrices>(() => initialPrices(initial));
  const [multiBranch, setMultiBranch] = useState(initial?.multiBranch ?? false);
  const [branchLimit, setBranchLimit] = useState(initial ? String(initial.branchLimit) : "1");
  const [activeStudentLimit, setActiveStudentLimit] = useState(
    initial?.activeStudentLimit != null ? String(initial.activeStudentLimit) : "",
  );
  const [limits, setLimits] = useState(() => initialLimits(initial));
  const [takeHomeQuiz, setTakeHomeQuiz] = useState(initial?.takeHomeQuiz ?? false);
  const [interactiveQuestions, setInteractiveQuestions] = useState(
    initial?.interactiveQuestions ?? false,
  );
  const [onDemandLearning, setOnDemandLearning] = useState(initial?.onDemandLearning ?? false);
  const [interactiveVideo, setInteractiveVideo] = useState(initial?.interactiveVideo ?? false);
  const [communication, setCommunication] = useState(initial?.communication ?? false);
  const [timetable, setTimetable] = useState(initial?.timetable ?? false);
  const [lessonNotes, setLessonNotes] = useState(initial?.lessonNotes ?? false);
  const [aiLessonNotes, setAiLessonNotes] = useState(initial?.aiLessonNotes ?? false);
  const [aiGenerationLimit, setAiGenerationLimit] = useState(
    initial ? String(initial.aiGenerationLimit) : "0",
  );
  const [billing, setBilling] = useState(initial?.billing ?? false);
  const [learningMedia, setLearningMedia] = useState(initial?.learningMedia ?? false);
  const [studentLogins, setStudentLogins] = useState(initial?.studentLogins ?? false);
  const [guardianAccess, setGuardianAccess] = useState(initial?.guardianAccess ?? false);
  const [platformVideo, setPlatformVideo] = useState(initial?.platformVideo ?? false);
  const [staffAttendance, setStaffAttendance] = useState(initial?.staffAttendance ?? false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const pricedIn = free
      ? []
      : isCreator
        ? CYCLES.flatMap(({ cycle }) => pricesIn(prices[cycle], cycle))
        : pricesIn(prices[billingCycle], billingCycle);
    if (!free && pricedIn.length === 0) {
      setError("Enter a price in at least one currency.");
      return;
    }
    if (!free && !pricedIn.some((price) => price.billingCycle === billingCycle)) {
      setError(
        `Enter a ${billingCycle === "ANNUAL" ? "annual" : "monthly"} price, or change the default billing cycle.`,
      );
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        name,
        description: description || undefined,
        billingCycle,
        audience,
        free: isCreator && free,
        prices: pricedIn,
        multiBranch: !isCreator && multiBranch,
        branchLimit: !isCreator && multiBranch ? Number(branchLimit) : 1,
        activeStudentLimit: isCreator ? null : Number(activeStudentLimit),
        maxClasses: isCreator ? limitValue(limits.maxClasses) : null,
        maxStudentsPerClass: isCreator ? limitValue(limits.maxStudentsPerClass) : null,
        maxSessionMinutes: isCreator ? limitValue(limits.maxSessionMinutes) : null,
        maxParticipantsPerSession: isCreator ? limitValue(limits.maxParticipantsPerSession) : null,
        maxMonthlySessionHours: isCreator ? limitValue(limits.maxMonthlySessionHours) : null,
        takeHomeQuiz,
        interactiveQuestions: takeHomeQuiz && interactiveQuestions,
        onDemandLearning,
        interactiveVideo: !isCreator && onDemandLearning && interactiveVideo,
        communication,
        timetable: !isCreator && timetable,
        lessonNotes,
        aiLessonNotes,
        aiGenerationLimit: aiLessonNotes ? Number(aiGenerationLimit) : 0,
        billing: !isCreator && billing,
        learningMedia,
        studentLogins: !isCreator && studentLogins,
        guardianAccess: isCreator && guardianAccess,
        platformVideo: isCreator && platformVideo,
        staffAttendance: !isCreator && staffAttendance,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save package");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={title}>
      <form className="space-y-4" onSubmit={handleSubmit}>
        {error && <Alert variant="error">{error}</Alert>}
        <FormField label="Name" htmlFor="package-name">
          <Input id="package-name" required value={name} onChange={(event) => setName(event.target.value)} />
        </FormField>
        <FormField label="Description" htmlFor="package-description">
          <Input
            id="package-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </FormField>
        <FormField
          label={isCreator ? "Default billing cycle" : "Billing cycle"}
          htmlFor="package-billing-cycle"
          description={isCreator ? "Preselected for tutors at checkout. It needs a price below." : undefined}
        >
          <Select
            id="package-billing-cycle"
            value={billingCycle}
            onChange={(event) => {
              const next = event.target.value as BillingCycle;
              // A school package has one cycle: its prices move with it.
              if (!isCreator) {
                setPrices((current) => ({ ...current, [next]: current[billingCycle], [billingCycle]: blankPrices() }));
              }
              setBillingCycle(next);
            }}
          >
            <option value="MONTHLY">Monthly</option>
            <option value="ANNUAL">Annual</option>
          </Select>
        </FormField>

        {isCreator && (
          <Flag
            checked={free}
            onChange={setFree}
            disabled={initial !== undefined}
            label="Free plan"
            help={
              initial
                ? "Whether a plan is the free plan can't be changed once it exists."
                : "The plan every tutor falls back to when they have no paid plan. It has no price, and only one free plan can be active."
            }
          />
        )}

        {!free &&
          (isCreator ? (
            CYCLES.map(({ cycle, label }) => (
              <PriceFieldset
                key={cycle}
                idPrefix={`package-price-${cycle.toLowerCase()}`}
                legend={`${label} price`}
                help={`Leave a currency blank to not sell the plan ${cycle === "ANNUAL" ? "annually" : "monthly"} in it.`}
                values={prices[cycle]}
                onChange={(currency, value) =>
                  setPrices((current) => ({ ...current, [cycle]: { ...current[cycle], [currency]: value } }))
                }
              />
            ))
          ) : (
            <PriceFieldset
              idPrefix="package-price"
              legend="Price per billing cycle"
              help="Leave a currency blank to not sell the plan in it."
              values={prices[billingCycle]}
              onChange={(currency, value) =>
                setPrices((current) => ({
                  ...current,
                  [billingCycle]: { ...current[billingCycle], [currency]: value },
                }))
              }
            />
          ))}

        {isCreator ? (
          <>
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-slate-700">Limits</legend>
              <p className="text-xs text-slate-500">Leave a limit blank for unlimited.</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {CREATOR_LIMITS.map(({ key, label }) => (
                  <LimitField
                    key={key}
                    limitKey={key}
                    label={label}
                    value={limits[key]}
                    onChange={(value) => setLimits((current) => ({ ...current, [key]: value }))}
                  />
                ))}
              </div>
            </fieldset>
            <fieldset className="space-y-2">
              <legend className="sr-only">Platform Video Conferencing</legend>
              <Flag
                checked={platformVideo}
                onChange={setPlatformVideo}
                label="Platform Video Conferencing"
                help="Sessions can run in the built-in video room. Without it, the tutor holds every session on their own Google Meet or Zoom link."
              />
              <p className="text-xs text-slate-500">
                Platform Video limits apply only to sessions held in the built-in video room. Leave blank for unlimited.
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {PLATFORM_VIDEO_LIMITS.map(({ key, label }) => (
                  <LimitField
                    key={key}
                    limitKey={key}
                    label={label}
                    value={limits[key]}
                    disabled={!platformVideo}
                    onChange={(value) => setLimits((current) => ({ ...current, [key]: value }))}
                  />
                ))}
              </div>
            </fieldset>
          </>
        ) : (
          <>
            <Flag checked={multiBranch} onChange={setMultiBranch} label="Allow multiple branches" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label="Branch limit" htmlFor="package-branch-limit">
                <Input
                  id="package-branch-limit"
                  type="number"
                  min="1"
                  required
                  disabled={!multiBranch}
                  value={multiBranch ? branchLimit : "1"}
                  onChange={(event) => setBranchLimit(event.target.value)}
                />
              </FormField>
              <FormField label="Active student limit" htmlFor="package-student-limit">
                <Input
                  id="package-student-limit"
                  type="number"
                  min="1"
                  required
                  value={activeStudentLimit}
                  onChange={(event) => setActiveStudentLimit(event.target.value)}
                />
              </FormField>
            </div>
          </>
        )}

        <Flag
          checked={takeHomeQuiz}
          onChange={setTakeHomeQuiz}
          label="CBT/Quizzes"
          help={
            isCreator
              ? "Quizzes the tutor sets and learners take in their portal."
              : "Entitlement for the teacher-authored CBT/Quiz module - does not affect midterm quiz recording, which is available on every package."
          }
        />
        <Flag
          checked={takeHomeQuiz && interactiveQuestions}
          onChange={setInteractiveQuestions}
          disabled={!takeHomeQuiz}
          label="Interactive questions"
          help="An add-on on top of CBT/Quizzes for authoring drag-and-drop, matching, sequencing, sorting, diagram-labelling and hotspot questions. Quizzes that already have them keep working after a downgrade."
        />
        <Flag
          checked={onDemandLearning}
          onChange={setOnDemandLearning}
          label="On-demand learning"
          help="Learning resources: PDF, rich text and YouTube."
        />
        <Flag
          checked={learningMedia}
          onChange={setLearningMedia}
          label="Learning media (mp3/mp4)"
          help="A second gate on top of On-demand learning for uploaded audio and video only - the storage-heavy media types."
        />
        {!isCreator && (
          <Flag
            checked={onDemandLearning && interactiveVideo}
            onChange={setInteractiveVideo}
            disabled={!onDemandLearning}
            label="Interactive video"
            help="An add-on on top of On-demand learning for authoring videos with timed questions, text, images and hotspots. An uploaded-video source also needs Learning media. Published interactive videos keep playing after a downgrade."
          />
        )}
        {!isCreator && (
          <Flag
            checked={studentLogins}
            onChange={setStudentLogins}
            label="Student logins"
            help="Entitlement for the student portal and student credential provisioning. Deliberately not checked at the login endpoint itself, so a downgrade can never strand an already-signed-in student."
          />
        )}
        <Flag
          checked={communication}
          onChange={setCommunication}
          label={isCreator ? "Class messaging" : "Home-school messaging"}
          help={
            isCreator
              ? "Messages between the tutor and their learners or guardians."
              : "A school without it loses the Messages screen entirely, for both staff and guardians."
          }
        />
        {!isCreator && (
          <Flag
            checked={timetable}
            onChange={setTimetable}
            label="Timetables"
            help="A school without it loses the Timetable screen entirely, for staff and guardians alike."
          />
        )}
        <Flag
          checked={lessonNotes}
          onChange={setLessonNotes}
          label="Lesson notes"
          help={
            isCreator
              ? "Lesson notes per class that learners can read."
              : "A school without it loses the Lesson notes screen entirely, for staff and guardians alike."
          }
        />
        <Flag
          checked={aiLessonNotes}
          onChange={setAiLessonNotes}
          label="AI lesson notes"
          help="A second, independent gate on top of Lesson notes for AI drafting only."
        />
        <FormField label="AI generations per month" htmlFor="package-ai-generation-limit">
          <Input
            id="package-ai-generation-limit"
            type="number"
            min="0"
            required
            disabled={!aiLessonNotes}
            value={aiLessonNotes ? aiGenerationLimit : "0"}
            onChange={(event) => setAiGenerationLimit(event.target.value)}
          />
        </FormField>
        {isCreator ? (
          <Flag
            checked={guardianAccess}
            onChange={setGuardianAccess}
            label="Guardian access"
            help="A minor learner's guardian gets the invite and can follow their classes. Without it, the tutor issues the minor their own login."
          />
        ) : (
          <Flag
            checked={billing}
            onChange={setBilling}
            label="Fees & bills"
            help="Entitlement for the per-term parent billing module - a school without it loses the Fees & Bills screen entirely. Never confuse with this package's own price above, which is the SaaS operator billing the school."
          />
        )}
        {!isCreator && (
          <Flag
            checked={staffAttendance}
            onChange={setStaffAttendance}
            label="Staff biometric clock-in"
            help="The staff roster - including non-academic staff such as nannies, cleaners, drivers and security - with clock-in on fingerprint terminals or a phone passkey at a gate QR. A school without it loses the Staff & clock-in screen entirely."
          />
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving…" : "Save"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

interface PriceFieldsetProps {
  idPrefix: string;
  legend: string;
  help: string;
  values: PriceInputs;
  onChange: (currency: SupportedCurrency, value: string) => void;
}

function PriceFieldset({ idPrefix, legend, help, values, onChange }: PriceFieldsetProps) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-slate-700">{legend}</legend>
      <p className="text-xs text-slate-500">{help}</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {SUPPORTED_CURRENCIES.map((currency) => (
          <FormField key={currency} label={currency} htmlFor={`${idPrefix}-${currency}`}>
            <Input
              id={`${idPrefix}-${currency}`}
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={values[currency]}
              onChange={(event) => onChange(currency, event.target.value)}
            />
          </FormField>
        ))}
      </div>
    </fieldset>
  );
}

interface LimitFieldProps {
  limitKey: LimitKey;
  label: string;
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}

function LimitField({ limitKey, label, value, disabled, onChange }: LimitFieldProps) {
  return (
    <FormField label={label} htmlFor={`package-${limitKey}`}>
      <Input
        id={`package-${limitKey}`}
        type="number"
        min="1"
        placeholder="Unlimited"
        disabled={disabled}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </FormField>
  );
}

interface FlagProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  help?: ReactNode;
  disabled?: boolean;
}

function Flag({ checked, onChange, label, help, disabled }: FlagProps) {
  return (
    <div>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <Checkbox checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
        {label}
      </label>
      {help && <p className="mt-1 text-xs text-slate-500">{help}</p>}
    </div>
  );
}
