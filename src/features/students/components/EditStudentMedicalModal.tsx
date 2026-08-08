import { type FormEvent, useState } from "react";
import { ApiError } from "@/api/client";
import { type BloodGroup, type Genotype, type StudentMedicalView, updateStudentMedical } from "@/api/students";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { BLOOD_GROUPS, GENOTYPES } from "@/features/students/components/medicalOptions";

interface EditStudentMedicalModalProps {
  studentId: string;
  medical: StudentMedicalView;
  onClose: () => void;
  onSaved: (medical: StudentMedicalView) => void;
}

/** Full-replace PUT, so every field is seeded from the currently loaded view - an omitted field clears it. */
export function EditStudentMedicalModal({
  studentId,
  medical,
  onClose,
  onSaved,
}: EditStudentMedicalModalProps) {
  const [bloodGroup, setBloodGroup] = useState<BloodGroup | "">(medical.bloodGroup ?? "");
  const [genotype, setGenotype] = useState<Genotype | "">(medical.genotype ?? "");
  const [allergies, setAllergies] = useState(medical.allergies ?? "");
  const [medicalConditions, setMedicalConditions] = useState(medical.medicalConditions ?? "");
  const [medications, setMedications] = useState(medical.medications ?? "");
  const [disabilityNotes, setDisabilityNotes] = useState(medical.disabilityNotes ?? "");
  const [emergencyContactName, setEmergencyContactName] = useState(medical.emergencyContactName ?? "");
  const [emergencyContactPhone, setEmergencyContactPhone] = useState(medical.emergencyContactPhone ?? "");
  const [emergencyContactRelationship, setEmergencyContactRelationship] = useState(
    medical.emergencyContactRelationship ?? "",
  );
  const [clinicName, setClinicName] = useState(medical.clinicName ?? "");
  const [doctorPhone, setDoctorPhone] = useState(medical.doctorPhone ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const updated = await updateStudentMedical(studentId, {
        bloodGroup: bloodGroup || undefined,
        genotype: genotype || undefined,
        allergies: allergies || undefined,
        medicalConditions: medicalConditions || undefined,
        medications: medications || undefined,
        disabilityNotes: disabilityNotes || undefined,
        emergencyContactName: emergencyContactName || undefined,
        emergencyContactPhone: emergencyContactPhone || undefined,
        emergencyContactRelationship: emergencyContactRelationship || undefined,
        clinicName: clinicName || undefined,
        doctorPhone: doctorPhone || undefined,
      });
      onSaved(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save medical information");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Edit medical & emergency information" size="lg">
      <form className="space-y-4" onSubmit={handleSubmit}>
        {error && <Alert variant="error">{error}</Alert>}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Blood group" htmlFor="medical-blood-group">
            <Select
              id="medical-blood-group"
              value={bloodGroup}
              onChange={(event) => setBloodGroup(event.target.value as BloodGroup | "")}
            >
              <option value="">Unknown</option>
              {BLOOD_GROUPS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Genotype" htmlFor="medical-genotype">
            <Select
              id="medical-genotype"
              value={genotype}
              onChange={(event) => setGenotype(event.target.value as Genotype | "")}
            >
              <option value="">Unknown</option>
              {GENOTYPES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </FormField>
        </div>
        <FormField label="Allergies" htmlFor="medical-allergies">
          <Textarea
            id="medical-allergies"
            rows={2}
            value={allergies}
            onChange={(event) => setAllergies(event.target.value)}
            placeholder="e.g. Peanuts, penicillin"
          />
        </FormField>
        <FormField label="Medical conditions" htmlFor="medical-conditions">
          <Textarea
            id="medical-conditions"
            rows={2}
            value={medicalConditions}
            onChange={(event) => setMedicalConditions(event.target.value)}
            placeholder="e.g. Mild asthma"
          />
        </FormField>
        <FormField label="Medications" htmlFor="medical-medications">
          <Textarea
            id="medical-medications"
            rows={2}
            value={medications}
            onChange={(event) => setMedications(event.target.value)}
            placeholder="e.g. Ventolin inhaler, as needed"
          />
        </FormField>
        <FormField label="Disability / special needs" htmlFor="medical-disability">
          <Textarea
            id="medical-disability"
            rows={2}
            value={disabilityNotes}
            onChange={(event) => setDisabilityNotes(event.target.value)}
          />
        </FormField>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Emergency contact name" htmlFor="medical-emergency-name">
            <Input
              id="medical-emergency-name"
              value={emergencyContactName}
              onChange={(event) => setEmergencyContactName(event.target.value)}
            />
          </FormField>
          <FormField label="Relationship" htmlFor="medical-emergency-relationship">
            <Input
              id="medical-emergency-relationship"
              value={emergencyContactRelationship}
              onChange={(event) => setEmergencyContactRelationship(event.target.value)}
              placeholder="e.g. Aunt, neighbour"
            />
          </FormField>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Emergency contact phone" htmlFor="medical-emergency-phone">
            <Input
              id="medical-emergency-phone"
              value={emergencyContactPhone}
              onChange={(event) => setEmergencyContactPhone(event.target.value)}
            />
          </FormField>
          <FormField label="Clinic / hospital" htmlFor="medical-clinic-name">
            <Input
              id="medical-clinic-name"
              value={clinicName}
              onChange={(event) => setClinicName(event.target.value)}
            />
          </FormField>
        </div>
        <FormField label="Doctor phone" htmlFor="medical-doctor-phone">
          <Input
            id="medical-doctor-phone"
            value={doctorPhone}
            onChange={(event) => setDoctorPhone(event.target.value)}
          />
        </FormField>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
