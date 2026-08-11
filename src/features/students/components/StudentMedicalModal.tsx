import { useEffect, useState } from "react";
import { getStudentMedical as getMyStudentMedical, type RosterStudentView } from "@/api/me";
import { ApiError } from "@/api/client";
import type { StudentMedicalView } from "@/api/students";
import { Alert } from "@/components/ui/Alert";
import { Modal } from "@/components/ui/Modal";
import { Spinner } from "@/components/ui/Spinner";
import { StudentMedicalPanel } from "@/features/students/components/StudentMedicalPanel";

interface StudentMedicalModalProps {
  student: RosterStudentView;
  onClose: () => void;
}

/**
 * Read-only medical & emergency info for a student on one of the caller's
 * own classes - shared by {@code StudentsPage}'s teacher roster and
 * {@code ClassDetailPage}'s enrolled-students panel, since both let a
 * TEACHER tap a roster row for the same read-only detail.
 */
export function StudentMedicalModal({ student, onClose }: StudentMedicalModalProps) {
  const [state, setState] = useState<
    { kind: "loading" } | { kind: "loaded"; medical: StudentMedicalView } | { kind: "error"; message: string }
  >({ kind: "loading" });

  useEffect(() => {
    getMyStudentMedical(student.studentId)
      .then((medical) => setState({ kind: "loaded", medical }))
      .catch((error: unknown) =>
        setState({
          kind: "error",
          message: error instanceof ApiError ? error.message : "Failed to load medical information",
        }),
      );
  }, [student.studentId]);

  return (
    <Modal open onClose={onClose} title={`${student.fullName} — Medical & emergency`} size="lg">
      {state.kind === "loading" && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner /> Loading…
        </div>
      )}
      {state.kind === "error" && <Alert variant="error">{state.message}</Alert>}
      {state.kind === "loaded" && <StudentMedicalPanel medical={state.medical} />}
    </Modal>
  );
}
