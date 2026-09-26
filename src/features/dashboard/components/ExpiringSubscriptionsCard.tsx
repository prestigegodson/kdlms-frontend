import { CalendarClock } from "lucide-react";
import type { AdminDashboardExpiringSchool } from "@/api/dashboard";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/Table";
import { formatLongDate } from "@/utils/date";

const DANGER_THRESHOLD_DAYS = 14;
const WARNING_THRESHOLD_DAYS = 30;

function daysRemainingVariant(daysRemaining: number): "danger" | "warning" | "neutral" {
  if (daysRemaining <= DANGER_THRESHOLD_DAYS) {
    return "danger";
  }
  if (daysRemaining <= WARNING_THRESHOLD_DAYS) {
    return "warning";
  }
  return "neutral";
}

interface ExpiringSubscriptionsCardProps {
  schools: AdminDashboardExpiringSchool[];
}

/**
 * SYSTEM_ADMIN's renewal worklist - every school whose subscription is still
 * active but ends within the next 3 months (`AdminDashboardView.expiringSchools`,
 * a superset of the 14-day tile above it), soonest-ending first. Each row
 * links into that school's own detail page.
 */
export function ExpiringSubscriptionsCard({ schools }: ExpiringSubscriptionsCardProps) {
  return (
    <Card className="p-0">
      <h2 className="p-6 pb-0 text-sm font-semibold text-slate-900">
        Subscriptions expiring within 3 months
      </h2>
      {schools.length === 0 ? (
        <div className="p-6">
          <EmptyState
            icon={CalendarClock}
            title="Nothing expiring soon"
            description="No subscriptions expire in the next 3 months."
          />
        </div>
      ) : (
        <div className="mt-3">
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>School</TableHeaderCell>
                <TableHeaderCell>Package</TableHeaderCell>
                <TableHeaderCell>Ends</TableHeaderCell>
                <TableHeaderCell numeric>Days left</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {schools.map((school) => (
                <TableRow key={school.schoolId} to={`/admin/schools/${school.schoolId}`}>
                  <TableCell label="School">{school.schoolName}</TableCell>
                  <TableCell label="Package">{school.packageName}</TableCell>
                  <TableCell label="Ends">{formatLongDate(school.endDate)}</TableCell>
                  <TableCell label="Days left" numeric>
                    <Badge variant={daysRemainingVariant(school.daysRemaining)}>
                      {school.daysRemaining} {school.daysRemaining === 1 ? "day" : "days"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </Card>
  );
}
