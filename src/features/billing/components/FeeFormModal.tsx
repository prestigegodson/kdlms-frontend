import { type FormEvent, useEffect, useState } from "react";
import { createFee, type FeeApplicability, type FeeKind, type FeeView, updateFee } from "@/api/billing";
import { listLevels } from "@/api/levels";
import { ApiError } from "@/api/client";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";

interface FeeFormModalProps {
  /** Present -> edit an existing fee. Absent -> create a new one. */
  fee?: FeeView;
  /** Next print-order position for a brand-new fee - ignored when editing. */
  nextPosition: number;
  onClose: () => void;
  onSaved: () => void;
}

const TERM_NUMBERS = [1, 2, 3] as const;

/**
 * Create-and-edit fee form. Level options come from the same active-levels list the academics
 * screens use - no dedicated billing endpoint.
 * <p>
 * `kind` (Phase 22) is pickable only on create - it's immutable once a fee exists, so the field
 * disappears entirely when editing (the existing kind is just implied). Picking TRANSPORT hides
 * the level picker (a school-bus fee applies to every level unconditionally), forces
 * applicability to TERMLY (hiding the FIRST_TERM_ONLY option, which is meaningless for a bus
 * fare), and forces + disables "Compulsory" (a transport line is always optional on the bill).
 * Routes, fares, and rider assignment live on the Transport tab, not here.
 * <p>
 * "Price varies by term" (Phase 23) is only selectable for a STANDARD, TERMLY fee with two or
 * more terms selected (`canVaryByTerm`) - narrowing terms below two, switching applicability away
 * from TERMLY, or picking TRANSPORT all auto-untick it, since the flag has no meaning there. The
 * server still enforces the same invariant and the ordinary refusal-with-message flow (`error`,
 * rendered via `Alert`) already surfaces its 422 the same way any other save failure does.
 */
export function FeeFormModal({ fee, nextPosition, onClose, onSaved }: FeeFormModalProps) {
  const isEdit = fee != null;
  const [kind, setKind] = useState<FeeKind>(fee?.kind ?? "STANDARD");
  const isTransport = kind === "TRANSPORT";
  const [name, setName] = useState(fee?.name ?? "");
  const [description, setDescription] = useState(fee?.description ?? "");
  const [applicability, setApplicability] = useState<FeeApplicability>(fee?.applicability ?? "TERMLY");
  const [termNumbers, setTermNumbers] = useState<number[]>(fee?.termNumbers ?? [1, 2, 3]);
  const [levelIds, setLevelIds] = useState<string[]>(fee?.levels.map((level) => level.levelId) ?? []);
  const [compulsory, setCompulsory] = useState(fee?.compulsory ?? true);
  const [active, setActive] = useState(fee?.active ?? true);
  const [priceVariesByTerm, setPriceVariesByTerm] = useState(fee?.priceVariesByTerm ?? false);
  const canVaryByTerm = !isTransport && applicability === "TERMLY" && termNumbers.length >= 2;

  const [levelOptions, setLevelOptions] = useState<{ id: string; displayName: string }[] | null>(null);
  const [levelsError, setLevelsError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listLevels()
      .then((levels) =>
        setLevelOptions(
          levels.filter((level) => level.status === "ACTIVE").map((level) => ({
            id: level.id,
            displayName: level.displayName,
          })),
        ),
      )
      .catch((err: unknown) => setLevelsError(err instanceof ApiError ? err.message : "Failed to load levels"));
  }, []);

  function handleKindChange(nextKind: FeeKind) {
    setKind(nextKind);
    if (nextKind === "TRANSPORT") {
      setApplicability("TERMLY");
      setTermNumbers([1, 2, 3]);
      setLevelIds([]);
      setCompulsory(false);
      setPriceVariesByTerm(false);
    }
  }

  function handleApplicabilityChange(next: FeeApplicability) {
    setApplicability(next);
    if (next !== "TERMLY") setPriceVariesByTerm(false);
  }

  function toggleTermNumber(termNumber: number) {
    setTermNumbers((current) => {
      const next = current.includes(termNumber)
        ? current.filter((n) => n !== termNumber)
        : [...current, termNumber].sort();
      if (next.length < 2) setPriceVariesByTerm(false);
      return next;
    });
  }

  function toggleLevel(levelId: string) {
    setLevelIds((current) =>
      current.includes(levelId) ? current.filter((id) => id !== levelId) : [...current, levelId],
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const request = {
        kind,
        name,
        description: description || null,
        applicability,
        termNumbers: applicability === "TERMLY" ? termNumbers : null,
        levelIds: isTransport ? [] : levelIds,
        compulsory: isTransport ? false : compulsory,
        active,
        position: fee?.position ?? nextPosition,
        priceVariesByTerm: canVaryByTerm && priceVariesByTerm,
      };
      if (isEdit) {
        await updateFee(fee.id, request);
      } else {
        await createFee(request);
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : `Failed to ${isEdit ? "update" : "create"} fee`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={isEdit ? "Edit fee" : "Add fee"}>
      <form className="space-y-4" onSubmit={handleSubmit}>
        {error && <Alert variant="error">{error}</Alert>}
        {levelsError && <Alert variant="error">{levelsError}</Alert>}

        {!isEdit && (
          <FormField
            label="Kind"
            htmlFor="fee-kind"
            description="A school-bus fee is priced per route and direction, and assigned per student on the Transport tab - not here. Only one is allowed per school."
          >
            <Select
              id="fee-kind"
              value={kind}
              onChange={(event) => handleKindChange(event.target.value as FeeKind)}
            >
              <option value="STANDARD">Standard fee</option>
              <option value="TRANSPORT">School bus (transport)</option>
            </Select>
          </FormField>
        )}

        <FormField label="Name" htmlFor="fee-name">
          <Input id="fee-name" required value={name} onChange={(event) => setName(event.target.value)} />
        </FormField>

        <FormField label="Description" htmlFor="fee-description">
          <Textarea
            id="fee-description"
            rows={2}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </FormField>

        {isTransport ? (
          <Alert variant="info">
            A school-bus fee is always every-session, every-term, and applies to riders on any level - configure its
            terms only if this fee shouldn't run all year.
          </Alert>
        ) : null}

        <FormField
          label="Applies"
          htmlFor="fee-applicability"
          description="TERMLY charges in the term(s) you pick, every session. FIRST_TERM_ONLY charges once - in the student's own admission term, not necessarily term 1."
        >
          <Select
            id="fee-applicability"
            value={applicability}
            disabled={isTransport}
            onChange={(event) => handleApplicabilityChange(event.target.value as FeeApplicability)}
          >
            <option value="TERMLY">Every session, in specific terms</option>
            {!isTransport && (
              <option value="FIRST_TERM_ONLY">Once - the student's own admission term</option>
            )}
          </Select>
        </FormField>

        {applicability === "TERMLY" && (
          <FormField label="Terms">
            <div className="flex gap-4">
              {TERM_NUMBERS.map((termNumber) => (
                <label key={termNumber} className="flex items-center gap-2 text-sm text-slate-700">
                  <Checkbox
                    checked={termNumbers.includes(termNumber)}
                    onChange={() => toggleTermNumber(termNumber)}
                  />
                  Term {termNumber}
                </label>
              ))}
            </div>
          </FormField>
        )}

        {!isTransport && (
          <label className="flex items-start gap-2 text-sm text-slate-700">
            <Checkbox
              checked={canVaryByTerm && priceVariesByTerm}
              disabled={!canVaryByTerm}
              onChange={(event) => setPriceVariesByTerm(event.target.checked)}
            />
            <span>
              Price varies by term
              <span className="mt-0.5 block text-xs text-slate-500">
                {canVaryByTerm
                  ? "Set a different amount per term on the Prices tab, instead of one price for the whole session. Switching this back off is refused while terms are priced differently."
                  : "Only available for a fee applying to more than one term."}
              </span>
            </span>
          </label>
        )}

        {!isTransport && (
          <FormField label="Levels">
            {levelOptions === null ? (
              <p className="text-sm text-slate-500">Loading levels…</p>
            ) : levelOptions.length === 0 ? (
              <p className="text-sm text-slate-500">No active levels found.</p>
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {levelOptions.map((level) => (
                  <label key={level.id} className="flex items-center gap-2 text-sm text-slate-700">
                    <Checkbox checked={levelIds.includes(level.id)} onChange={() => toggleLevel(level.id)} />
                    {level.displayName}
                  </label>
                ))}
              </div>
            )}
          </FormField>
        )}

        <div className="flex flex-wrap gap-6">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <Checkbox
              checked={isTransport ? false : compulsory}
              disabled={isTransport}
              onChange={(event) => setCompulsory(event.target.checked)}
            />
            {isTransport ? "Optional (a school-bus fee never counts toward the total)" : "Compulsory (counts toward the bill's total)"}
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <Checkbox checked={active} onChange={(event) => setActive(event.target.checked)} />
            Active
          </label>
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting || (!isTransport && levelIds.length === 0)}>
            {submitting ? "Saving…" : isEdit ? "Save changes" : "Add fee"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
