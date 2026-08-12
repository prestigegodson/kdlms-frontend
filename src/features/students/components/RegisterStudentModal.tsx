import { type FormEvent, useState } from "react";
import type { BranchView } from "@/api/branches";
import type { SchoolClassView } from "@/api/classes";
import { ApiError } from "@/api/client";
import { registerStudent } from "@/api/students";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { DateInput } from "@/components/ui/DateInput";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { todayIso } from "@/utils/date";

interface RegisterStudentModalProps {
  branches?: BranchView[];
  classes?: SchoolClassView[];
  showBranchField?: boolean;
  /**
   * Pins the class and hides both the branch and class pickers - the
   * class-detail page's "Register student" action already knows which
   * class, unlike the student registry's version of this same form.
   */
  fixedClass?: { id: string; name: string, branchId: string };
  onClose: () => void;
  onSaved: () => void;
}

/**
 * The registration form shared by the student registry ({@code StudentsPage})
 * and a class's own "Register student" action ({@code ClassDetailPage}'s
 * roster panel) - only the branch/class pickers differ between the two call
 * sites (see {@link fixedClass}).
 */
export function RegisterStudentModal({
  branches = [],
  classes = [],
  showBranchField = false,
  fixedClass,
  onClose,
  onSaved,
}: RegisterStudentModalProps) {
  const [branchId, setBranchId] = useState(branches[0]?.id ?? "");
  const classesInBranch = showBranchField ? classes.filter((c) => c.branchId === branchId) : classes;
  const [classId, setClassId] = useState(fixedClass?.id ?? classesInBranch[0]?.id ?? "");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [otherName, setOtherName] = useState("");
  const [gender, setGender] = useState<"FEMALE" | "MALE">("FEMALE");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [manualAdmissionNumber, setManualAdmissionNumber] = useState(false);
  const [admissionNumber, setAdmissionNumber] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await registerStudent({
        branchId: showBranchField ? branchId : fixedClass?.branchId,
        classId,
        admissionNumber: manualAdmissionNumber ? admissionNumber : undefined,
        firstName,
        lastName,
        otherName: otherName || undefined,
        gender,
        dateOfBirth: dateOfBirth || undefined,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to register student");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Register student" size="lg">
      <form className="space-y-4" onSubmit={handleSubmit}>
        {error && <Alert variant="error">{error}</Alert>}
        {fixedClass ? (
          <p className="text-sm text-slate-600">
            Registering into <span className="font-medium text-slate-900">{fixedClass.name}</span>.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {showBranchField && (
              <FormField label="Branch" htmlFor="register-branch">
                <Select
                  id="register-branch"
                  required
                  value={branchId}
                  onChange={(event) => {
                    setBranchId(event.target.value);
                    setClassId("");
                  }}
                >
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </Select>
              </FormField>
            )}
            <FormField label="Class" htmlFor="register-class">
              <Select
                id="register-class"
                required
                value={classId}
                onChange={(event) => setClassId(event.target.value)}
              >
                <option value="" disabled>
                  Select a class…
                </option>
                {classesInBranch.map((schoolClass) => (
                  <option key={schoolClass.id} value={schoolClass.id}>
                    {schoolClass.name}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="First name" htmlFor="register-first-name">
            <Input id="register-first-name" required value={firstName} onChange={(event) => setFirstName(event.target.value)} />
          </FormField>
          <FormField label="Last name" htmlFor="register-last-name">
            <Input id="register-last-name" required value={lastName} onChange={(event) => setLastName(event.target.value)} />
          </FormField>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Other name" htmlFor="register-other-name">
            <Input id="register-other-name" value={otherName} onChange={(event) => setOtherName(event.target.value)} />
          </FormField>
          <FormField label="Gender" htmlFor="register-gender">
            <Select
              id="register-gender"
              required
              value={gender}
              onChange={(event) => setGender(event.target.value as "FEMALE" | "MALE")}
            >
              <option value="FEMALE">Female</option>
              <option value="MALE">Male</option>
            </Select>
          </FormField>
        </div>
        <FormField label="Date of birth" htmlFor="register-dob">
          <DateInput id="register-dob" max={todayIso()} value={dateOfBirth} onChange={setDateOfBirth} />
        </FormField>
        <div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <Checkbox checked={manualAdmissionNumber} onChange={(event) => setManualAdmissionNumber(event.target.checked)} />
            Enter admission number manually
          </label>
          {manualAdmissionNumber ? (
            <div className="mt-2">
              <Input
                aria-label="Admission number"
                required
                placeholder="e.g. OLD-1998/77"
                value={admissionNumber}
                onChange={(event) => setAdmissionNumber(event.target.value)}
              />
            </div>
          ) : (
            <p className="mt-1 text-xs text-slate-500">
              Leave unchecked to generate one automatically from the school code and year.
            </p>
          )}
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting || !classId}>
            {submitting ? "Registering…" : "Register student"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
