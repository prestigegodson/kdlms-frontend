import { FormField } from "@/components/ui/FormField";
import { ImageUploadField } from "@/components/ui/ImageUploadField";
import { Input } from "@/components/ui/Input";

export interface BrandingValues {
  logoFileId?: string;
  principalName: string;
  principalSignatureFileId?: string;
}

interface BrandingFieldsProps {
  values: BrandingValues;
  onChange: (values: BrandingValues) => void;
}

/**
 * A school's result-report personalization form - logo and principal
 * name/signature.
 */
export function BrandingFields({ values, onChange }: BrandingFieldsProps) {
  function set<K extends keyof BrandingValues>(key: K, value: BrandingValues[K]) {
    onChange({ ...values, [key]: value });
  }

  return (
    <div className="space-y-4">
      <ImageUploadField label="School logo" fileId={values.logoFileId} onChange={(id) => set("logoFileId", id)} />
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
