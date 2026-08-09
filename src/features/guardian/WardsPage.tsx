import { ChevronRight, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { getWardAttendance, getWardMedical, listWardTerms, type MyWardView } from "@/api/wards";
import { ApiError } from "@/api/client";
import type { StudentMedicalView } from "@/api/students";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { Spinner } from "@/components/ui/Spinner";
import { StatTile } from "@/components/ui/StatTile";
import { StudentMedicalPanel } from "@/features/students/components/StudentMedicalPanel";
import { useWardStore } from "@/stores/wardStore";

interface WardCardProps {
  ward: MyWardView;
}

/**
 * One ward's summary card - bio, current class, and (if the school has
 * marked a current session for this ward) this term's attendance rate.
 * Selecting either action switches `wardStore`'s selection before
 * navigating, so Results/Attendance land already scoped to this ward.
 */
function WardCard({ ward }: WardCardProps) {
  const navigate = useNavigate();
  const select = useWardStore((state) => state.select);
  const [attendanceRate, setAttendanceRate] = useState<number | null>(null);
  const [showMedical, setShowMedical] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listWardTerms(ward.studentId)
      .then((terms) => {
        const currentTerm = [...terms].reverse().find((term) => term.currentSession);
        if (!currentTerm) return;
        return getWardAttendance(ward.studentId, currentTerm.termId).then((summary) => {
          if (!cancelled && summary.daysMarked > 0) setAttendanceRate(summary.attendanceRate);
        });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [ward.studentId]);

  function goTo(path: string) {
    select(ward.studentId);
    navigate(path);
  }

  return (
    <Card>
      <button
        type="button"
        onClick={() => goTo("/guardian/results")}
        aria-label={`${ward.fullName} — view results`}
        className="flex w-full items-start gap-3 rounded-panel text-left transition-colors hover:bg-slate-50"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-medium text-slate-900">{ward.fullName}</h2>
              <p className="text-sm text-slate-500">{ward.admissionNumber}</p>
            </div>
            <Badge variant="brand">{ward.relationship}</Badge>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatTile label="Class" value={ward.currentClassName ?? "—"} />
            <StatTile label="Level" value={ward.levelName ?? "—"} />
            {attendanceRate != null && (
              <StatTile label="Attendance (this term)" value={`${attendanceRate.toFixed(1)}%`} />
            )}
          </div>
        </div>
        <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />
      </button>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" onClick={() => goTo("/guardian/attendance")}>
          View attendance
        </Button>
        <Button variant="secondary" size="sm" onClick={() => setShowMedical(true)}>
          Medical &amp; emergency
        </Button>
      </div>

      {showMedical && <WardMedicalModal ward={ward} onClose={() => setShowMedical(false)} />}
    </Card>
  );
}

interface WardMedicalModalProps {
  ward: MyWardView;
  onClose: () => void;
}

/** Read-only medical & emergency info for a linked ward - not publication-gated, like attendance. */
function WardMedicalModal({ ward, onClose }: WardMedicalModalProps) {
  const [state, setState] = useState<
    { kind: "loading" } | { kind: "loaded"; medical: StudentMedicalView } | { kind: "error"; message: string }
  >({ kind: "loading" });

  useEffect(() => {
    getWardMedical(ward.studentId)
      .then((medical) => setState({ kind: "loaded", medical }))
      .catch((error: unknown) =>
        setState({
          kind: "error",
          message: error instanceof ApiError ? error.message : "Failed to load medical information",
        }),
      );
  }, [ward.studentId]);

  return (
    <Modal open onClose={onClose} title={`${ward.fullName} — Medical & emergency`} size="lg">
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

/** Guardian portal index - one card per linked ward. */
export function WardsPage() {
  const { wards, status, errorMessage, fetchIfNeeded, retry } = useWardStore();

  useEffect(() => {
    fetchIfNeeded();
  }, [fetchIfNeeded]);

  return (
    <div className="space-y-6">
      <PageHeader title="My Wards" description="Students linked to your account." />

      {(status === "idle" || status === "loading") && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner /> Loading…
        </div>
      )}
      {status === "error" && <ErrorState message={errorMessage ?? "Failed to load your wards"} onRetry={retry} />}
      {status === "loaded" && wards.length === 0 && (
        <EmptyState
          icon={Users}
          title="No wards linked yet"
          description="Contact your school if you believe this is a mistake."
        />
      )}
      {status === "loaded" && wards.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {wards.map((ward) => (
            <WardCard key={ward.studentId} ward={ward} />
          ))}
        </div>
      )}
    </div>
  );
}
