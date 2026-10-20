import { useEffect, useRef, useState } from "react";
import { getErrorMessage } from "@/api/client";
import {
  type AudiencePreview,
  MAX_CUSTOM_EMAILS,
  type NewsletterAudience,
  previewAudience,
  type SchoolStatusFilter,
} from "@/api/newsletters";
import { listPackages, type PackageView } from "@/api/packages";
import { listSchools, type SchoolView } from "@/api/schools";
import { Checkbox } from "@/components/ui/Checkbox";
import { FormField } from "@/components/ui/FormField";
import { SearchInput } from "@/components/ui/SearchInput";
import { Spinner } from "@/components/ui/Spinner";
import { Switch } from "@/components/ui/Switch";
import { Textarea } from "@/components/ui/Textarea";
import { extractEmails, parseEmailList } from "../newsletterContent";

const SCHOOL_STATUSES: Array<{ value: SchoolStatusFilter; label: string }> = [
  { value: "ACTIVE", label: "Active" },
  { value: "SUSPENDED", label: "Suspended" },
  { value: "ARCHIVED", label: "Archived" },
];

interface AudiencePickerProps {
  value: NewsletterAudience;
  onChange: (audience: NewsletterAudience) => void;
  /** Lets the editor show the count in its send confirmation. */
  onPreview?: (preview: AudiencePreview | null) => void;
  disabled?: boolean;
}

function toggle<T>(list: T[], item: T): T[] {
  return list.includes(item) ? list.filter((existing) => existing !== item) : [...list, item];
}

/**
 * Who a newsletter goes to: every school admin (optionally narrowed by school status, current
 * package, or a hand-picked set of schools), every education creator, and any pasted or uploaded
 * addresses. Shows a live recipient count from the server - resolved exactly as a real send
 * would be, so duplicates and unsubscribed addresses are already taken out.
 */
export function AudiencePicker({ value, onChange, onPreview, disabled }: AudiencePickerProps) {
  const [emailsText, setEmailsText] = useState(() => value.customEmails.join("\n"));
  const [invalidEmails, setInvalidEmails] = useState<string[]>([]);
  const [packages, setPackages] = useState<PackageView[]>([]);
  const [schools, setSchools] = useState<SchoolView[] | null>(null);
  const [schoolQuery, setSchoolQuery] = useState("");
  const [pickSchools, setPickSchools] = useState(value.schoolIds.length > 0);
  const [preview, setPreview] = useState<AudiencePreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [counting, setCounting] = useState(false);
  const [showSample, setShowSample] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    listPackages(0, 100, "SCHOOL")
      .then((page) => setPackages(page.content))
      .catch(() => setPackages([]));
  }, []);

  useEffect(() => {
    if (!pickSchools || schools !== null) return;
    listSchools(0, 1000)
      .then((page) => setSchools(page.content))
      .catch(() => setSchools([]));
  }, [pickSchools, schools]);

  const audienceKey = JSON.stringify(value);
  useEffect(() => {
    let cancelled = false;
    const timeout = setTimeout(() => {
      setCounting(true);
      previewAudience(JSON.parse(audienceKey) as NewsletterAudience)
        .then((result) => {
          if (cancelled) return;
          setPreview(result);
          setPreviewError(null);
          onPreview?.(result);
        })
        .catch((caught: unknown) => {
          if (cancelled) return;
          setPreview(null);
          setPreviewError(getErrorMessage(caught, "Couldn't count the recipients."));
          onPreview?.(null);
        })
        .finally(() => {
          if (!cancelled) setCounting(false);
        });
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-count only when the audience itself changes
  }, [audienceKey]);

  function update(patch: Partial<NewsletterAudience>) {
    onChange({ ...value, ...patch });
  }

  function commitEmails(text: string) {
    const { valid, invalid } = parseEmailList(text);
    setInvalidEmails(invalid);
    update({ customEmails: valid.slice(0, MAX_CUSTOM_EMAILS) });
  }

  async function importFile(file: File | undefined) {
    if (!file) return;
    const imported = extractEmails(await file.text());
    const merged = [...new Set([...value.customEmails, ...imported])];
    setEmailsText(merged.join("\n"));
    commitEmails(merged.join("\n"));
    if (fileRef.current) fileRef.current.value = "";
  }

  const visibleSchools = (schools ?? [])
    .filter((school) => school.name.toLowerCase().includes(schoolQuery.trim().toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <Switch
          checked={value.schoolAdmins}
          onChange={(checked) => update({ schoolAdmins: checked })}
          label="School admins"
          hint="Every active school admin account."
          disabled={disabled}
        />
        {value.schoolAdmins && (
          <div className="ml-1 space-y-4 border-l-2 border-slate-100 pl-4">
            <fieldset>
              <legend className="text-sm font-medium text-slate-700">School status</legend>
              <p className="text-xs text-slate-500">None ticked means every status.</p>
              <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
                {SCHOOL_STATUSES.map((status) => (
                  <label
                    key={status.value}
                    className="flex items-center gap-2 text-sm text-slate-700"
                  >
                    <Checkbox
                      checked={value.schoolStatuses.includes(status.value)}
                      onChange={() =>
                        update({ schoolStatuses: toggle(value.schoolStatuses, status.value) })
                      }
                      disabled={disabled}
                    />
                    {status.label}
                  </label>
                ))}
              </div>
            </fieldset>

            {packages.length > 0 && (
              <fieldset>
                <legend className="text-sm font-medium text-slate-700">Current package</legend>
                <p className="text-xs text-slate-500">None ticked means any package, or none.</p>
                <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
                  {packages.map((pkg) => (
                    <label key={pkg.id} className="flex items-center gap-2 text-sm text-slate-700">
                      <Checkbox
                        checked={value.packageIds.includes(pkg.id)}
                        onChange={() => update({ packageIds: toggle(value.packageIds, pkg.id) })}
                        disabled={disabled}
                      />
                      {pkg.name}
                      {pkg.status === "RETIRED" ? " (retired)" : ""}
                    </label>
                  ))}
                </div>
              </fieldset>
            )}

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <Checkbox
                  checked={pickSchools}
                  onChange={(event) => {
                    setPickSchools(event.target.checked);
                    if (!event.target.checked) update({ schoolIds: [] });
                  }}
                  disabled={disabled}
                />
                Only specific schools
                {value.schoolIds.length > 0 && (
                  <span className="text-xs text-slate-500">
                    ({value.schoolIds.length} selected)
                  </span>
                )}
              </label>
              {pickSchools && (
                <div className="space-y-2">
                  <SearchInput
                    value={schoolQuery}
                    onChange={setSchoolQuery}
                    placeholder="Search schools"
                    className="w-full sm:w-72"
                    disabled={disabled}
                  />
                  <div className="max-h-56 overflow-y-auto overscroll-contain rounded-control border border-slate-200 p-2">
                    {schools === null ? (
                      <div className="flex items-center gap-2 p-2 text-sm text-slate-500">
                        <Spinner /> Loading schools…
                      </div>
                    ) : visibleSchools.length === 0 ? (
                      <p className="p-2 text-sm text-slate-500">No schools match.</p>
                    ) : (
                      visibleSchools.map((school) => (
                        <label
                          key={school.id}
                          className="flex items-center gap-2 rounded px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                        >
                          <Checkbox
                            checked={value.schoolIds.includes(school.id)}
                            onChange={() =>
                              update({ schoolIds: toggle(value.schoolIds, school.id) })
                            }
                            disabled={disabled}
                          />
                          {school.name}
                        </label>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <Switch
        checked={value.creators}
        onChange={(checked) => update({ creators: checked })}
        label="Education creators"
        hint="Every active creator account."
        disabled={disabled}
      />

      <FormField
        label="Other email addresses"
        htmlFor="newsletter-custom-emails"
        description={`Separate with commas or new lines, or import a CSV. Up to ${MAX_CUSTOM_EMAILS.toLocaleString()}.`}
      >
        <Textarea
          id="newsletter-custom-emails"
          rows={4}
          value={emailsText}
          disabled={disabled}
          onChange={(event) => setEmailsText(event.target.value)}
          onBlur={(event) => commitEmails(event.target.value)}
          placeholder="partner@example.com, prospect@example.org"
          className="overscroll-contain"
        />
      </FormField>
      <div className="-mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="text-slate-500">
          {value.customEmails.length.toLocaleString()}{" "}
          {value.customEmails.length === 1 ? "address" : "addresses"}
        </span>
        <button
          type="button"
          disabled={disabled}
          onClick={() => fileRef.current?.click()}
          className="text-brand-600 hover:text-brand-700 disabled:opacity-50 mobile:min-h-11"
        >
          Import from CSV
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.txt,text/csv,text/plain"
          className="hidden"
          aria-label="Email list file"
          onChange={(event) => void importFile(event.target.files?.[0])}
        />
      </div>
      {invalidEmails.length > 0 && (
        <p className="text-xs text-red-600">
          Skipped {invalidEmails.length} invalid {invalidEmails.length === 1 ? "entry" : "entries"}:{" "}
          {invalidEmails.slice(0, 5).join(", ")}
          {invalidEmails.length > 5 ? "…" : ""}
        </p>
      )}

      <div className="rounded-panel bg-slate-50 px-4 py-3 text-sm" aria-live="polite">
        {previewError ? (
          <p className="text-red-700">{previewError}</p>
        ) : preview === null ? (
          <p className="flex items-center gap-2 text-slate-500">
            <Spinner /> Counting recipients…
          </p>
        ) : (
          <>
            <p className="flex items-center gap-2 font-medium text-slate-900">
              {preview.total.toLocaleString()} {preview.total === 1 ? "recipient" : "recipients"}
              {counting && <Spinner />}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              {[
                value.schoolAdmins && `${preview.schoolAdmins} school admins`,
                value.creators && `${preview.creators} creators`,
                preview.customEmails > 0 && `${preview.customEmails} other addresses`,
                preview.duplicates > 0 && `${preview.duplicates} duplicates removed`,
                preview.suppressed > 0 && `${preview.suppressed} unsubscribed, left out`,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
            {preview.sample.length > 0 && (
              <button
                type="button"
                onClick={() => setShowSample((open) => !open)}
                className="mt-1 text-xs text-brand-600 hover:text-brand-700 mobile:min-h-11"
              >
                {showSample ? "Hide sample" : "Show sample"}
              </button>
            )}
            {showSample && (
              <ul className="mt-2 space-y-1 text-xs text-slate-600">
                {preview.sample.map((recipient) => (
                  <li key={recipient.email} className="break-all">
                    {recipient.email}
                    {recipient.name ? ` - ${recipient.name}` : ""}
                    {recipient.schoolName ? ` (${recipient.schoolName})` : ""}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  );
}
