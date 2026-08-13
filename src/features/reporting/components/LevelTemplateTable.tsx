import { useState } from "react";
import type { LevelTemplateAssignmentView } from "@/api/reportSettings";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Spinner } from "@/components/ui/Spinner";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/Table";

interface LevelTemplateTableProps {
  levels: LevelTemplateAssignmentView[];
  onAssign: (levelId: string, templateId: string) => Promise<void>;
  onClear: (levelId: string) => Promise<void>;
  onPreview: (level: LevelTemplateAssignmentView) => void;
  editable: boolean;
}

/**
 * One row per active level: its assessment mode, which template it
 * currently resolves to (or "Platform default" when the school hasn't
 * picked one explicitly - see CLAUDE.md's template-resolution order), and a
 * picker over that mode's PUBLISHED templates this school may use - shared
 * ones plus any made specifically for this school (marked "made for your
 * school") - plus whichever template is currently assigned (even if since
 * retired, so the select's value always has a matching option). Selecting a
 * template applies immediately, the same single-action-per-control
 * convention publish/retire buttons elsewhere in the app use, rather than a
 * form with its own Save button.
 */
export function LevelTemplateTable({ levels, onAssign, onClear, onPreview, editable }: LevelTemplateTableProps) {
  const [savingLevelId, setSavingLevelId] = useState<string | null>(null);

  async function handleChange(levelId: string, templateId: string) {
    setSavingLevelId(levelId);
    try {
      if (templateId) {
        await onAssign(levelId, templateId);
      } else {
        await onClear(levelId);
      }
    } finally {
      setSavingLevelId(null);
    }
  }

  return (
    <Table>
      <TableHead>
        <TableRow>
          <TableHeaderCell>Level</TableHeaderCell>
          <TableHeaderCell>Mode</TableHeaderCell>
          <TableHeaderCell>Template</TableHeaderCell>
          <TableHeaderCell>Preview</TableHeaderCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {levels.map((level) => (
          <TableRow key={level.levelId}>
            <TableCell label="Level" className="font-medium text-slate-900">
              {level.levelName}
            </TableCell>
            <TableCell label="Mode">
              <Badge variant="neutral">{level.assessmentMode === "NUMERIC" ? "Numeric" : "Qualitative"}</Badge>
            </TableCell>
            <TableCell label="Template">
              {editable ? (
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Select
                      value={level.assignedTemplateId ?? ""}
                      onChange={(event) => handleChange(level.levelId, event.target.value)}
                      disabled={savingLevelId === level.levelId}
                    >
                      <option value="">
                        Platform default{level.resolvedTemplateName ? ` (${level.resolvedTemplateName})` : ""}
                      </option>
                      {level.availableTemplates.map((template) => (
                        <option key={template.id} value={template.id}>
                          {template.name}
                          {template.baseLevel ? ` — ${template.baseLevel}` : ""}
                          {template.schoolId ? " (made for your school)" : ""}
                          {template.status !== "PUBLISHED" ? " (retired)" : ""}
                        </option>
                      ))}
                    </Select>
                    {savingLevelId === level.levelId && <Spinner />}
                  </div>
                  {level.availableTemplates.length === 0 && (
                    <p className="text-xs text-amber-800">
                      No published {level.assessmentMode === "NUMERIC" ? "Numeric" : "Qualitative"} template yet — a
                      system admin must publish one under Result Templates.
                    </p>
                  )}
                </div>
              ) : (
                <span>{level.assignedTemplateName ?? level.resolvedTemplateName ?? "Using the default template"}</span>
              )}
            </TableCell>
            <TableCell label="Preview">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onPreview(level)}
                disabled={!level.resolvedTemplateId}
              >
                Preview sample
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
