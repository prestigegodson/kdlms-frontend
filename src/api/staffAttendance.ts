import { apiFetch, apiFetchBlob } from "@/api/client";

/**
 * Mirrors backend staffattendance (Phase 46) - the staff roster, biometric
 * terminals, gate displays, the daily clock-in register and its corrections.
 * Admin endpoints are SCHOOL_ADMIN/BRANCH_ADMIN only and need the package's
 * `staffAttendance` flag; the `public*` functions are the unauthenticated
 * phone/gate side.
 */

export type StaffKind = "ACADEMIC" | "NON_ACADEMIC";

export const STAFF_CATEGORIES = [
  "NANNY",
  "CLEANER",
  "SECURITY",
  "DRIVER",
  "COOK",
  "GARDENER",
  "ATTENDANT",
  "OTHER",
] as const;
export type StaffCategory = (typeof STAFF_CATEGORIES)[number];

export const STAFF_CATEGORY_LABELS: Record<StaffCategory, string> = {
  NANNY: "Nanny",
  CLEANER: "Cleaner",
  SECURITY: "Security",
  DRIVER: "Driver",
  COOK: "Cook",
  GARDENER: "Gardener",
  ATTENDANT: "Attendant",
  OTHER: "Other",
};

/** `NOT_LINKED`: a login staff member not yet set up for clock-in (no row, no PIN). */
export type StaffRowStatus = "ACTIVE" | "INACTIVE" | "NOT_LINKED";

export interface StaffRowView {
  staffMemberId: string | null;
  userId: string | null;
  kind: StaffKind;
  firstName: string;
  lastName: string;
  /** Login role of an academic row (TEACHER, SCHOOL_ADMIN, ...); null otherwise. */
  role: string | null;
  category: StaffCategory | null;
  jobTitle: string | null;
  phone: string | null;
  branchId: string | null;
  devicePin: number | null;
  /** "HH:mm:ss" - a personal shift overriding the branch hours. */
  shiftStart: string | null;
  shiftEnd: string | null;
  status: StaffRowStatus;
  passkeys: number;
  fingerprintDevices: number;
  face: boolean;
  createdAt: string | null;
}

export interface SaveStaffRequest {
  branchId?: string;
  firstName: string;
  lastName: string;
  phone?: string;
  category: StaffCategory;
  jobTitle?: string;
}

export type DayStatus = "PRESENT" | "CLOCKED_IN" | "NOT_CLOCKED_IN" | "ABSENT" | "OFF_DAY";

export interface DayView {
  date: string;
  status: DayStatus;
  clockIn: string | null;
  clockOut: string | null;
  late: boolean;
  lateMinutes: number;
  earlyLeave: boolean;
  missingClockOut: boolean;
  workedMinutes: number;
  punches: number;
}

export interface RegisterRowView {
  staffMemberId: string;
  userId: string | null;
  kind: StaffKind;
  name: string;
  role: string | null;
  category: StaffCategory | null;
  branchId: string | null;
  day: DayView;
}

export interface RegisterSummary {
  total: number;
  onSite: number;
  present: number;
  late: number;
  absent: number;
  notClockedIn: number;
}

export interface DailyRegisterView {
  date: string;
  /** Every instant on the page is shown in this zone. */
  timezone: string;
  summary: RegisterSummary;
  rows: RegisterRowView[];
}

export type ClockSource = "DEVICE" | "PASSKEY" | "MANUAL";

export interface ClockEventView {
  id: string;
  occurredAt: string;
  localDate: string;
  source: ClockSource;
  branchId: string;
  deviceId: string | null;
  stationId: string | null;
  reason: string | null;
  recordedByName: string | null;
  voidedAt: string | null;
  voidReason: string | null;
  voidedByName: string | null;
}

export interface StaffHistoryView {
  staffMemberId: string;
  name: string;
  timezone: string;
  days: DayView[];
  events: ClockEventView[];
}

export type DayOfWeek =
  | "MONDAY"
  | "TUESDAY"
  | "WEDNESDAY"
  | "THURSDAY"
  | "FRIDAY"
  | "SATURDAY"
  | "SUNDAY";

export const DAYS_OF_WEEK: DayOfWeek[] = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
];

export interface ShiftPolicyView {
  branchId: string;
  timezone: string;
  resumptionTime: string;
  closingTime: string;
  lateGraceMinutes: number;
  earlyLeaveGraceMinutes: number;
  workingDays: DayOfWeek[];
  /** False while the branch still runs on the platform defaults. */
  custom: boolean;
}

export interface SaveShiftPolicyRequest {
  timezone: string;
  resumptionTime: string;
  closingTime: string;
  lateGraceMinutes: number;
  earlyLeaveGraceMinutes: number;
  workingDays: DayOfWeek[];
}

export interface PasskeyView {
  id: string;
  label: string | null;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

export interface EnrollmentLinkView {
  token: string;
  expiresAt: string;
}

export interface DeviceView {
  id: string;
  branchId: string;
  serialNumber: string;
  name: string;
  status: "ACTIVE" | "DISABLED";
  allowedCidr: string | null;
  lastSeenAt: string | null;
  lastSeenIp: string | null;
  online: boolean;
  pendingCommands: number;
}

export interface DeviceCommandView {
  id: number;
  command: string;
  status: "PENDING" | "SENT" | "DONE" | "FAILED";
  returnCode: number | null;
  createdAt: string;
  completedAt: string | null;
}

export interface StationView {
  id: string;
  branchId: string;
  name: string;
  paired: boolean;
  pairedAt: string | null;
  lastSeenAt: string | null;
  online: boolean;
}

export interface StationPairingView {
  stationId: string;
  token: string;
}

const BASE = "/api/v1/staff-attendance";

function query(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) {
      search.set(key, value);
    }
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}

// ---- roster ----

export function getRoster(branchId?: string): Promise<{ staff: StaffRowView[] }> {
  return apiFetch(`${BASE}/staff${query({ branchId })}`);
}

export function createStaff(request: SaveStaffRequest): Promise<StaffRowView> {
  return apiFetch(`${BASE}/staff`, { method: "POST", body: JSON.stringify(request) });
}

export function updateStaff(staffMemberId: string, request: SaveStaffRequest): Promise<StaffRowView> {
  return apiFetch(`${BASE}/staff/${staffMemberId}`, { method: "PUT", body: JSON.stringify(request) });
}

export function setStaffShift(
  staffMemberId: string,
  shiftStart: string | null,
  shiftEnd: string | null,
): Promise<StaffRowView> {
  return apiFetch(`${BASE}/staff/${staffMemberId}/shift`, {
    method: "PUT",
    body: JSON.stringify({ shiftStart, shiftEnd }),
  });
}

export function setStaffActive(staffMemberId: string, active: boolean): Promise<StaffRowView> {
  return apiFetch(`${BASE}/staff/${staffMemberId}/${active ? "reactivate" : "deactivate"}`, {
    method: "POST",
  });
}

export function linkAcademicStaff(userId: string): Promise<StaffRowView> {
  return apiFetch(`${BASE}/staff/academic/${userId}`, { method: "POST" });
}

export function linkAllAcademicStaff(branchId?: string): Promise<{ linked: number }> {
  return apiFetch(`${BASE}/staff/academic/link-all${query({ branchId })}`, { method: "POST" });
}

// ---- passkeys ----

export function issueEnrollmentLink(staffMemberId: string): Promise<EnrollmentLinkView> {
  return apiFetch(`${BASE}/staff/${staffMemberId}/enrollment-links`, { method: "POST" });
}

export function listPasskeys(staffMemberId: string): Promise<PasskeyView[]> {
  return apiFetch(`${BASE}/staff/${staffMemberId}/passkeys`);
}

export function revokePasskey(passkeyId: string): Promise<void> {
  return apiFetch(`${BASE}/passkeys/${passkeyId}`, { method: "DELETE" });
}

// ---- register ----

export function getRegister(date: string, branchId?: string): Promise<DailyRegisterView> {
  return apiFetch(`${BASE}/register${query({ date, branchId })}`);
}

export function exportRegister(from: string, to: string, branchId?: string): Promise<Blob> {
  return apiFetchBlob(`${BASE}/register/export${query({ from, to, branchId })}`);
}

export function getStaffHistory(staffMemberId: string, from?: string, to?: string): Promise<StaffHistoryView> {
  return apiFetch(`${BASE}/staff/${staffMemberId}/history${query({ from, to })}`);
}

export function addManualEvent(
  staffMemberId: string,
  request: { date: string; time: string; branchId?: string; reason: string },
): Promise<ClockEventView> {
  return apiFetch(`${BASE}/staff/${staffMemberId}/events`, { method: "POST", body: JSON.stringify(request) });
}

export function voidEvent(eventId: string, reason: string): Promise<ClockEventView> {
  return apiFetch(`${BASE}/events/${eventId}/void`, { method: "POST", body: JSON.stringify({ reason }) });
}

// ---- shift rules ----

export function getShiftPolicy(branchId: string): Promise<ShiftPolicyView> {
  return apiFetch(`${BASE}/branches/${branchId}/shift-policy`);
}

export function saveShiftPolicy(branchId: string, request: SaveShiftPolicyRequest): Promise<ShiftPolicyView> {
  return apiFetch(`${BASE}/branches/${branchId}/shift-policy`, {
    method: "PUT",
    body: JSON.stringify(request),
  });
}

// ---- terminals and gates ----

export function listDevices(branchId?: string): Promise<DeviceView[]> {
  return apiFetch(`${BASE}/devices${query({ branchId })}`);
}

export function registerDevice(request: {
  branchId?: string;
  serialNumber: string;
  name: string;
  allowedCidr?: string;
}): Promise<DeviceView> {
  return apiFetch(`${BASE}/devices`, { method: "POST", body: JSON.stringify(request) });
}

export function updateDevice(
  deviceId: string,
  request: { name: string; active: boolean; allowedCidr?: string },
): Promise<DeviceView> {
  return apiFetch(`${BASE}/devices/${deviceId}`, { method: "PUT", body: JSON.stringify(request) });
}

export function syncDevice(deviceId: string): Promise<{ queued: number }> {
  return apiFetch(`${BASE}/devices/${deviceId}/sync`, { method: "POST" });
}

export function enrollOnDevice(deviceId: string, staffMemberId: string): Promise<void> {
  return apiFetch(`${BASE}/devices/${deviceId}/enroll/${staffMemberId}`, { method: "POST" });
}

export function listDeviceCommands(deviceId: string): Promise<DeviceCommandView[]> {
  return apiFetch(`${BASE}/devices/${deviceId}/commands`);
}

export function listStations(branchId?: string): Promise<StationView[]> {
  return apiFetch(`${BASE}/stations${query({ branchId })}`);
}

export function createStation(request: { branchId?: string; name: string }): Promise<StationView> {
  return apiFetch(`${BASE}/stations`, { method: "POST", body: JSON.stringify(request) });
}

export function pairStation(stationId: string): Promise<StationPairingView> {
  return apiFetch(`${BASE}/stations/${stationId}/pair`, { method: "POST" });
}

export function removeStation(stationId: string): Promise<void> {
  return apiFetch(`${BASE}/stations/${stationId}`, { method: "DELETE" });
}

// ---- public: phone and gate display (no session) ----

const PUBLIC = "/api/v1/public/staff-clock";

export interface EnrollmentInfoView {
  staffName: string;
  schoolName: string;
}

export interface CredentialDescriptor {
  type: "public-key";
  id: string;
}

export interface RegistrationOptionsView {
  challenge: string;
  rpId: string;
  rpName: string;
  userId: string;
  userName: string;
  userDisplayName: string;
  algorithms: number[];
  excludeCredentials: CredentialDescriptor[];
  timeoutMillis: number;
}

export interface AuthenticationOptionsView {
  challenge: string;
  rpId: string;
  timeoutMillis: number;
}

export interface GateCodeView {
  stationId: string;
  stationName: string;
  schoolName: string;
  branchName: string;
  code: string;
  expiresInSeconds: number;
}

export interface ClockResultView {
  staffName: string;
  direction: "IN" | "OUT";
  occurredAt: string;
  localTime: string;
  timezone: string;
  late: boolean;
  duplicate: boolean;
}

export function publicEnrollmentInfo(token: string): Promise<EnrollmentInfoView> {
  return apiFetch(`${PUBLIC}/enrollment/${encodeURIComponent(token)}`, { authenticated: false });
}

export function publicRegistrationOptions(token: string): Promise<RegistrationOptionsView> {
  return apiFetch(`${PUBLIC}/enrollment/${encodeURIComponent(token)}/options`, {
    method: "POST",
    authenticated: false,
  });
}

export function publicCompleteEnrollment(
  token: string,
  request: { challenge: string; credential: unknown; label?: string },
): Promise<void> {
  return apiFetch(`${PUBLIC}/enrollment/${encodeURIComponent(token)}/complete`, {
    method: "POST",
    authenticated: false,
    body: JSON.stringify(request),
  });
}

export function publicGateCode(stationToken: string): Promise<GateCodeView> {
  return apiFetch(`${PUBLIC}/gate/code`, {
    authenticated: false,
    headers: { "X-Station-Token": stationToken },
  });
}

export function publicClockOptions(stationId: string, code: string): Promise<AuthenticationOptionsView> {
  return apiFetch(`${PUBLIC}/clock/options`, {
    method: "POST",
    authenticated: false,
    body: JSON.stringify({ stationId, code }),
  });
}

export function publicClockIn(
  stationId: string,
  challenge: string,
  credential: unknown,
): Promise<ClockResultView> {
  return apiFetch(`${PUBLIC}/clock`, {
    method: "POST",
    authenticated: false,
    body: JSON.stringify({ stationId, challenge, credential }),
  });
}
