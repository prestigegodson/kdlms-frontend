import { ChevronRight } from "lucide-react";
import { Fragment } from "react";
import { Link } from "react-router";

interface BreadcrumbStep {
  label: string;
  /** Omit on the current (last) step - it renders as plain text rather than a link. */
  to?: string;
}

interface WardBreadcrumbProps {
  steps: BreadcrumbStep[];
}

/**
 * The School › Ward › Session › Term trail shown above each step of a
 * guardian ward drill-down (results or attendance), so a guardian always
 * sees where they are in the hierarchy without relying solely on the mobile
 * app bar's single-level back chevron. Own `overflow-x-auto
 * overscroll-x-contain` wrapper so a long school + ward + session name can
 * never widen the page itself at 375px.
 */
export function WardBreadcrumb({ steps }: WardBreadcrumbProps) {
  return (
    <nav aria-label="Breadcrumb" className="overflow-x-auto overscroll-x-contain">
      <ol className="flex items-center gap-1.5 whitespace-nowrap text-sm text-slate-500">
        {steps.map((step, index) => (
          <Fragment key={`${step.label}-${index}`}>
            {index > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-300" aria-hidden="true" />}
            <li>
              {step.to ? (
                <Link to={step.to} className="cursor-pointer hover:text-brand-700 hover:underline">
                  {step.label}
                </Link>
              ) : (
                <span className="font-medium text-slate-700" aria-current="page">
                  {step.label}
                </span>
              )}
            </li>
          </Fragment>
        ))}
      </ol>
    </nav>
  );
}
