import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/format";
import { formatInr } from "@/lib/formatCurrency";
import type { CirculationReportResponse } from "@/types/dashboard";

type TrendPoint = CirculationReportResponse["trend"][number];

const CHART_WIDTH = 760;
const CHART_HEIGHT = 250;
const PLOT = { left: 54, right: 16, top: 16, bottom: 42 };
const PLOT_WIDTH = CHART_WIDTH - PLOT.left - PLOT.right;
const PLOT_HEIGHT = CHART_HEIGHT - PLOT.top - PLOT.bottom;

function labelIndexes(length: number): number[] {
  if (length <= 5) return Array.from({ length }, (_, index) => index);
  const indexes = new Set<number>([0, length - 1]);
  for (let index = 1; index <= 3; index += 1) {
    indexes.add(Math.round(((length - 1) * index) / 4));
  }
  return [...indexes].sort((a, b) => a - b);
}

function formatInterval(value: string, interval: CirculationReportResponse["trend_interval"]): string {
  const date = new Date(`${value}T00:00:00Z`);
  if (interval === "month") {
    return date.toLocaleDateString("en-GB", { month: "short", year: "2-digit", timeZone: "UTC" });
  }
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}

function TrendLegend({
  entries,
}: {
  entries: Array<{ label: string; color: string }>;
}) {
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
      {entries.map((entry) => (
        <li key={entry.label} className="flex items-center gap-2">
          <span className="size-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
          {entry.label}
        </li>
      ))}
    </ul>
  );
}

function CirculationLineChart({
  data,
  interval,
}: {
  data: TrendPoint[];
  interval: CirculationReportResponse["trend_interval"];
}) {
  const maxValue = Math.max(1, ...data.flatMap((point) => [point.loans_issued, point.returns_processed]));
  const xAt = (index: number) =>
    PLOT.left + (data.length <= 1 ? PLOT_WIDTH / 2 : (PLOT_WIDTH * index) / (data.length - 1));
  const yAt = (value: number) => PLOT.top + PLOT_HEIGHT - (value / maxValue) * PLOT_HEIGHT;
  const labelPositions = labelIndexes(data.length);
  const series = [
    { key: "loans_issued" as const, label: "Loans issued", color: "var(--primary)" },
    { key: "returns_processed" as const, label: "Returns processed", color: "#2563eb" },
  ];

  return (
    <svg
      className="h-64 w-full overflow-visible"
      viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
      role="img"
      aria-label="Loans issued and returns processed trend"
    >
      <title>Loans issued and returns processed trend</title>
      {[0, 1, 2, 3, 4].map((step) => {
        const value = Math.round((maxValue * (4 - step)) / 4);
        const y = PLOT.top + (PLOT_HEIGHT * step) / 4;
        return (
          <g key={step}>
            <line x1={PLOT.left} x2={CHART_WIDTH - PLOT.right} y1={y} y2={y} stroke="var(--border)" strokeDasharray="3 5" />
            <text x={PLOT.left - 10} y={y + 4} textAnchor="end" className="fill-muted-foreground" fontSize="11">
              {value}
            </text>
          </g>
        );
      })}
      {series.map((item) => {
        const points = data.map((point, index) => `${xAt(index)},${yAt(point[item.key])}`).join(" ");
        return (
          <g key={item.key}>
            {data.length > 1 ? (
              <polyline
                fill="none"
                points={points}
                stroke={item.color}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="3"
              />
            ) : null}
            {data.map((point, index) => (
              <circle
                key={`${point.period_start}-${item.key}`}
                cx={xAt(index)}
                cy={yAt(point[item.key])}
                r="4"
                fill="var(--card)"
                stroke={item.color}
                strokeWidth="2.5"
              >
                <title>{`${formatDate(point.period_start)} · ${item.label}: ${point[item.key]}`}</title>
              </circle>
            ))}
          </g>
        );
      })}
      {labelPositions.map((index) => (
        <text
          key={data[index]?.period_start}
          x={xAt(index)}
          y={CHART_HEIGHT - 10}
          textAnchor="middle"
          className="fill-muted-foreground"
          fontSize="11"
        >
          {formatInterval(data[index]!.period_start, interval)}
        </text>
      ))}
    </svg>
  );
}

function FineBarChart({
  data,
  interval,
}: {
  data: TrendPoint[];
  interval: CirculationReportResponse["trend_interval"];
}) {
  const values = data.map((point) => Number(point.fines_collected));
  const maxValue = Math.max(1, ...values);
  const slotWidth = data.length ? PLOT_WIDTH / data.length : PLOT_WIDTH;
  const barWidth = Math.min(24, slotWidth * 0.62);
  const labelPositions = labelIndexes(data.length);

  return (
    <svg
      className="h-64 w-full overflow-visible"
      viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
      role="img"
      aria-label="Fines collected trend"
    >
      <title>Fines collected trend</title>
      {[0, 1, 2, 3, 4].map((step) => {
        const value = (maxValue * (4 - step)) / 4;
        const y = PLOT.top + (PLOT_HEIGHT * step) / 4;
        return (
          <g key={step}>
            <line x1={PLOT.left} x2={CHART_WIDTH - PLOT.right} y1={y} y2={y} stroke="var(--border)" strokeDasharray="3 5" />
            <text x={PLOT.left - 10} y={y + 4} textAnchor="end" className="fill-muted-foreground" fontSize="10">
              {formatInr(Math.round(value))}
            </text>
          </g>
        );
      })}
      {data.map((point, index) => {
        const amount = Number(point.fines_collected);
        const height = (amount / maxValue) * PLOT_HEIGHT;
        const x = PLOT.left + slotWidth * index + (slotWidth - barWidth) / 2;
        const y = PLOT.top + PLOT_HEIGHT - height;
        return (
          <rect
            key={point.period_start}
            x={x}
            y={y}
            width={barWidth}
            height={Math.max(0, height)}
            rx="4"
            fill="#d97706"
          >
            <title>{`${formatDate(point.period_start)} · ${formatInr(amount)}`}</title>
          </rect>
        );
      })}
      {labelPositions.map((index) => (
        <text
          key={data[index]?.period_start}
          x={PLOT.left + slotWidth * index + slotWidth / 2}
          y={CHART_HEIGHT - 10}
          textAnchor="middle"
          className="fill-muted-foreground"
          fontSize="11"
        >
          {formatInterval(data[index]!.period_start, interval)}
        </text>
      ))}
    </svg>
  );
}

function ReservationLineChart({
  data,
  interval,
}: {
  data: CirculationReportResponse["reservation_trend"];
  interval: CirculationReportResponse["trend_interval"];
}) {
  const maxValue = Math.max(
    1,
    ...data.flatMap((point) => [point.reservations_placed, point.reservations_fulfilled]),
  );
  const xAt = (index: number) =>
    PLOT.left + (data.length <= 1 ? PLOT_WIDTH / 2 : (PLOT_WIDTH * index) / (data.length - 1));
  const yAt = (value: number) => PLOT.top + PLOT_HEIGHT - (value / maxValue) * PLOT_HEIGHT;
  const lines = [
    { key: "reservations_placed" as const, label: "Placed", color: "var(--primary)" },
    { key: "reservations_fulfilled" as const, label: "Fulfilled", color: "#2563eb" },
  ];

  return (
    <svg
      className="h-64 w-full overflow-visible"
      viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
      role="img"
      aria-label="Reservations placed and fulfilled trend"
    >
      <title>Reservations placed and fulfilled trend</title>
      {[0, 1, 2, 3, 4].map((step) => {
        const value = Math.round((maxValue * (4 - step)) / 4);
        const y = PLOT.top + (PLOT_HEIGHT * step) / 4;
        return (
          <g key={step}>
            <line x1={PLOT.left} x2={CHART_WIDTH - PLOT.right} y1={y} y2={y} stroke="var(--border)" strokeDasharray="3 5" />
            <text x={PLOT.left - 10} y={y + 4} textAnchor="end" className="fill-muted-foreground" fontSize="11">
              {value}
            </text>
          </g>
        );
      })}
      {lines.map((line) => (
        <g key={line.key}>
          {data.length > 1 ? (
            <polyline
              fill="none"
              points={data.map((point, index) => `${xAt(index)},${yAt(point[line.key])}`).join(" ")}
              stroke={line.color}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="3"
            />
          ) : null}
          {data.map((point, index) => (
            <circle
              key={`${point.period_start}-${line.key}`}
              cx={xAt(index)}
              cy={yAt(point[line.key])}
              r="4"
              fill="var(--card)"
              stroke={line.color}
              strokeWidth="2.5"
            >
              <title>{`${formatDate(point.period_start)} · ${line.label}: ${point[line.key]}`}</title>
            </circle>
          ))}
        </g>
      ))}
      {labelIndexes(data.length).map((index) => (
        <text
          key={data[index]?.period_start}
          x={xAt(index)}
          y={CHART_HEIGHT - 10}
          textAnchor="middle"
          className="fill-muted-foreground"
          fontSize="11"
        >
          {formatInterval(data[index]!.period_start, interval)}
        </text>
      ))}
    </svg>
  );
}

export function CirculationTrendCharts({
  data,
  interval,
}: {
  data: TrendPoint[];
  interval: CirculationReportResponse["trend_interval"];
}) {
  const intervalLabel = interval === "day" ? "daily" : interval === "week" ? "weekly" : "monthly";

  return (
    <section className="space-y-4" aria-labelledby="circulation-trends-heading">
      <div>
        <h2 id="circulation-trends-heading" className="text-lg font-semibold tracking-tight">
          Activity trends
        </h2>
        <p className="text-sm text-muted-foreground">
          {`Shown ${intervalLabel}; the interval adjusts to the selected date range.`}
        </p>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="gap-4 border-border/70 bg-card/90 py-5 shadow-sm">
          <CardHeader className="pb-0">
            <CardTitle className="text-base">Loans and returns</CardTitle>
            <CardDescription>Circulation volume over time.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 overflow-hidden">
            <TrendLegend
              entries={[
                { label: "Loans issued", color: "var(--primary)" },
                { label: "Returns processed", color: "#2563eb" },
              ]}
            />
            <CirculationLineChart data={data} interval={interval} />
          </CardContent>
        </Card>
        <Card className="gap-4 border-border/70 bg-card/90 py-5 shadow-sm">
          <CardHeader className="pb-0">
            <CardTitle className="text-base">Fine collection</CardTitle>
            <CardDescription>Payments recorded over time.</CardDescription>
          </CardHeader>
          <CardContent className="overflow-hidden">
            <FineBarChart data={data} interval={interval} />
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

export function ReservationTrendChart({
  data,
  interval,
}: {
  data: CirculationReportResponse["reservation_trend"];
  interval: CirculationReportResponse["trend_interval"];
}) {
  return (
    <Card className="gap-4 border-border/70 bg-card/90 py-5 shadow-sm">
      <CardHeader className="pb-0">
        <CardTitle className="text-base">Reservation demand</CardTitle>
        <CardDescription>Reservations placed compared with copies issued to waiting students.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 overflow-hidden">
        <TrendLegend
          entries={[
            { label: "Placed", color: "var(--primary)" },
            { label: "Fulfilled", color: "#2563eb" },
          ]}
        />
        <ReservationLineChart data={data} interval={interval} />
      </CardContent>
    </Card>
  );
}
