"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { toast } from "react-hot-toast";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area,
} from "recharts";
import {
  FileText, PieChart as PieChartIcon, BarChart3, Wallet, Activity, Shield, Table, Download, Filter, X,
} from "lucide-react";
import { fmtMoney, fmtNum, fmtDateTime, statusPillClass, riskClass } from "@/lib/utils";
import Modal from "@/components/Modal";

type ReportType =
  | "project-summary"
  | "budget-summary"
  | "performance"
  | "audit"
  | "risk"
  | "expense";

interface ReportCardDef {
  type: ReportType;
  icon: React.ReactNode;
  title: string;
  description: string;
}

const REPORT_CARDS: ReportCardDef[] = [
  { type: "project-summary", icon: <BarChart3 size={22} />, title: "Project Summary", description: "Budget vs actual spend across all projects" },
  { type: "budget-summary", icon: <Wallet size={22} />, title: "Budget Summary", description: "Budget KPIs and usage by department" },
  { type: "performance", icon: <Activity size={22} />, title: "Performance", description: "Spending trends and status distribution" },
  { type: "audit", icon: <Shield size={22} />, title: "Audit Trail", description: "Recent audit log entries" },
  { type: "risk", icon: <FileText size={22} />, title: "Risk Register", description: "Risk severity matrix and status" },
  { type: "expense", icon: <PieChartIcon size={22} />, title: "Expense Analysis", description: "Expenses by category and monthly trend" },
];

const PIE_COLORS = ["#eb1600", "#1b3139", "#143d4a", "#1b5162", "#90a5b1", "#c4ccd6", "#618794"];

interface FilterState {
  department: string;
  year: string;
  quarter: string;
  projectId: string;
}

const initialFilters: FilterState = { department: "", year: "", quarter: "", projectId: "" };

type FieldKey = string;

const FIELD_OPTIONS: Record<ReportType, { key: FieldKey; label: string }[]> = {
  "project-summary": [
    { key: "code", label: "Project Code" },
    { key: "name", label: "Project Name" },
    { key: "department", label: "Department" },
    { key: "budget", label: "Budget" },
    { key: "actualSpend", label: "Actual Spend" },
    { key: "usagePercent", label: "Usage %" },
  ],
  "budget-summary": [
    { key: "code", label: "Project Code" },
    { key: "name", label: "Project Name" },
    { key: "budget", label: "Total Budget" },
    { key: "capitalBudget", label: "Capital Budget" },
    { key: "operatingBudget", label: "Operating Budget" },
    { key: "personnelBudget", label: "Personnel Budget" },
    { key: "procurementBudget", label: "Procurement Budget" },
    { key: "travelBudget", label: "Travel Budget" },
    { key: "reserveBudget", label: "Reserve Budget" },
    { key: "actualSpend", label: "Actual Spend" },
    { key: "usagePercent", label: "Usage %" },
  ],
  "performance": [
    { key: "code", label: "Project Code" },
    { key: "name", label: "Project Name" },
    { key: "status", label: "Status" },
    { key: "progress", label: "Progress" },
    { key: "healthScore", label: "Health Score" },
  ],
  "audit": [
    { key: "timestamp", label: "Timestamp" },
    { key: "user", label: "User" },
    { key: "action", label: "Action" },
    { key: "field", label: "Field" },
    { key: "oldValue", label: "Old Value" },
    { key: "newValue", label: "New Value" },
    { key: "comment", label: "Comment" },
  ],
  "risk": [
    { key: "description", label: "Description" },
    { key: "severity", label: "Severity" },
    { key: "impact", label: "Impact" },
    { key: "probability", label: "Probability" },
    { key: "status", label: "Status" },
    { key: "projectName", label: "Project" },
  ],
  "expense": [
    { key: "description", label: "Description" },
    { key: "category", label: "Category" },
    { key: "amountInclTax", label: "Amount" },
    { key: "date", label: "Date" },
    { key: "vendor", label: "Vendor" },
    { key: "projectName", label: "Project" },
    { key: "approvalStatus", label: "Approval Status" },
  ],
};

// API response types
interface StatusCount { status: string; _count: number }
interface DeptCount { department: string; _count: number }
interface ProjectSummaryData { total: number; byStatus: StatusCount[]; byDepartment: DeptCount[] }
interface BudgetItem {
  id: string; code: string; name: string; budget: number;
  capitalBudget: number; operatingBudget: number; personnelBudget: number;
  procurementBudget: number; travelBudget: number; reserveBudget: number;
  actualSpend: number; usagePercent: number;
}
interface PerfProject { id: string; code: string; name: string; progress: number; healthScore: number; status: string }
interface AuditEntry { id: string; timestamp: string; user: { id: string; name: string } | null; action: string; field: string | null; oldValue: string | null; newValue: string | null; comment: string | null }
interface SeverityCount { severity: string; _count: number }
interface ProjectRisk { project: { id: string; code: string; name: string } | null; count: number }
interface RiskData { total: number; bySeverity: SeverityCount[]; byStatus: StatusCount[]; byProject: ProjectRisk[] }
interface ExpCategory { category: string | null; _sum: { amountInclTax: number | null } }
interface ExpenseEntry { description: string | null; category: string | null; amountInclTax: number; date: string | null; vendor: string | null; project: { id: string; code: string; name: string } | null; approvalStatus: string }
interface ExpenseData { total: number; byCategory: ExpCategory[]; byStatus: { approvalStatus: string; _count: number }[]; expenses: ExpenseEntry[] }

export default function ReportsPage() {
  const [activeType, setActiveType] = useState<ReportType | null>(null);
  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const [showBuilder, setShowBuilder] = useState(false);
  const [selectedFields, setSelectedFields] = useState<Record<ReportType, Set<FieldKey>>>(() => {
    const init: Record<string, Set<FieldKey>> = {};
    for (const card of REPORT_CARDS) {
      init[card.type] = new Set(FIELD_OPTIONS[card.type].map((f) => f.key));
    }
    return init as Record<ReportType, Set<FieldKey>>;
  });
  const [projects, setProjects] = useState<{ id: string; code: string; name: string; department: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);

  const [summaryData, setSummaryData] = useState<ProjectSummaryData | null>(null);
  const [budgetData, setBudgetData] = useState<BudgetItem[]>([]);
  const [perfData, setPerfData] = useState<PerfProject[]>([]);
  const [auditData, setAuditData] = useState<AuditEntry[]>([]);
  const [riskData, setRiskData] = useState<RiskData | null>(null);
  const [expenseData, setExpenseData] = useState<ExpenseData | null>(null);

  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.ok ? r.json() : [])
      .then((data) => setProjects(data))
      .catch(() => {});
  }, []);

  const fetchReport = useCallback(async (type: ReportType) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ type });
      if (filters.projectId) params.set("projectId", filters.projectId);

      const res = await fetch(`/api/reports?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();

      switch (type) {
        case "project-summary": setSummaryData(data); break;
        case "budget-summary": setBudgetData(data); break;
        case "performance": setPerfData(data); break;
        case "audit": setAuditData(data); break;
        case "risk": setRiskData(data); break;
        case "expense": setExpenseData(data); break;
      }
    } catch {
      toast.error("Failed to load report data");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    if (activeType) fetchReport(activeType);
  }, [activeType, fetchReport]);

  const departments = useMemo(() => {
    const deps = new Set(projects.map((p) => p.department));
    return Array.from(deps).sort();
  }, [projects]);

  const activeFields = activeType ? selectedFields[activeType] ?? new Set() : new Set();
  const fieldOpts = activeType ? FIELD_OPTIONS[activeType] : [];

  function toggleField(type: ReportType, key: FieldKey) {
    setSelectedFields((prev) => {
      const next = new Set(prev[type]);
      if (next.has(key)) next.delete(key); else next.add(key);
      return { ...prev, [type]: next };
    });
  }

  function selectAllFields(type: ReportType) {
    setSelectedFields((prev) => ({
      ...prev,
      [type]: new Set(FIELD_OPTIONS[type].map((f) => f.key)),
    }));
  }

  function clearFilters() {
    setFilters(initialFilters);
  }

  function hasFilters() {
    return Object.values(filters).some((v) => v !== "");
  }

  async function handleExportCSV() {
    if (!activeType) return;
    const rows = getExportRows(activeType);
    if (rows.length === 0) { toast.error("No data to export"); return; }
    const header = fieldOpts.filter((f) => activeFields.has(f.key)).map((f) => f.label).join(",");
    const csv = rows.map((r) => fieldOpts.filter((f) => activeFields.has(f.key)).map((k) => `"${String(r[k.key] ?? "")}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + header + "\n" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${activeType}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
    toast.success("CSV exported");
  }

  async function handleExportExcel() {
    if (!activeType) return;
    const rows = getExportRows(activeType);
    if (rows.length === 0) { toast.error("No data to export"); return; }
    const mapped = rows.map((r) => {
      const obj: Record<string, unknown> = {};
      fieldOpts.filter((f) => activeFields.has(f.key)).forEach((f) => { obj[f.label] = r[f.key]; });
      return obj;
    });
    const ws = XLSX.utils.json_to_sheet(mapped);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, activeType ?? "Report");
    XLSX.writeFile(wb, `${activeType}-${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success("Excel exported");
  }

  async function handleExportPDF() {
    if (!reportRef.current) return;
    setShowExportModal(false);
    toast.loading("Generating PDF...");
    try {
      const canvas = await html2canvas(reportRef.current, { scale: 2, backgroundColor: "#ffffff" });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfW = pdf.internal.pageSize.getWidth();
      const pdfH = (canvas.height * pdfW) / canvas.width;
      let heightLeft = pdfH;
      let position = 0;
      const pageHeight = pdf.internal.pageSize.getHeight();
      pdf.addImage(imgData, "PNG", 0, position, pdfW, pdfH);
      heightLeft -= pageHeight;
      while (heightLeft > 0) {
        position -= pageHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, pdfW, pdfH);
        heightLeft -= pageHeight;
      }
      pdf.save(`${activeType}-${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.dismiss();
      toast.success("PDF exported");
    } catch {
      toast.dismiss();
      toast.error("PDF generation failed");
    }
  }

  function getExportRows(type: ReportType): Record<string, unknown>[] {
    switch (type) {
      case "project-summary": {
        if (!summaryData) return [];
        const rows: Record<string, unknown>[] = summaryData.byStatus.map((s) => ({ status: s.status, count: s._count }));
        summaryData.byDepartment.forEach((d) => rows.push({ status: `Dept: ${d.department}`, count: d._count }));
        return rows;
      }
      case "budget-summary": return budgetData as unknown as Record<string, unknown>[];
      case "performance": return perfData.map((p) => ({
        code: p.code, name: p.name, status: p.status, progress: `${p.progress}%`, healthScore: p.healthScore,
      }));
      case "audit": return auditData.map((a) => ({
        timestamp: fmtDateTime(a.timestamp),
        user: a.user?.name ?? "",
        action: a.action,
        field: a.field ?? "",
        oldValue: a.oldValue ?? "",
        newValue: a.newValue ?? "",
        comment: a.comment ?? "",
      }));
      case "risk": {
        if (!riskData) return [];
        const rows: Record<string, unknown>[] = [];
        riskData.bySeverity.forEach((s) => rows.push({ severity: s.severity, count: s._count }));
        riskData.byProject.forEach((p) => rows.push({ projectName: p.project?.name ?? "", count: p.count }));
        return rows;
      }
      case "expense": {
        if (!expenseData) return [];
        return expenseData.expenses.map((e) => ({
          description: e.description ?? "",
          category: e.category ?? "",
          amountInclTax: e.amountInclTax,
          date: e.date ? new Date(e.date).toLocaleDateString("en-GB") : "",
          vendor: e.vendor ?? "",
          projectName: e.project?.name ?? "",
          approvalStatus: e.approvalStatus,
        }));
      }
      default: return [];
    }
  }

  function renderReportContent() {
    if (!activeType) return null;

    return (
      <div ref={reportRef} className="bg-white rounded-[var(--radius-lg)] border border-[var(--hairline)] p-6">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="font-mono text-xs text-[var(--mute)] uppercase tracking-wider">Loading...</div>
          </div>
        ) : (
          <>
            {activeType === "project-summary" && renderProjectSummary()}
            {activeType === "budget-summary" && renderBudgetSummary()}
            {activeType === "performance" && renderPerformance()}
            {activeType === "audit" && renderAudit()}
            {activeType === "risk" && renderRisk()}
            {activeType === "expense" && renderExpense()}
          </>
        )}
      </div>
    );
  }

  function renderProjectSummary() {
    const data = summaryData;
    if (!data) return <div className="py-12 text-center text-xs text-[var(--mute)]">No data available</div>;

    const statusDist = data.byStatus.map((s) => ({
      name: s.status.replace(/_/g, " "), value: s._count,
    }));
    const deptDist = data.byDepartment.map((d) => ({
      name: d.department, value: d._count,
    }));

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-[var(--canvas-soft)] rounded-[var(--radius-md)] p-4 text-center">
            <div className="font-mono text-[10px] uppercase tracking-wider text-[var(--mute)]">Total Projects</div>
            <div className="text-2xl font-semibold text-[var(--ink)] mt-1">{fmtNum(data.total)}</div>
          </div>
          <div className="bg-[var(--canvas-soft)] rounded-[var(--radius-md)] p-4 text-center">
            <div className="font-mono text-[10px] uppercase tracking-wider text-[var(--mute)]">Statuses</div>
            <div className="text-2xl font-semibold text-[var(--ink)] mt-1">{data.byStatus.length}</div>
          </div>
          <div className="bg-[var(--canvas-soft)] rounded-[var(--radius-md)] p-4 text-center">
            <div className="font-mono text-[10px] uppercase tracking-wider text-[var(--mute)]">Departments</div>
            <div className="text-2xl font-semibold text-[var(--ink)] mt-1">{data.byDepartment.length}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div>
            <h3 className="text-sm font-semibold text-[var(--ink)] mb-3">Projects by Status</h3>
            {statusDist.length === 0 ? (
              <div className="flex items-center justify-center h-48 text-xs text-[var(--mute)]">No data</div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={statusDist} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} innerRadius={50} label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`} labelLine={false}>
                    {statusDist.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "#fff", border: "1px solid var(--hairline)", borderRadius: 6, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[var(--ink)] mb-3">Projects by Department</h3>
            {deptDist.length === 0 ? (
              <div className="flex items-center justify-center h-48 text-xs text-[var(--mute)]">No data</div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={deptDist} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--hairline)" />
                  <XAxis type="number" tick={{ fontSize: 10, fill: "var(--mute)" }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "var(--mute)" }} width={130} />
                  <Tooltip contentStyle={{ background: "#fff", border: "1px solid var(--hairline)", borderRadius: 6, fontSize: 12 }} />
                  <Bar dataKey="value" name="Projects" radius={[0, 2, 2, 0]} fill="var(--canvas-soft-2)" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    );
  }

  function renderBudgetSummary() {
    if (budgetData.length === 0) return <div className="py-12 text-center text-xs text-[var(--mute)]">No data available</div>;

    const totalBudget = budgetData.reduce((s, p) => s + p.budget, 0);
    const totalActual = budgetData.reduce((s, p) => s + p.actualSpend, 0);
    const totalUsage = totalBudget > 0 ? Math.round((totalActual / totalBudget) * 100) : 0;
    const overLimit = budgetData.filter((p) => p.usagePercent >= 100).length;
    const top10 = [...budgetData].sort((a, b) => b.budget - a.budget).slice(0, 10);

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-[var(--canvas-soft)] rounded-[var(--radius-md)] p-4 text-center">
            <div className="font-mono text-[10px] uppercase tracking-wider text-[var(--mute)]">Total Budget</div>
            <div className="text-xl font-semibold text-[var(--ink)] mt-1">${fmtMoney(totalBudget)}</div>
          </div>
          <div className="bg-[var(--canvas-soft)] rounded-[var(--radius-md)] p-4 text-center">
            <div className="font-mono text-[10px] uppercase tracking-wider text-[var(--mute)]">Actual Spend</div>
            <div className="text-xl font-semibold text-[var(--ink)] mt-1">${fmtMoney(totalActual)}</div>
          </div>
          <div className="bg-[var(--canvas-soft)] rounded-[var(--radius-md)] p-4 text-center">
            <div className="font-mono text-[10px] uppercase tracking-wider text-[var(--mute)]">Usage</div>
            <div className={`text-xl font-semibold mt-1 ${totalUsage >= 90 ? "text-[var(--primary)]" : "text-[var(--ink)]"}`}>{totalUsage}%</div>
          </div>
          <div className="bg-[var(--canvas-soft)] rounded-[var(--radius-md)] p-4 text-center">
            <div className="font-mono text-[10px] uppercase tracking-wider text-[var(--mute)]">Over Budget</div>
            <div className={`text-xl font-semibold mt-1 ${overLimit > 0 ? "text-[var(--primary)]" : "text-[var(--ink)]"}`}>{fmtNum(overLimit)}</div>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-[var(--ink)] mb-3">Budget vs Actual (Top 10)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={top10}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--hairline)" />
              <XAxis dataKey="code" tick={{ fontSize: 10, fill: "var(--mute)" }} />
              <YAxis tick={{ fontSize: 10, fill: "var(--mute)" }} />
              <Tooltip contentStyle={{ background: "#fff", border: "1px solid var(--hairline)", borderRadius: 6, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="budget" name="Budget" fill="var(--canvas-soft-2)" radius={[2, 2, 0, 0]} />
              <Bar dataKey="actualSpend" name="Actual" fill="var(--primary)" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-[var(--ink)] mb-3">Budget Usage by Project</h3>
          <div className="space-y-2">
            {budgetData.slice(0, 20).map((p) => (
              <div key={p.id} className="flex items-center gap-3">
                <div className="w-24 font-mono text-[10px] text-[var(--mute)] truncate shrink-0">{p.code}</div>
                <div className="flex-1">
                  <div className="flex items-center justify-between text-xs mb-0.5">
                    <span className="font-medium text-[var(--ink)] truncate max-w-[200px]">{p.name}</span>
                    <span className={`font-mono tabular-nums ${p.usagePercent >= 100 ? "text-[var(--primary)]" : p.usagePercent >= 90 ? "text-orange-600" : "text-[var(--mute)]"}`}>{p.usagePercent}%</span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${Math.min(p.usagePercent, 100)}%`, backgroundColor: p.usagePercent >= 100 ? "var(--primary)" : p.usagePercent >= 90 ? "#f59e0b" : "var(--canvas-soft-2)" }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  function renderPerformance() {
    if (perfData.length === 0) return <div className="py-12 text-center text-xs text-[var(--mute)]">No data available</div>;

    const statusDist = perfData.reduce<Record<string, number>>((acc, p) => {
      const key = p.status.replace(/_/g, " ");
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    const pieData = Object.entries(statusDist).map(([name, value]) => ({ name, value }));

    const healthAvg = Math.round(perfData.reduce((s, p) => s + p.healthScore, 0) / perfData.length);
    const progressAvg = Math.round(perfData.reduce((s, p) => s + p.progress, 0) / perfData.length);

    const mockMonthly = [
      { month: "Jan", spend: 12000 }, { month: "Feb", spend: 18500 }, { month: "Mar", spend: 15200 },
      { month: "Apr", spend: 22100 }, { month: "May", spend: 19800 }, { month: "Jun", spend: 26500 },
      { month: "Jul", spend: 24200 }, { month: "Aug", spend: 28100 }, { month: "Sep", spend: 23400 },
      { month: "Oct", spend: 31200 }, { month: "Nov", spend: 27800 }, { month: "Dec", spend: 35400 },
    ];

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-[var(--canvas-soft)] rounded-[var(--radius-md)] p-4 text-center">
            <div className="font-mono text-[10px] uppercase tracking-wider text-[var(--mute)]">Avg Health Score</div>
            <div className="text-xl font-semibold text-[var(--ink)] mt-1">{healthAvg}</div>
          </div>
          <div className="bg-[var(--canvas-soft)] rounded-[var(--radius-md)] p-4 text-center">
            <div className="font-mono text-[10px] uppercase tracking-wider text-[var(--mute)]">Avg Progress</div>
            <div className="text-xl font-semibold text-[var(--ink)] mt-1">{progressAvg}%</div>
          </div>
          <div className="bg-[var(--canvas-soft)] rounded-[var(--radius-md)] p-4 text-center">
            <div className="font-mono text-[10px] uppercase tracking-wider text-[var(--mute)]">Projects</div>
            <div className="text-xl font-semibold text-[var(--ink)] mt-1">{fmtNum(perfData.length)}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div>
            <h3 className="text-sm font-semibold text-[var(--ink)] mb-3">Spending Trend</h3>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={mockMonthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--hairline)" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: "var(--mute)" }} />
                <YAxis tick={{ fontSize: 10, fill: "var(--mute)" }} />
                <Tooltip contentStyle={{ background: "#fff", border: "1px solid var(--hairline)", borderRadius: 6, fontSize: 12 }} formatter={(v: unknown) => `$${fmtMoney(v as number)}`} />
                <Area type="monotone" dataKey="spend" name="Spend" stroke="var(--primary)" fill="var(--primary)" fillOpacity={0.1} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[var(--ink)] mb-3">Status Distribution</h3>
            {pieData.length === 0 ? (
              <div className="flex items-center justify-center h-48 text-xs text-[var(--mute)]">No data</div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} innerRadius={50} label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`} labelLine={false}>
                    {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "#fff", border: "1px solid var(--hairline)", borderRadius: 6, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    );
  }

  function renderAudit() {
    if (auditData.length === 0) return <div className="py-12 text-center text-xs text-[var(--mute)]">No audit log entries</div>;
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--hairline)]">
              <th className="text-left font-mono text-[10px] uppercase tracking-wider text-[var(--mute)] pb-2 pr-3">Timestamp</th>
              <th className="text-left font-mono text-[10px] uppercase tracking-wider text-[var(--mute)] pb-2 pr-3">User</th>
              <th className="text-left font-mono text-[10px] uppercase tracking-wider text-[var(--mute)] pb-2 pr-3">Action</th>
              <th className="text-left font-mono text-[10px] uppercase tracking-wider text-[var(--mute)] pb-2 pr-3">Field</th>
              <th className="text-left font-mono text-[10px] uppercase tracking-wider text-[var(--mute)] pb-2">Details</th>
            </tr>
          </thead>
          <tbody>
            {auditData.slice(0, 100).map((log) => (
              <tr key={log.id} className="border-b border-[var(--hairline)] last:border-0 hover:bg-[var(--canvas-soft)] transition-colors">
                <td className="py-2.5 pr-3 font-mono text-[10px] text-[var(--mute)] tabular-nums whitespace-nowrap">
                  {fmtDateTime(log.timestamp)}
                </td>
                <td className="py-2.5 pr-3 text-xs font-medium text-[var(--ink)]">{log.user?.name ?? "\u2014"}</td>
                <td className="py-2.5 pr-3">
                  <span className={statusPillClass(log.action)}>{log.action.replace(/_/g, " ")}</span>
                </td>
                <td className="py-2.5 pr-3 font-mono text-[10px] text-[var(--mute)]">{log.field ?? "\u2014"}</td>
                <td className="py-2.5 text-xs text-[var(--mute)] max-w-xs truncate">
                  {log.comment || [log.oldValue, log.newValue].filter(Boolean).join(" \u2192 ") || "\u2014"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {auditData.length > 100 && (
          <div className="text-center pt-3 font-mono text-[10px] text-[var(--mute)]">Showing 100 of {auditData.length} entries</div>
        )}
      </div>
    );
  }

  function renderRisk() {
    if (!riskData) return <div className="py-12 text-center text-xs text-[var(--mute)]">No data available</div>;

    const severityOrder = ["Critical", "High", "Medium", "Low"];
    const severityData = severityOrder.map((s) => ({
      severity: s,
      count: riskData.bySeverity.find((b) => b.severity === s)?._count ?? 0,
    }));

    const totalBySeverity = severityData.reduce((s, d) => s + d.count, 0);

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-[var(--canvas-soft)] rounded-[var(--radius-md)] p-4 text-center">
            <div className="font-mono text-[10px] uppercase tracking-wider text-[var(--mute)]">Total Risks</div>
            <div className="text-xl font-semibold text-[var(--ink)] mt-1">{fmtNum(riskData.total)}</div>
          </div>
          <div className="bg-[var(--canvas-soft)] rounded-[var(--radius-md)] p-4 text-center">
            <div className="font-mono text-[10px] uppercase tracking-wider text-[var(--mute)]">Open</div>
            <div className="text-xl font-semibold text-[var(--ink)] mt-1">{fmtNum(riskData.byStatus.find((b) => b.status === "Open")?._count ?? 0)}</div>
          </div>
          <div className="bg-[var(--canvas-soft)] rounded-[var(--radius-md)] p-4 text-center">
            <div className="font-mono text-[10px] uppercase tracking-wider text-[var(--mute)]">Projects Affected</div>
            <div className="text-xl font-semibold text-[var(--ink)] mt-1">{fmtNum(riskData.byProject.length)}</div>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-[var(--ink)] mb-3">Severity Matrix</h3>
          <div className="grid grid-cols-4 gap-3">
            {severityData.map((d) => {
              const barW = totalBySeverity > 0 ? (d.count / totalBySeverity) * 100 : 0;
              return (
                <div key={d.severity} className="bg-[var(--canvas-soft)] rounded-[var(--radius-md)] p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-xs font-semibold ${riskClass(d.severity)}`}>{d.severity}</span>
                    <span className="font-mono text-lg font-semibold text-[var(--ink)]">{d.count}</span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${barW}%`, backgroundColor: d.severity === "Critical" ? "var(--primary)" : d.severity === "High" ? "#f59e0b" : d.severity === "Medium" ? "#06b6d4" : "var(--mute)" }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-[var(--ink)] mb-3">Risks by Project</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--hairline)]">
                  <th className="text-left font-mono text-[10px] uppercase tracking-wider text-[var(--mute)] pb-2 pr-3">Project</th>
                  <th className="text-right font-mono text-[10px] uppercase tracking-wider text-[var(--mute)] pb-2">Count</th>
                </tr>
              </thead>
              <tbody>
                {riskData.byProject.slice(0, 30).map((r) => (
                  <tr key={r.project?.id ?? r.project?.code ?? ""} className="border-b border-[var(--hairline)] last:border-0 hover:bg-[var(--canvas-soft)] transition-colors">
                    <td className="py-2 pr-3 text-sm font-medium text-[var(--ink)]">{r.project?.name ?? "\u2014"}</td>
                    <td className="py-2 text-right font-mono text-xs tabular-nums">{r.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  function renderExpense() {
    if (!expenseData) return <div className="py-12 text-center text-xs text-[var(--mute)]">No data available</div>;

    const catData = expenseData.byCategory.map((c) => ({
      category: c.category ?? "Uncategorized",
      amount: c._sum.amountInclTax ?? 0,
    })).sort((a, b) => b.amount - a.amount);

    const mockMonthly = [
      { month: "Jan", amount: 8500 }, { month: "Feb", amount: 12300 }, { month: "Mar", amount: 10200 },
      { month: "Apr", amount: 16100 }, { month: "May", amount: 14400 }, { month: "Jun", amount: 19800 },
    ];

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-[var(--canvas-soft)] rounded-[var(--radius-md)] p-4 text-center">
            <div className="font-mono text-[10px] uppercase tracking-wider text-[var(--mute)]">Total Spend</div>
            <div className="text-xl font-semibold text-[var(--ink)] mt-1">${fmtMoney(expenseData.total)}</div>
          </div>
          <div className="bg-[var(--canvas-soft)] rounded-[var(--radius-md)] p-4 text-center">
            <div className="font-mono text-[10px] uppercase tracking-wider text-[var(--mute)]">Categories</div>
            <div className="text-xl font-semibold text-[var(--ink)] mt-1">{catData.length}</div>
          </div>
          <div className="bg-[var(--canvas-soft)] rounded-[var(--radius-md)] p-4 text-center">
            <div className="font-mono text-[10px] uppercase tracking-wider text-[var(--mute)]">Transactions</div>
            <div className="text-xl font-semibold text-[var(--ink)] mt-1">{fmtNum(expenseData.expenses.length)}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div>
            <h3 className="text-sm font-semibold text-[var(--ink)] mb-3">Expenses by Category</h3>
            {catData.length === 0 ? (
              <div className="flex items-center justify-center h-48 text-xs text-[var(--mute)]">No data</div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={catData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--hairline)" />
                  <XAxis type="number" tick={{ fontSize: 10, fill: "var(--mute)" }} />
                  <YAxis type="category" dataKey="category" tick={{ fontSize: 10, fill: "var(--mute)" }} width={120} />
                  <Tooltip contentStyle={{ background: "#fff", border: "1px solid var(--hairline)", borderRadius: 6, fontSize: 12 }} formatter={(v: unknown) => `$${fmtMoney(v as number)}`} />
                  <Bar dataKey="amount" name="Amount" radius={[0, 2, 2, 0]} fill="var(--canvas-soft-2)" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[var(--ink)] mb-3">Monthly Trend</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={mockMonthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--hairline)" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: "var(--mute)" }} />
                <YAxis tick={{ fontSize: 10, fill: "var(--mute)" }} />
                <Tooltip contentStyle={{ background: "#fff", border: "1px solid var(--hairline)", borderRadius: 6, fontSize: 12 }} formatter={(v: unknown) => `$${fmtMoney(v as number)}`} />
                <Line type="monotone" dataKey="amount" name="Spend" stroke="var(--primary)" strokeWidth={2} dot={{ fill: "var(--primary)" }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--ink)] tracking-tight">Reports & Analytics</h1>
          <p className="text-sm text-[var(--mute)] mt-0.5 font-mono">
            Comprehensive project intelligence and reporting
          </p>
        </div>
      </div>

      {/* Report Type Cards Grid */}
      {!activeType && (
        <div className="grid grid-cols-3 gap-4">
          {REPORT_CARDS.map((card) => (
            <button
              key={card.type}
              onClick={() => { setActiveType(card.type); setFilters(initialFilters); }}
              className="bg-white rounded-[var(--radius-lg)] border border-[var(--hairline)] p-5 text-left hover:border-[var(--primary)] hover:shadow-sm transition-all group"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="text-[var(--canvas-soft-2)] group-hover:text-[var(--primary)] transition-colors">
                  {card.icon}
                </div>
                <div className="font-mono text-[10px] uppercase tracking-wider text-[var(--mute)]">Report</div>
              </div>
              <h3 className="text-base font-semibold text-[var(--ink)] mb-1">{card.title}</h3>
              <p className="text-xs text-[var(--mute)] mb-4 leading-relaxed">{card.description}</p>
              <div className="inline-flex items-center gap-1.5 bg-[var(--primary)] text-white px-4 py-1.5 rounded-[var(--radius-md)] text-xs font-medium group-hover:bg-[var(--primary-hover)] transition-colors">
                <FileText size={14} />
                Generate
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Active Report Area */}
      {activeType && (
        <div className="space-y-4">
          {/* Report Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => { setActiveType(null); setFilters(initialFilters); }}
                className="p-1.5 rounded-[var(--radius-xs)] text-[var(--mute)] hover:text-[var(--ink)] hover:bg-[var(--canvas-soft)] transition-colors"
              >
                <X size={18} />
              </button>
              <div>
                <h2 className="text-base font-semibold text-[var(--ink)]">
                  {REPORT_CARDS.find((c) => c.type === activeType)?.title}
                </h2>
                <p className="font-mono text-[10px] uppercase tracking-wider text-[var(--mute)] mt-0.5">
                  {REPORT_CARDS.find((c) => c.type === activeType)?.description}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowBuilder(!showBuilder)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-md)] text-xs font-medium border transition-colors ${
                  showBuilder
                    ? "bg-[var(--primary)] text-white border-[var(--primary)]"
                    : "bg-white text-[var(--ink)] border-[var(--hairline)] hover:bg-[var(--canvas-soft)]"
                }`}
              >
                <Table size={14} />
                Fields
              </button>
              <button
                onClick={() => setShowExportModal(true)}
                className="flex items-center gap-1.5 bg-[var(--primary)] text-white px-4 py-1.5 rounded-[var(--radius-md)] text-xs font-medium hover:bg-[var(--primary-hover)] transition-colors"
              >
                <Download size={14} />
                Export
              </button>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="flex flex-wrap items-center gap-3 bg-white rounded-[var(--radius-lg)] border border-[var(--hairline)] px-4 py-3">
            <Filter size={15} className="text-[var(--mute)] shrink-0" />
            <select
              value={filters.department}
              onChange={(e) => setFilters((f) => ({ ...f, department: e.target.value }))}
              className="px-2.5 py-1.5 border border-[var(--hairline)] rounded-[var(--radius-xs)] text-xs text-[var(--ink)] bg-white outline-none focus:border-[var(--primary)]"
            >
              <option value="">All Departments</option>
              {departments.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
            <select
              value={filters.year}
              onChange={(e) => setFilters((f) => ({ ...f, year: e.target.value }))}
              className="px-2.5 py-1.5 border border-[var(--hairline)] rounded-[var(--radius-xs)] text-xs text-[var(--ink)] bg-white outline-none focus:border-[var(--primary)]"
            >
              <option value="">All Years</option>
              {[2024, 2025, 2026, 2027].map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            <select
              value={filters.quarter}
              onChange={(e) => setFilters((f) => ({ ...f, quarter: e.target.value }))}
              className="px-2.5 py-1.5 border border-[var(--hairline)] rounded-[var(--radius-xs)] text-xs text-[var(--ink)] bg-white outline-none focus:border-[var(--primary)]"
            >
              <option value="">All Quarters</option>
              {["Q1", "Q2", "Q3", "Q4"].map((q) => <option key={q} value={q}>{q}</option>)}
            </select>
            <select
              value={filters.projectId}
              onChange={(e) => setFilters((f) => ({ ...f, projectId: e.target.value }))}
              className="px-2.5 py-1.5 border border-[var(--hairline)] rounded-[var(--radius-xs)] text-xs text-[var(--ink)] bg-white outline-none focus:border-[var(--primary)] min-w-[160px]"
            >
              <option value="">All Projects</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.code} - {p.name}</option>)}
            </select>
            {hasFilters() && (
              <button onClick={clearFilters} className="text-xs text-[var(--link)] hover:underline font-medium ml-auto">
                Clear filters
              </button>
            )}
          </div>

          {/* Custom Report Builder */}
          {showBuilder && fieldOpts.length > 0 && (
            <div className="bg-white rounded-[var(--radius-lg)] border border-[var(--hairline)] p-4 animate-fade-in">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold text-[var(--ink)]">Custom Report Fields</h3>
                <button
                  onClick={() => selectAllFields(activeType!)}
                  className="text-[10px] font-mono text-[var(--link)] hover:underline"
                >
                  Select all
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {fieldOpts.map((f) => (
                  <label
                    key={f.key}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-xs)] border text-xs cursor-pointer transition-colors ${
                      activeFields.has(f.key)
                        ? "bg-[var(--primary)] text-white border-[var(--primary)]"
                        : "bg-white text-[var(--mute)] border-[var(--hairline)] hover:border-[var(--mute)]"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={activeFields.has(f.key)}
                      onChange={() => toggleField(activeType!, f.key)}
                      className="sr-only"
                    />
                    {f.label}
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Report Content */}
          {renderReportContent()}
        </div>
      )}

      {/* Export Modal */}
      <Modal isOpen={showExportModal} onClose={() => setShowExportModal(false)} title="Export Report">
        <div className="space-y-3">
          <p className="text-xs text-[var(--mute)]">Choose export format for the current report.</p>
          <button
            onClick={() => { setShowExportModal(false); handleExportCSV(); }}
            className="w-full flex items-center justify-between px-4 py-3 rounded-[var(--radius-md)] border border-[var(--hairline)] hover:bg-[var(--canvas-soft)] transition-colors text-left"
          >
            <div>
              <div className="text-sm font-medium text-[var(--ink)]">CSV</div>
              <div className="font-mono text-[10px] text-[var(--mute)]">Comma-separated values</div>
            </div>
            <Download size={16} className="text-[var(--mute)]" />
          </button>
          <button
            onClick={() => { setShowExportModal(false); handleExportExcel(); }}
            className="w-full flex items-center justify-between px-4 py-3 rounded-[var(--radius-md)] border border-[var(--hairline)] hover:bg-[var(--canvas-soft)] transition-colors text-left"
          >
            <div>
              <div className="text-sm font-medium text-[var(--ink)]">Excel (XLSX)</div>
              <div className="font-mono text-[10px] text-[var(--mute)]">Microsoft Excel workbook</div>
            </div>
            <Download size={16} className="text-[var(--mute)]" />
          </button>
          <button
            onClick={handleExportPDF}
            className="w-full flex items-center justify-between px-4 py-3 rounded-[var(--radius-md)] border border-[var(--hairline)] hover:bg-[var(--canvas-soft)] transition-colors text-left"
          >
            <div>
              <div className="text-sm font-medium text-[var(--ink)]">PDF</div>
              <div className="font-mono text-[10px] text-[var(--mute)]">Portable Document Format</div>
            </div>
            <Download size={16} className="text-[var(--mute)]" />
          </button>
        </div>
      </Modal>
    </div>
  );
}
