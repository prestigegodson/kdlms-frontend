import { CalendarCheck, HeartPulse, LogIn, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { downloadWardPhoto, getWardAttendance, getWardMedical, listWardTerms, type MyWardView } from "@/api/wards";
import { ApiError } from "@/api/client";
import type { StudentMedicalView } from "@/api/students";
import { ActionMenu, type ActionMenuItem } from "@/components/ui/ActionMenu";
import { Alert } from "@/components/ui/Alert";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { Spinner } from "@/components/ui/Spinner";
import { LogInAsWardDialog } from "@/features/guardian/components/LogInAsWardDialog";
import { groupWardsBySchool } from "@/features/guardian/groupWardsBySchool";
import { WardInsightCard } from "@/features/insights/components/WardInsightCard";
import { StudentMedicalPanel } from "@/features/students/components/StudentMedicalPanel";
import { useObjectUrl } from "@/hooks/useObjectUrl";
import { can } from "@/auth/permissions";
import { UpcomingSessionsPanel } from "@/features/virtualclass/components/UpcomingSessionsPanel";
import { loadGuardianUpcoming } from "@/features/virtualclass/upcomingSessions";
import { useAuthStore } from "@/stores/authStore";
import { useFeatureStore } from "@/stores/featureStore";
import { useWardStore } from "@/stores/wardStore";
import { initialsOfFullName } from "@/utils/initials";

interface WardCardProps {
  ward: MyWardView;
  /** Shown as a neutral badge next to the relationship badge once a guardian has wards at more than one school. */
  showSchool: boolean;
}

/**
 * One ward's profile card - ringed photo, name, class/level, admission
 * number, and (if the school has marked a current session for this ward)
 * this term's attendance rate, plus a collapsed "How {name} is doing"
 * insights line when the ward's school has it. Tapping the card opens
 * Results; the other actions live in a kebab menu, with "Log in as" also a
 * one-tap shortcut icon beside it. Navigating actions switch `wardStore`'s
 * selection first, so Results/Attendance land already scoped to this ward.
 */
function WardCard({ ward }: WardCardProps) {
  const navigate = useNavigate();
  const select = useWardStore((state) => state.select);
  const [attendanceRate, setAttendanceRate] = useState<number | null>(null);
  const [showMedical, setShowMedical] = useState(false);
  const [showLogInAs, setShowLogInAs] = useState(false);
  // Gated on photoFileId so a ward with no photo never fires a fetch that
  // can only 404 - downloadWardPhoto itself only takes the studentId.
  const photoUrl = useObjectUrl(ward.photoFileId ? ward.studentId : undefined, downloadWardPhoto);

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

  const firstName = ward.fullName.split(" ")[0];
  const menuItems: ActionMenuItem[] = [
    {
      label: "View attendance",
      icon: CalendarCheck,
      onSelect: () => goTo(`/guardian/attendance/${ward.studentId}`),
    },
    { label: "Medical & emergency", icon: HeartPulse, onSelect: () => setShowMedical(true) },
  ];
  if (ward.canLogInAs) {
    menuItems.push({ label: `Log in as ${firstName}`, icon: LogIn, separated: true, onSelect: () => setShowLogInAs(true) });
  }
  const classLine = [ward.currentClassName, ward.levelName].filter(Boolean);

  return (
    <Card>
      <div className="flex items-start gap-2">
        <button
          type="button"
          onClick={() => goTo(`/guardian/results/${ward.studentId}`)}
          aria-label={`${ward.fullName} — view results`}
          className="-m-2 flex min-w-0 flex-1 items-center gap-4 rounded-panel p-2 text-left transition-colors
            hover:bg-slate-50"
        >
          <Avatar
            initials={initialsOfFullName(ward.fullName)}
            url={photoUrl}
            size="xl"
            className="shadow-md ring-4 ring-white"
          />
          <div className="min-w-0 flex-1">
            <h2 className="truncate font-display text-lg font-medium text-slate-900">{ward.fullName}</h2>
            <p className="truncate text-sm text-slate-600">
              {classLine.length === 0
                ? "—"
                : classLine.map((part, index) => (
                    <span key={part}>
                      {index > 0 && <span aria-hidden="true"> · </span>}
                      <span>{part}</span>
                    </span>
                  ))}
            </p>
            <p className="text-xs text-slate-500">{ward.admissionNumber}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Badge variant="brand">{ward.relationship}</Badge>
              {attendanceRate != null && (
                <Badge variant="neutral">Attendance {attendanceRate.toFixed(1)}%</Badge>
              )}
            </div>
          </div>
        </button>

        <div className="flex shrink-0 items-center gap-0.5">
          {ward.canLogInAs && (
            <button
              type="button"
              onClick={() => setShowLogInAs(true)}
              aria-label={`Log in as ${firstName}`}
              title={`Log in as ${firstName}`}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-brand-600 transition-colors
                hover:bg-brand-50 mobile:min-h-11 mobile:min-w-11"
            >
              <LogIn className="h-5 w-5" aria-hidden="true" />
            </button>
          )}
          <ActionMenu variant="kebab" items={menuItems} ariaLabel={`More actions for ${ward.fullName}`} />
        </div>
      </div>

      <WardInsightCard studentId={ward.studentId} firstName={firstName} collapsible />

      {showMedical && <WardMedicalModal ward={ward} onClose={() => setShowMedical(false)} />}
      {showLogInAs && <LogInAsWardDialog ward={ward} onClose={() => setShowLogInAs(false)} />}
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

/**
 * Guardian portal index - one card per linked ward. A guardian whose wards
 * are all at one school (the overwhelmingly common case) sees exactly the
 * flat grid this page has always rendered; a guardian with wards at more
 * than one school (CLAUDE.md's cross-school guardian rule) instead sees the
 * cards grouped under a heading per school, since `wards` already arrives
 * sorted by name across schools rather than grouped.
 */
export function WardsPage() {
  const { wards, status, errorMessage, fetchIfNeeded, retry } = useWardStore();
  const role = useAuthStore((state) => state.user?.role);
  const onlineClasses = useFeatureStore((state) => state.onlineClasses);

  useEffect(() => {
    fetchIfNeeded();
  }, [fetchIfNeeded]);

  const multiSchool = new Set(wards.map((ward) => ward.schoolId)).size > 1;

  return (
    <div className="space-y-6">
      <PageHeader title="My Wards" description="Pupils linked to your account." />

      {can.viewOnlineClasses(role, onlineClasses) && (
        <UpcomingSessionsPanel load={loadGuardianUpcoming} joinLabel={() => "Watch"} hideWhenEmpty />
      )}

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
      {status === "loaded" && wards.length > 0 && !multiSchool && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {wards.map((ward) => (
            <WardCard key={ward.studentId} ward={ward} showSchool={false} />
          ))}
        </div>
      )}
      {status === "loaded" && wards.length > 0 && multiSchool && (
        <div className="space-y-6">
          {groupWardsBySchool(wards).map(([schoolName, schoolWards]) => (
            <div key={schoolName}>
              <h2 className="mb-3 font-display text-sm font-semibold uppercase tracking-wide text-slate-500">
                {schoolName}
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {schoolWards.map((ward) => (
                  <WardCard key={ward.studentId} ward={ward} showSchool />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
