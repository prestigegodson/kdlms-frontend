import { Checkbox } from "@/components/ui/Checkbox";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { plainText } from "../shared/labels";
import { RegionEditor } from "../shared/RegionEditor";
import { hotspotRegionFor, pinRange } from "./defaults";
import { MAX_HOTSPOT_REGIONS, type HotspotConfig, type HotspotRegion } from "./types";

interface HotspotAuthorProps {
  value: HotspotConfig;
  onChange(config: HotspotConfig): void;
  disabled: boolean;
  idPrefix: string;
}

/**
 * Authors a hotspot question: the image, the target regions students should tap, any other named
 * regions review can point out ("you tapped the Atlantic"), and how many pins a student may drop.
 * Students see only the image.
 */
export function HotspotAuthor({ value, onChange, disabled, idPrefix }: HotspotAuthorProps) {
  const range = pinRange(value.regions);

  /** Regions changed - keep the pin allowance inside the range their targets allow. */
  function setRegions(regions: HotspotRegion[]) {
    const { min, max } = pinRange(regions);
    onChange({ ...value, regions, maxPins: Math.min(max, Math.max(min, value.maxPins)) });
  }

  function updateRegion(id: string, patch: Partial<HotspotRegion>) {
    setRegions(value.regions.map((region) => (region.id === id ? { ...region, ...patch } : region)));
  }

  return (
    <div className="space-y-4">
      <FormField label="Image and regions">
        <RegionEditor
          imageFileId={value.imageFileId}
          imageAspect={value.imageAspect}
          onImageChange={(imageFileId, imageAspect) => onChange({ ...value, imageFileId, imageAspect })}
          regions={value.regions}
          onRegionsChange={setRegions}
          createRegion={hotspotRegionFor}
          allowedKinds={["RECT", "CIRCLE", "POLYGON"]}
          maxRegions={MAX_HOTSPOT_REGIONS}
          regionName={(index) => `Region ${index + 1}`}
          disabled={disabled}
          renderRegionPanel={(region, index) => (
            <div className="mt-1 grid gap-2 sm:grid-cols-[auto_1fr] sm:items-center">
              <label htmlFor={`${idPrefix}-target-${region.id}`} className="flex items-center gap-2 text-sm text-slate-700">
                <Checkbox
                  id={`${idPrefix}-target-${region.id}`}
                  checked={region.target}
                  onChange={(event) => updateRegion(region.id, { target: event.target.checked })}
                  disabled={disabled}
                />
                Target
              </label>
              <Input
                value={region.label ? plainText(region.label) : ""}
                onChange={(event) => updateRegion(region.id, { label: toLabel(event.target.value) })}
                placeholder="Name, shown in review (optional)"
                aria-label={`Region ${index + 1} name`}
                maxLength={300}
                disabled={disabled}
              />
            </div>
          )}
        />
      </FormField>

      <FormField label="Pins a student may place" htmlFor={`${idPrefix}-max-pins`}>
        <Select
          id={`${idPrefix}-max-pins`}
          value={value.maxPins}
          onChange={(event) => onChange({ ...value, maxPins: Number(event.target.value) })}
          disabled={disabled}
        >
          {Array.from({ length: range.max - range.min + 1 }, (_, i) => range.min + i).map((count) => (
            <option key={count} value={count}>
              {count}
            </option>
          ))}
        </Select>
      </FormField>
      <p className="text-xs text-slate-500">
        Each target counts once. Every pin that misses all the targets cancels one found target, so scattering
        pins never pays.
      </p>
    </div>
  );
}

/** A plain name as a one-paragraph rich-text label, or `null` when blank. */
function toLabel(text: string): string | null {
  if (!text.trim()) {
    return null;
  }
  const escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<p>${escaped}</p>`;
}
