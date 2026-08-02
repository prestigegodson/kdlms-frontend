import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { ImageUploadField } from "@/features/reporting/components/ImageUploadField";

export interface BrandingValues {
  logoFileId?: string;
  primaryColor: string;
  secondaryColor: string;
  fontFamily: string;
  principalName: string;
  principalSignatureFileId?: string;
}

interface BrandingFieldsProps {
  values: BrandingValues;
  onChange: (values: BrandingValues) => void;
}

/**
 * A school's result-report personalization form - logo, colors, font, and
 * principal name/signature. `primaryColor`/`secondaryColor` reuse the same
 * `<Input type="color">` pattern `features/school/SchoolProfilePage.tsx`
 * already established for the school's own branding fields.
 */
export function BrandingFields({ values, onChange }: BrandingFieldsProps) {
  function set<K extends keyof BrandingValues>(key: K, value: BrandingValues[K]) {
    onChange({ ...values, [key]: value });
  }

  return (
    <div className="space-y-4">
      <ImageUploadField label="School logo" fileId={values.logoFileId} onChange={(id) => set("logoFileId", id)} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Primary color" htmlFor="report-settings-primary-color">
          <Input
            id="report-settings-primary-color"
            type="color"
            value={values.primaryColor || "#3B4FD9"}
            onChange={(event) => set("primaryColor", event.target.value)}
          />
        </FormField>
        <FormField label="Secondary color" htmlFor="report-settings-secondary-color">
          <Input
            id="report-settings-secondary-color"
            type="color"
            value={values.secondaryColor || "#182057"}
            onChange={(event) => set("secondaryColor", event.target.value)}
          />
        </FormField>
      </div>
      <FormField label="Font family" htmlFor="report-settings-font">
        <Input
          id="report-settings-font"
          placeholder="e.g. Arial, sans-serif"
          value={values.fontFamily}
          onChange={(event) => set("fontFamily", event.target.value)}
        />
      </FormField>
      <FormField label="Principal's name" htmlFor="report-settings-principal-name">
        <Input
          id="report-settings-principal-name"
          value={values.principalName}
          onChange={(event) => set("principalName", event.target.value)}
        />
      </FormField>
      <ImageUploadField
        label="Principal's signature"
        fileId={values.principalSignatureFileId}
        onChange={(id) => set("principalSignatureFileId", id)}
      />
    </div>
  );
}
