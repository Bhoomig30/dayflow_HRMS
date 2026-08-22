"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Alert } from "@/components/ui/Alert";
import { useApi } from "@/lib/client/useApi";
import { formatCurrency, formatDateShort, formatMonth } from "@/lib/ui/format";
import { BarChart3 } from "lucide-react";

const COLORS = {
  accent: "#8387c3",
  success: "#34b37a",
  warning: "#d9a441",
  danger: "#e2685f",
  info: "#6d9bd9",
  grid: "rgba(149,155,181,0.14)",
  text: "#a7abc9",
};
const PIE_COLORS = [COLORS.accent, COLORS.info, COLORS.success, COLORS.warning, COLORS.danger, "#7d81a0"];

interface AnalyticsData {
  overview: { totalEmployees: number; presentToday: number; onLeaveToday: number; absentToday: number; pendingLeaveRequests: number };
  attendanceTrend: { date: string; present: number; absent: number; halfDay: number; leave: number }[];
  departmentDistribution: { department: string; count: number }[];
  leaveUtilization: { leaveType: string; approvedWorkingDays: number; requestCount: number }[];
  lateArrivalTrend: { weekStart: string; lateCount: number }[];
  salaryOverview: { recordCount: number; averageNet: number; byMonth: { month: string; total: number }[] } | null;
  year: number;
}

const tooltipStyle = { background: "#0d1530", border: "1px solid rgba(149,155,181,0.3)", borderRadius: 8, fontSize: 12, color: "#f3f4fa" };

export function AnalyticsDashboard() {
  const { data, error, loading } = useApi<AnalyticsData>("/api/analytics");

  if (loading) return <p className="text-sm text-[var(--df-text-muted)]">Loading analytics…</p>;
  if (error) return <Alert tone="danger">{error}</Alert>;
  if (!data) return null;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Attendance trend</CardTitle>
          <CardDescription>Last 14 working days, company-wide.</CardDescription>
        </CardHeader>
        <CardContent>
          {data.attendanceTrend.every((d) => d.present + d.absent + d.halfDay + d.leave === 0) ? (
            <EmptyState icon={BarChart3} title="Not enough data to generate this report yet." description="Attendance check-ins will populate this chart." />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={data.attendanceTrend}>
                <defs>
                  <linearGradient id="presentGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={COLORS.success} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={COLORS.success} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} vertical={false} />
                <XAxis dataKey="date" tickFormatter={formatDateShort} stroke={COLORS.text} fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke={COLORS.text} fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} labelFormatter={(v) => formatDateShort(v as string)} />
                <Legend wrapperStyle={{ fontSize: 11, color: COLORS.text }} />
                <Area type="monotone" dataKey="present" name="Present" stroke={COLORS.success} fill="url(#presentGrad)" strokeWidth={2} />
                <Area type="monotone" dataKey="halfDay" name="Half-day" stroke={COLORS.warning} fillOpacity={0} strokeWidth={2} />
                <Area type="monotone" dataKey="leave" name="Leave" stroke={COLORS.info} fillOpacity={0} strokeWidth={2} />
                <Area type="monotone" dataKey="absent" name="Absent" stroke={COLORS.danger} fillOpacity={0} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Department distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {data.departmentDistribution.length === 0 ? (
              <EmptyState title="Not enough data to generate this report yet." description="Assign employees to departments to see this breakdown." />
            ) : (
              <>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={data.departmentDistribution} dataKey="count" nameKey="department" cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={2}>
                      {data.departmentDistribution.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="none" />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
                {/* Custom legend: recharts' built-in <Legend> shrinks a radial chart's plot area in a way that clipped this
                    donut in testing, so the legend is rendered here instead, outside the chart's measured area. */}
                <div className="mt-2 flex flex-wrap justify-center gap-3 text-xs" style={{ color: COLORS.text }}>
                  {data.departmentDistribution.map((d, i) => (
                    <span key={d.department} className="flex items-center gap-1.5">
                      <span className="size-2.5 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                      {d.department} ({d.count})
                    </span>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Leave utilization ({data.year})</CardTitle>
          </CardHeader>
          <CardContent>
            {data.leaveUtilization.length === 0 ? (
              <EmptyState title="Not enough data to generate this report yet." description="Approved leave requests this year will appear here." />
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={data.leaveUtilization}>
                  <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} vertical={false} />
                  <XAxis dataKey="leaveType" stroke={COLORS.text} fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke={COLORS.text} fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="approvedWorkingDays" name="Approved working days" fill={COLORS.accent} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Late arrivals per week</CardTitle>
            <CardDescription>Last 8 weeks.</CardDescription>
          </CardHeader>
          <CardContent>
            {data.lateArrivalTrend.length === 0 ? (
              <EmptyState title="Not enough data to generate this report yet." description="No late check-ins recorded in this window." />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data.lateArrivalTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} vertical={false} />
                  <XAxis dataKey="weekStart" tickFormatter={formatDateShort} stroke={COLORS.text} fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke={COLORS.text} fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} labelFormatter={(v) => formatDateShort(v as string)} />
                  <Bar dataKey="lateCount" name="Late check-ins" fill={COLORS.warning} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Salary overview</CardTitle>
            <CardDescription>Published payroll records only.</CardDescription>
          </CardHeader>
          <CardContent>
            {!data.salaryOverview ? (
              <EmptyState title="Not enough data to generate this report yet." description="Publish payroll records to see salary trends." />
            ) : (
              <>
                <p className="mb-3 text-sm text-[var(--df-text-secondary)]">
                  Average net salary: <span className="font-semibold text-[var(--df-text-primary)]">{formatCurrency(data.salaryOverview.averageNet)}</span> across{" "}
                  {data.salaryOverview.recordCount} published record(s)
                </p>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={data.salaryOverview.byMonth}>
                    <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} vertical={false} />
                    <XAxis dataKey="month" tickFormatter={formatMonth} stroke={COLORS.text} fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke={COLORS.text} fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v) => formatCurrency(Number(v))} labelFormatter={(v) => formatMonth(v as string)} />
                    <Bar dataKey="total" name="Total net payout" fill={COLORS.accent} radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
