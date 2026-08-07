import { useEffect, useState } from "react";
import { Link } from "react-router";
import { type GuardianView, listGuardianWards, type WardView } from "@/api/guardians";
import { ApiError } from "@/api/client";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { Spinner } from "@/components/ui/Spinner";
import { Alert } from "@/components/ui/Alert";

interface WardsModalProps {
  guardian: GuardianView;
  onClose: () => void;
}

export function WardsModal({ guardian, onClose }: WardsModalProps) {
  const [wards, setWards] = useState<WardView[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listGuardianWards(guardian.id)
      .then(setWards)
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : "Failed to load wards"));
  }, [guardian.id]);

  return (
    <Modal open onClose={onClose} title={`${guardian.fullName}'s wards`}>
      {error && <Alert variant="error">{error}</Alert>}
      {wards === null && !error && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner /> Loading…
        </div>
      )}
      {wards !== null && wards.length === 0 && (
        <EmptyState title="No wards linked" description="Link a student from their profile page." />
      )}
      {wards !== null && wards.length > 0 && (
        <ul className="divide-y divide-slate-100">
          {wards.map((ward) => (
            <li key={ward.studentId} className="flex items-center justify-between py-2 text-sm">
              <Link to={`/school/students/${ward.studentId}`} onClick={onClose} className="hover:underline">
                <p className="font-medium text-slate-900">{ward.studentName}</p>
                <p className="text-slate-500">{ward.admissionNumber}</p>
              </Link>
              <Badge variant="neutral">{ward.relationship}</Badge>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
