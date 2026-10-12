import { Plus, X } from "lucide-react";
import { RichTextField } from "@/components/richText/RichTextField";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Select } from "@/components/ui/Select";
import { describeLabel } from "../shared/labels";
import { blankCategorizeGroup, blankCategorizeItem } from "./defaults";
import {
  MAX_CATEGORIZE_GROUPS,
  MAX_CATEGORIZE_ITEMS,
  MIN_CATEGORIZE_GROUPS,
  type CategorizeConfig,
  type CategorizeItem,
} from "./types";

interface CategorizeAuthorProps {
  value: CategorizeConfig;
  onChange(config: CategorizeConfig): void;
  disabled: boolean;
  idPrefix: string;
}

/**
 * Authors a categorize question: the groups, then each item with the group it belongs in. Students
 * see both lists shuffled.
 */
export function CategorizeAuthor({ value, onChange, disabled }: CategorizeAuthorProps) {
  const { groups, items } = value;

  function updateItem(index: number, patch: Partial<CategorizeItem>) {
    onChange({ ...value, items: items.map((item, i) => (i === index ? { ...item, ...patch } : item)) });
  }

  function removeGroup(index: number) {
    const removed = groups[index].id;
    onChange({
      ...value,
      groups: groups.filter((_, i) => i !== index),
      items: items.map((item) => (item.groupId === removed ? { ...item, groupId: null } : item)),
    });
  }

  return (
    <div className="space-y-4">
      <FormField label="Groups">
        <ul className="space-y-2">
          {groups.map((group, index) => (
            <li key={group.id} className="flex items-start gap-2">
              <span className="mt-2 w-6 shrink-0 text-sm font-semibold text-slate-500">{letter(index)}</span>
              <div className="flex-1">
                <RichTextField
                  value={group.html}
                  onChange={(html) =>
                    onChange({ ...value, groups: groups.map((g, i) => (i === index ? { ...g, html } : g)) })
                  }
                  singleLine
                  allowImages
                  disabled={disabled}
                  ariaLabel={`Group ${letter(index)}`}
                />
              </div>
              {!disabled && groups.length > MIN_CATEGORIZE_GROUPS && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={`Remove group ${letter(index)}`}
                  onClick={() => removeGroup(index)}
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </Button>
              )}
            </li>
          ))}
        </ul>
        {!disabled && groups.length < MAX_CATEGORIZE_GROUPS && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="mt-2"
            onClick={() => onChange({ ...value, groups: [...groups, blankCategorizeGroup()] })}
          >
            <Plus className="h-4 w-4" aria-hidden="true" /> Add a group
          </Button>
        )}
      </FormField>

      <FormField label="Items, each with the group it belongs in">
        <ul className="space-y-2">
          {items.map((item, index) => (
            <li key={item.id} className="grid items-start gap-2 sm:grid-cols-[1fr_12rem_auto]">
              <RichTextField
                value={item.html}
                onChange={(html) => updateItem(index, { html })}
                singleLine
                allowImages
                disabled={disabled}
                ariaLabel={`Item ${index + 1}`}
              />
              <Select
                value={item.groupId ?? ""}
                onChange={(event) => updateItem(index, { groupId: event.target.value || null })}
                disabled={disabled}
                aria-label={`Item ${index + 1} belongs in`}
              >
                <option value="">Belongs in...</option>
                {groups.map((group, groupIndex) => (
                  <option key={group.id} value={group.id}>
                    {letter(groupIndex)}. {describeLabel(group.html, "(image)")}
                  </option>
                ))}
              </Select>
              {!disabled && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={`Remove item ${index + 1}`}
                  onClick={() => onChange({ ...value, items: items.filter((_, i) => i !== index) })}
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </Button>
              )}
            </li>
          ))}
        </ul>
        {!disabled && items.length < MAX_CATEGORIZE_ITEMS && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="mt-2"
            onClick={() => onChange({ ...value, items: [...items, blankCategorizeItem()] })}
          >
            <Plus className="h-4 w-4" aria-hidden="true" /> Add an item
          </Button>
        )}
      </FormField>
    </div>
  );
}

function letter(index: number): string {
  return String.fromCharCode(65 + index);
}
