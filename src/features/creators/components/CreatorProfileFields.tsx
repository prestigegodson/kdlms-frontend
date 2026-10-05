import { SUPPORTED_CURRENCIES, type CreatorProfileInput, type SupportedCurrency } from "@/api/creators";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";

/** Every IANA zone the runtime knows, with `current` kept in the list even if it isn't one of them. */
function timezoneOptions(current: string): string[] {
  const zones = supportedTimezones();
  return zones.includes(current) ? zones : [current, ...zones];
}

function supportedTimezones(): string[] {
  try {
    return (Intl as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf?.("timeZone") ?? [];
  } catch {
    return [];
  }
}

interface CreatorProfileFieldsProps {
  value: CreatorProfileInput;
  onChange: (value: CreatorProfileInput) => void;
  /** Prefixes each input id, so two forms on one page never collide. */
  idPrefix?: string;
}

/** The business-profile inputs shared by creator sign-up, the creator's Profile page, and admin onboarding. */
export function CreatorProfileFields({ value, onChange, idPrefix = "creator" }: CreatorProfileFieldsProps) {
  function set<K extends keyof CreatorProfileInput>(key: K, next: CreatorProfileInput[K]) {
    onChange({ ...value, [key]: next });
  }
  const id = (name: string) => `${idPrefix}-${name}`;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="First name" htmlFor={id("firstName")}>
          <Input
            id={id("firstName")}
            autoComplete="given-name"
            required
            maxLength={100}
            value={value.firstName}
            onChange={(event) => set("firstName", event.target.value)}
          />
        </FormField>
        <FormField label="Last name" htmlFor={id("lastName")}>
          <Input
            id={id("lastName")}
            autoComplete="family-name"
            required
            maxLength={100}
            value={value.lastName}
            onChange={(event) => set("lastName", event.target.value)}
          />
        </FormField>
      </div>
      <FormField label="Business name" htmlFor={id("businessName")}>
        <Input
          id={id("businessName")}
          autoComplete="organization"
          required
          maxLength={200}
          value={value.businessName}
          onChange={(event) => set("businessName", event.target.value)}
        />
      </FormField>
      <FormField label="Contact address" htmlFor={id("contactAddress")}>
        <Input
          id={id("contactAddress")}
          autoComplete="street-address"
          required
          maxLength={500}
          value={value.contactAddress}
          onChange={(event) => set("contactAddress", event.target.value)}
        />
      </FormField>
      <FormField label="Mobile number" htmlFor={id("mobile")}>
        <Input
          id={id("mobile")}
          type="tel"
          autoComplete="tel"
          required
          maxLength={30}
          value={value.mobile}
          onChange={(event) => set("mobile", event.target.value)}
        />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Timezone" htmlFor={id("timezone")}>
          <Select
            id={id("timezone")}
            required
            value={value.timezone}
            onChange={(event) => set("timezone", event.target.value)}
          >
            {timezoneOptions(value.timezone).map((zone) => (
              <option key={zone} value={zone}>
                {zone}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Preferred currency" htmlFor={id("currency")}>
          <Select
            id={id("currency")}
            required
            value={value.currency}
            onChange={(event) => set("currency", event.target.value as SupportedCurrency)}
          >
            {SUPPORTED_CURRENCIES.map((currency) => (
              <option key={currency} value={currency}>
                {currency}
              </option>
            ))}
          </Select>
        </FormField>
      </div>
    </div>
  );
}
