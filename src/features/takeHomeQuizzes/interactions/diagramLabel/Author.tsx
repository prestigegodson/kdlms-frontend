import { Plus, X } from "lucide-react";
import { RichTextField } from "@/components/richText/RichTextField";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { FormField } from "@/components/ui/FormField";
import { describeLabel } from "../shared/labels";
import { RegionEditor } from "../shared/RegionEditor";
import { blankDiagramLabel, diagramZoneFor } from "./defaults";
import { MAX_DIAGRAM_LABELS, MAX_DIAGRAM_ZONES, type DiagramLabelConfig, type DiagramZone } from "./types";

interface DiagramLabelAuthorProps {
  value: DiagramLabelConfig;
  onChange(config: DiagramLabelConfig): void;
  disabled: boolean;
  answerOnly?: boolean;
  idPrefix: string;
}

/**
 * Authors a diagram-labelling question: the label bank (a label no zone accepts is a distractor),
 * then the image with a zone drawn for each place a label goes, each ticking the labels that are
 * right for it. Students see the labels shuffled and never which zone takes which. `answerOnly`
 * leaves only which labels each zone accepts - students see the zones, so they stay put.
 */
export function DiagramLabelAuthor({
  value,
  onChange,
  disabled,
  answerOnly = false,
  idPrefix,
}: DiagramLabelAuthorProps) {
  const { labels, zones } = value;
  const layoutDisabled = disabled || answerOnly;

  function removeLabel(index: number) {
    const removed = labels[index].id;
    onChange({
      ...value,
      labels: labels.filter((_, i) => i !== index),
      zones: zones.map((zone) => ({
        ...zone,
        acceptedLabelIds: zone.acceptedLabelIds.filter((id) => id !== removed),
      })),
    });
  }

  function toggleAccepted(zone: DiagramZone, labelId: string, accepted: boolean) {
    const acceptedLabelIds = accepted
      ? [...zone.acceptedLabelIds, labelId]
      : zone.acceptedLabelIds.filter((id) => id !== labelId);
    onChange({ ...value, zones: zones.map((z) => (z.id === zone.id ? { ...z, acceptedLabelIds } : z)) });
  }

  return (
    <div className="space-y-4">
      <FormField label="Labels">
        <ul className="space-y-2">
          {labels.map((label, index) => (
            <li key={label.id} className="flex items-start gap-2">
              <span className="mt-2 w-6 shrink-0 text-sm font-semibold text-slate-500">{letter(index)}</span>
              <div className="flex-1">
                <RichTextField
                  value={label.html}
                  onChange={(html) =>
                    onChange({ ...value, labels: labels.map((l, i) => (i === index ? { ...l, html } : l)) })
                  }
                  singleLine
                  allowImages
                  disabled={layoutDisabled}
                  ariaLabel={`Label ${letter(index)}`}
                />
              </div>
              {!layoutDisabled && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={`Remove label ${letter(index)}`}
                  onClick={() => removeLabel(index)}
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </Button>
              )}
            </li>
          ))}
        </ul>
        {!layoutDisabled && labels.length < MAX_DIAGRAM_LABELS && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="mt-2"
            onClick={() => onChange({ ...value, labels: [...labels, blankDiagramLabel()] })}
          >
            <Plus className="h-4 w-4" aria-hidden="true" /> Add a label
          </Button>
        )}
      </FormField>

      <FormField label="Diagram and zones">
        <RegionEditor
          imageFileId={value.imageFileId}
          imageAspect={value.imageAspect}
          onImageChange={(imageFileId, imageAspect) => onChange({ ...value, imageFileId, imageAspect })}
          regions={zones}
          onRegionsChange={(next) => onChange({ ...value, zones: next })}
          createRegion={diagramZoneFor}
          allowedKinds={["RECT"]}
          maxRegions={MAX_DIAGRAM_ZONES}
          regionName={(index) => `Zone ${index + 1}`}
          disabled={layoutDisabled}
          renderRegionPanel={(zone, zoneIndex) => (
            <fieldset className="mt-1">
              <legend className="text-xs text-slate-500">Right label{labels.length === 1 ? "" : "s"} for zone {zoneIndex + 1}</legend>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                {labels.map((label, index) => {
                  const id = `${idPrefix}-zone-${zone.id}-${label.id}`;
                  return (
                    <label key={label.id} htmlFor={id} className="flex items-center gap-2 text-sm text-slate-700">
                      <Checkbox
                        id={id}
                        checked={zone.acceptedLabelIds.includes(label.id)}
                        onChange={(event) => toggleAccepted(zone, label.id, event.target.checked)}
                        disabled={disabled}
                      />
                      {letter(index)}. {describeLabel(label.html, "(image)")}
                    </label>
                  );
                })}
              </div>
            </fieldset>
          )}
        />
      </FormField>

      <label htmlFor={`${idPrefix}-reuse`} className="flex items-center gap-2 text-sm text-slate-700">
        <Checkbox
          id={`${idPrefix}-reuse`}
          checked={value.reuseLabels}
          onChange={(event) => onChange({ ...value, reuseLabels: event.target.checked })}
          disabled={layoutDisabled}
        />
        One label can go on more than one zone
      </label>
    </div>
  );
}

function letter(index: number): string {
  return String.fromCharCode(65 + index);
}
