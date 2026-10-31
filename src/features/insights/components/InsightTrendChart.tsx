import { useState } from "react";
import type { TrendPoint } from "@/api/insights";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/Table";
import { SEVERITY_BADGE, formatPosition, formatScore, ordinal } from "@/features/insights/format";

const WIDTH = 320;
const HEIGHT = 140;
const PAD = { top: 12, right: 14, bottom: 26, left: 34 };

interface Panel {
  title: string;
  /** The value each term contributes, or null for a gap. */
  value: (point: TrendPoint) => number | null;
  /** `[top, bottom]` of the y-axis - position runs inverted, 1st at the top. */
  domain: [number, number];
  ticks: number[];
  tickLabel: (value: number) => string;
  valueLabel: (point: TrendPoint) => string;
}

function buildPanels(terms: TrendPoint[]): Panel[] {
  const maxSize = Math.max(2, ...terms.map((point) => point.classSize ?? point.position ?? 0));
  const middle = Math.round((1 + maxSize) / 2);
  return [
    {
      title: "Term average",
      value: (point) => point.average ?? null,
      domain: [100, 0],
      ticks: [0, 50, 100],
      tickLabel: String,
      valueLabel: (point) => formatScore(point.average),
    },
    {
      title: "Class position",
      value: (point) => point.position ?? null,
      domain: [1, maxSize],
      ticks: [...new Set([1, middle, maxSize])],
      tickLabel: ordinal,
      valueLabel: (point) => formatPosition(point.position, point.classSize),
    },
    {
      title: "Attendance",
      value: (point) => point.attendanceRate ?? null,
      domain: [100, 0],
      ticks: [0, 50, 100],
      tickLabel: (value) => `${value}%`,
      valueLabel: (point) => (point.attendanceRate === undefined ? "—" : `${formatScore(point.attendanceRate)}%`),
    },
  ];
}

function termLabel(point: TrendPoint): string {
  return [point.termName, point.sessionName].filter(Boolean).join(" · ") || `Term ${point.termNumber}`;
}

/**
 * Term-over-term trend for one student (insights Phase I4), per the dataviz guidance: three small
 * multiples sharing the term x-axis, each with its own single y-axis (average and attendance are
 * 0-100, position is a rank) - never a dual axis. One series per panel, so no legend; the title
 * names it. A missing value leaves a gap rather than a line drawn across it. A table view carries
 * the same numbers for anyone who can't read the chart.
 */
export function InsightTrendChart({ terms }: { terms: TrendPoint[] }) {
  const [asTable, setAsTable] = useState(false);
  const panels = buildPanels(terms);

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={() => setAsTable((value) => !value)}>
          {asTable ? "Show as chart" : "Show as table"}
        </Button>
      </div>
      {asTable ? (
        <TrendTable terms={terms} />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {panels.map((panel) => (
            <TrendPanel key={panel.title} panel={panel} terms={terms} />
          ))}
        </div>
      )}
    </div>
  );
}

function TrendPanel({ panel, terms }: { panel: Panel; terms: TrendPoint[] }) {
  const [active, setActive] = useState<number | null>(null);
  const plotWidth = WIDTH - PAD.left - PAD.right;
  const plotHeight = HEIGHT - PAD.top - PAD.bottom;
  const [top, bottom] = panel.domain;

  const x = (index: number) =>
    terms.length === 1 ? PAD.left + plotWidth / 2 : PAD.left + (index / (terms.length - 1)) * plotWidth;
  const y = (value: number) => PAD.top + ((value - top) / (bottom - top)) * plotHeight;

  const values = terms.map(panel.value);
  // One "M" per run of known values, so a null term breaks the line.
  let path = "";
  values.forEach((value, index) => {
    if (value === null) {
      return;
    }
    path += `${index > 0 && values[index - 1] !== null ? "L" : "M"}${x(index).toFixed(1)},${y(value).toFixed(1)} `;
  });

  const latest = [...terms].reverse().find((point) => panel.value(point) !== null);
  const activePoint = active === null ? null : terms[active];
  const activeValue = active === null ? null : values[active];

  return (
    <figure className="rounded-panel border border-slate-200 bg-white p-3">
      <figcaption className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium text-slate-900">{panel.title}</span>
        <span className="text-sm tabular-nums text-slate-600">{latest ? panel.valueLabel(latest) : "—"}</span>
      </figcaption>
      <div className="relative mt-2">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="block h-auto w-full overflow-visible"
          role="img"
          aria-label={`${panel.title} by term: ${terms.map((point) => `${termLabel(point)} ${panel.valueLabel(point)}`).join(", ")}`}
        >
          {panel.ticks.map((tick) => (
            <g key={tick}>
              <line
                x1={PAD.left}
                x2={WIDTH - PAD.right}
                y1={y(tick)}
                y2={y(tick)}
                className="stroke-slate-200"
                strokeWidth={1}
              />
              <text x={PAD.left - 6} y={y(tick)} dy="0.32em" textAnchor="end" className="fill-slate-500" fontSize={10}>
                {panel.tickLabel(tick)}
              </text>
            </g>
          ))}
          {terms.map((point, index) => (
            <text
              key={point.termId}
              x={x(index)}
              y={HEIGHT - 8}
              textAnchor="middle"
              className="fill-slate-500"
              fontSize={10}
            >
              {`T${point.termNumber}`}
            </text>
          ))}
          {path && (
            <path
              d={path.trim()}
              fill="none"
              className="stroke-brand-500"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
          {values.map((value, index) =>
            value === null ? null : (
              <g
                key={terms[index].termId}
                tabIndex={0}
                role="button"
                aria-label={`${termLabel(terms[index])}: ${panel.valueLabel(terms[index])}`}
                onMouseEnter={() => setActive(index)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(index)}
                onBlur={() => setActive(null)}
                className="cursor-default outline-none"
              >
                <circle cx={x(index)} cy={y(value)} r={14} fill="transparent" />
                <circle
                  cx={x(index)}
                  cy={y(value)}
                  r={active === index ? 6 : 4.5}
                  className="fill-brand-500 stroke-white"
                  strokeWidth={2}
                />
              </g>
            ),
          )}
        </svg>
        {activePoint && activeValue !== null && active !== null && (
          <div
            role="tooltip"
            className="pointer-events-none absolute z-10 whitespace-nowrap rounded-control border border-slate-200 bg-white px-2.5 py-1.5 text-xs shadow-md"
            style={{
              left: `${(x(active) / WIDTH) * 100}%`,
              top: `${(y(activeValue) / HEIGHT) * 100}%`,
              marginTop: -10,
              transform: "translate(-50%, -100%)",
            }}
          >
            <p className="font-medium text-slate-900">{termLabel(activePoint)}</p>
            <p className="tabular-nums text-slate-700">{panel.valueLabel(activePoint)}</p>
            <p className="text-slate-500">{SEVERITY_BADGE[activePoint.severity].label}</p>
          </div>
        )}
      </div>
    </figure>
  );
}

function TrendTable({ terms }: { terms: TrendPoint[] }) {
  return (
    <Table>
      <TableHead>
        <tr>
          <TableHeaderCell>Term</TableHeaderCell>
          <TableHeaderCell>Class</TableHeaderCell>
          <TableHeaderCell numeric>Average</TableHeaderCell>
          <TableHeaderCell numeric>Position</TableHeaderCell>
          <TableHeaderCell numeric>Attendance</TableHeaderCell>
          <TableHeaderCell>Status</TableHeaderCell>
        </tr>
      </TableHead>
      <TableBody>
        {terms.map((point) => {
          const severity = SEVERITY_BADGE[point.severity];
          return (
            <TableRow key={point.termId}>
              <TableCell label="Term">{termLabel(point)}</TableCell>
              <TableCell label="Class">{point.className ?? "—"}</TableCell>
              <TableCell label="Average" numeric>
                {formatScore(point.average)}
              </TableCell>
              <TableCell label="Position" numeric>
                {formatPosition(point.position, point.classSize)}
              </TableCell>
              <TableCell label="Attendance" numeric>
                {point.attendanceRate === undefined ? "—" : `${formatScore(point.attendanceRate)}%`}
              </TableCell>
              <TableCell label="Status">
                <Badge variant={severity.variant}>{severity.label}</Badge>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
