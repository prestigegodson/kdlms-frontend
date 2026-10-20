import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { getErrorMessage } from "@/api/client";
import {
  type AudiencePreview,
  cancelNewsletter,
  createNewsletter,
  deleteNewsletter,
  duplicateNewsletter,
  getNewsletter,
  type NewsletterAudience,
  type NewsletterView,
  type SaveNewsletterRequest,
  scheduleNewsletter,
  sendNewsletterNow,
  sendTestNewsletter,
  unscheduleNewsletter,
  updateNewsletter,
} from "@/api/newsletters";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { Spinner } from "@/components/ui/Spinner";
import { Tabs } from "@/components/ui/Tabs";
import { useAuthStore } from "@/stores/authStore";
import { formatInstant } from "@/utils/date";
import { AudiencePicker } from "./components/AudiencePicker";
import { EmailPreviewFrame } from "./components/EmailPreviewFrame";
import { HtmlSourcePane } from "./components/HtmlSourcePane";
import { ScheduleModal } from "./components/ScheduleModal";
import { TestSendModal } from "./components/TestSendModal";
import {
  DEFAULT_AUDIENCE,
  NEWSLETTER_STATUS_LABEL,
  NEWSLETTER_STATUS_VARIANT,
} from "./newsletterContent";

const BACK_TO = "/admin/newsletters";
const SUBJECT_MAX = 200;
const PREHEADER_MAX = 250;
/** How often an in-flight send's progress is refreshed. */
const SENDING_POLL_MS = 5000;

type LoadState = { kind: "loading" } | { kind: "ready" } | { kind: "error"; message: string };
type Dialog = "test" | "schedule" | "send" | "cancel" | "delete" | null;
type MobilePane = "compose" | "preview";

/**
 * Writes, previews and sends one newsletter - `/admin/newsletters/new` for a fresh draft,
 * `/admin/newsletters/:newsletterId` afterwards. Only a draft is editable; a scheduled one can be
 * unscheduled back to a draft, and a sending/sent/cancelled one shows its delivery numbers. Every
 * send/schedule/test action saves the form first, so what goes out is always what's on screen.
 */
export function NewsletterEditorPage() {
  const { newsletterId } = useParams<{ newsletterId: string }>();
  const navigate = useNavigate();
  const userEmail = useAuthStore((state) => state.user?.email ?? "");

  const [loadState, setLoadState] = useState<LoadState>(
    newsletterId ? { kind: "loading" } : { kind: "ready" },
  );
  const [newsletter, setNewsletter] = useState<NewsletterView | null>(null);
  const [subject, setSubject] = useState("");
  const [preheader, setPreheader] = useState("");
  const [htmlBody, setHtmlBody] = useState("");
  const [audience, setAudience] = useState<NewsletterAudience>(DEFAULT_AUDIENCE);
  const [audiencePreview, setAudiencePreview] = useState<AudiencePreview | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [mobilePane, setMobilePane] = useState<MobilePane>("compose");
  const [dialog, setDialog] = useState<Dialog>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  function adopt(view: NewsletterView) {
    setNewsletter(view);
    setSubject(view.subject);
    setPreheader(view.preheader ?? "");
    setHtmlBody(view.htmlBody);
    setAudience(view.audience);
    setDirty(false);
  }

  useEffect(() => {
    // After the first save of a new draft the URL gains its id - the page already holds it.
    if (!newsletterId || newsletter?.id === newsletterId) return;
    let cancelled = false;
    getNewsletter(newsletterId)
      .then((view) => {
        if (cancelled) return;
        adopt(view);
        setLoadState({ kind: "ready" });
      })
      .catch((caught: unknown) => {
        if (!cancelled)
          setLoadState({
            kind: "error",
            message: getErrorMessage(caught, "Failed to load the newsletter"),
          });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refetch only when the route's id changes
  }, [newsletterId]);

  const sendingId = newsletter?.status === "SENDING" ? newsletter.id : null;
  useEffect(() => {
    if (!sendingId) return;
    const interval = setInterval(() => {
      getNewsletter(sendingId)
        .then((view) => setNewsletter(view))
        .catch(() => undefined);
    }, SENDING_POLL_MS);
    return () => clearInterval(interval);
  }, [sendingId]);

  const editable = newsletter === null || newsletter.status === "DRAFT";

  function edit<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      setDirty(true);
      setNotice(null);
    };
  }

  /** Creates or updates the draft from the form; returns the saved newsletter. */
  async function persist(): Promise<NewsletterView> {
    if (!subject.trim()) {
      throw new Error("Give the newsletter a subject first.");
    }
    if (newsletter && !dirty) return newsletter;
    const request: SaveNewsletterRequest = { subject, preheader, htmlBody, audience };
    const saved = newsletter
      ? await updateNewsletter(newsletter.id, request)
      : await createNewsletter(request);
    adopt(saved);
    if (!newsletter) navigate(`/admin/newsletters/${saved.id}`, { replace: true });
    return saved;
  }

  async function saveDraft() {
    setActionError(null);
    if (!subject.trim()) {
      setActionError("Give the newsletter a subject first.");
      return;
    }
    setSaving(true);
    try {
      await persist();
      setNotice("Draft saved.");
    } catch (caught) {
      setActionError(getErrorMessage(caught, "Couldn't save the draft."));
    } finally {
      setSaving(false);
    }
  }

  async function run(action: () => Promise<NewsletterView>, message: string) {
    setActionError(null);
    try {
      adopt(await action());
      setNotice(message);
    } catch (caught) {
      setActionError(getErrorMessage(caught, "That action failed."));
    }
  }

  function openDialog(next: Dialog) {
    setActionError(null);
    setNotice(null);
    if ((next === "test" || next === "schedule" || next === "send") && !subject.trim()) {
      setActionError("Give the newsletter a subject first.");
      return;
    }
    setDialog(next);
  }

  if (loadState.kind !== "ready") {
    return (
      <div className="space-y-6">
        <PageHeader title="Newsletter" backTo={BACK_TO} />
        {loadState.kind === "loading" ? (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Spinner /> Loading…
          </div>
        ) : (
          <Alert variant="error">{loadState.message}</Alert>
        )}
      </div>
    );
  }

  const recipientCount = audiencePreview?.total ?? null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={newsletter ? newsletter.subject : "New newsletter"}
        description={
          editable
            ? "Paste your email's HTML, check the preview, choose who gets it, then send or schedule it."
            : undefined
        }
        backTo={BACK_TO}
        actions={
          newsletter && (
            <Badge variant={NEWSLETTER_STATUS_VARIANT[newsletter.status]}>
              {NEWSLETTER_STATUS_LABEL[newsletter.status]}
            </Badge>
          )
        }
      />

      {notice && <Alert variant="success">{notice}</Alert>}
      {actionError && <Alert variant="error">{actionError}</Alert>}

      {newsletter && !editable && (
        <DeliveryCard
          newsletter={newsletter}
          onUnschedule={() =>
            void run(
              () => unscheduleNewsletter(newsletter.id),
              "Unscheduled - it's a draft again, so you can edit it.",
            )
          }
          onCancel={() => openDialog("cancel")}
          onDuplicate={() =>
            void duplicateNewsletter(newsletter.id)
              .then((copy) => {
                navigate(`/admin/newsletters/${copy.id}`);
              })
              .catch((caught: unknown) =>
                setActionError(getErrorMessage(caught, "Couldn't duplicate it.")),
              )
          }
          onDelete={() => openDialog("delete")}
        />
      )}

      <Card className="space-y-4">
        <FormField label="Subject" htmlFor="newsletter-subject">
          <Input
            id="newsletter-subject"
            value={subject}
            maxLength={SUBJECT_MAX}
            disabled={!editable}
            onChange={(event) => edit(setSubject)(event.target.value)}
            placeholder="What's new on KDLMS this month"
          />
        </FormField>
        <FormField
          label="Preview text"
          htmlFor="newsletter-preheader"
          description="Shown after the subject in most inboxes. Optional."
        >
          <Input
            id="newsletter-preheader"
            value={preheader}
            maxLength={PREHEADER_MAX}
            disabled={!editable}
            onChange={(event) => edit(setPreheader)(event.target.value)}
          />
        </FormField>
      </Card>

      <div className="lg:hidden">
        <Tabs<MobilePane>
          ariaLabel="Editor view"
          value={mobilePane}
          onChange={setMobilePane}
          items={[
            { value: "compose", label: "HTML" },
            { value: "preview", label: "Preview" },
          ]}
        />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <section
          className={mobilePane === "compose" ? "" : "hidden lg:block"}
          aria-label="HTML source"
        >
          <Card>
            <h2 className="mb-3 text-sm font-semibold text-slate-900">HTML</h2>
            <HtmlSourcePane value={htmlBody} onChange={edit(setHtmlBody)} disabled={!editable} />
          </Card>
        </section>
        <section className={mobilePane === "preview" ? "" : "hidden lg:block"} aria-label="Preview">
          <div className="h-[640px] lg:sticky lg:top-4">
            <EmailPreviewFrame html={htmlBody} subject={subject} preheader={preheader} />
          </div>
        </section>
      </div>

      <Card>
        <h2 className="mb-4 text-sm font-semibold text-slate-900">Audience</h2>
        <AudiencePicker
          value={audience}
          onChange={edit(setAudience)}
          onPreview={setAudiencePreview}
          disabled={!editable}
        />
      </Card>

      {editable && (
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          {newsletter && (
            <Button variant="ghost" onClick={() => openDialog("delete")} className="sm:mr-auto">
              Delete draft
            </Button>
          )}
          <Button
            variant="secondary"
            onClick={() => void saveDraft()}
            loading={saving}
            className={newsletter ? "" : "sm:ml-auto"}
          >
            Save draft
          </Button>
          <Button variant="secondary" onClick={() => openDialog("test")}>
            Send test
          </Button>
          <Button onClick={() => openDialog("schedule")}>Schedule</Button>
          <Button variant="accent" onClick={() => openDialog("send")}>
            Send now
          </Button>
        </div>
      )}

      {dialog === "test" && (
        <TestSendModal
          defaultEmail={userEmail}
          onClose={() => setDialog(null)}
          onSend={async (emails) => {
            const saved = await persist();
            await sendTestNewsletter(saved.id, emails);
          }}
        />
      )}
      {dialog === "schedule" && (
        <ScheduleModal
          recipientCount={recipientCount}
          onClose={() => setDialog(null)}
          onSchedule={async (instant) => {
            const saved = await persist();
            adopt(await scheduleNewsletter(saved.id, instant));
            setDialog(null);
            setNotice(`Scheduled for ${formatInstant(instant)}.`);
          }}
        />
      )}
      {dialog === "send" && (
        <ConfirmDialog
          title="Send this newsletter now?"
          message={
            recipientCount === null
              ? "It will go to everyone in the audience you chose. This can't be undone."
              : `It will go to ${recipientCount.toLocaleString()} ${recipientCount === 1 ? "person" : "people"}. This can't be undone.`
          }
          confirmLabel="Send now"
          onConfirm={async () => {
            const saved = await persist();
            adopt(await sendNewsletterNow(saved.id));
            setDialog(null);
            setNotice("Sending has started.");
          }}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === "cancel" && newsletter && (
        <ConfirmDialog
          title={newsletter.status === "SENDING" ? "Stop sending?" : "Cancel this newsletter?"}
          message={
            newsletter.status === "SENDING"
              ? "Anyone who hasn't been sent it yet won't get it. Emails already sent can't be recalled."
              : "It won't be sent. You can duplicate it later to start again."
          }
          confirmLabel={newsletter.status === "SENDING" ? "Stop sending" : "Cancel newsletter"}
          variant="danger"
          onConfirm={async () => {
            adopt(await cancelNewsletter(newsletter.id));
            setDialog(null);
            setNotice("Newsletter cancelled.");
          }}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === "delete" && newsletter && (
        <ConfirmDialog
          title="Delete this newsletter?"
          message={
            <>
              <strong>{newsletter.subject}</strong> will be removed for good.
            </>
          }
          confirmLabel="Delete"
          variant="danger"
          onConfirm={async () => {
            await deleteNewsletter(newsletter.id);
            navigate(BACK_TO);
          }}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
}

interface DeliveryCardProps {
  newsletter: NewsletterView;
  onUnschedule: () => void;
  onCancel: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

/** Where a non-draft newsletter stands - when it goes out, or how its send went - and what can still be done. */
function DeliveryCard({
  newsletter,
  onUnschedule,
  onCancel,
  onDuplicate,
  onDelete,
}: DeliveryCardProps) {
  const done = newsletter.sentCount + newsletter.failedCount;
  const percent =
    newsletter.recipientCount > 0 ? Math.round((done / newsletter.recipientCount) * 100) : 100;

  return (
    <Card className="space-y-4">
      {newsletter.status === "SCHEDULED" && (
        <p className="text-sm text-slate-700">
          Goes out <strong>{formatInstant(newsletter.scheduledAt)}</strong>. Unschedule it to make
          changes.
        </p>
      )}
      {newsletter.status === "SENDING" && (
        <div className="space-y-2">
          <p className="flex items-center gap-2 text-sm text-slate-700">
            <Spinner /> Sending - {done.toLocaleString()} of{" "}
            {newsletter.recipientCount.toLocaleString()} done
          </p>
          <div
            className="h-2 overflow-hidden rounded-full bg-slate-100"
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Sending progress"
          >
            <div className="h-full bg-brand-500 transition-all" style={{ width: `${percent}%` }} />
          </div>
        </div>
      )}
      {(newsletter.status === "SENT" ||
        newsletter.status === "CANCELLED" ||
        newsletter.status === "SENDING") && (
        <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <Stat label="Recipients" value={newsletter.recipientCount} />
          <Stat label="Sent" value={newsletter.sentCount} />
          <Stat
            label="Failed"
            value={newsletter.failedCount}
            tone={newsletter.failedCount > 0 ? "danger" : undefined}
          />
          <Stat label="Unsubscribed, left out" value={newsletter.suppressedCount} />
        </dl>
      )}
      {newsletter.status === "SENT" && (
        <p className="text-xs text-slate-500">Finished {formatInstant(newsletter.completedAt)}.</p>
      )}
      {newsletter.status === "CANCELLED" && (
        <p className="text-xs text-slate-500">Cancelled {formatInstant(newsletter.completedAt)}.</p>
      )}
      <div className="flex flex-wrap gap-2">
        {newsletter.status === "SCHEDULED" && (
          <Button variant="secondary" onClick={onUnschedule}>
            Unschedule
          </Button>
        )}
        {(newsletter.status === "SCHEDULED" || newsletter.status === "SENDING") && (
          <Button variant="danger" onClick={onCancel}>
            {newsletter.status === "SENDING" ? "Stop sending" : "Cancel"}
          </Button>
        )}
        <Button variant="secondary" onClick={onDuplicate}>
          Duplicate
        </Button>
        {newsletter.status === "CANCELLED" && (
          <Button variant="ghost" onClick={onDelete}>
            Delete
          </Button>
        )}
      </div>
    </Card>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "danger" }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd
        className={`text-lg font-semibold ${tone === "danger" ? "text-red-700" : "text-slate-900"}`}
      >
        {value.toLocaleString()}
      </dd>
    </div>
  );
}
