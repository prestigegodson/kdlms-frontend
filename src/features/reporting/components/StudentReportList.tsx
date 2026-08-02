import { Download, Eye } from "lucide-react";
import { useState } from "react";
import { ApiError } from "@/api/client";
import { downloadStudentReportPdf } from "@/api/reports";
import { Alert } from "@/components/ui/Alert";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/Table";
import { downloadBlob } from "@/utils/download";

export interface ReportStudentRow {
  studentId: string;
  studentName: string;
  admissionNumber: string;
}

interface StudentReportListProps {
  students: ReportStudentRow[];
  termId: string;
  onPreview: (studentId: string) => void;
}

/** The class roster for the selected class/term - preview or download each student's report individually. */
export function StudentReportList({ students, termId, onPreview }: StudentReportListProps) {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleDownload(student: ReportStudentRow) {
    setDownloadingId(student.studentId);
    setError(null);
    try {
      const blob = await downloadStudentReportPdf(student.studentId, termId);
      downloadBlob(blob, `${student.admissionNumber || student.studentName}-result.pdf`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to download the report");
    } finally {
      setDownloadingId(null);
    }
  }

  return (
    <div className="space-y-2">
      {error && <Alert variant="error">{error}</Alert>}
      <Table>
        <TableHead>
          <TableRow>
            <TableHeaderCell>Student</TableHeaderCell>
            <TableHeaderCell>Actions</TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {students.map((student) => (
            <TableRow key={student.studentId}>
              <TableCell label="Student" className="font-medium text-slate-900">
                {student.studentName}
                <span className="block text-xs font-normal text-slate-500">{student.admissionNumber}</span>
              </TableCell>
              <TableCell label="Actions">
                <div className="flex justify-end gap-3 sm:justify-start">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-brand-500 hover:text-brand-600"
                    onClick={() => onPreview(student.studentId)}
                  >
                    <Eye className="h-4 w-4" aria-hidden="true" /> Preview
                  </button>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-700 disabled:opacity-50"
                    disabled={downloadingId === student.studentId}
                    onClick={() => handleDownload(student)}
                  >
                    <Download className="h-4 w-4" aria-hidden="true" />
                    {downloadingId === student.studentId ? "Downloading…" : "Download PDF"}
                  </button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
