import { useState } from "react";
import type { LevelTemplateAssignmentView } from "@/api/reportSettings";
import { Badge } from "@/components/ui/Badge";
import { Select } from "@/components/ui/Select";
import { Spinner } from "@/components/ui/Spinner";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/Table";

interface LevelTemplateTableProps {
  levels: LevelTemplateAssignmentView[];
  onAssign: (levelId: string, templateId: string) => Promise<void>;
  editable: boolean;
}

/**
 * One row per active level: its assessment mode, which template it
 * currently resolves to (or "Using the default template" when the school
 * hasn't picked one explicitly - see CLAUDE.md's template-resolution order),
 * and a picker over that mode's PUBLISHED templates. Selecting a template
 * applies immediately, the same single-action-per-control convention
 * publish/retire buttons elsewhere in the app use, rather than a form with
 * its own Save button.
 */
export function LevelTemplateTable({ levels, onAssign, editable }: LevelTemplateTableProps) {
  const [savingLevelId, setSavingLevelId] = useState<string | null>(null);

  async function handleChange(levelId: string, templateId: string) {
    if (!templateId) return;
    setSavingLevelId(levelId);
    try {
      await onAssign(levelId, templateId);
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
                <div className="flex items-center gap-2">
                  <Select
                    value={level.assignedTemplateId ?? ""}
                    onChange={(event) => handleChange(level.levelId, event.target.value)}
                    disabled={savingLevelId === level.levelId}
                  >
                    <option value="" disabled>
                      {level.assignedTemplateId ? level.assignedTemplateName : "Using the default template"}
                    </option>
                    {level.availableTemplates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name}
                      </option>
                    ))}
                  </Select>
                  {savingLevelId === level.levelId && <Spinner />}
                </div>
              ) : (
                <span>{level.assignedTemplateName ?? "Using the default template"}</span>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
