import type { StudentMedicalView } from "@/api/students";
import { EmptyState } from "@/components/ui/EmptyState";
import { HeartPulse } from "lucide-react";
import { bloodGroupLabel } from "@/features/students/components/medicalOptions";

interface StudentMedicalPanelProps {
  medical: StudentMedicalView;
}

/**
 * Read-only medical & emergency details - one component, three callers: the
 * admin student profile, the teacher roster's per-student modal, and the
 * guardian ward view. Only the admin caller wraps this with an Edit action;
 * teachers and guardians never get a write path.
 */
export function StudentMedicalPanel({ medical }: StudentMedicalPanelProps) {
  const isEmpty =
    !medical.bloodGroup &&
    !medical.genotype &&
    !medical.allergies &&
    !medical.medicalConditions &&
    !medical.medications &&
    !medical.disabilityNotes &&
    !medical.emergencyContactName &&
    !medical.emergencyContactPhone &&
    !medical.emergencyContactRelationship &&
    !medical.clinicName &&
    !medical.doctorPhone;

  if (isEmpty) {
    return (
      <EmptyState
        icon={HeartPulse}
        title="No medical information on file"
        description="Nothing has been recorded yet."
      />
    );
  }

  return (
    <dl className="grid grid-cols-1 gap-x-4 gap-y-3 text-sm sm:grid-cols-2">
      <div>
        <dt className="text-slate-500">Blood group</dt>
        <dd className="text-slate-900">{bloodGroupLabel(medical.bloodGroup) ?? "—"}</dd>
      </div>
      <div>
        <dt className="text-slate-500">Genotype</dt>
        <dd className="text-slate-900">{medical.genotype ?? "—"}</dd>
      </div>
      <div className="col-span-2">
        <dt className="text-slate-500">Allergies</dt>
        <dd className="whitespace-pre-wrap text-slate-900">{medical.allergies ?? "—"}</dd>
      </div>
      <div className="col-span-2">
        <dt className="text-slate-500">Medical conditions</dt>
        <dd className="whitespace-pre-wrap text-slate-900">{medical.medicalConditions ?? "—"}</dd>
      </div>
      <div className="col-span-2">
        <dt className="text-slate-500">Medications</dt>
        <dd className="whitespace-pre-wrap text-slate-900">{medical.medications ?? "—"}</dd>
      </div>
      <div className="col-span-2">
        <dt className="text-slate-500">Disability / special needs</dt>
        <dd className="whitespace-pre-wrap text-slate-900">{medical.disabilityNotes ?? "—"}</dd>
      </div>
      <div>
        <dt className="text-slate-500">Emergency contact</dt>
        <dd className="text-slate-900">
          {medical.emergencyContactName ?? "—"}
          {medical.emergencyContactRelationship ? ` (${medical.emergencyContactRelationship})` : ""}
        </dd>
      </div>
      <div>
        <dt className="text-slate-500">Emergency phone</dt>
        <dd className="text-slate-900">{medical.emergencyContactPhone ?? "—"}</dd>
      </div>
      <div>
        <dt className="text-slate-500">Clinic / hospital</dt>
        <dd className="text-slate-900">{medical.clinicName ?? "—"}</dd>
      </div>
      <div>
        <dt className="text-slate-500">Doctor phone</dt>
        <dd className="text-slate-900">{medical.doctorPhone ?? "—"}</dd>
      </div>
    </dl>
  );
}
