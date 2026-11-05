import { apiFetch } from "@/api/client";
import type {
  AnswerCommand,
  AttemptClockView,
  AttemptState,
  QuizAttemptView,
  QuizAvailability,
  QuizReviewView,
  SubmitConfirmationView,
} from "@/api/publicTakeHomeQuiz";
import type { QuizThemeStyle } from "@/api/quizThemes";

/** Mirrors backend `TakeGuestQuizUseCase.GuestQuizLandingView` - shown before a guest starts. */
export interface GuestQuizLandingView {
  tutorName: string;
  tutorLogoDataUri?: string | null;
  quizTitle: string;
  className: string;
  questionCount: number;
  totalPoints: number;
  timed: boolean;
  durationMinutes?: number | null;
  closesAt: string;
  /** Absent once results are published ahead of the closing time. */
  availability?: QuizAvailability | null;
  revealOnSubmit: boolean;
  serverTime: string;
  theme?: QuizThemeStyle | null;
}

/** Mirrors backend `TakeGuestQuizUseCase.GuestQuizStartView`. The session token is only ever returned here. */
export interface GuestQuizStartView {
  sessionToken: string;
  attempt: QuizAttemptView;
}

/** Mirrors backend `TakeGuestQuizUseCase.GuestQuizSessionView` - where a returning browser's guest stands. */
export interface GuestQuizSessionView {
  guestName: string;
  hasEmail: boolean;
  attemptState: AttemptState;
  revealResults: boolean;
  quizTitle: string;
  theme?: QuizThemeStyle | null;
}

export interface StartGuestQuizRequest {
  fullName: string;
  email: string | null;
  captchaToken: string | null;
  /** The honeypot: a field people never see, so it stays empty unless a bot fills it in. */
  website: string;
}

function linkBase(linkToken: string): string {
  return `/api/v1/public/guest-quiz-links/${encodeURIComponent(linkToken)}`;
}

function attemptBase(sessionToken: string): string {
  return `/api/v1/public/guest-quiz-attempts/${encodeURIComponent(sessionToken)}`;
}

export function getGuestQuizLanding(linkToken: string): Promise<GuestQuizLandingView> {
  return apiFetch<GuestQuizLandingView>(linkBase(linkToken), { authenticated: false });
}

export function startGuestQuiz(linkToken: string, request: StartGuestQuizRequest): Promise<GuestQuizStartView> {
  return apiFetch<GuestQuizStartView>(`${linkBase(linkToken)}/start`, {
    method: "POST",
    authenticated: false,
    body: JSON.stringify(request),
  });
}

export function guestQuizLinkImageUrl(linkToken: string, fileId: string): string {
  return `${linkBase(linkToken)}/images/${encodeURIComponent(fileId)}`;
}

export function getGuestQuizSession(sessionToken: string): Promise<GuestQuizSessionView> {
  return apiFetch<GuestQuizSessionView>(attemptBase(sessionToken), { authenticated: false });
}

export function resumeGuestQuiz(sessionToken: string): Promise<QuizAttemptView> {
  return apiFetch<QuizAttemptView>(`${attemptBase(sessionToken)}/attempt`, { authenticated: false });
}

export function saveGuestQuizAnswers(sessionToken: string, answers: AnswerCommand[]): Promise<QuizAttemptView> {
  return apiFetch<QuizAttemptView>(`${attemptBase(sessionToken)}/answers`, {
    method: "PUT",
    authenticated: false,
    body: JSON.stringify({ answers }),
  });
}

export function heartbeatGuestQuiz(sessionToken: string): Promise<AttemptClockView> {
  return apiFetch<AttemptClockView>(`${attemptBase(sessionToken)}/heartbeat`, { method: "POST", authenticated: false });
}

export function pauseGuestQuiz(sessionToken: string): Promise<AttemptClockView> {
  return apiFetch<AttemptClockView>(`${attemptBase(sessionToken)}/pause`, {
    method: "POST",
    authenticated: false,
    keepalive: true,
  });
}

export function submitGuestQuiz(sessionToken: string, answers: AnswerCommand[]): Promise<SubmitConfirmationView> {
  return apiFetch<SubmitConfirmationView>(`${attemptBase(sessionToken)}/submit`, {
    method: "POST",
    authenticated: false,
    body: JSON.stringify({ answers }),
  });
}

export function getGuestQuizReview(sessionToken: string): Promise<QuizReviewView> {
  return apiFetch<QuizReviewView>(`${attemptBase(sessionToken)}/review`, { authenticated: false });
}

export function guestQuizImageUrl(sessionToken: string, fileId: string): string {
  return `${attemptBase(sessionToken)}/images/${encodeURIComponent(fileId)}`;
}
