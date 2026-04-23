import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { scurveService } from "@/services/scurveService";
import {
  deriveSCurvePerformanceIndicators,
  type SCurveDailyValue,
  type SCurvePerformanceIndicators,
} from "@/lib/scurve";

interface SCurveViewProps {
  projectId: string;
  projectName: string;
}

type ZoomLevel = "daily" | "weekly" | "monthly";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-AE", {
    style: "currency",
    currency: "AED",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function formatCompactCurrency(value: number) {
  return new Intl.NumberFormat("en-AE", {
    notation: "compact",
    compactDisplay: "short",
    maximumFractionDigits: 1,
  }).format(value || 0);
}

function getWeekBucket(dateValue: string) {
  const date = new Date(`${dateValue}T00:00:00.000Z`);
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - day + 1);
  return date.toISOString().split("T")[0];
}

function groupSeries(series: SCurveDailyValue[], zoom: ZoomLevel) {
  if (zoom === "daily") {
    return series;
  }

  const grouped = new Map<string, SCurveDailyValue>();

  series.forEach((entry) => {
    const key = zoom === "weekly" ? getWeekBucket(entry.date) : entry.date.slice(0, 7);
    grouped.set(key, entry);
  });

  return Array.from(grouped.values());
}

function buildStatusTone(value: number) {
  if (value > 0) {
    return "text-emerald-600";
  }
  if (value < 0) {
    return "text-rose-600";
  }
  return "text-muted-foreground";
}

export function SCurveView({ projectId, projectName }: SCurveViewProps) {
  const [series, setSeries] = useState<SCurveDailyValue[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [zoom, setZoom] = useState<ZoomLevel>("daily");
  const [errorMessage, setErrorMessage] = useState("");

  async function loadSeries(forceRecalculate = false) {
    try {
      setErrorMessage("");
      if (forceRecalculate) {
        setRefreshing(true);
        const recalculatedSeries = await scurveService.recalculateProject(projectId);
        setSeries(recalculatedSeries);
      } else {
        setLoading(true);
        const storedSeries = await scurveService.getProjectDailyAggregates(projectId);
        if (storedSeries.length > 0) {
          setSeries(storedSeries);
        } else {
          const recalculatedSeries = await scurveService.recalculateProject(projectId);
          setSeries(recalculatedSeries);
        }
      }
    } catch (error) {
      console.error(error);
      setErrorMessage("Unable to load S-Curve data for this project.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void loadSeries();
  }, [projectId]);

  const indicators: SCurvePerformanceIndicators = useMemo(
    () => deriveSCurvePerformanceIndicators(series),
    [series]
  );

  const chartData = useMemo(() => groupSeries(series, zoom), [series, zoom]);
  const latestPoint = chartData[chartData.length - 1];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">S-Curve (Planned vs Actual)</h3>
          <p className="text-sm text-muted-foreground">
            Cumulative PV, AV, and EV for {projectName}.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="flex rounded-lg border bg-background p-1">
            {(["daily", "weekly", "monthly"] as ZoomLevel[]).map((level) => (
              <Button
                key={level}
                type="button"
                size="sm"
                variant={zoom === level ? "default" : "ghost"}
                onClick={() => setZoom(level)}
                className="capitalize"
              >
                {level}
              </Button>
            ))}
          </div>
          <Button type="button" variant="outline" onClick={() => void loadSeries(true)} disabled={refreshing}>
            {refreshing ? "Refreshing..." : "Refresh data"}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Cost Variance (CV)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-semibold ${buildStatusTone(indicators.costVariance)}`}>
              {formatCurrency(indicators.costVariance)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{indicators.budgetStatus}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Schedule Variance (SV)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-semibold ${buildStatusTone(indicators.scheduleVariance)}`}>
              {formatCurrency(indicators.scheduleVariance)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{indicators.scheduleStatus}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Cost Performance Index (CPI)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-foreground">
              {indicators.costPerformanceIndex?.toFixed(2) || "—"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {indicators.costPerformanceIndex && indicators.costPerformanceIndex >= 1
                ? "Healthy cost performance"
                : "Needs cost attention"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Schedule Performance Index (SPI)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-foreground">
              {indicators.schedulePerformanceIndex?.toFixed(2) || "—"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {indicators.schedulePerformanceIndex && indicators.schedulePerformanceIndex >= 1
                ? "Schedule performing well"
                : "Schedule needs recovery"}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Cumulative project curve</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="py-20 text-center text-sm text-muted-foreground">Loading S-Curve data...</p>
          ) : errorMessage ? (
            <p className="py-20 text-center text-sm text-destructive">{errorMessage}</p>
          ) : chartData.length === 0 ? (
            <div className="rounded-lg border border-dashed bg-muted/20 px-6 py-16 text-center">
              <p className="text-sm font-medium text-foreground">No S-Curve data yet</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Add planned schedule, labor cost, material plans, and execution updates to generate the curve.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-lg border bg-muted/20 p-3">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">PV</p>
                  <p className="mt-2 text-lg font-semibold text-sky-700">
                    {formatCurrency(latestPoint?.cumulativePlannedValue || 0)}
                  </p>
                </div>
                <div className="rounded-lg border bg-muted/20 p-3">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">AV</p>
                  <p className="mt-2 text-lg font-semibold text-amber-700">
                    {formatCurrency(latestPoint?.cumulativeActualValue || 0)}
                  </p>
                </div>
                <div className="rounded-lg border bg-muted/20 p-3">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">EV</p>
                  <p className="mt-2 text-lg font-semibold text-emerald-700">
                    {formatCurrency(latestPoint?.cumulativeEarnedValue || 0)}
                  </p>
                </div>
              </div>

              <div className="h-[360px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 12, right: 16, bottom: 8, left: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                    <YAxis
                      tick={{ fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => formatCompactCurrency(Number(value))}
                    />
                    <Tooltip
                      formatter={(value: number) => formatCurrency(Number(value))}
                      labelFormatter={(label) => `Date: ${label}`}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="cumulativePlannedValue"
                      name="Planned Value (PV)"
                      stroke="#0ea5e9"
                      strokeWidth={2.5}
                      dot={false}
                      activeDot={{ r: 5 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="cumulativeActualValue"
                      name="Actual Value (AV)"
                      stroke="#f59e0b"
                      strokeWidth={2.5}
                      dot={false}
                      activeDot={{ r: 5 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="cumulativeEarnedValue"
                      name="Earned Value (EV)"
                      stroke="#10b981"
                      strokeWidth={2.5}
                      dot={false}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="rounded-lg border bg-background px-4 py-3 text-sm text-muted-foreground">
                Deviations are visible as the gap between PV, AV, and EV. A widening AV above EV indicates cost overrun,
                while EV below PV indicates schedule slippage.
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}