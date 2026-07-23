"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area,
} from "recharts";
import { Download, AlertTriangle, CheckCircle, Clock, DollarSign, TrendingUp, Users } from "lucide-react";
import {
  fmtMoney, fmtNum, calcBudgetUsage, statusPillClass, healthClass, riskClass, PROJECT_STATUSES, PROJECT_TYPES, PRIORITIES, RISK_LEVELS,
} from "@/lib/utils";

type ProjectSummary = {
  total: number;
  byStatus: { status: string; _count: number }[];
  byDepartment: { department: string; _count: number }[];
};

type BudgetItem = {
  id: string;
  code: string;
  name: string;
  budget: number;
  actualSpend: number;
  usagePercent: number;
};

type Project = {
  id: string;
  code: string;
  name: string;
  description: string;
  department: string;
  status: string;
  budget: number;
  progress: number;
  healthScore: number;
  manager: { id: string; name: string } | null;
  _count: { expenses: number; workItems: number; risks: number; approvals: number };
};

type Expense = {
  id: string;
  amountInclTax: number;
  date: string;
  category: string;
  project: { id: string; code: string; name: string } | null;
};

type Approval = {
  id: string;
  type: string;
  status: string;
  amount: number;
  createdAt: string;
  project: { id: string; code: string; name: string } | null;
  requester: { id: string; name: string; role: string } | null;
};

const PIE_COLORS = ["var(--primary)", "var(--link)", "var(--violet)", "var(--cyan)", "var(--warning)", "var(--mute)"];
const DEPT_COLORS = ["var(--primary)", "var(--link)", "var(--violet)", "var(--cyan)", "var(--warning-deep)", "var(--mute)"];

export default function DashboardPage() {
  const router = useRouter();

  const [summary, setSummary] = useState<ProjectSummary | null>(null);
  const [budgetData, setBudgetData] = useState<BudgetItem[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);

  const [filters, setFilters] = useState({ year: "", department: "", type: "", status: "", riskLevel: "" });
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.year) params.set("year", filters.year);
      if (filters.department) params.set("department", filters.department);
      if (filters.status) params.set("status", filters.status);

      const [summaryRes, budgetRes, projectsRes, expensesRes, approvalsRes] = await Promise.all([
        fetch("/api/reports?type=project-summary"),
        fetch("/api/reports?type=budget-summary"),
        fetch(`/api/projects?${params.toString()}`),
        fetch("/api/expenses"),
        fetch("/api/approvals?status=Pending"),
      ]);

      if (summaryRes.ok) setSummary(await summaryRes.json());
      if (budgetRes.ok) setBudgetData(await budgetRes.json());
      if (projectsRes.ok) setProjects(await projectsRes.json());
      if (expensesRes.ok) setExpenses(await expensesRes.json());
      if (approvalsRes.ok) setApprovals(await approvalsRes.json());
    } catch {
      toast.error("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const statusCount = (s: string) => summary?.byStatus.find((b) => b.status === s)?._count ?? 0;
  const activeCount = statusCount("In_Progress");
  const completedCount = statusCount("Completed") + statusCount("Closed") + statusCount("Cancelled");
  const delayedCount = statusCount("Delayed");
  const totalBudget = budgetData.reduce((s, p) => s + p.budget, 0);
  const totalActual = budgetData.reduce((s, p) => s + p.actualSpend, 0);
  const budgetUsage = totalBudget > 0 ? Math.round((totalActual / totalBudget) * 100) : 0;
  const nearLimitCount = budgetData.filter((p) => p.usagePercent >= 90).length;

  const topBudget = [...budgetData].sort((a, b) => b.budget - a.budget).slice(0, 10);

  const statusDist = summary
    ? summary.byStatus.map((s) => ({ name: s.status.replace(/_/g, " "), value: s._count }))
    : [];

  const deptExpenses = (() => {
    const grouped: Record<string, number> = {};
    projects.forEach((p) => {
      if (!grouped[p.department]) grouped[p.department] = 0;
    });
    expenses.forEach((e) => {
      if (e.project) {
        const proj = projects.find((p) => p.id === e.project?.id);
        if (proj) grouped[proj.department] = (grouped[proj.department] || 0) + e.amountInclTax;
      }
    });
    return Object.entries(grouped)
      .map(([name, value]) => ({ name, value: Math.round(value) }))
      .sort((a, b) => b.value - a.value);
  })();

  const monthlyTrend = (() => {
    const grouped: Record<string, number> = {};
    expenses.forEach((e) => {
      if (e.date) {
        const key = e.date.slice(0, 7);
        grouped[key] = (grouped[key] || 0) + e.amountInclTax;
      }
    });
    return Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, spend]) => ({ month, spend: Math.round(spend) }));
  })();

  const highRisk = projects
    .map((p) => {
      const actual = budgetData.find((b) => b.id === p.id)?.actualSpend ?? 0;
      const usage = calcBudgetUsage(actual, p.budget);
      return { ...p, actualSpend: actual, usagePercent: usage };
    })
    .filter((p) => p.usagePercent >= 80 || p.healthScore < 50)
    .sort((a, b) => b.usagePercent - a.usagePercent)
    .slice(0, 10);

  const pendingApprovals = approvals.filter((a) => a.status === "Pending").slice(0, 10);

  async function handleReview(id: string, status: string) {
    try {
      const res = await fetch("/api/approvals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      if (!res.ok) throw new Error();
      toast.success(`Approval ${status.toLowerCase()}`);
      setApprovals((prev) => prev.filter((a) => a.id !== id));
    } catch {
      toast.error("Failed to update approval");
    }
  }

  async function handleExport() {
    setExporting(true);
    try {
      const res = await fetch("/api/reports?type=budget-summary");
      if (!res.ok) throw new Error();
      const data: BudgetItem[] = await res.json();
      const header = "Project Code,Project Name,Budget,Actual Spend,Usage %\n";
      const rows = data.map((p) => `${p.code},"${p.name}",${p.budget},${p.actualSpend},${p.usagePercent}%`).join("\n");
      const blob = new Blob(["\uFEFF" + header + rows], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "dashboard-export.csv";
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Export downloaded");
    } catch {
      toast.error("Export failed");
    } finally {
      setExporting(false);
    }
  }

  const kpiCard = (label: string, value: string | number, icon: React.ReactNode, danger = false) => (
    <div className="bg-[var(--canvas)] rounded-[var(--radius-lg)] border border-[var(--hairline)] p-4 flex items-center gap-3">
      <div className="shrink-0">{icon}</div>
      <div className="min-w-0">
        <div className="font-mono text-[10px] uppercase tracking-wider text-[var(--mute)]">{label}</div>
        <div className={`text-xl font-semibold tabular-nums ${danger ? "text-[var(--primary)]" : "text-[var(--ink)]"}`}>
          {value}
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="font-mono text-xs text-[var(--mute)] uppercase tracking-wider">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--ink)] tracking-tight">Dashboard</h1>
          <p className="text-sm text-[var(--mute)] mt-0.5 font-mono">
            Project Portfolio Overview
          </p>
        </div>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="flex items-center gap-1.5 bg-[var(--primary)] text-[var(--on-primary)] px-4 py-2 rounded-[var(--radius-md)] text-sm font-medium hover:bg-[var(--primary-hover)] transition-colors disabled:opacity-50"
        >
          <Download size={16} />
          {exporting ? "Exporting..." : "Export"}
        </button>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap gap-3">
        <select
          value={filters.year}
          onChange={(e) => setFilters((f) => ({ ...f, year: e.target.value }))}
          className="px-3 py-1.5 border border-[var(--hairline)] rounded-[var(--radius-xs)] text-sm text-[var(--ink)] bg-[var(--canvas)] outline-none focus:border-[var(--primary)]"
        >
          <option value="">All Years</option>
          {[2025, 2026, 2027].map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <select
          value={filters.department}
          onChange={(e) => setFilters((f) => ({ ...f, department: e.target.value }))}
          className="px-3 py-1.5 border border-[var(--hairline)] rounded-[var(--radius-xs)] text-sm text-[var(--ink)] bg-[var(--canvas)] outline-none focus:border-[var(--primary)]"
        >
          <option value="">All Departments</option>
          {Array.from(new Set(projects.map((p) => p.department))).map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
        <select
          value={filters.type}
          onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value }))}
          className="px-3 py-1.5 border border-[var(--hairline)] rounded-[var(--radius-xs)] text-sm text-[var(--ink)] bg-[var(--canvas)] outline-none focus:border-[var(--primary)]"
        >
          <option value="">All Types</option>
          {PROJECT_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <select
          value={filters.status}
          onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
          className="px-3 py-1.5 border border-[var(--hairline)] rounded-[var(--radius-xs)] text-sm text-[var(--ink)] bg-[var(--canvas)] outline-none focus:border-[var(--primary)]"
        >
          <option value="">All Statuses</option>
          {PROJECT_STATUSES.map((s) => (
            <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
          ))}
        </select>
        <select
          value={filters.riskLevel}
          onChange={(e) => setFilters((f) => ({ ...f, riskLevel: e.target.value }))}
          className="px-3 py-1.5 border border-[var(--hairline)] rounded-[var(--radius-xs)] text-sm text-[var(--ink)] bg-[var(--canvas)] outline-none focus:border-[var(--primary)]"
        >
          <option value="">All Risk Levels</option>
          {RISK_LEVELS.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-8 gap-3">
        {kpiCard("Total Projects", fmtNum(summary?.total), <Users size={20} className="text-[var(--mute)]" />)}
        {kpiCard("Active", fmtNum(activeCount), <TrendingUp size={20} className="text-[var(--link)]" />)}
        {kpiCard("Completed", fmtNum(completedCount), <CheckCircle size={20} className="text-[var(--success)]" />)}
        {kpiCard("Delayed", fmtNum(delayedCount), <Clock size={20} className="text-[var(--error)]" />, delayedCount > 0)}
        {kpiCard("Total Budget", `$${fmtMoney(totalBudget)}`, <DollarSign size={20} className="text-[var(--mute)]" />)}
        {kpiCard("Actual Spend", `$${fmtMoney(totalActual)}`, <DollarSign size={20} className="text-[var(--warning)]" />)}
        {kpiCard("Budget Usage", `${budgetUsage}%`, <TrendingUp size={20} className="text-[var(--warning)]" />, budgetUsage > 90)}
        {kpiCard("Near Limit", fmtNum(nearLimitCount), <AlertTriangle size={20} className="text-[var(--warning)]" />, nearLimitCount > 0)}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-2 gap-4">
        {/* Budget vs Actual */}
        <div className="bg-[var(--canvas)] rounded-[var(--radius-lg)] border border-[var(--hairline)] p-4">
          <h2 className="text-sm font-semibold text-[var(--ink)] mb-3">Budget vs Actual Spend (Top 10)</h2>
          {topBudget.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-xs text-[var(--mute)]">No data</div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={topBudget}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--hairline)" />
                <XAxis dataKey="code" tick={{ fontSize: 10, fill: "var(--mute)" }} />
                <YAxis tick={{ fontSize: 10, fill: "var(--mute)" }} />
                <Tooltip
                  contentStyle={{ background: "var(--canvas)", border: "1px solid var(--hairline)", borderRadius: 6, fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="budget" name="Budget" fill="var(--canvas-soft-2)" radius={[2, 2, 0, 0]} />
                <Bar dataKey="actualSpend" name="Actual" fill="var(--primary)" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Project Status Distribution */}
        <div className="bg-[var(--canvas)] rounded-[var(--radius-lg)] border border-[var(--hairline)] p-4">
          <h2 className="text-sm font-semibold text-[var(--ink)] mb-3">Project Status Distribution</h2>
          {statusDist.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-xs text-[var(--mute)]">No data</div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={statusDist}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  innerRadius={50}
                  label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {statusDist.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: "var(--canvas)", border: "1px solid var(--hairline)", borderRadius: 6, fontSize: 12 }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Expenses by Department */}
        <div className="bg-[var(--canvas)] rounded-[var(--radius-lg)] border border-[var(--hairline)] p-4">
          <h2 className="text-sm font-semibold text-[var(--ink)] mb-3">Expenses by Department</h2>
          {deptExpenses.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-xs text-[var(--mute)]">No data</div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={deptExpenses} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--hairline)" />
                <XAxis type="number" tick={{ fontSize: 10, fill: "var(--mute)" }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "var(--mute)" }} width={100} />
                <Tooltip
                  contentStyle={{ background: "var(--canvas)", border: "1px solid var(--hairline)", borderRadius: 6, fontSize: 12 }}
                  formatter={(v: unknown) => `$${fmtMoney(v as number)}`}
                />
                <Bar dataKey="value" name="Expenses" radius={[0, 2, 2, 0]}>
                  {deptExpenses.map((_, i) => (
                    <Cell key={i} fill={DEPT_COLORS[i % DEPT_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Monthly Spending Trend */}
        <div className="bg-[var(--canvas)] rounded-[var(--radius-lg)] border border-[var(--hairline)] p-4">
          <h2 className="text-sm font-semibold text-[var(--ink)] mb-3">Monthly Spending Trend</h2>
          {monthlyTrend.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-xs text-[var(--mute)]">No data</div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--hairline)" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: "var(--mute)" }} />
                <YAxis tick={{ fontSize: 10, fill: "var(--mute)" }} />
                <Tooltip
                  contentStyle={{ background: "var(--canvas)", border: "1px solid var(--hairline)", borderRadius: 6, fontSize: 12 }}
                  formatter={(v: unknown) => `$${fmtMoney(v as number)}`}
                />
                <Area type="monotone" dataKey="spend" name="Spend" stroke="var(--primary)" fill="var(--primary)" fillOpacity={0.1} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* High-Risk Projects Table */}
      <div className="bg-[var(--canvas)] rounded-[var(--radius-lg)] border border-[var(--hairline)] p-4">
        <h2 className="text-sm font-semibold text-[var(--ink)] mb-3">High-Risk Projects</h2>
        {highRisk.length === 0 ? (
          <div className="py-8 text-center text-xs text-[var(--mute)]">No high-risk projects</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--hairline)]">
                  <th className="text-left font-mono text-[10px] uppercase tracking-wider text-[var(--mute)] pb-2 pr-3">Code</th>
                  <th className="text-left font-mono text-[10px] uppercase tracking-wider text-[var(--mute)] pb-2 pr-3">Project</th>
                  <th className="text-left font-mono text-[10px] uppercase tracking-wider text-[var(--mute)] pb-2 pr-3">Department</th>
                  <th className="text-right font-mono text-[10px] uppercase tracking-wider text-[var(--mute)] pb-2 pr-3">Budget</th>
                  <th className="text-right font-mono text-[10px] uppercase tracking-wider text-[var(--mute)] pb-2 pr-3">Actual</th>
                  <th className="text-right font-mono text-[10px] uppercase tracking-wider text-[var(--mute)] pb-2 pr-3">Usage</th>
                  <th className="text-left font-mono text-[10px] uppercase tracking-wider text-[var(--mute)] pb-2 pr-3">Progress</th>
                  <th className="text-right font-mono text-[10px] uppercase tracking-wider text-[var(--mute)] pb-2">Health</th>
                </tr>
              </thead>
              <tbody>
                {highRisk.map((p) => {
                  const hc = healthClass(p.healthScore);
                  return (
                    <tr key={p.id} className="border-b border-[var(--hairline)] last:border-0 hover:bg-[var(--canvas-soft)] transition-colors">
                      <td className="py-2.5 pr-3 font-mono text-xs text-[var(--mute)]">{p.code}</td>
                      <td className="py-2.5 pr-3 font-medium text-[var(--ink)]">{p.name}</td>
                      <td className="py-2.5 pr-3 text-xs text-[var(--mute)]">{p.department}</td>
                      <td className="py-2.5 pr-3 text-right font-mono text-xs tabular-nums">${fmtMoney(p.budget)}</td>
                      <td className="py-2.5 pr-3 text-right font-mono text-xs tabular-nums">${fmtMoney(p.actualSpend)}</td>
                      <td className="py-2.5 pr-3 text-right">
                        <span className={`font-mono text-xs font-medium tabular-nums ${p.usagePercent >= 100 ? "text-[var(--error)]" : p.usagePercent >= 80 ? "text-[var(--warning)]" : "text-[var(--body)]"}`}>
                          {p.usagePercent}%
                        </span>
                      </td>
                      <td className="py-2.5 pr-3">
                        <div className="flex items-center gap-2">
                          <div className="progress-bar flex-1 max-w-24">
                            <div className="progress-fill bg-[var(--canvas-soft-2)]" style={{ width: `${p.progress}%` }} />
                          </div>
                          <span className="font-mono text-[10px] text-[var(--mute)] tabular-nums">{p.progress}%</span>
                        </div>
                      </td>
                      <td className="py-2.5 text-right">
                        <span
                          className={`inline-flex items-center gap-1 font-mono text-xs font-medium tabular-nums ${
                            hc === "green" ? "text-[var(--success)]" : hc === "yellow" ? "text-[var(--warning)]" : "text-[var(--error)]"
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            hc === "green" ? "bg-[var(--success)]" : hc === "yellow" ? "bg-[var(--warning)]" : "bg-[var(--error)]"
                          }`} />
                          {p.healthScore}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pending My Approval Table */}
      <div className="bg-[var(--canvas)] rounded-[var(--radius-lg)] border border-[var(--hairline)] p-4">
        <h2 className="text-sm font-semibold text-[var(--ink)] mb-3">Pending My Approval</h2>
        {pendingApprovals.length === 0 ? (
          <div className="py-8 text-center text-xs text-[var(--mute)]">No pending approvals</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--hairline)]">
                  <th className="text-left font-mono text-[10px] uppercase tracking-wider text-[var(--mute)] pb-2 pr-3">Project</th>
                  <th className="text-left font-mono text-[10px] uppercase tracking-wider text-[var(--mute)] pb-2 pr-3">Type</th>
                  <th className="text-right font-mono text-[10px] uppercase tracking-wider text-[var(--mute)] pb-2 pr-3">Amount</th>
                  <th className="text-left font-mono text-[10px] uppercase tracking-wider text-[var(--mute)] pb-2 pr-3">Requester</th>
                  <th className="text-left font-mono text-[10px] uppercase tracking-wider text-[var(--mute)] pb-2 pr-3">Date</th>
                  <th className="text-right font-mono text-[10px] uppercase tracking-wider text-[var(--mute)] pb-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {pendingApprovals.map((a) => (
                  <tr key={a.id} className="border-b border-[var(--hairline)] last:border-0 hover:bg-[var(--canvas-soft)] transition-colors">
                    <td className="py-2.5 pr-3 font-medium text-[var(--ink)]">{a.project?.name || "\u2014"}</td>
                    <td className="py-2.5 pr-3">
                      <span className={statusPillClass(a.type)}>
                        {a.type.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3 text-right font-mono text-xs tabular-nums">${fmtMoney(a.amount)}</td>
                    <td className="py-2.5 pr-3 text-xs text-[var(--mute)]">{a.requester?.name || "\u2014"}</td>
                    <td className="py-2.5 pr-3 font-mono text-[10px] text-[var(--mute)] tabular-nums">
                      {new Date(a.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                    </td>
                    <td className="py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleReview(a.id, "Approved")}
                          className="px-3 py-1 bg-[var(--success)] text-[var(--on-primary)] rounded-[var(--radius-xs)] text-xs font-medium hover:bg-[var(--link-deep)] transition-colors"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleReview(a.id, "Rejected")}
                          className="px-3 py-1 bg-[var(--error)] text-[var(--on-primary)] rounded-[var(--radius-xs)] text-xs font-medium hover:bg-[var(--error-deep)] transition-colors"
                        >
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
